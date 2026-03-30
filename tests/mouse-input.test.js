import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MouseInput } from '../sync/mouse-input.js';

/**
 * Helper to create a PS/2 mouse packet.
 * @param {number} buttons - Bit flags: bit0=left, bit1=right, bit2=middle, bit4=signX, bit5=signY
 * @param {number} dx - Relative X movement
 * @param {number} dy - Relative Y movement
 * @returns {number[]}
 */
function ps2Packet(buttons, dx, dy) {
    let b0 = buttons & 0x07; // Only button bits
    // Set sign bits for negative values
    if (dx < 0) { b0 |= 0x10; dx += 256; }
    if (dy < 0) { dy += 256; b0 |= 0x20; }
    return [b0, dx & 0xFF, dy & 0xFF];
}

/**
 * Helper to create ImPS/2 (4-byte) packet with scroll wheel
 */
function imps2Packet(buttons, dx, dy, scroll) {
    const pkt = ps2Packet(buttons, dx, dy);
    // Handle scroll signed value
    let s = scroll;
    if (s < 0) s += 256;
    pkt.push(s & 0xFF);
    return pkt;
}

describe('MouseInput - construction', () => {
    it('initializes with defaults', () => {
        const mouse = new MouseInput();
        assert.strictEqual(mouse.x, 0);
        assert.strictEqual(mouse.y, 0);
        assert.strictEqual(mouse.width, 1920);
        assert.strictEqual(mouse.height, 1080);
        assert.strictEqual(mouse.leftButton, false);
        assert.strictEqual(mouse.rightButton, false);
        assert.strictEqual(mouse.middleButton, false);
        assert.strictEqual(mouse.scrollY, 0);
        assert.strictEqual(mouse.protocol, 'ps2');
    });

    it('accepts custom options', () => {
        const mouse = new MouseInput({
            device: '/dev/input/mouse0',
            startX: 100,
            startY: 200,
            width: 800,
            height: 600,
            protocol: 'imps2',
        });
        assert.strictEqual(mouse.x, 100);
        assert.strictEqual(mouse.y, 200);
        assert.strictEqual(mouse.width, 800);
        assert.strictEqual(mouse.height, 600);
        assert.strictEqual(mouse.protocol, 'imps2');
    });
});

