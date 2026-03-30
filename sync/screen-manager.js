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
}
