import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FramebufferMouse, bresenhamLine } from '../sync/framebuffer-mouse.js';
import { MouseInput } from '../sync/mouse-input.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';

function ps2Packet(buttons, dx, dy) {
    let b0 = buttons & 0x07;
    if (dx < 0) { b0 |= 0x10; dx += 256; }
    if (dy < 0) { dy += 256; b0 |= 0x20; }
    return [b0, dx & 0xFF, dy & 0xFF];
}

describe('FramebufferMouse - construction', () => {
    it('initializes with defaults', () => {
        const fbm = new FramebufferMouse();
        assert.strictEqual(fbm.paintMode, false);
        assert.strictEqual(fbm.showCursor, true);
        assert.strictEqual(fbm.brushSize, 1);
        assert.deepStrictEqual(fbm.brushColor, [255, 255, 255, 255]);
        assert.deepStrictEqual(fbm.cursorColor, [255, 255, 0, 255]);
    });

    it('accepts custom options', () => {
        const pb = new PixelBuffer(100, 100);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            brushColor: [255, 0, 0, 255],
            brushSize: 3,
            paintMode: true,
            showCursor: false,
            cursorColor: [0, 255, 0, 255],
        });
        assert.strictEqual(fbm.pixelBuffer, pb);
        assert.strictEqual(fbm.mouse, mouse);
        assert.strictEqual(fbm.paintMode, true);
        assert.strictEqual(fbm.showCursor, false);
        assert.strictEqual(fbm.brushSize, 3);
        assert.deepStrictEqual(fbm.brushColor, [255, 0, 0, 255]);
        assert.deepStrictEqual(fbm.cursorColor, [0, 255, 0, 255]);
    });
});