describe('MouseInput - PS/2 packet parsing', () => {
    let mouse, events;

    beforeEach(() => {
        mouse = new MouseInput({ width: 100, height: 100 });
        events = [];
        mouse.on('move', (e) => events.push({ type: 'move', ...e }));
        mouse.on('mousedown', (e) => events.push({ type: 'mousedown', ...e }));
        mouse.on('mouseup', (e) => events.push({ type: 'mouseup', ...e }));
        mouse.on('click', (e) => events.push({ type: 'click', ...e }));
    });

    it('parses positive X movement', () => {
        mouse.feedPacket(ps2Packet(0, 10, 0));
        assert.strictEqual(mouse.x, 10);
        assert.strictEqual(mouse.y, 0);
    });

    it('parses positive Y movement (positive dy from mouse = screen y decreases)', () => {
        mouse.y = 50;
        mouse.feedPacket(ps2Packet(0, 0, 5));
        // dy=5 from mouse: this.y - 5 = 45
        assert.strictEqual(mouse.y, 45);
    });

    it('parses negative X movement', () => {
        mouse.x = 50;
        mouse.feedPacket(ps2Packet(0, -10, 0));
        assert.strictEqual(mouse.x, 40);
    });

    it('parses negative Y movement (negative dy from mouse = screen y increases)', () => {
        mouse.y = 50;
        mouse.feedPacket(ps2Packet(0, 0, -5));
        // dy=-5 from mouse: this.y - (-5) = 55
        assert.strictEqual(mouse.y, 55);
    });

    it('clamps position to screen bounds', () => {
        mouse.x = 5;
        mouse.feedPacket(ps2Packet(0, -20, 0));
        assert.strictEqual(mouse.x, 0);

        mouse.feedPacket(ps2Packet(0, 200, 0));
        assert.strictEqual(mouse.x, 99); // width - 1
    });

    it('clamps Y to screen bounds', () => {
        mouse.y = 5;
        // dy=200 from mouse (physical down): this.y - 200 = 5-200 = -195, clamped to 0
        mouse.feedPacket(ps2Packet(0, 0, 200));
        assert.strictEqual(mouse.y, 0);

        mouse.y = 50;
        // dy=-200 from mouse (physical up): this.y - (-200) = 50+200 = 250, clamped to 99
        mouse.feedPacket(ps2Packet(0, 0, -200));
        assert.strictEqual(mouse.y, 99);
    });

    it('emits move event with correct coordinates', () => {
        mouse.feedPacket(ps2Packet(0, 5, -3));
        // dx=5, dy=-3 from mouse: x=5, y = 0-(-3) = 3
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'move');
        assert.strictEqual(events[0].x, 5);
        assert.strictEqual(events[0].y, 3);
        assert.strictEqual(events[0].dx, 5);
    });

    it('does not emit move when position unchanged', () => {
        mouse.feedPacket(ps2Packet(0, 0, 0));
        assert.strictEqual(events.length, 0);
    });

    it('emits mousedown on left button press', () => {
        mouse.feedPacket(ps2Packet(1, 0, 0)); // left=1
        assert.strictEqual(mouse.leftButton, true);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'mousedown');
        assert.strictEqual(events[0].button, 'left');
    });

    it('emits mouseup and click on left button release', () => {
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press
        mouse.feedPacket(ps2Packet(0, 0, 0)); // release
        assert.strictEqual(mouse.leftButton, false);
        assert.strictEqual(events.length, 3);
        assert.strictEqual(events[1].type, 'mouseup');
        assert.strictEqual(events[2].type, 'click');
    });

    it('emits mousedown/mouseup for right button', () => {
        mouse.feedPacket(ps2Packet(2, 0, 0)); // right=2
        assert.strictEqual(mouse.rightButton, true);
        assert.strictEqual(events[0].type, 'mousedown');
        assert.strictEqual(events[0].button, 'right');

        mouse.feedPacket(ps2Packet(0, 0, 0)); // release
        assert.strictEqual(mouse.rightButton, false);
    });

    it('emits rightclick on right button release', () => {
        const rc = [];
        mouse.on('rightclick', (e) => rc.push(e));
        mouse.feedPacket(ps2Packet(2, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));
        assert.strictEqual(rc.length, 1);
        assert.strictEqual(rc[0].button, 'right');
    });

    it('emits mousedown/mouseup for middle button', () => {
        mouse.feedPacket(ps2Packet(4, 0, 0)); // middle=4
        assert.strictEqual(mouse.middleButton, true);

        mouse.feedPacket(ps2Packet(0, 0, 0)); // release
        assert.strictEqual(mouse.middleButton, false);
    });

    it('handles simultaneous movement and button', () => {
        mouse.feedPacket(ps2Packet(1, 10, -5)); // left + move, dy=-5: y=0-(-5)=5
        assert.strictEqual(mouse.leftButton, true);
        assert.strictEqual(mouse.x, 10);
        assert.strictEqual(mouse.y, 5);
        // Should emit both move and mousedown
        const types = events.map(e => e.type);
        assert.ok(types.includes('move'));
        assert.ok(types.includes('mousedown'));
    });

    it('ignores repeated button press without release', () => {
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press
        assert.strictEqual(events.length, 1);
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press again
        assert.strictEqual(events.length, 1); // no new event
    });
});

describe('MouseInput - ImPS/2 scroll wheel', () => {
    let mouse, scrollEvents;

    beforeEach(() => {
        mouse = new MouseInput({ width: 100, height: 100, protocol: 'imps2' });
        scrollEvents = [];
        mouse.on('scroll', (e) => scrollEvents.push(e));
    });

    it('emits scroll event for positive scroll', () => {
        mouse.feedPacket(imps2Packet(0, 0, 0, 1));
        assert.strictEqual(scrollEvents.length, 1);
        assert.strictEqual(scrollEvents[0].delta, 1);
        assert.strictEqual(mouse.scrollY, 1);
    });

    it('emits scroll event for negative scroll', () => {
        mouse.feedPacket(imps2Packet(0, 0, 0, -1));
        assert.strictEqual(scrollEvents.length, 1);
        assert.strictEqual(scrollEvents[0].delta, -1);
        assert.strictEqual(mouse.scrollY, -1);
    });

    it('emits scrollup for positive delta', () => {
        const up = [];
        mouse.on('scrollup', (e) => up.push(e));
        mouse.feedPacket(imps2Packet(0, 0, 0, 1));
        assert.strictEqual(up.length, 1);
    });

    it('emits scrolldown for negative delta', () => {
        const down = [];
        mouse.on('scrolldown', (e) => down.push(e));
        mouse.feedPacket(imps2Packet(0, 0, 0, -1));
        assert.strictEqual(down.length, 1);
    });

    it('accumulates scroll position', () => {
        mouse.feedPacket(imps2Packet(0, 0, 0, 3));
        mouse.feedPacket(imps2Packet(0, 0, 0, -1));
        assert.strictEqual(mouse.scrollY, 2);
    });

    it('ignores zero scroll delta', () => {
        mouse.feedPacket(imps2Packet(0, 0, 0, 0));
        assert.strictEqual(scrollEvents.length, 0);
    });
});

