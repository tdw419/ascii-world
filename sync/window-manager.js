// sync/window-manager.js — Window/Panel abstraction for ScreenManager
// Part of Phase 3 Feature Enhancement: "Create window/panel system"

import { EventEmitter } from 'events';

export class Window extends EventEmitter {
    constructor(options = {}) {
        super();
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.title = options.title || 'Window';
        
        // Position and size in cells (cols/rows)
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.w = options.w || 20;
        this.h = options.h || 10;
        
        this.active = true;
        this.focused = false;
        this.style = options.style || 'single';
        this.fg = options.fg || [255, 255, 255, 255];
        this.bg = options.bg || [20, 20, 30, 255];
        
        // Window local grid
        this.grid = Array.from({ length: this.h }, () => 
            Array.from({ length: this.w }, () => ({
                char: ' ',
                fg: this.fg,
                bg: this.bg,
                dirty: true
            }))
        );
    }

    /**
     * Set a cell within the window (local coordinates)
     */
    setCell(x, y, char, fg, bg) {
        if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
        const cell = this.grid[y][x];
        cell.char = char;
        if (fg) cell.fg = fg;
        if (bg) cell.bg = bg;
        cell.dirty = true;
    }

    /**
     * Clear the window content
     */
    clear() {
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                this.setCell(x, y, ' ', this.fg, this.bg);
            }
        }
    }

    /**
     * Draw window to a ScreenManager
     */
    draw(screen) {
        if (!this.active) return;

        // Draw border
        screen.drawBox(this.x, this.y, this.w, this.h, this.style, this.fg, this.bg);
        
        // Draw title
        if (this.title) {
            const titleStr = ` ${this.title} `;
            const titleX = this.x + Math.floor((this.w - titleStr.length) / 2);
            screen.write(titleStr, titleX, this.y, this.focused ? [0, 255, 255, 255] : this.fg, this.bg);
        }

        // Draw content
        for (let y = 1; y < this.h - 1; y++) {
            for (let x = 1; x < this.w - 1; x++) {
                const cell = this.grid[y][x];
                screen.setCell(this.x + x, this.y + y, cell.char, cell.fg, cell.bg);
            }
        }
    }

    /**
     * Move window
     */
    move(x, y) {
        this.x = x;
        this.y = y;
        this.emit('moved', { x, y });
    }

    /**
     * Resize window
     */
    resize(w, h) {
        this.w = w;
        this.h = h;
        // Re-init grid (simplified)
        this.grid = Array.from({ length: this.h }, () => 
            Array.from({ length: this.w }, () => ({
                char: ' ',
                fg: this.fg,
                bg: this.bg,
                dirty: true
            }))
        );
        this.emit('resized', { w, h });
    }
}

export class WindowManager {
    constructor(screen) {
        this.screen = screen;
        this.windows = [];
        this.focusedWindow = null;
    }

    addWindow(win) {
        this.windows.push(win);
        this.focusedWindow = win;
        win.focused = true;
        return win;
    }

    removeWindow(id) {
        this.windows = this.windows.filter(w => w.id !== id);
        if (this.focusedWindow?.id === id) {
            this.focusedWindow = this.windows[this.windows.length - 1] || null;
            if (this.focusedWindow) this.focusedWindow.focused = true;
        }
    }

    render() {
        for (const win of this.windows) {
            win.draw(this.screen);
        }
    }

    handleMouse(event) {
        // Simple hit test for focus/drag (to be implemented)
        if (event.button === 'left') {
            const col = Math.floor(event.x / this.screen.atlas.glyphW);
            const row = Math.floor(event.y / this.screen.atlas.glyphH);
            
            // Reverse order for top-down hit test
            for (let i = this.windows.length - 1; i >= 0; i--) {
                const win = this.windows[i];
                if (col >= win.x && col < win.x + win.w && row >= win.y && row < win.y + win.h) {
                    // Focus window
                    if (this.focusedWindow) this.focusedWindow.focused = false;
                    this.focusedWindow = win;
                    win.focused = true;
                    // Move to top of stack
                    this.windows.splice(i, 1);
                    this.windows.push(win);
                    return true;
                }
            }
        }
        return false;
    }
}
