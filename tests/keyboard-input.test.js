import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import { KeyboardInput, InputLine, KEY } from '../sync/keyboard-input.js';

// Mock stdin that behaves like a readable stream
class MockStdin extends EventEmitter {
    constructor() {
        super();
        this.isTTY = true;
        this.isRaw = false;
        this._paused = true;
    }
    setRawMode(val) { this.isRaw = val; }
    resume() { this._paused = false; }
    pause() { this._paused = true; }
    // Simulate sending bytes
    send(bytes) {
        this.emit('data', Buffer.from(bytes));
    }
}

describe('KeyboardInput', () => {
    let stdin, kb, keys;

    beforeEach(() => {
        stdin = new MockStdin();
        kb = new KeyboardInput({ stdin, escTimeout: 5 });
        keys = [];
        kb.on('key', (e) => keys.push(e));
        kb.start();
    });

    it('sets raw mode on start', () => {
        assert.strictEqual(stdin.isRaw, true);
    });

    it('parses printable ASCII characters', () => {
        stdin.send([0x61]); // 'a'
        assert.strictEqual(keys.length, 1);
        assert.strictEqual(keys[0].name, 'char');
        assert.strictEqual(keys[0].value, 'a');
    });

    it('parses Enter key', () => {
        stdin.send([0x0D]);
        assert.strictEqual(keys[0].name, KEY.ENTER);
    });

    it('parses Backspace (DEL)', () => {
        stdin.send([0x7F]);
        assert.strictEqual(keys[0].name, KEY.BACKSPACE);
    });

    it('parses Tab', () => {
        stdin.send([0x09]);
        assert.strictEqual(keys[0].name, KEY.TAB);
    });

    it('parses Ctrl+C', () => {
        stdin.send([0x03]);
        assert.strictEqual(keys[0].name, KEY.CTRL_C);
    });

    it('parses Ctrl+D', () => {
        stdin.send([0x04]);
        assert.strictEqual(keys[0].name, KEY.CTRL_D);
    });

    it('parses arrow keys (CSI sequences)', () => {
        // Up: ESC [ A
        stdin.send([0x1B, 0x5B, 0x41]);
        assert.strictEqual(keys[0].name, KEY.UP);

        // Down: ESC [ B
        stdin.send([0x1B, 0x5B, 0x42]);
        assert.strictEqual(keys[1].name, KEY.DOWN);

        // Right: ESC [ C
        stdin.send([0x1B, 0x5B, 0x43]);
        assert.strictEqual(keys[2].name, KEY.RIGHT);

        // Left: ESC [ D
        stdin.send([0x1B, 0x5B, 0x44]);
        assert.strictEqual(keys[3].name, KEY.LEFT);
    });

    it('parses Home/End', () => {
        stdin.send([0x1B, 0x5B, 0x48]); // Home
        assert.strictEqual(keys[0].name, KEY.HOME);
        stdin.send([0x1B, 0x5B, 0x46]); // End
        assert.strictEqual(keys[1].name, KEY.END);
    });

    it('parses tilde sequences (Delete, PageUp, PageDown)', () => {
        stdin.send([0x1B, 0x5B, 0x33, 0x7E]); // Delete: ESC [ 3 ~
        assert.strictEqual(keys[0].name, KEY.DELETE);
        stdin.send([0x1B, 0x5B, 0x35, 0x7E]); // PageUp: ESC [ 5 ~
        assert.strictEqual(keys[1].name, KEY.PAGE_UP);
        stdin.send([0x1B, 0x5B, 0x36, 0x7E]); // PageDown: ESC [ 6 ~
        assert.strictEqual(keys[2].name, KEY.PAGE_DOWN);
    });

    it('parses SS3 function keys', () => {
        stdin.send([0x1B, 0x4F, 0x50]); // F1: ESC O P
        assert.strictEqual(keys[0].name, KEY.F1);
    });

    it('standalone ESC emitted after timeout', async () => {
        stdin.send([0x1B]);
        assert.strictEqual(keys.length, 0); // Not yet
        await new Promise(r => setTimeout(r, 20));
        assert.strictEqual(keys.length, 1);
        assert.strictEqual(keys[0].name, KEY.ESCAPE);
    });

    it('restores raw mode on stop', () => {
        kb.stop();
        assert.strictEqual(stdin.isRaw, false); // restored to original
    });

    it('handles rapid multi-byte sequence', () => {
        // Send arrow up + 'a' + Enter in one chunk
        stdin.send([0x1B, 0x5B, 0x41, 0x61, 0x0D]);
        assert.strictEqual(keys.length, 3);
        assert.strictEqual(keys[0].name, KEY.UP);
        assert.strictEqual(keys[1].name, 'char');
        assert.strictEqual(keys[1].value, 'a');
        assert.strictEqual(keys[2].name, KEY.ENTER);
    });
});