describe('MouseInput - double-click detection', () => {
    let mouse, dblClicks;

    beforeEach(() => {
        mouse = new MouseInput({ width: 100, height: 100, doubleClickThreshold: 500 });
        dblClicks = [];
        mouse.on('dblclick', (e) => dblClicks.push(e));
    });

    it('detects double-click on two rapid clicks', () => {
        // First click
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press
        mouse.feedPacket(ps2Packet(0, 0, 0)); // release
        // Second click (immediate)
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press
        mouse.feedPacket(ps2Packet(0, 0, 0)); // release
        assert.strictEqual(dblClicks.length, 1);
        assert.strictEqual(dblClicks[0].button, 'left');
    });
});

describe('MouseInput - drag detection', () => {
    let mouse, drags, dragEnds;

    beforeEach(() => {
        mouse = new MouseInput({ width: 200, height: 200 });
        drags = [];
        dragEnds = [];
        mouse.on('drag', (e) => drags.push(e));
        mouse.on('dragend', (e) => dragEnds.push(e));
    });

    it('detects drag when moving while button held', () => {
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press at (0,0)
        mouse.feedPacket(ps2Packet(1, 10, 0)); // move to (10,0)
        assert.strictEqual(drags.length, 1);
        assert.strictEqual(drags[0].startX, 0);
        assert.strictEqual(drags[0].x, 10);
    });

    it('does not start drag for small movements', () => {
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press
        mouse.feedPacket(ps2Packet(1, 1, 0)); // tiny move
        assert.strictEqual(drags.length, 0);
    });

    it('emits dragend on button release after drag', () => {
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press
        mouse.feedPacket(ps2Packet(1, 20, 0)); // drag
        mouse.feedPacket(ps2Packet(0, 0, 0)); // release
        assert.strictEqual(dragEnds.length, 1);
        assert.strictEqual(dragEnds[0].startX, 0);
        assert.strictEqual(dragEnds[0].x, 20);
    });

    it('does not emit dragend without prior drag', () => {
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press
        mouse.feedPacket(ps2Packet(0, 0, 0)); // release (no drag)
        assert.strictEqual(dragEnds.length, 0);
    });
});

describe('MouseInput - moveTo', () => {
    it('moves to absolute position', () => {
        const mouse = new MouseInput({ width: 100, height: 100 });
        const moves = [];
        mouse.on('move', (e) => moves.push(e));

        mouse.moveTo(50, 60);
        assert.strictEqual(mouse.x, 50);
        assert.strictEqual(mouse.y, 60);
        assert.strictEqual(moves.length, 1);
        assert.strictEqual(moves[0].dx, 50);
        assert.strictEqual(moves[0].dy, 60);
    });

    it('clamps to bounds', () => {
        const mouse = new MouseInput({ width: 100, height: 100 });
        mouse.moveTo(200, 200);
        assert.strictEqual(mouse.x, 99);
        assert.strictEqual(mouse.y, 99);

        mouse.moveTo(-10, -10);
        assert.strictEqual(mouse.x, 0);
        assert.strictEqual(mouse.y, 0);
    });

    it('does not emit when position unchanged', () => {
        const mouse = new MouseInput({ width: 100, height: 100, startX: 50, startY: 50 });
        const moves = [];
        mouse.on('move', (e) => moves.push(e));
        mouse.moveTo(50, 50);
        assert.strictEqual(moves.length, 0);
    });
});

describe('MouseInput - stop', () => {
    it('stop is safe to call without start', () => {
        const mouse = new MouseInput({ device: '/dev/nonexistent' });
        mouse.stop(); // Should not throw
        assert.strictEqual(mouse.fd, null);
    });
});
