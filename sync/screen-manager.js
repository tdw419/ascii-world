// screen-manager.js — Stateful cell-based screen abstraction
// Manages a grid of characters and renders to PixelBuffer/Framebuffer
//
// Upgraded with framebuffer research optimizations:
// - Uint32Array bulk operations for background fills
// - copyWithin-based scroll (vs array shift)
// - Dirty row tracking for partial flushes
// - Stride-aware framebuffer writer
// - ANSI-styled text rendering

import * as fs from 'fs';
import { GlyphAtlas } from './glyph-atlas.js';
import { PixelBuffer } from './pixel-buffer.js';
import { FramebufferWriter } from './framebuffer-writer.js';
import { AnsiParser } from './ansi-parser.js';

/**
 * Represents a window/panel within the screen grid.
 * Each window has its own local coordinate system, content buffer,
 * optional title bar, border, and can be layered via z-order.
 */
export class Window {
    /**
     * @param {object} options
     * @param {number} options.col - X position in grid columns
     * @param {number} options.row - Y position in grid rows
     * @param {number} options.width - Width in grid columns
     * @param {number} options.height - Height in grid rows
     * @param {string} [options.title] - Title bar text (adds 1 row if set)
     * @param {boolean} [options.border=true] - Draw border around window
     * @param {number[]} [options.fg=[255,255,255,255]] - Default foreground color
     * @param {number[]} [options.bg=[10,10,18,255]] - Default background color
     * @param {number[]} [options.titleFg=[255,255,255,255]] - Title bar text color
     * @param {number[]} [options.titleBg=[40,40,80,255]] - Title bar background color
     * @param {number[]} [options.borderFg=[100,100,160,255]] - Border foreground color
     * @param {string} [options.borderStyle='single'] - Border style: 'single' or 'double'
     * @param {boolean} [options.visible=true] - Whether window is visible
     * @param {string} [options.id] - Unique identifier (auto-generated if not set)
     */
    constructor(options = {}) {
        this.id = options.id || `win_${Window._nextId++}`;
        this.col = options.col || 0;
        this.row = options.row || 0;
        this.width = Math.max(1, options.width || 10);
        this.height = Math.max(1, options.height || 5);
        this.title = options.title || null;
        this.border = options.border !== false;
        this.fg = options.fg || [255, 255, 255, 255];
        this.bg = options.bg || [10, 10, 18, 255];
        this.titleFg = options.titleFg || [255, 255, 255, 255];
        this.titleBg = options.titleBg || [40, 40, 80, 255];
        this.borderFg = options.borderFg || [100, 100, 160, 255];
        this.borderStyle = options.borderStyle || 'single';
        this.visible = options.visible !== false;
        this.zIndex = options.zIndex || 0;

        // Content area dimensions (inside border/title)
        this.contentCols = this.width - (this.border ? 2 : 0);
        this.contentRows = this.height - (this.border ? 2 : 0) - (this.title ? 1 : 0);
        if (this.contentCols < 1) this.contentCols = 1;
        if (this.contentRows < 1) this.contentRows = 1;

        // Local content grid: array of rows, each row is array of cells
        this.content = Array.from({ length: this.contentRows }, () =>
            Array.from({ length: this.contentCols }, () => ({
                char: ' ',
                fg: [...this.fg],
                bg: [...this.bg],
                dirty: true
            }))
        );

        this.cursorX = 0;
        this.cursorY = 0;
        this._dirty = true;
    }

    /**
     * Content area offset within the window (accounts for border + title).
     * Returns { col, row } in window-local grid coordinates.
     */
    get contentOffset() {
        return {
            col: this.border ? 1 : 0,
            row: (this.border ? 1 : 0) + (this.title ? 1 : 0)
        };
    }

    /**
     * Mark the entire window dirty for re-render
     */
    invalidate() {
        this._dirty = true;
        for (let r = 0; r < this.contentRows; r++) {
            for (let c = 0; c < this.contentCols; c++) {
                this.content[r][c].dirty = true;
            }
        }
    }

    /**
     * Set a cell in the content area (local coordinates)
     */
    setCell(col, row, char, fg, bg) {
        if (col < 0 || col >= this.contentCols || row < 0 || row >= this.contentRows) return;
        const cell = this.content[row][col];
        cell.char = char;
        if (fg) cell.fg = fg;
        if (bg) cell.bg = bg;
        cell.dirty = true;
        this._dirty = true;
    }