describe('FramebufferMouse - hit regions', () => {
    let fbm;

    beforeEach(() => {
        fbm = new FramebufferMouse({ pixelBuffer: new PixelBuffer(200, 200) });
    });

    it('addHitRegion returns an ID', () => {
        const id = fbm.addHitRegion(10, 10, 50, 30, () => {});
        assert.strictEqual(id, 1);
        const id2 = fbm.addHitRegion(70, 10, 50, 30, () => {});
        assert.strictEqual(id2, 2);
    });

    it('hitTest finds region containing point', () => {
        fbm.addHitRegion(10, 10, 50, 30, () => {});
        const r = fbm.hitTest(30, 20);
        assert.ok(r);
        assert.strictEqual(r.id, 1);
        assert.strictEqual(r.x, 10);
        assert.strictEqual(r.y, 10);
        assert.strictEqual(r.w, 50);
        assert.strictEqual(r.h, 30);
    });

    it('hitTest returns null for point outside all regions', () => {
        fbm.addHitRegion(10, 10, 50, 30, () => {});
        assert.strictEqual(fbm.hitTest(5, 5), null);
        assert.strictEqual(fbm.hitTest(100, 100), null);
    });

    it('hitTest matches at region boundary (inclusive start, exclusive end)', () => {
        fbm.addHitRegion(10, 10, 50, 30, () => {});
        assert.ok(fbm.hitTest(10, 10)); // top-left corner
        assert.ok(fbm.hitTest(59, 39)); // bottom-right (exclusive end, so 59 is in, 60 is not)
        assert.strictEqual(fbm.hitTest(60, 10), null);
        assert.strictEqual(fbm.hitTest(10, 40), null);
    });

    it('hitTest returns last-added region for overlapping areas (painter order)', () => {
        fbm.addHitRegion(0, 0, 100, 100, () => {});
        fbm.addHitRegion(25, 25, 50, 50, () => {});
        const r = fbm.hitTest(30, 30);
        assert.ok(r);
        assert.strictEqual(r.id, 2); // last-added wins
    });

    it('removeHitRegion removes region by ID', () => {
        const id = fbm.addHitRegion(10, 10, 50, 30, () => {});
        assert.strictEqual(fbm.removeHitRegion(id), true);
        assert.strictEqual(fbm.hitTest(30, 20), null);
    });

    it('removeHitRegion returns false for non-existent ID', () => {
        assert.strictEqual(fbm.removeHitRegion(999), false);
    });

    it('click fires handler on hit region', () => {
        const clicks = [];
        fbm.addHitRegion(10, 10, 50, 30, (e) => clicks.push(e));

        const mouse = new MouseInput({ width: 200, height: 200 });
        fbm.mouse = mouse;
        fbm.start();

        // Move to position inside region
        mouse.feedPacket(ps2Packet(0, 30, -20));
        // Click
        mouse.feedPacket(ps2Packet(1, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));

        assert.strictEqual(clicks.length, 1);
        assert.strictEqual(clicks[0].id, 1);
        assert.strictEqual(clicks[0].button, 'left');
        fbm.stop();
    });

    it('click outside hit region does not fire handler', () => {
        const clicks = [];
        fbm.addHitRegion(10, 10, 50, 30, (e) => clicks.push(e));

        const mouse = new MouseInput({ width: 200, height: 200 });
        fbm.mouse = mouse;
        fbm.start();

        // Move to position outside region
        mouse.feedPacket(ps2Packet(0, 150, -150));
        // Click
        mouse.feedPacket(ps2Packet(1, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));

        assert.strictEqual(clicks.length, 0);
        fbm.stop();
    });

    it('rightclick fires handler on hit region', () => {
        const clicks = [];
        fbm.addHitRegion(10, 10, 50, 30, (e) => clicks.push(e));

        const mouse = new MouseInput({ width: 200, height: 200 });
        fbm.mouse = mouse;
        fbm.start();

        mouse.feedPacket(ps2Packet(0, 30, -20));
        mouse.feedPacket(ps2Packet(2, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));

        assert.strictEqual(clicks.length, 1);
        assert.strictEqual(clicks[0].button, 'right');
        fbm.stop();
    });

    it('dblclick passes dblclick flag to handler', () => {
        const events = [];
        fbm.addHitRegion(10, 10, 50, 30, (e) => events.push(e));

        const mouse = new MouseInput({ width: 200, height: 200, doubleClickThreshold: 500 });
        fbm.mouse = mouse;
        fbm.start();

        mouse.feedPacket(ps2Packet(0, 30, -20));
        // Double click
        mouse.feedPacket(ps2Packet(1, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));
        mouse.feedPacket(ps2Packet(1, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));

        // Should have 3 calls: click, click, dblclick
        assert.ok(events.length >= 2);
        const dbl = events.find(e => e.dblclick === true);
        assert.ok(dbl, 'should have a dblclick event');
        fbm.stop();
    });
});

describe('FramebufferMouse - paint mode', () => {
    it('paints pixel at click position', () => {
        const pb = new PixelBuffer(100, 100);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            paintMode: true,
            brushColor: [255, 0, 0, 255],
            showCursor: false,
        });
        fbm.start();
        mouse.feedPacket(ps2Packet(0, 50, -50));
        mouse.feedPacket(ps2Packet(1, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));

        const pixel = pb.getPixel(50, 50);
        assert.strictEqual(pixel[0], 255);
        assert.strictEqual(pixel[1], 0);
        assert.strictEqual(pixel[2], 0);
        fbm.stop();
    });

    it('paints along drag path', () => {
        const pb = new PixelBuffer(100, 100);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            paintMode: true,
            brushColor: [255, 0, 0, 255],
            showCursor: false,
        });
        fbm.start();

        mouse.feedPacket(ps2Packet(0, 10, -10));
        mouse.feedPacket(ps2Packet(1, 0, 0)); // press at (10,10)
        mouse.feedPacket(ps2Packet(1, 20, 0)); // drag to (30,10)
        mouse.feedPacket(ps2Packet(0, 0, 0));  // release

        // All pixels along the line should be painted
        for (let x = 10; x <= 30; x++) {
            const pixel = pb.getPixel(x, 10);
            assert.strictEqual(pixel[0], 255, `pixel at x=${x} should be red`);
        }
        fbm.stop();
    });

    it('uses brushSize for larger strokes', () => {
        const pb = new PixelBuffer(100, 100);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            paintMode: true,
            brushColor: [0, 255, 0, 255],
            brushSize: 3,
            showCursor: false,
        });
        fbm.start();

        mouse.feedPacket(ps2Packet(0, 50, -50));
        mouse.feedPacket(ps2Packet(1, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));

        // Center pixel should be green
        const center = pb.getPixel(50, 50);
        assert.strictEqual(center[1], 255);

        // Adjacent pixels within radius should be green
        const adj = pb.getPixel(51, 50);
        assert.strictEqual(adj[1], 255);

        const diag = pb.getPixel(51, 51);
        assert.strictEqual(diag[1], 255);
        fbm.stop();
    });

    it('does not paint when paintMode is false', () => {
        const pb = new PixelBuffer(100, 100);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            paintMode: false,
            brushColor: [255, 0, 0, 255],
            showCursor: false,
        });
        fbm.start();

        mouse.feedPacket(ps2Packet(0, 50, -50));
        mouse.feedPacket(ps2Packet(1, 0, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0));

        const pixel = pb.getPixel(50, 50);
        // Should remain default (0,0,0,0)
        assert.strictEqual(pixel[0], 0);
        fbm.stop();
    });
});

