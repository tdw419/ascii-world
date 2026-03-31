import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ScreenManager, Window } from '../sync/screen-manager.js';

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

// ─────────────────────────────────────────────────────────
// Window class unit tests
// ─────────────────────────────────────────────────────────

describe('Window', () => {
    it('creates window with default options', () => {
        const w = new Window();
        assert.strictEqual(w.col, 0);
        assert.strictEqual(w.row, 0);
        assert.strictEqual(w.width, 10);
        assert.strictEqual(w.height, 5);
        assert.strictEqual(w.border, true);
        assert.strictEqual(w.title, null);
        assert.strictEqual(w.visible, true);
        assert.ok(w.id.startsWith('win_'));
    });

    it('creates window with custom options', () => {
        const w = new Window({
            id: 'mywin',
            col: 5, row: 3,
            width: 20, height: 10,
            title: 'Test',
            border: false,
            visible: false,
            zIndex: 5
        });
        assert.strictEqual(w.id, 'mywin');
        assert.strictEqual(w.col, 5);
        assert.strictEqual(w.row, 3);
        assert.strictEqual(w.width, 20);
        assert.strictEqual(w.height, 10);
        assert.strictEqual(w.title, 'Test');
        assert.strictEqual(w.border, false);
        assert.strictEqual(w.visible, false);
        assert.strictEqual(w.zIndex, 5);
    });

    it('auto-generates unique ids', () => {
        const w1 = new Window();
        const w2 = new Window();
        assert.notStrictEqual(w1.id, w2.id);
    });

    it('clamps width and height to minimum 1', () => {
        const w = new Window({ width: 0, height: -5 });
        assert.strictEqual(w.width, 1);
        assert.strictEqual(w.height, 1);
    });

    it('computes contentCols/contentRows with border', () => {
        // 20 wide, 10 tall, border on (2 cols/rows for borders)
        const w = new Window({ width: 20, height: 10, border: true });
        assert.strictEqual(w.contentCols, 18); // 20 - 2
        assert.strictEqual(w.contentRows, 8);  // 10 - 2
    });

    it('computes contentCols/contentRows with border and title', () => {
        // 20 wide, 10 tall, border on, title = 1 extra row
        const w = new Window({ width: 20, height: 10, border: true, title: 'Hi' });
        assert.strictEqual(w.contentCols, 18);
        assert.strictEqual(w.contentRows, 7); // 10 - 2 (border) - 1 (title)
    });

    it('computes contentCols/contentRows without border', () => {
        const w = new Window({ width: 20, height: 10, border: false });
        assert.strictEqual(w.contentCols, 20);
        assert.strictEqual(w.contentRows, 10);
    });

    it('computes contentOffset with border and title', () => {
        const w = new Window({ border: true, title: 'Test' });
        assert.deepStrictEqual(w.contentOffset, { col: 1, row: 2 });
    });

    it('computes contentOffset with border no title', () => {
        const w = new Window({ border: true, title: null });
        assert.deepStrictEqual(w.contentOffset, { col: 1, row: 1 });
    });

    it('computes contentOffset without border', () => {
        const w = new Window({ border: false });
        assert.deepStrictEqual(w.contentOffset, { col: 0, row: 0 });
    });

    it('initializes content grid with blanks', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        // contentCols = 10, contentRows = 4
        assert.strictEqual(w.content.length, 4);
        assert.strictEqual(w.content[0].length, 10);
        assert.strictEqual(w.content[0][0].char, ' ');
        assert.strictEqual(w.content[0][0].dirty, true);
    });

    it('setCell writes to content area', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        w.setCell(0, 0, 'A', [255, 0, 0, 255]);
        assert.strictEqual(w.content[0][0].char, 'A');
        assert.deepStrictEqual(w.content[0][0].fg, [255, 0, 0, 255]);
    });

    it('setCell ignores out of bounds', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        w.setCell(-1, 0, 'X');
        w.setCell(0, -1, 'X');
        w.setCell(100, 0, 'X');
        w.setCell(0, 100, 'X');
        // No crash, content unchanged
        assert.strictEqual(w.content[0][0].char, ' ');
    });

    it('write places text in content area', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        w.write('Hello', 0, 0);
        assert.strictEqual(w.content[0][0].char, 'H');
        assert.strictEqual(w.content[0][4].char, 'o');
        assert.strictEqual(w.cursorX, 5);
        assert.strictEqual(w.cursorY, 0);
    });

    it('write handles newlines', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        w.write('A\nB', 0, 0);
        assert.strictEqual(w.content[0][0].char, 'A');
        assert.strictEqual(w.content[1][0].char, 'B');
    });

    it('write wraps at content width', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        // contentCols = 10
        w.write('0123456789X', 0, 0);
        assert.strictEqual(w.content[0][9].char, '9');
        assert.strictEqual(w.content[1][0].char, 'X');
    });

    it('write clips at content bottom', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        // contentRows = 4
        w.write('L0\nL1\nL2\nL3\nL4\nL5', 0, 0);
        assert.strictEqual(w.content[0][0].char, 'L');
        assert.strictEqual(w.content[3][0].char, 'L');
        // After L3\n, y becomes 4 which >= contentRows(4), breaks
        assert.strictEqual(w.cursorY, 4);
    });

    it('clear resets content area', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        w.write('Hello', 0, 0);
        w.clear();
        assert.strictEqual(w.content[0][0].char, ' ');
        assert.strictEqual(w.cursorX, 0);
        assert.strictEqual(w.cursorY, 0);
    });

    it('invalidate marks all cells dirty', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        // Clear dirty flags
        for (const row of w.content) for (const c of row) c.dirty = false;
        w.invalidate();
        for (const row of w.content) {
            for (const c of row) {
                assert.strictEqual(c.dirty, true);
            }
        }
        assert.strictEqual(w._dirty, true);
    });

    it('move updates position and invalidates', () => {
        const w = new Window({ col: 0, row: 0 });
        w.move(10, 5);
        assert.strictEqual(w.col, 10);
        assert.strictEqual(w.row, 5);
        assert.strictEqual(w._dirty, true);
    });

    it('resize preserves content that fits', () => {
        const w = new Window({ width: 12, height: 6, border: true });
        w.write('Hello', 0, 0);
        w.resize(16, 8);
        // contentCols should now be 14 (16-2)
        assert.strictEqual(w.contentCols, 14);
        assert.strictEqual(w.contentRows, 6);
        // Original content preserved
        assert.strictEqual(w.content[0][0].char, 'H');
        assert.strictEqual(w.content[0][4].char, 'o');
    });

    it('resize smaller truncates content', () => {
        const w = new Window({ width: 20, height: 10, border: true });
        w.write('ABCDEFGHIJKLMNOP', 0, 0);
        w.resize(8, 6);
        assert.strictEqual(w.contentCols, 6); // 8-2
        assert.strictEqual(w.contentRows, 4); // 6-2
        // First 6 chars preserved
        assert.strictEqual(w.content[0][0].char, 'A');
        assert.strictEqual(w.content[0][5].char, 'F');
    });
});

