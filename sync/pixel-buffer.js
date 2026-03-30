// pixel-buffer.js — RGBA pixel buffer for direct pixel rendering
// Source of truth for the pixel-native reactive cell system.
// No text intermediary. Formulas write here directly.
//
// Optimizations from framebuffer research:
// - Uint32Array view for bulk operations (4x faster clears/fills)
// - copyWithin for scroll (memmove-equivalent)
// - Dirty row tracking for partial flushes
// - Stride-aware layout for framebuffer hardware alignment

export class PixelBuffer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        // Shared backing buffer for dual views
        this._buffer = new ArrayBuffer(width * height * 4);
        this.data = new Uint8ClampedArray(this._buffer);
        // Uint32Array view for bulk operations (same memory, zero copy)
        this.data32 = new Uint32Array(this._buffer);
        // Dirty row tracking: bitmask per row
        this._dirtyRows = new Uint8Array(height);
        this._dirtyRows.fill(1); // all dirty initially
    }

    /**
     * Pack RGBA into a single Uint32 value (little-endian: ABGR in memory)
     */
    static packRGBA(r, g, b, a = 255) {
        return (a << 24) | (b << 16) | (g << 8) | r;
    }

    /**
     * Unpack Uint32 to [r, g, b, a]
     */
    static unpackRGBA(val) {
        return [val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF];
    }

    setPixel(x, y, r, g, b, a = 255) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = (y * this.width + x) * 4;
        this.data[idx] = r;
        this.data[idx + 1] = g;
        this.data[idx + 2] = b;
        this.data[idx + 3] = a;
        this._dirtyRows[y] = 1;
    }

    /**
     * Set pixel using packed Uint32 value (4x faster for known colors)
     */
    setPixel32(x, y, rgba32) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.data32[y * this.width + x] = rgba32;
        this._dirtyRows[y] = 1;
    }

    getPixel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0];
        const idx = (y * this.width + x) * 4;
        return [this.data[idx], this.data[idx + 1], this.data[idx + 2], this.data[idx + 3]];
    }

    /**
     * Get pixel as packed Uint32
     */
    getPixel32(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.data32[y * this.width + x];
    }

    /**
     * Fill entire buffer using Uint32Array bulk write (4x faster than per-byte)
     */
    fill(r, g, b, a = 255) {
        const packed = PixelBuffer.packRGBA(r, g, b, a);
        this.data32.fill(packed);
        this._dirtyRows.fill(1);
    }

    clear(color = 0x0a0a0f) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        this.fill(r, g, b, 255);
    }

    /**
     * Fill rectangle using Uint32Array bulk write
     */
    drawRect(x, y, w, h, r, g, b, a = 255) {
        const packed = PixelBuffer.packRGBA(r, g, b, a);
        const x0 = Math.max(0, x);
        const y0 = Math.max(0, y);
        const x1 = Math.min(this.width, x + w);
        const y1 = Math.min(this.height, y + h);
        for (let dy = y0; dy < y1; dy++) {
            const rowStart = dy * this.width + x0;
            this.data32.fill(packed, rowStart, rowStart + (x1 - x0));
            this._dirtyRows[dy] = 1;
        }
    }

    drawProgressBar(x, y, w, h, fraction, fillColor, emptyColor) {
        const filled = Math.round(w * Math.max(0, Math.min(1, fraction)));
        this.drawRect(x, y, filled, h, fillColor[0], fillColor[1], fillColor[2], fillColor[3] ?? 255);
        this.drawRect(x + filled, y, w - filled, h, emptyColor[0], emptyColor[1], emptyColor[2], emptyColor[3] ?? 255);
    }

    getRegion(x, y, w, h) {
        const region = new Uint8ClampedArray(w * h * 4);
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const srcIdx = ((y + dy) * this.width + (x + dx)) * 4;
                const dstIdx = (dy * w + dx) * 4;
                region[dstIdx] = this.data[srcIdx];
                region[dstIdx + 1] = this.data[srcIdx + 1];
                region[dstIdx + 2] = this.data[srcIdx + 2];
                region[dstIdx + 3] = this.data[srcIdx + 3];
            }
        }
        return region;
    }

    setRegion(x, y, w, h, data) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const srcIdx = (dy * w + dx) * 4;
                this.setPixel(x + dx, y + dy, data[srcIdx], data[srcIdx + 1], data[srcIdx + 2], data[srcIdx + 3]);
            }
        }
    }

    /**
     * Scroll buffer up by N pixel rows using copyWithin (memmove-equivalent).
     * Much faster than shifting grid arrays — moves raw bytes in contiguous memory.
     * Clears the newly exposed bottom rows to bgColor.
     */
    scrollUp(pixelRows, bgColor = 0x0a0a0f) {
        if (pixelRows <= 0 || pixelRows >= this.height) {
            if (pixelRows >= this.height) this.clear(bgColor);
            return;
        }
        // Shift pixel data up: copy from row pixelRows..end to row 0
        const srcOffset = pixelRows * this.width;
        this.data32.copyWithin(0, srcOffset);
        // Clear the newly exposed rows at the bottom
        const bgPacked = PixelBuffer.packRGBA(
            (bgColor >> 16) & 0xFF, (bgColor >> 8) & 0xFF, bgColor & 0xFF, 255
        );
        const clearStart = (this.height - pixelRows) * this.width;
        this.data32.fill(bgPacked, clearStart);
        this._dirtyRows.fill(1);
    }

    /**
     * Get contiguous ranges of dirty rows for partial flush.
     * Returns array of { start, count } objects.
     */
    getDirtyRowRanges() {
        const ranges = [];
        let inRange = false;
        let start = 0;
        for (let y = 0; y <= this.height; y++) {
            const dirty = y < this.height && this._dirtyRows[y];
            if (dirty && !inRange) {
                start = y;
                inRange = true;
            } else if (!dirty && inRange) {
                ranges.push({ start, count: y - start });
                inRange = false;
            }
        }
        return ranges;
    }

    /**
     * Get raw byte slice for a range of rows (for partial framebuffer write).
     * Returns { offset, buffer } where offset is byte position in framebuffer.
     */
    getRowSlice(startRow, count) {
        const byteOffset = startRow * this.width * 4;
        const byteLength = count * this.width * 4;
        return {
            offset: byteOffset,
            buffer: Buffer.from(this._buffer, byteOffset, byteLength)
        };
    }

    /**
     * Clear dirty row tracking (call after successful flush)
     */
    clearDirty() {
        this._dirtyRows.fill(0);
    }

    /**
     * Mark specific rows as dirty
     */
    markRowsDirty(startRow, count) {
        const end = Math.min(startRow + count, this.height);
        for (let y = startRow; y < end; y++) {
            this._dirtyRows[y] = 1;
        }
    }

    /**
     * Check if any rows are dirty
     */
    isDirty() {
        for (let y = 0; y < this.height; y++) {
            if (this._dirtyRows[y]) return true;
        }
        return false;
    }

    async toPNG() {
        const sharp = (await import('sharp')).default;
        return sharp(Buffer.from(this.data), {
            raw: { width: this.width, height: this.height, channels: 4 }
        }).png().toBuffer();
    }

    toASCII(cellW = 6, cellH = 10) {
        // Sample pixel buffer at cell intervals, map brightness to characters
        const gridW = Math.floor(this.width / cellW);
        const gridH = Math.floor(this.height / cellH);
        const lines = [];
        for (let row = 0; row < gridH; row++) {
            let line = '';
            for (let col = 0; col < gridW; col++) {
                // Sample center pixel of cell
                const px = col * cellW + Math.floor(cellW / 2);
                const py = row * cellH + Math.floor(cellH / 2);
                const [r, g, b] = this.getPixel(px, py);
                const brightness = (r + g + b) / 3;
                line += brightness > 192 ? '█' : brightness > 128 ? '▓' : brightness > 64 ? '▒' : brightness > 16 ? '░' : ' ';
            }
            lines.push(line);
        }
        return lines.join('\n');
    }
}