describe('InputLine', () => {
    let line, changes, enters;

    beforeEach(() => {
        line = new InputLine();
        changes = [];
        enters = [];
        line.on('change', (buf, cur) => changes.push({ buf, cur }));
        line.on('enter', (text) => enters.push(text));
    });

    it('inserts characters', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: 'char', value: 'b' });
        assert.strictEqual(line.buffer, 'ab');
        assert.strictEqual(line.cursor, 2);
    });

    it('handles backspace', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: 'char', value: 'b' });
        line.handleKey({ name: KEY.BACKSPACE });
        assert.strictEqual(line.buffer, 'a');
        assert.strictEqual(line.cursor, 1);
    });

    it('handles delete', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: 'char', value: 'b' });
        line.handleKey({ name: KEY.LEFT });
        line.handleKey({ name: KEY.LEFT });
        line.handleKey({ name: KEY.DELETE });
        assert.strictEqual(line.buffer, 'b');
        assert.strictEqual(line.cursor, 0);
    });

    it('emits enter with buffer contents', () => {
        line.handleKey({ name: 'char', value: 'h' });
        line.handleKey({ name: 'char', value: 'i' });
        line.handleKey({ name: KEY.ENTER });
        assert.strictEqual(enters.length, 1);
        assert.strictEqual(enters[0], 'hi');
        assert.strictEqual(line.buffer, '');
    });

    it('cursor movement with left/right', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: 'char', value: 'b' });
        line.handleKey({ name: KEY.LEFT });
        assert.strictEqual(line.cursor, 1);
        line.handleKey({ name: KEY.RIGHT });
        assert.strictEqual(line.cursor, 2);
    });

    it('Home/End move cursor to start/end', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: 'char', value: 'b' });
        line.handleKey({ name: 'char', value: 'c' });
        line.handleKey({ name: KEY.HOME });
        assert.strictEqual(line.cursor, 0);
        line.handleKey({ name: KEY.END });
        assert.strictEqual(line.cursor, 3);
    });

    it('Ctrl+K kills to end of line', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: 'char', value: 'b' });
        line.handleKey({ name: 'char', value: 'c' });
        line.handleKey({ name: KEY.LEFT });
        line.handleKey({ name: KEY.CTRL_K });
        assert.strictEqual(line.buffer, 'ab');
    });

    it('Ctrl+U kills to beginning of line', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: 'char', value: 'b' });
        line.handleKey({ name: 'char', value: 'c' });
        line.handleKey({ name: KEY.LEFT });
        line.handleKey({ name: KEY.CTRL_U });
        assert.strictEqual(line.buffer, 'c');
        assert.strictEqual(line.cursor, 0);
    });

    it('history navigation with up/down', () => {
        line.handleKey({ name: 'char', value: 'a' });
        line.handleKey({ name: KEY.ENTER });
        line.handleKey({ name: 'char', value: 'b' });
        line.handleKey({ name: KEY.ENTER });
        
        // Navigate up
        line.handleKey({ name: KEY.UP });
        assert.strictEqual(line.buffer, 'b');
        line.handleKey({ name: KEY.UP });
        assert.strictEqual(line.buffer, 'a');
        
        // Navigate down
        line.handleKey({ name: KEY.DOWN });
        assert.strictEqual(line.buffer, 'b');
        line.handleKey({ name: KEY.DOWN });
        assert.strictEqual(line.buffer, ''); // back to empty
    });

    it('Ctrl+W kills word backward', () => {
        'hello world'.split('').forEach(ch => line.handleKey({ name: 'char', value: ch }));
        line.handleKey({ name: KEY.CTRL_W });
        assert.strictEqual(line.buffer, 'hello ');
    });

    it('reset clears buffer and cursor', () => {
        line.handleKey({ name: 'char', value: 'x' });
        line.reset();
        assert.strictEqual(line.buffer, '');
        assert.strictEqual(line.cursor, 0);
    });
});
