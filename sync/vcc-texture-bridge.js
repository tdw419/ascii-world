// sync/vcc-texture-bridge.js
// Reads GlyphLang VCC colony texture from /dev/shm/vcc_colony.rgba
// and feeds it into the dashboard as live pixel data + scalar stats.
//
// The VCC texture is 256x256 RGBA written by the Rust WGSL runner.
// Each pixel represents one VM's state on the Hilbert curve grid.

import { openSync, readSync, closeSync, existsSync, statSync } from 'fs';
import { PixelBuffer } from './pixel-buffer.js';

const VCC_WIDTH = 256;
const VCC_HEIGHT = 256;
const VCC_PIXELS = VCC_WIDTH * VCC_HEIGHT;
const VCC_BYTES = VCC_PIXELS * 4;
const SHM_PATH = '/dev/shm/vcc_colony.rgba';

export class VCCTextureBridge {
    /**
     * @param {object} options
     * @param {import('./cell-store.js').CellStore} options.cellStore - for scalar stats
     * @param {function} options.onFrame - called with {rgba: Uint8ClampedArray, stats: object} each frame
     * @param {function} options.onError - called on errors
     * @param {string} [options.shmPath] - shared memory file path
     */
    constructor(options = {}) {
        this.cellStore = options.cellStore || null;
        this.onFrame = options.onFrame || (() => {});
        this.onError = options.onError || (() => {});
        this.shmPath = options.shmPath || SHM_PATH;
        this.interval = null;
        this.fd = null;
        this.buf = Buffer.alloc(VCC_BYTES);
        this.lastStats = null;
        this.frameCount = 0;
    }

    start(pollMs = 100) {
        if (this.interval) return;
        console.log(`[VCC-BRIDGE] Starting texture reader from ${this.shmPath}...`);

        // Try to open SHM file immediately
        this._openFd();

        this.interval = setInterval(() => this._poll(), pollMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this._closeFd();
    }

    _openFd() {
        try {
            if (existsSync(this.shmPath)) {
                this.fd = openSync(this.shmPath, 'r');
                console.log('[VCC-BRIDGE] SHM file opened');
                return true;
            }
        } catch (err) {
            // Will retry next poll
        }
        return false;
    }

    _closeFd() {
        if (this.fd !== null) {
            try { closeSync(this.fd); } catch {}
            this.fd = null;
        }
    }

    _poll() {
        // Open FD if we don't have one
        if (this.fd === null) {
            if (!this._openFd()) return;
        }

        try {
            readSync(this.fd, this.buf, 0, VCC_BYTES, 0);
        } catch (err) {
            // SHM file was deleted or GlyphLang restarted — close and retry next cycle
            this._closeFd();
            return;
        }

        const stats = this._computeStats();
        this.frameCount++;
        this.lastStats = stats;

        // Push scalar stats to CellStore for dashboard gauges
        if (this.cellStore) {
            this.cellStore.setCells({
                vcc_status: 'LIVE',
                vcc_status_color: 'active',
                vcc_active_vms: stats.activeVMs,
                vcc_total_vms: stats.totalVMs,
                vcc_fill_pct: stats.fillPct,
                vcc_colony_fps: stats.estimatedFPS,
                vcc_last_frame: new Date().toLocaleTimeString(),
            });
        }

        this.onFrame({ rgba: this.buf, stats });
    }

    /**
     * Compute stats from the raw RGBA buffer.
     * A VM is "active" if its pixel is non-zero (GlyphLang writes rgba8unorm).
     */
    _computeStats() {
        let activeVMs = 0;
        let totalBrightness = 0;

        for (let i = 0; i < VCC_PIXELS; i++) {
            const offset = i * 4;
            const r = this.buf[offset];
            const g = this.buf[offset + 1];
            const b = this.buf[offset + 2];
            const brightness = r + g + b;

            if (brightness > 0) {
                activeVMs++;
                totalBrightness += brightness;
            }
        }

        const totalVMs = VCC_PIXELS;
        const fillPct = ((activeVMs / totalVMs) * 100).toFixed(1);
        const avgBrightness = activeVMs > 0 ? (totalBrightness / activeVMs / 765 * 100).toFixed(0) : 0;

        return {
            activeVMs,
            totalVMs,
            fillPct: parseFloat(fillPct),
            avgBrightness: parseInt(avgBrightness),
            estimatedFPS: 0, // Updated externally if we have timing data
        };
    }

    /**
     * Downsample the 256x256 texture to fit a target region.
     * Returns a PixelBuffer of the target size.
     */
    downsample(targetW, targetH) {
        const out = new PixelBuffer(targetW, targetH);
        const scaleX = VCC_WIDTH / targetW;
        const scaleY = VCC_HEIGHT / targetH;

        for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
                // Sample the center pixel of each block
                const srcX = Math.floor(x * scaleX + scaleX / 2);
                const srcY = Math.floor(y * scaleY + scaleY / 2);
                const srcIdx = (srcY * VCC_WIDTH + srcX) * 4;
                out.setPixel(x, y,
                    this.buf[srcIdx],
                    this.buf[srcIdx + 1],
                    this.buf[srcIdx + 2],
                    this.buf[srcIdx + 3]
                );
            }
        }
        return out;
    }

    /**
     * Convert the texture to ASCII art for terminal display.
     * Uses brightness-based character mapping.
     */
    toASCII(cols = 64, rows = 24) {
        const scaleX = VCC_WIDTH / cols;
        const scaleY = VCC_HEIGHT / rows;
        const chars = ' .:-=+*#%@';
        const lines = [];

        for (let y = 0; y < rows; y++) {
            let line = '';
            for (let x = 0; x < cols; x++) {
                const srcX = Math.floor(x * scaleX + scaleX / 2);
                const srcY = Math.floor(y * scaleY + scaleY / 2);
                const srcIdx = (srcY * VCC_WIDTH + srcX) * 4;
                const r = this.buf[srcIdx];
                const g = this.buf[srcIdx + 1];
                const b = this.buf[srcIdx + 2];
                const brightness = (r + g + b) / 3;
                const charIdx = Math.min(chars.length - 1, Math.floor(brightness / 256 * chars.length));
                line += chars[charIdx];
            }
            lines.push(line);
        }
        return lines.join('\n');
    }

    /**
     * Get raw RGBA buffer for HTTP serving / WebSocket broadcast.
     */
    getRawRGBA() {
        return Buffer.from(this.buf);
    }

    /**
     * Get stats snapshot
     */
    getStats() {
        return this.lastStats || { activeVMs: 0, totalVMs: VCC_PIXELS, fillPct: 0, avgBrightness: 0 };
    }
}