    /**
     * Write text to content area at local coordinates
     */
    write(text, col, row, fg, bg) {
        let x = col !== undefined ? col : this.cursorX;
        let y = row !== undefined ? row : this.cursorY;

        for (const char of text) {
            if (char === '\n') {
                x = 0;
                y++;
                continue;
            }
            this.setCell(x, y, char, fg, bg);
            x++;
            if (x >= this.contentCols) {
                x = 0;
                y++;
            }
            // Clip at content area bottom — no auto-scroll in windows
            if (y >= this.contentRows) break;
        }
        this.cursorX = x;
        this.cursorY = y;
    }

    /**
     * Clear content area
     */
    clear() {
        for (let r = 0; r < this.contentRows; r++) {
            for (let c = 0; c < this.contentCols; c++) {
                const cell = this.content[r][c];
                cell.char = ' ';
                cell.fg = [...this.fg];
                cell.bg = [...this.bg];
                cell.dirty = true;
            }
        }
        this.cursorX = 0;
        this.cursorY = 0;
        this._dirty = true;
    }

    /**
     * Move the window to a new position
     */
    move(col, row) {
        this.col = col;
        this.row = row;
        this._dirty = true;
        this.invalidate();
    }

    /**
     * Resize the window (rebuilds content buffer, preserving what fits)
     */
    resize(width, height) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        const newContentCols = this.width - (this.border ? 2 : 0);
        const newContentRows = this.height - (this.border ? 2 : 0) - (this.title ? 1 : 0);

        const oldContent = this.content;
        const oldCols = this.contentCols;
        const oldRows = this.contentRows;

        this.contentCols = Math.max(1, newContentCols);
        this.contentRows = Math.max(1, newContentRows);

        this.content = Array.from({ length: this.contentRows }, (_, r) =>
            Array.from({ length: this.contentCols }, (_, c) => {
                if (r < oldRows && c < oldCols) {
                    return { ...oldContent[r][c], dirty: true };
                }
                return { char: ' ', fg: [...this.fg], bg: [...this.bg], dirty: true };
            })
        );

        this.invalidate();
    }
}

Window._nextId = 0;

export class ScreenManager {
    constructor(options = {}) {
        this.width = options.width || 1920;
        this.height = options.height || 1080;
        this.device = options.device || '/dev/fb0';
        
        this.atlas = new GlyphAtlas(6, 10);
        this.buffer = new PixelBuffer(this.width, this.height);
        
        // Grid dimensions
        this.cols = Math.floor(this.width / this.atlas.glyphW);
        this.rows = Math.floor(this.height / this.atlas.glyphH);
        
        // State: 2D array of cells
        this.grid = Array.from({ length: this.rows }, () => 
            Array.from({ length: this.cols }, () => ({
                char: ' ',
                fg: [255, 255, 255, 255],
                bg: [10, 10, 18, 255],
                dirty: true
            }))
        );
        
        this.cursorX = 0;
        this.cursorY = 0;
        this.autoFlush = options.autoFlush !== false;
        
        // Dirty row tracking (mirrors PixelBuffer._dirtyRows)
        this._dirtyGridRows = new Uint8Array(this.rows);
        this._dirtyGridRows.fill(1);
        
        // Framebuffer writer (stride-aware, partial flush)
        this._fbWriter = null;
        if (options.framebuffer !== false) {
            try {
                this._fbWriter = new FramebufferWriter({ device: this.device });
            } catch {
                // Framebuffer not available — PNG/software mode
            }
        }
        
        // ANSI parser for styled text
        this._ansiParser = new AnsiParser();
        
        // Pre-compute packed background color for bulk fill
        this._bgPacked = PixelBuffer.packRGBA(10, 10, 18, 255);
        
        // Clear buffer initially
        this.buffer.clear(0x0a0a12);

        // Window/panel system
        this._windows = new Map();   // id -> Window
        this._windowOrder = [];      // z-sorted array of Window ids
        this._focusedWindow = null;  // id of focused window
    }

    /**
     * Set a cell at (col, row)
     */
    setCell(col, row, char, fg = [255,255,255,255], bg = [10,10,18,255]) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
        
