// framebuffer-writer.js — Stride-aware framebuffer output with dirty row optimization
//
// From research doc: "Hardware alignment requirements often dictate that each row of
// pixels must end on a specific byte boundary. Failure to account for this stride
// results in a skewed or torn image."
//
// Supports:
// - ioctl-equivalent screen info queries via /sys/class/graphics/fb0
// - Stride (line_length) vs visible width (xres) handling
// - Dirty row partial writes (pwrite64-style)
// - Full frame fallback via writeSync

import * as fs from 'fs';
import * as path from 'path';

/**
 * Screen info from framebuffer sysfs (equivalent to fb_var_screeninfo + fb_fix_screeninfo)
 */
function queryScreenInfo(device = '/dev/fb0') {
    const fbName = path.basename(device); // e.g. 'fb0'
    const sysPath = `/sys/class/graphics/${fbName}`;

    const info = {
        xres: 1920,
        yres: 1080,
        bitsPerPixel: 32,
        lineLength: 0, // stride in bytes
        smemLen: 0,
    };

    try {
        // Try reading from sysfs (safer than ioctl from Node.js)
        const modes = fs.readFileSync(path.join(sysPath, 'modes'), 'utf-8').trim();
        // Format: "U:1920x1080p-60" or similar
        const match = modes.match(/(\d+)x(\d+)/);
        if (match) {
            info.xres = parseInt(match[1]);
            info.yres = parseInt(match[2]);
        }

        const bpp = fs.readFileSync(path.join(sysPath, 'bits_per_pixel'), 'utf-8').trim();
        info.bitsPerPixel = parseInt(bpp) || 32;

        const stride = fs.readFileSync(path.join(sysPath, 'stride'), 'utf-8').trim();
        info.lineLength = parseInt(stride) || 0;
    } catch {
        // Fallback: compute from dimensions
    }

    // Compute stride if not available from sysfs
    if (!info.lineLength) {
        info.lineLength = info.xres * (info.bitsPerPixel / 8);
    }

    info.smemLen = info.lineLength * info.yres;

    return info;
}

export class FramebufferWriter {
    constructor(options = {}) {
        this.device = options.device || '/dev/fb0';
        this.screenInfo = options.screenInfo || null;
        this._fd = null;
    }

    /**
     * Query and cache screen info
     */
    getScreenInfo() {
        if (!this.screenInfo) {
            this.screenInfo = queryScreenInfo(this.device);
        }
        return this.screenInfo;
    }

    /**
     * Open the framebuffer device for writing
     */
    open() {
        if (this._fd !== null) return;
        try {
            this._fd = fs.openSync(this.device, 'w');
        } catch (e) {
            this._fd = null;
            throw new Error(`Cannot open framebuffer ${this.device}: ${e.message}`);
        }
    }

    /**
     * Close the framebuffer device
     */
    close() {
        if (this._fd !== null) {
            try { fs.closeSync(this._fd); } catch {}
            this._fd = null;
        }
    }

    /**
     * Write a PixelBuffer to the framebuffer, handling stride differences.
     * If lineLength > xres * bytesPerPixel, we must pad each row.
     */
    writeFullFrame(pixelBuffer) {
        const info = this.getScreenInfo();
        const bytesPerPixel = info.bitsPerPixel / 8;
        const visibleStride = info.xres * bytesPerPixel;

        // Fast path: stride matches visible width (no padding needed)
        if (info.lineLength === visibleStride) {
            return this._writeAt(0, Buffer.from(pixelBuffer._buffer));
        }

        // Slow path: stride differs, must write row-by-row with padding
        const frameBuffer = Buffer.alloc(info.smemLen, 0);
        for (let y = 0; y < Math.min(pixelBuffer.height, info.yres); y++) {
            const srcOffset = y * pixelBuffer.width * 4;
            const dstOffset = y * info.lineLength;
            const rowBytes = Math.min(visibleStride, pixelBuffer.width * 4);
            Buffer.from(pixelBuffer._buffer, srcOffset, rowBytes).copy(frameBuffer, dstOffset);
        }
        return this._writeAt(0, frameBuffer);
    }

    /**
     * Write only dirty rows from a PixelBuffer (partial flush).
     * Massive bandwidth savings: ~99.9% reduction for single-char updates.
     */
    writeDirtyRows(pixelBuffer) {
        const ranges = pixelBuffer.getDirtyRowRanges();
        if (ranges.length === 0) return false;

        const info = this.getScreenInfo();
        const bytesPerPixel = info.bitsPerPixel / 8;
        const visibleStride = info.xres * bytesPerPixel;
        const strideMatch = info.lineLength === visibleStride;

        for (const { start, count } of ranges) {
            if (strideMatch) {
                // Fast: contiguous row range, direct pwrite
                const { offset, buffer } = pixelBuffer.getRowSlice(start, count);
                this._writeAt(offset, buffer);
            } else {
                // Stride-aware: pad each row
                for (let y = start; y < start + count && y < info.yres; y++) {
                    const srcOffset = y * pixelBuffer.width * 4;
                    const dstOffset = y * info.lineLength;
                    const rowBytes = Math.min(visibleStride, pixelBuffer.width * 4);
                    const rowBuf = Buffer.from(pixelBuffer._buffer, srcOffset, rowBytes);
                    this._writeAt(dstOffset, rowBuf);
                }
            }
        }

        pixelBuffer.clearDirty();
        return true;
    }

    /**
     * Write buffer at specific byte offset (pwrite64 equivalent)
     */
    _writeAt(offset, buffer) {
        try {
            const fd = this._fd !== null ? this._fd : fs.openSync(this.device, 'w');
            fs.writeSync(fd, buffer, 0, buffer.length, offset);
            if (this._fd === null) fs.closeSync(fd);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Convenience: flush a PixelBuffer with automatic dirty detection
     */
    flush(pixelBuffer) {
        if (!pixelBuffer.isDirty()) return false;
        return this.writeDirtyRows(pixelBuffer);
    }
}

export { queryScreenInfo };