// ─────────────────────────────────────────────────────────
// ScreenManager window management tests
// ─────────────────────────────────────────────────────────

describe('ScreenManager Window Management', () => {
    function makeSm() {
        return new ScreenManager({ width: 480, height: 240, framebuffer: false });
    }

    it('createWindow returns a Window', () => {
        const sm = makeSm();
        const win = sm.createWindow({ col: 0, row: 0, width: 20, height: 10 });
        assert.ok(win instanceof Window);
        assert.strictEqual(win.width, 20);
        assert.strictEqual(win.height, 10);
    });

    it('getWindow retrieves by id', () => {
        const sm = makeSm();
        const win = sm.createWindow({ id: 'test' });
        assert.strictEqual(sm.getWindow('test'), win);
    });

    it('getWindow returns undefined for unknown id', () => {
        const sm = makeSm();
        assert.strictEqual(sm.getWindow('nope'), undefined);
    });

    it('destroyWindow removes window', () => {
        const sm = makeSm();
        const win = sm.createWindow({ id: 'del' });
        assert.strictEqual(sm.destroyWindow('del'), true);
        assert.strictEqual(sm.getWindow('del'), undefined);
    });

    it('destroyWindow returns false for unknown id', () => {
        const sm = makeSm();
        assert.strictEqual(sm.destroyWindow('nope'), false);
    });

    it('getWindowIds returns ids in z-order', () => {
        const sm = makeSm();
        sm.createWindow({ id: 'a', zIndex: 0 });
        sm.createWindow({ id: 'b', zIndex: 1 });
        sm.createWindow({ id: 'c', zIndex: 2 });
        assert.deepStrictEqual(sm.getWindowIds(), ['a', 'b', 'c']);
    });

    it('focusWindow moves window to top', () => {
        const sm = makeSm();
        sm.createWindow({ id: 'a', zIndex: 0 });
        sm.createWindow({ id: 'b', zIndex: 1 });
        sm.createWindow({ id: 'c', zIndex: 2 });
        sm.focusWindow('a');
        // 'a' should be last (top)
        const ids = sm.getWindowIds();
        assert.strictEqual(ids[ids.length - 1], 'a');
    });

    it('focusWindow sets focused window id', () => {
        const sm = makeSm();
        sm.createWindow({ id: 'a' });
        sm.focusWindow('a');
        assert.strictEqual(sm.getFocusedWindowId(), 'a');
    });

    it('focusWindow returns false for unknown id', () => {
        const sm = makeSm();
        assert.strictEqual(sm.focusWindow('nope'), false);
    });

    it('destroyWindow refocuses to next top window', () => {
        const sm = makeSm();
        sm.createWindow({ id: 'a' });
        sm.createWindow({ id: 'b' });
        sm.focusWindow('a'); // a is focused + on top
        sm.destroyWindow('a');
        assert.strictEqual(sm.getFocusedWindowId(), 'b');
    });

    it('destroyWindow sets focused to null if no windows left', () => {
        const sm = makeSm();
        sm.createWindow({ id: 'only' });
        sm.focusWindow('only');
        sm.destroyWindow('only');
        assert.strictEqual(sm.getFocusedWindowId(), null);
    });

    it('getFocusedWindowId returns null initially', () => {
        const sm = makeSm();
        assert.strictEqual(sm.getFocusedWindowId(), null);
    });

    it('moveWindow updates position', () => {
        const sm = makeSm();
        sm.createWindow({ id: 'a', col: 0, row: 0, width: 10, height: 5 });
        sm.moveWindow('a', 20, 10);
        const win = sm.getWindow('a');
        assert.strictEqual(win.col, 20);
        assert.strictEqual(win.row, 10);
    });

    it('moveWindow returns false for unknown id', () => {
        const sm = makeSm();
        assert.strictEqual(sm.moveWindow('nope', 5, 5), false);
    });

    it('resizeWindow updates dimensions', () => {
        const sm = makeSm();
        sm.createWindow({ id: 'a', width: 10, height: 5 });
        sm.resizeWindow('a', 20, 10);
        const win = sm.getWindow('a');
        assert.strictEqual(win.width, 20);
        assert.strictEqual(win.height, 10);
    });

    it('resizeWindow returns false for unknown id', () => {
        const sm = makeSm();
        assert.strictEqual(sm.resizeWindow('nope', 10, 10), false);
    });

    // ─────────────────────────────────────────────────────────
    // Compositing tests
    // ─────────────────────────────────────────────────────────

    it('renderWindows composites window border to screen grid', () => {
        const sm = makeSm();
        sm.render(); // clear initial dirty
        sm.createWindow({ col: 0, row: 0, width: 10, height: 5, border: true });
        sm.renderWindows();
        // Border corners
        assert.strictEqual(sm.grid[0][0].char, '┌');
        assert.strictEqual(sm.grid[0][9].char, '┐');
        assert.strictEqual(sm.grid[4][0].char, '└');
        assert.strictEqual(sm.grid[4][9].char, '┘');
        // Border sides
        assert.strictEqual(sm.grid[0][5].char, '─');
        assert.strictEqual(sm.grid[2][0].char, '│');
    });

    it('renderWindows composites double border style', () => {
        const sm = makeSm();
        sm.render();
        sm.createWindow({ col: 0, row: 0, width: 10, height: 5, border: true, borderStyle: 'double' });
        sm.renderWindows();
        assert.strictEqual(sm.grid[0][0].char, '╔');
        assert.strictEqual(sm.grid[0][9].char, '╗');
    });

    it('renderWindows composites window content', () => {
        const sm = makeSm();
        sm.render();
        const win = sm.createWindow({ col: 2, row: 2, width: 12, height: 6, border: true });
        // contentCols=10, contentRows=4, contentOffset={col:1,row:1}
        win.write('ABCD', 0, 0);
        sm.renderWindows();
        // 'A' at content (0,0) -> screen (2+1, 2+1) = (3, 3)
        assert.strictEqual(sm.grid[3][3].char, 'A');
        assert.strictEqual(sm.grid[3][4].char, 'B');
    });

    it('renderWindows composites title bar', () => {
        const sm = makeSm();
        sm.render();
        sm.createWindow({ col: 0, row: 0, width: 15, height: 8, border: true, title: 'Hello' });
        sm.renderWindows();
        // Title is at row 1 (border row 0 + title row 1)
        assert.strictEqual(sm.grid[1][1].char, 'H');
        assert.strictEqual(sm.grid[1][2].char, 'e');
        assert.strictEqual(sm.grid[1][5].char, 'o');
    });

    it('renderWindows only renders dirty windows', () => {
        const sm = makeSm();
        sm.render();
        sm.createWindow({ id: 'a', col: 0, row: 0, width: 10, height: 5 });
        const count1 = sm.renderWindows();
        assert.strictEqual(count1, 1); // was dirty
        const count2 = sm.renderWindows();
        assert.strictEqual(count2, 0); // no longer dirty
    });

    it('renderWindows skips invisible windows', () => {
        const sm = makeSm();
        sm.render();
        sm.createWindow({ id: 'a', col: 0, row: 0, width: 10, height: 5, visible: false });
        const count = sm.renderWindows();
        assert.strictEqual(count, 0);
    });

    it('window without border renders content directly', () => {
        const sm = makeSm();
        sm.render();
        const win = sm.createWindow({ col: 5, row: 3, width: 10, height: 5, border: false });
        win.write('XYZ', 0, 0);
        sm.renderWindows();
        // No border offset, content starts at (5,3)
        assert.strictEqual(sm.grid[3][5].char, 'X');
        assert.strictEqual(sm.grid[3][6].char, 'Y');
        assert.strictEqual(sm.grid[3][7].char, 'Z');
    });

    it('overlapping windows composite in z-order', () => {
        const sm = makeSm();
        sm.render();
        // Create two overlapping windows, same position
        const winA = sm.createWindow({ id: 'a', col: 5, row: 5, width: 10, height: 5, border: false, zIndex: 0 });
        const winB = sm.createWindow({ id: 'b', col: 5, row: 5, width: 10, height: 5, border: false, zIndex: 1 });
        winA.write('AAAA', 0, 0);
        winB.write('BBBB', 0, 0);
        sm.renderWindows();
        // winB is on top (higher z), should overwrite winA's content
        assert.strictEqual(sm.grid[5][5].char, 'B');
    });

    it('content update invalidates window for re-render', () => {
        const sm = makeSm();
        sm.render();
        const win = sm.createWindow({ col: 0, row: 0, width: 10, height: 5, border: false });
        sm.renderWindows(); // first render
        assert.strictEqual(sm.grid[0][0].char, ' ');

        win.write('Hi', 0, 0);
        assert.strictEqual(win._dirty, true);
        sm.renderWindows();
        assert.strictEqual(sm.grid[0][0].char, 'H');
    });

    it('title bar clips to window width', () => {
        const sm = makeSm();
        sm.render();
        // Window width=10, border=1 on each side, title area = 8 chars
        sm.createWindow({ col: 0, row: 0, width: 10, height: 6, border: true, title: 'LongTitleHere' });
        sm.renderWindows();
        // Title area is cols 1-8 (8 chars): L,o,n,g,T,i,t,l
        assert.strictEqual(sm.grid[1][1].char, 'L');
        assert.strictEqual(sm.grid[1][8].char, 'l'); // 8th char = index 7 = 'l'
        // Col 9 is right border
        assert.strictEqual(sm.grid[1][9].char, '│');
    });

    it('window content with custom colors', () => {
        const sm = makeSm();
        sm.render();
        const win = sm.createWindow({ col: 0, row: 0, width: 10, height: 5, border: false, fg: [255, 0, 0, 255] });
        win.write('R', 0, 0);
        sm.renderWindows();
        assert.deepStrictEqual(sm.grid[0][0].fg, [255, 0, 0, 255]);
    });

    it('destroyed window region gets dirty for redraw', () => {
        const sm = makeSm();
        sm.render();
        sm.createWindow({ id: 'a', col: 0, row: 0, width: 10, height: 5, border: false });
        sm.renderWindows();
        assert.strictEqual(sm.grid[0][0].char, ' '); // empty content
        // Destroy and verify grid cells in that region are dirty
        sm.destroyWindow('a');
        // Grid cells should be marked dirty
        assert.strictEqual(sm.grid[0][0].dirty, true);
    });

    it('window at edge does not crash on out-of-bounds content', () => {
        const sm = makeSm();
        sm.render();
        // Place window partially off-screen
        const win = sm.createWindow({ col: 75, row: 20, width: 10, height: 8, border: false });
        win.write('Edge', 0, 0);
        // Should not crash during compositing
        sm.renderWindows();
        assert.ok(true);
    });

    it('title bar background fills full width', () => {
        const sm = makeSm();
        sm.render();
        sm.createWindow({ col: 0, row: 0, width: 10, height: 6, border: true, title: 'Ab', titleBg: [50, 50, 100, 255] });
        sm.renderWindows();
        // Title row is row 1, cols 1-8 (inside border)
        for (let c = 1; c <= 8; c++) {
            assert.deepStrictEqual(sm.grid[1][c].bg, [50, 50, 100, 255]);
        }
    });
});