describe('FramebufferMouse - cursor rendering', () => {
    it('renders cursor at mouse position on move', () => {
        const pb = new PixelBuffer(100, 100);
        pb.fill(10, 10, 20, 255);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            showCursor: true,
            cursorColor: [255, 255, 0, 255],
            paintMode: false,
        });
        fbm.start();

        // Move mouse to (50, 50) — dy=-50 means screen y = 0-(-50)=50
        mouse.feedPacket(ps2Packet(0, 50, -50));

        // Center of cursor should be cursor color
        const center = pb.getPixel(50, 50);
        assert.strictEqual(center[0], 255); // R of yellow
        assert.strictEqual(center[1], 255); // G of yellow
        fbm.stop();
    });

    it('restores previous pixels when cursor moves away', () => {
        const pb = new PixelBuffer(100, 100);
        pb.fill(10, 10, 20, 255);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            showCursor: true,
            cursorColor: [255, 255, 0, 255],
            paintMode: false,
        });
        fbm.start();

        // Move to (50, 50)
        mouse.feedPacket(ps2Packet(0, 50, -50));

        // Cursor should be visible at (50, 50)
        assert.strictEqual(pb.getPixel(50, 50)[0], 255);

        // Move to (60, 60)
        mouse.feedPacket(ps2Packet(0, 10, -10));

        // Old position (50, 50) should be restored to background color
        const restored = pb.getPixel(50, 50);
        assert.strictEqual(restored[0], 10);
        assert.strictEqual(restored[1], 10);
        assert.strictEqual(restored[2], 20);

        // New cursor position should show cursor color
        const newCursor = pb.getPixel(60, 60);
        assert.strictEqual(newCursor[0], 255);
        fbm.stop();
    });

    it('stop restores cursor region', () => {
        const pb = new PixelBuffer(100, 100);
        pb.fill(10, 10, 20, 255);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            showCursor: true,
            cursorColor: [255, 255, 0, 255],
            paintMode: false,
        });
        fbm.start();

        mouse.feedPacket(ps2Packet(0, 50, -50));
        assert.strictEqual(pb.getPixel(50, 50)[0], 255);

        fbm.stop();

        const restored = pb.getPixel(50, 50);
        assert.strictEqual(restored[0], 10); // Back to background
    });

    it('cursor arms extend in crosshair pattern', () => {
        const pb = new PixelBuffer(100, 100);
        pb.fill(10, 10, 20, 255);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            showCursor: true,
            cursorColor: [255, 255, 0, 255],
            paintMode: false,
        });
        fbm.start();

        mouse.feedPacket(ps2Packet(0, 50, -50));

        // Horizontal arms
        assert.strictEqual(pb.getPixel(49, 50)[0], 255); // left
        assert.strictEqual(pb.getPixel(51, 50)[0], 255); // right
        // Vertical arms
        assert.strictEqual(pb.getPixel(50, 49)[0], 255); // top
        assert.strictEqual(pb.getPixel(50, 51)[0], 255); // bottom
        // Diagonal should NOT be cursor
        assert.strictEqual(pb.getPixel(49, 49)[0], 10); // bg
        fbm.stop();
    });
});

