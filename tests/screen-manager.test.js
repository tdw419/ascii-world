import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ScreenManager } from '../sync/screen-manager.js';

describe('ScreenManager', () => {
    it('creates grid with correct dimensions', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        assert.strictEqual(sm.cols, 80); // 480 / 6
        assert.strictEqual(sm.rows, 24); // 240 / 10
    });

    it('setCell writes to grid', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.setCell(5, 3, 'X', [255, 0, 0, 255]);
        assert.strictEqual(sm.grid[3][5].char, 'X');
        assert.deepStrictEqual(sm.grid[3][5].fg, [255, 0, 0, 255]);
    });

    it('setCell skips identical update', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.setCell(5, 3, 'X', [255, 0, 0, 255]);
        sm.grid[3][5].dirty = false;
        // Same values — should not re-dirty
        sm.setCell(5, 3, 'X', [255, 0, 0, 255]);
        assert.strictEqual(sm.grid[3][5].dirty, false);
    });

    it('setCell ignores out-of-bounds', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.setCell(-1, 0, 'X');
        sm.setCell(0, -1, 'X');
        sm.setCell(80, 0, 'X');
        sm.setCell(0, 24, 'X');
        // No crash
        assert.ok(true);
    });

    it('write places characters sequentially', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.write('Hello', 0, 0);
        assert.strictEqual(sm.grid[0][0].char, 'H');
        assert.strictEqual(sm.grid[0][1].char, 'e');
        assert.strictEqual(sm.grid[0][4].char, 'o');
        assert.strictEqual(sm.cursorX, 5);
        assert.strictEqual(sm.cursorY, 0);
    });

    it('write handles newlines', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.write('A\nB', 0, 0);
        assert.strictEqual(sm.grid[0][0].char, 'A');
        assert.strictEqual(sm.grid[1][0].char, 'B');
    });

    it('write wraps at column boundary', () => {
        const sm = new ScreenManager({ width: 60, height: 20, framebuffer: false });
        // 60/6 = 10 cols
        sm.write('0123456789X', 0, 0);
        assert.strictEqual(sm.grid[0][9].char, '9');
        assert.strictEqual(sm.grid[1][0].char, 'X');
    });

    it('writeAnsi parses ANSI colors', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.writeAnsi('\x1b[31mHi\x1b[0m', 0, 0);
        assert.strictEqual(sm.grid[0][0].char, 'H');
        assert.strictEqual(sm.grid[0][0].fg[0], 0xf8); // red from palette
        assert.strictEqual(sm.grid[0][1].char, 'i');
    });

    it('scroll shifts grid and uses copyWithin on buffer', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.write('Line1', 0, 0);
        sm.write('Line2', 0, 1);
        sm.scroll(1);
        // Line2 is now at row 0
        assert.strictEqual(sm.grid[0][0].char, 'L');
        assert.strictEqual(sm.grid[0][4].char, '2');
        // Last row is cleared
        assert.strictEqual(sm.grid[23][0].char, ' ');
    });

    it('render returns dirty cell count', () => {
        const sm = new ScreenManager({ width: 60, height: 20, framebuffer: false });
        sm.write('Hi', 0, 0);
        // First render — all cells dirty from constructor
        const dirty1 = sm.render();
        assert.ok(dirty1 > 0);
        // Second render — nothing changed
        const dirty2 = sm.render();
        assert.strictEqual(dirty2, 0);
    });

    it('render skips clean rows', () => {
        const sm = new ScreenManager({ width: 60, height: 20, framebuffer: false });
        sm.render(); // render everything
        // Dirty just one cell
        sm.setCell(0, 0, 'X');
        const dirty = sm.render();
        assert.strictEqual(dirty, 1);
    });

    it('clear resets all cells', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.write('Hello', 0, 0);
        sm.clear();
        assert.strictEqual(sm.grid[0][0].char, ' ');
        assert.strictEqual(sm.cursorX, 0);
        assert.strictEqual(sm.cursorY, 0);
    });

    it('forceRedraw marks all cells dirty', () => {
        const sm = new ScreenManager({ width: 60, height: 20, framebuffer: false });
        sm.render();
        sm.forceRedraw();
        const dirty = sm.render();
        // All cells should be re-rendered
        assert.strictEqual(dirty, sm.rows * sm.cols);
    });

    it('drawBox creates box outline', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.drawBox(0, 0, 10, 5);
        assert.strictEqual(sm.grid[0][0].char, '┌');
        assert.strictEqual(sm.grid[0][9].char, '┐');
        assert.strictEqual(sm.grid[4][0].char, '└');
        assert.strictEqual(sm.grid[4][9].char, '┘');
        assert.strictEqual(sm.grid[0][5].char, '─');
        assert.strictEqual(sm.grid[2][0].char, '│');
    });

    it('drawBox double style', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.drawBox(0, 0, 10, 5, 'double');
        assert.strictEqual(sm.grid[0][0].char, '╔');
        assert.strictEqual(sm.grid[0][9].char, '╗');
    });

    it('fillRect fills region', () => {
        const sm = new ScreenManager({ width: 480, height: 240, framebuffer: false });
        sm.fillRect(2, 2, 3, 3, '█');
        assert.strictEqual(sm.grid[2][2].char, '█');
        assert.strictEqual(sm.grid[4][4].char, '█');
        assert.strictEqual(sm.grid[1][2].char, ' ');
    });
});