        const cell = this.grid[row][col];
        if (cell.char === char && 
            cell.fg[0] === fg[0] && cell.fg[1] === fg[1] && 
            cell.fg[2] === fg[2] && cell.fg[3] === fg[3] &&
            cell.bg[0] === bg[0] && cell.bg[1] === bg[1] && 
            cell.bg[2] === bg[2] && cell.bg[3] === bg[3]) {
            return; // No change
        }
        
        cell.char = char;
        cell.fg = fg;
        cell.bg = bg;
        cell.dirty = true;
        this._dirtyGridRows[row] = 1;
    }

    /**
     * Write plain text starting at (col, row)
     */
    write(text, col, row, fg, bg) {
        let x = col !== undefined ? col : this.cursorX;
        let y = row !== undefined ? row : this.cursorY;
        
        for (const char of text) {
            if (char === '\n') {
                x = col || 0;
                y++;
                continue;
            }
            
            this.setCell(x, y, char, fg, bg);
            x++;
            
            if (x >= this.cols) {
                x = 0;
                y++;
            }
            
            if (y >= this.rows) {
                this.scroll(1);
                y = this.rows - 1;
            }
        }
        
        this.cursorX = x;
        this.cursorY = y;
    }

    /**
     * Write ANSI-styled text starting at (col, row).
     * Parses escape sequences and applies colors/attributes per character.
     */
    writeAnsi(text, col, row) {
        const styled = this._ansiParser.parse(text);
        let x = col !== undefined ? col : this.cursorX;
        let y = row !== undefined ? row : this.cursorY;

        for (const { char, style } of styled) {
            if (char === '\n') {
                x = col || 0;
                y++;
                continue;
            }

            const { fg, bg } = style.getEffectiveColors();
            this.setCell(x, y, char, fg, bg);
            x++;

            if (x >= this.cols) {
                x = 0;
                y++;
            }

            if (y >= this.rows) {
                this.scroll(1);
                y = this.rows - 1;
            }
        }

        this.cursorX = x;
        this.cursorY = y;
    }

    /**
     * Scroll grid up by N rows.
     * Uses PixelBuffer.scrollUp() for fast copyWithin-based pixel shift.
     */
    scroll(n = 1) {
        if (n <= 0) return;

        // Shift the cell grid
        for (let i = 0; i < n; i++) {
            this.grid.shift();
            this.grid.push(Array.from({ length: this.cols }, () => ({
                char: ' ',
                fg: [255, 255, 255, 255],
                bg: [10, 10, 18, 255],
                dirty: true
            })));
        }

        // Use copyWithin for pixel buffer scroll (much faster than re-rendering)
        this.buffer.scrollUp(n * this.atlas.glyphH, 0x0a0a12);

        // Only the new bottom rows need grid re-render
        this._dirtyGridRows.fill(0);
        for (let r = this.rows - n; r < this.rows; r++) {
            if (r >= 0) this._dirtyGridRows[r] = 1;
        }
    }

    /**
     * Mark all cells as dirty
     */
    forceRedraw() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c].dirty = true;
            }
            this._dirtyGridRows[r] = 1;
        }
    }

    /**
     * Render dirty cells to PixelBuffer.
     * Only processes rows marked dirty in _dirtyGridRows for early skip.
     */
    render() {
        let dirtyCount = 0;
        for (let r = 0; r < this.rows; r++) {
            // Skip entire clean rows
            if (!this._dirtyGridRows[r]) continue;

            let rowHadDirty = false;
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                if (cell.dirty) {
                    // Draw background using Uint32Array bulk fill
                    const [br, bg, bb, ba] = cell.bg;
                    this.buffer.drawRect(
                        c * this.atlas.glyphW, 
                        r * this.atlas.glyphH, 
                        this.atlas.glyphW, 
                        this.atlas.glyphH, 
                        br, bg, bb, ba
                    );
                    
                    // Draw character
                    if (cell.char !== ' ') {
                        this.atlas.drawTextCell(this.buffer, c, r, cell.char, cell.fg);
                    }
                    
                    cell.dirty = false;
                    dirtyCount++;
                    rowHadDirty = true;
                }
            }
            if (!rowHadDirty) {
                this._dirtyGridRows[r] = 0;
            }
        }
        return dirtyCount;
    }

    /**
     * Write to framebuffer using dirty row partial flushes
     */
    flush() {
        const dirty = this.render();
        if (dirty === 0) return false;
        
        // Use framebuffer writer if available (dirty row partial writes)
        if (this._fbWriter) {
            try {
                return this._fbWriter.flush(this.buffer);
            } catch {
                // Fallback to legacy
            }
        }

        // Legacy fallback: full frame writeSync
        try {
            const fd = fs.openSync(this.device, 'w');
            fs.writeSync(fd, Buffer.from(this.buffer._buffer), 0, this.buffer.data.length, 0);
            fs.closeSync(fd);
            this.buffer.clearDirty();
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Synchronous flush (no dynamic import)
     */
    flushSync() {
        const dirty = this.render();
        if (dirty === 0) return false;

        if (this._fbWriter) {
            try {
                return this._fbWriter.flush(this.buffer);
            } catch {}
        }

        return false;
    }
    
    /**
     * Clear the screen
     */
    clear() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this.setCell(c, r, ' ');
            }
        }
        this.cursorX = 0;
        this.cursorY = 0;
    }

    /**
     * Draw a box outline using box-drawing characters
     */
    drawBox(col, row, w, h, style = 'single', fg, bg) {
        const chars = style === 'double' 
            ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
            : { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };

        this.setCell(col, row, chars.tl, fg, bg);
        this.setCell(col + w - 1, row, chars.tr, fg, bg);
        this.setCell(col, row + h - 1, chars.bl, fg, bg);
        this.setCell(col + w - 1, row + h - 1, chars.br, fg, bg);

        for (let x = col + 1; x < col + w - 1; x++) {
            this.setCell(x, row, chars.h, fg, bg);
            this.setCell(x, row + h - 1, chars.h, fg, bg);
        }
        for (let y = row + 1; y < row + h - 1; y++) {
            this.setCell(col, y, chars.v, fg, bg);
            this.setCell(col + w - 1, y, chars.v, fg, bg);
        }
    }

    /**
     * Fill a rectangular region with a character
     */
    fillRect(col, row, w, h, char = ' ', fg, bg) {
        for (let y = row; y < row + h; y++) {
            for (let x = col; x < col + w; x++) {
                this.setCell(x, y, char, fg, bg);
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // Window/Panel System
    // ─────────────────────────────────────────────────────────

    /**
     * Create a new window and register it.
     * @param {object} options - Window options (col, row, width, height, title, border, etc.)
     * @returns {Window} The created window
     */
    createWindow(options = {}) {
        const win = new Window(options);
        this._windows.set(win.id, win);
        this._insertWindowOrder(win);
        this._dirtyWindowRegion(win);
        return win;
    }

    /**
     * Get a window by id
     * @param {string} id
     * @returns {Window|undefined}
     */
    getWindow(id) {
        return this._windows.get(id);
    }

    /**
     * Destroy a window by id, restoring cells underneath
     * @param {string} id
     * @returns {boolean} true if window was found and removed
     */
    destroyWindow(id) {
        const win = this._windows.get(id);
        if (!win) return false;

        // Dirty the region so background is restored
        this._dirtyWindowRegion(win);
        this._windows.delete(id);
        this._windowOrder = this._windowOrder.filter(wid => wid !== id);

        if (this._focusedWindow === id) {
            this._focusedWindow = this._windowOrder.length > 0
                ? this._windowOrder[this._windowOrder.length - 1]
                : null;
        }

        return true;
    }

    /**
     * Get all window ids in z-order (bottom to top)
     * @returns {string[]}
     */
    getWindowIds() {
        return [...this._windowOrder];
    }

    /**
     * Focus a window (brings it to top of z-order)
     * @param {string} id
     * @returns {boolean}
     */
    focusWindow(id) {
        const win = this._windows.get(id);
        if (!win) return false;

        this._focusedWindow = id;
        // Move to top of z-order
        this._windowOrder = this._windowOrder.filter(wid => wid !== id);
        win.zIndex = this._windowOrder.length;
        this._windowOrder.push(id);
        win.invalidate();
        this._dirtyWindowRegion(win);
        return true;
    }

    /**
     * Get the id of the currently focused window
     * @returns {string|null}
     */
    getFocusedWindowId() {
        return this._focusedWindow;
    }

    /**
     * Move a window to a new position
     * @param {string} id
     * @param {number} col
     * @param {number} row
     * @returns {boolean}
     */
    moveWindow(id, col, row) {
        const win = this._windows.get(id);
        if (!win) return false;

        // Dirty old region
        this._dirtyWindowRegion(win);
        win.move(col, row);
        // Dirty new region
        this._dirtyWindowRegion(win);
        return true;
    }

    /**
     * Resize a window
     * @param {string} id
     * @param {number} width
     * @param {number} height
     * @returns {boolean}
     */
    resizeWindow(id, width, height) {
        const win = this._windows.get(id);
        if (!win) return false;

        this._dirtyWindowRegion(win);
        win.resize(width, height);
        this._dirtyWindowRegion(win);
        return true;
    }

    /**
     * Render all windows to the screen grid (compositing).
     * Windows are rendered bottom-to-top in z-order.
     * Only dirty windows are re-rendered.
     * @returns {number} Number of windows re-rendered
     */
    renderWindows() {
        let rendered = 0;
        for (const id of this._windowOrder) {
            const win = this._windows.get(id);
            if (!win || !win.visible) continue;
            if (!win._dirty) continue;
            this._compositeWindow(win);
            win._dirty = false;
            rendered++;
        }
        return rendered;
    }

    /**
     * Composite a single window onto the screen grid.
     * @param {Window} win
     */
    _compositeWindow(win) {
        if (!win.visible) return;

        const { col: offC, row: offR } = win.contentOffset;

        // Draw border
        if (win.border) {
            this._drawWindowBorder(win);
        }

        // Draw title bar
        if (win.title) {
            const titleRow = win.row + (win.border ? 1 : 0);
            const titleCol = win.col + (win.border ? 1 : 0);
            const maxTitleLen = win.width - (win.border ? 2 : 0);

            // Fill title bar background
            for (let i = 0; i < maxTitleLen; i++) {
                this.setCell(titleCol + i, titleRow, ' ', win.titleFg, win.titleBg);
            }
            // Write title text
            for (let i = 0; i < win.title.length && i < maxTitleLen; i++) {
                this.setCell(titleCol + i, titleRow, win.title[i], win.titleFg, win.titleBg);
            }
        }

        // Draw content
        for (let r = 0; r < win.contentRows; r++) {
            for (let c = 0; c < win.contentCols; c++) {
                const cell = win.content[r][c];
                const screenCol = win.col + offC + c;
                const screenRow = win.row + offR + r;
                if (screenCol >= 0 && screenCol < this.cols &&
                    screenRow >= 0 && screenRow < this.rows) {
                    this.setCell(screenCol, screenRow, cell.char, cell.fg, cell.bg);
                }
            }
        }
    }

    /**
     * Draw border around a window using box-drawing characters
     */
    _drawWindowBorder(win) {
        const chars = win.borderStyle === 'double'
            ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
            : { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
        const fg = win.borderFg;
        const bg = win.bg;
        const { col, row, width: w, height: h } = win;

        this.setCell(col, row, chars.tl, fg, bg);
        this.setCell(col + w - 1, row, chars.tr, fg, bg);
        this.setCell(col, row + h - 1, chars.bl, fg, bg);
        this.setCell(col + w - 1, row + h - 1, chars.br, fg, bg);

        for (let x = col + 1; x < col + w - 1; x++) {
            this.setCell(x, row, chars.h, fg, bg);
            this.setCell(x, row + h - 1, chars.h, fg, bg);
        }
        for (let y = row + 1; y < row + h - 1; y++) {
            this.setCell(col, y, chars.v, fg, bg);
            this.setCell(col + w - 1, y, chars.v, fg, bg);
        }
    }

    /**
     * Insert a window id into _windowOrder, sorted by zIndex
     */
    _insertWindowOrder(win) {
        let inserted = false;
        for (let i = 0; i < this._windowOrder.length; i++) {
            const existing = this._windows.get(this._windowOrder[i]);
            if (existing && win.zIndex <= existing.zIndex) {
                this._windowOrder.splice(i, 0, win.id);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this._windowOrder.push(win.id);
        }
    }

    /**
     * Mark screen grid cells dirty in a window's bounding region
     */
    _dirtyWindowRegion(win) {
        for (let r = win.row; r < win.row + win.height; r++) {
            if (r >= 0 && r < this.rows) {
                this._dirtyGridRows[r] = 1;
                for (let c = win.col; c < win.col + win.width; c++) {
                    if (c >= 0 && c < this.cols) {
                        this.grid[r][c].dirty = true;
                    }
                }
            }
        }
    }
}