describe('FramebufferMouse - paintAt', () => {
    it('paints single pixel with brushSize 1', () => {
        const pb = new PixelBuffer(50, 50);
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            brushColor: [0, 128, 255, 200],
            brushSize: 1,
        });
        fbm.paintAt(25, 25);

        const p = pb.getPixel(25, 25);
        assert.strictEqual(p[0], 0);
        assert.strictEqual(p[1], 128);
        assert.strictEqual(p[2], 255);
        assert.strictEqual(p[3], 200);
    });

    it('paints circular brush with brushSize > 1', () => {
        const pb = new PixelBuffer(50, 50);
        pb.fill(0, 0, 0, 0);
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            brushColor: [255, 0, 0, 255],
            brushSize: 3,
        });
        fbm.paintAt(25, 25);

        // Center
        assert.strictEqual(pb.getPixel(25, 25)[0], 255);
        // 1 pixel away
        assert.strictEqual(pb.getPixel(26, 25)[0], 255);
        assert.strictEqual(pb.getPixel(25, 26)[0], 255);
        // Corner (sqrt(2) > 1, so this is within radius 2)
        assert.strictEqual(pb.getPixel(26, 26)[0], 255);
        // 2 pixels away on axis is within radius (distance=2, radius=2)
        assert.strictEqual(pb.getPixel(27, 25)[0], 255);
        // 3 pixels away (outside circle, distance=3 > radius=2)
        assert.strictEqual(pb.getPixel(28, 25)[0], 0);
    });

    it('ignores out-of-bounds coordinates gracefully', () => {
        const pb = new PixelBuffer(10, 10);
        const fbm = new FramebufferMouse({ pixelBuffer: pb, brushColor: [255, 0, 0, 255] });
        // Should not throw
        fbm.paintAt(-5, -5);
        fbm.paintAt(100, 100);
    });
});

describe('FramebufferMouse - paintLine', () => {
    it('paints horizontal line', () => {
        const pb = new PixelBuffer(50, 50);
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            brushColor: [255, 255, 255, 255],
        });
        fbm.paintLine(10, 25, 20, 25);

        for (let x = 10; x <= 20; x++) {
            assert.strictEqual(pb.getPixel(x, 25)[0], 255, `x=${x}`);
        }
    });

    it('paints vertical line', () => {
        const pb = new PixelBuffer(50, 50);
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            brushColor: [0, 255, 0, 255],
        });
        fbm.paintLine(25, 10, 25, 20);

        for (let y = 10; y <= 20; y++) {
            assert.strictEqual(pb.getPixel(25, y)[1], 255, `y=${y}`);
        }
    });

    it('paints diagonal line', () => {
        const pb = new PixelBuffer(50, 50);
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            brushColor: [0, 0, 255, 255],
        });
        fbm.paintLine(0, 0, 5, 5);

        for (let i = 0; i <= 5; i++) {
            assert.strictEqual(pb.getPixel(i, i)[2], 255, `diag point ${i}`);
        }
    });

    it('paints line in reverse direction', () => {
        const pb = new PixelBuffer(50, 50);
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            brushColor: [255, 0, 0, 255],
        });
        fbm.paintLine(20, 25, 10, 25);

        for (let x = 10; x <= 20; x++) {
            assert.strictEqual(pb.getPixel(x, 25)[0], 255);
        }
    });
});

describe('bresenhamLine', () => {
    it('returns single point for zero-length line', () => {
        const points = [...bresenhamLine(5, 5, 5, 5)];
        assert.deepStrictEqual(points, [[5, 5]]);
    });

    it('returns all points on horizontal line', () => {
        const points = [...bresenhamLine(0, 0, 4, 0)];
        assert.strictEqual(points.length, 5);
        assert.deepStrictEqual(points[0], [0, 0]);
        assert.deepStrictEqual(points[4], [4, 0]);
    });

    it('returns all points on vertical line', () => {
        const points = [...bresenhamLine(0, 0, 0, 3)];
        assert.strictEqual(points.length, 4);
    });

    it('returns all points on diagonal line', () => {
        const points = [...bresenhamLine(0, 0, 3, 3)];
        assert.strictEqual(points.length, 4);
        assert.deepStrictEqual(points[0], [0, 0]);
        assert.deepStrictEqual(points[3], [3, 3]);
    });

    it('handles negative direction', () => {
        const points = [...bresenhamLine(5, 5, 2, 5)];
        assert.strictEqual(points.length, 4);
        assert.deepStrictEqual(points[0], [5, 5]);
        assert.deepStrictEqual(points[3], [2, 5]);
    });
});

