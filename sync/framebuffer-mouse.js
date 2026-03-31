// framebuffer-mouse.js — Integrates MouseInput with PixelBuffer/FramebufferWriter
//
// Bridges mouse events to framebuffer operations:
// - Cursor rendering (software cursor overlay)
// - Click-to-paint (draw pixels at click position)
// - Drag-to-paint (draw along drag path using Bresenham line)
// - Hit regions (rectangular clickable zones with callbacks)
// - Scroll actions (scroll PixelBuffer content on scroll wheel)
//
// Usage:
//   const fbMouse = new FramebufferMouse({ pixelBuffer, mouse, framebufferWriter });
//   fbMouse.addHitRegion(10, 10, 100, 30, () => console.log('clicked!'));
//   fbMouse.start();

import { PixelBuffer } from './pixel-buffer.js';

/**
 * Bresenham's line algorithm — yields all integer points between (x0,y0) and (x1,y1)
 */
function* bresenhamLine(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        yield [x0, y0];
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

export class FramebufferMouse {
    /**
     * @param {Object} options
     * @param {PixelBuffer} options.pixelBuffer - The pixel buffer to draw on
     * @param {import('./mouse-input.js').MouseInput} [options.mouse] - Mouse input device (created if not provided)
     * @param {import('./framebuffer-writer.js').FramebufferWriter} [options.framebufferWriter] - Optional writer for auto-flush
     * @param {number[]} [options.brushColor] - [r, g, b, a] for painting (default white)
     * @param {number} [options.brushSize] - Brush radius in pixels (default 1)
     * @param {boolean} [options.showCursor] - Whether to render software cursor (default true)
     * @param {number[]} [options.cursorColor] - Cursor color [r, g, b, a] (default yellow)
     */
    constructor(options = {}) {
        this.pixelBuffer = options.pixelBuffer || null;
        this.mouse = options.mouse || null;
        this.framebufferWriter = options.framebufferWriter || null;

        // Painting
        this.brushColor = options.brushColor || [255, 255, 255, 255];
        this.brushSize = options.brushSize || 1;
        this.paintMode = options.paintMode || false; // Whether clicks paint pixels

        // Cursor
        this.showCursor = options.showCursor !== false;
        this.cursorColor = options.cursorColor || [255, 255, 0, 255];
        this._cursorVisible = false;
        this._savedCursorRegion = null;
        this._lastCursorX = -1;
        this._lastCursorY = -1;

        // Hit regions: { x, y, w, h, id, handler }
        this._hitRegions = [];
        this._nextRegionId = 1;

        // Last paint position for drag-to-paint line interpolation
        this._lastPaintX = -1;
        this._lastPaintY = -1;

        // Event listener references for cleanup
        this._listeners = [];

        // Previous button state for click-through on hit regions
        this._lastClickX = -1;
        this._lastClickY = -1;
    }

    /**
     * Start listening to mouse events and rendering cursor
     */
    start() {
        if (!this.mouse) return;

        const onMove = (e) => this._handleMove(e);
        const onMouseDown = (e) => this._handleMouseDown(e);
        const onClick = (e) => this._handleClick(e);
        const onRightClick = (e) => this._handleRightClick(e);
        const onDrag = (e) => this._handleDrag(e);
        const onDragEnd = (e) => this._handleDragEnd(e);
        const onScroll = (e) => this._handleScroll(e);
        const onDblClick = (e) => this._handleDblClick(e);

        this.mouse.on('move', onMove);
        this.mouse.on('mousedown', onMouseDown);
        this.mouse.on('click', onClick);
        this.mouse.on('rightclick', onRightClick);
        this.mouse.on('drag', onDrag);
        this.mouse.on('dragend', onDragEnd);
        this.mouse.on('scroll', onScroll);
        this.mouse.on('dblclick', onDblClick);

        this._listeners = [
            ['move', onMove],
            ['mousedown', onMouseDown],
            ['click', onClick],
            ['rightclick', onRightClick],
            ['drag', onDrag],
            ['dragend', onDragEnd],
            ['scroll', onScroll],
            ['dblclick', onDblClick],
        ];

        // Show cursor at initial position
        if (this.showCursor && this.pixelBuffer) {
            this._renderCursor(this.mouse.x, this.mouse.y);
        }
    }

    /**
     * Stop listening and clean up cursor
     */
    stop() {
        if (this._cursorVisible) {
            this._restoreCursorRegion();
        }
        for (const [event, handler] of this._listeners) {
            this.mouse.off(event, handler);
        }
        this._listeners = [];
    }

    /**
     * Add a rectangular hit region that responds to clicks
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {Function} handler - Callback invoked with { x, y, id, region }
     * @returns {number} Region ID
     */
    addHitRegion(x, y, w, h, handler) {
        const id = this._nextRegionId++;
        this._hitRegions.push({ x, y, w, h, id, handler });
        return id;
    }

    /**
     * Remove a hit region by ID
     * @param {number} id
     * @returns {boolean} Whether region was found and removed
     */
    removeHitRegion(id) {
        const idx = this._hitRegions.findIndex(r => r.id === id);
        if (idx === -1) return false;
        this._hitRegions.splice(idx, 1);
        return true;
    }

    /**
     * Find hit region at given coordinates
     * @param {number} x
     * @param {number} y
     * @returns {Object|null} The matching region or null
     */
    hitTest(x, y) {
        for (let i = this._hitRegions.length - 1; i >= 0; i--) {
            const r = this._hitRegions[i];
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
                return r;
            }
        }
        return null;
    }

    /**
     * Paint a single pixel (or brush-sized circle) onto the pixel buffer
     */
    paintAt(x, y) {
        if (!this.pixelBuffer) return;
        const [r, g, b, a] = this.brushColor;
        const size = this.brushSize;

        if (size <= 1) {
            this.pixelBuffer.setPixel(x, y, r, g, b, a);
        } else {
            // Circle brush
            const radius = size - 1;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx * dx + dy * dy <= radius * radius) {
                        this.pixelBuffer.setPixel(x + dx, y + dy, r, g, b, a);
                    }
                }
            }
        }
    }

    /**
     * Paint a line between two points (for smooth drag painting)
     */
    paintLine(x0, y0, x1, y1) {
        for (const [px, py] of bresenhamLine(x0, y0, x1, y1)) {
            this.paintAt(px, py);
        }
    }

    /**
     * Flush pixel buffer to framebuffer if writer is available
     */
    flush() {
        if (this.framebufferWriter && this.pixelBuffer) {
            return this.framebufferWriter.flush(this.pixelBuffer);
        }
        return false;
    }

    // --- Private methods ---

    _handleMove(e) {
        if (!this.pixelBuffer) return;

        // Restore pixels under old cursor position
        if (this._cursorVisible) {
            this._restoreCursorRegion();
        }

        // Render cursor at new position
        if (this.showCursor) {
            this._renderCursor(e.x, e.y);
        }
    }

    _handleMouseDown(e) {
        // In paint mode, set the initial paint position on press (not release)
        if (this.paintMode && this.pixelBuffer && e.button === 'left') {
            this.paintAt(e.x, e.y);
            this._lastPaintX = e.x;
            this._lastPaintY = e.y;
            this.flush();
        }
    }

    _handleClick(e) {
        this._lastClickX = e.x;
        this._lastClickY = e.y;

        // Check hit regions first
        const region = this.hitTest(e.x, e.y);
        if (region) {
            region.handler({ x: e.x, y: e.y, id: region.id, button: 'left', region });
        }

        // Paint mode: ensure click position is painted
        if (this.paintMode && this.pixelBuffer) {
            this.paintAt(e.x, e.y);
            this._lastPaintX = -1;
            this._lastPaintY = -1;
            this.flush();
        }
    }

    _handleRightClick(e) {
        const region = this.hitTest(e.x, e.y);
        if (region && region.handler) {
            region.handler({ x: e.x, y: e.y, id: region.id, button: 'right', region });
        }
    }

    _handleDrag(e) {
        if (this.paintMode && this.pixelBuffer) {
            // Interpolate from last paint position for smooth lines
            if (this._lastPaintX >= 0 && this._lastPaintY >= 0) {
                this.paintLine(this._lastPaintX, this._lastPaintY, e.x, e.y);
            } else {
                this.paintAt(e.x, e.y);
            }
            this._lastPaintX = e.x;
            this._lastPaintY = e.y;
            this.flush();
        }
    }

    _handleDragEnd(e) {
        this._lastPaintX = -1;
        this._lastPaintY = -1;
    }

    _handleScroll(e) {
        if (!this.pixelBuffer) return;

        // Scroll the pixel buffer content
        const direction = e.delta > 0 ? -1 : 1; // scroll up = content moves down
        const lines = Math.abs(e.delta);

        for (let i = 0; i < lines; i++) {
            this.pixelBuffer.scrollUp(direction > 0 ? 1 : -1);
        }

        // Re-render cursor since content shifted
        if (this._cursorVisible) {
            this._restoreCursorRegion();
            if (this.showCursor) {
                this._renderCursor(this.mouse.x, this.mouse.y);
            }
        }

        this.flush();
    }

    _handleDblClick(e) {
        // Check hit regions for double-click
        const region = this.hitTest(e.x, e.y);
        if (region) {
            // Emit a double-click specific event via region handler
            region.handler({ x: e.x, y: e.y, id: region.id, button: e.button, region, dblclick: true });
        }
    }

    /**
     * Save the region under the cursor and draw cursor sprite
     */
    _renderCursor(x, y) {
        if (!this.pixelBuffer) return;
        const size = 5;
        const half = Math.floor(size / 2);

        // Save region before drawing cursor
        this._savedCursorRegion = {
            x: x - half,
            y: y - half,
            w: size,
            h: size,
            data: this.pixelBuffer.getRegion(
                Math.max(0, x - half),
                Math.max(0, y - half),
                size,
                size
            ),
        };
        this._lastCursorX = x;
        this._lastCursorY = y;
        this._cursorVisible = true;

        // Draw crosshair cursor
        const [r, g, b, a] = this.cursorColor;
        this.pixelBuffer.setPixel(x, y, r, g, b, a);
        // Horizontal arms
        this.pixelBuffer.setPixel(x - 1, y, r, g, b, a);
        this.pixelBuffer.setPixel(x + 1, y, r, g, b, a);
        // Vertical arms
        this.pixelBuffer.setPixel(x, y - 1, r, g, b, a);
        this.pixelBuffer.setPixel(x, y + 1, r, g, b, a);
    }

    /**
     * Restore the pixel region saved before cursor was drawn
     */
    _restoreCursorRegion() {
        if (!this._savedCursorRegion || !this.pixelBuffer) {
            this._cursorVisible = false;
            return;
        }
        const { x, y, w, h, data } = this._savedCursorRegion;
        this.pixelBuffer.setRegion(x, y, w, h, data);
        this._cursorVisible = false;
    }
}

export { bresenhamLine };