describe('FramebufferMouse - flush', () => {
    it('flush returns false without framebuffer writer', () => {
        const fbm = new FramebufferMouse({ pixelBuffer: new PixelBuffer(10, 10) });
        assert.strictEqual(fbm.flush(), false);
    });

    it('flush delegates to framebuffer writer', () => {
        const pb = new PixelBuffer(10, 10);
        const writer = { flush: () => true };
        const fbm = new FramebufferMouse({ pixelBuffer: pb, framebufferWriter: writer });
        assert.strictEqual(fbm.flush(), true);
    });
});

describe('FramebufferMouse - start/stop lifecycle', () => {
    it('start is safe without mouse', () => {
        const fbm = new FramebufferMouse({ pixelBuffer: new PixelBuffer(10, 10) });
        fbm.start(); // Should not throw
        fbm.stop();
    });

    it('stop removes all listeners', () => {
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({ mouse });
        fbm.start();
        assert.strictEqual(fbm._listeners.length, 8);
        fbm.stop();
        assert.strictEqual(fbm._listeners.length, 0);
    });

    it('stop is safe to call multiple times', () => {
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({ mouse });
        fbm.start();
        fbm.stop();
        fbm.stop(); // Should not throw
    });
});

describe('FramebufferMouse - no pixelBuffer scenarios', () => {
    it('paintAt is safe without pixelBuffer', () => {
        const fbm = new FramebufferMouse();
        fbm.paintAt(10, 10); // Should not throw
    });

    it('handleMove is safe without pixelBuffer', () => {
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({ mouse });
        fbm.start();
        mouse.feedPacket(ps2Packet(0, 10, -10)); // Should not throw
        fbm.stop();
    });

    it('handleScroll is safe without pixelBuffer', () => {
        const mouse = new MouseInput({ width: 100, height: 100, protocol: 'imps2' });
        const fbm = new FramebufferMouse({ mouse });
        fbm.start();
        // Simulate scroll
        const imps2Packet = (buttons, dx, dy, scroll) => {
            let b0 = buttons & 0x07;
            if (dx < 0) { b0 |= 0x10; dx += 256; }
            if (dy < 0) { dy += 256; b0 |= 0x20; }
            const pkt = [b0, dx & 0xFF, dy & 0xFF];
            let s = scroll;
            if (s < 0) s += 256;
            pkt.push(s & 0xFF);
            return pkt;
        };
        mouse.feedPacket(imps2Packet(0, 0, 0, 1)); // Should not throw
        fbm.stop();
    });
});

describe('FramebufferMouse - drag interpolation', () => {
    it('interpolates between drag points for smooth lines', () => {
        const pb = new PixelBuffer(100, 100);
        const mouse = new MouseInput({ width: 100, height: 100 });
        const fbm = new FramebufferMouse({
            pixelBuffer: pb,
            mouse,
            paintMode: true,
            brushColor: [255, 0, 0, 255],
            showCursor: false,
        });
        fbm.start();

        // Click at (10, 10)
        mouse.feedPacket(ps2Packet(0, 10, -10));
        mouse.feedPacket(ps2Packet(1, 0, 0));

        // Drag to (20, 10) — large enough move to trigger drag (>3 threshold)
        mouse.feedPacket(ps2Packet(1, 20, 0));
        mouse.feedPacket(ps2Packet(0, 0, 0)); // release

        // All pixels from 10..30 on row 10 should be painted
        for (let x = 10; x <= 30; x++) {
            assert.strictEqual(pb.getPixel(x, 10)[0], 255, `x=${x}`);
        }

        fbm.stop();
    });
});
