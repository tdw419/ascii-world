// pixel-buffer.js — RGBA pixel buffer for direct pixel rendering
// Source of truth for the pixel-native reactive cell system.
// No text intermediary. Formulas write here directly.

export class PixelBuffer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }

    setPixel(x, y, r, g, b, a = 255) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = (y * this.width + x) * 4;
        this.data[idx] = r;
        this.data[idx + 1] = g;
        this.data[idx + 2] = b;
        this.data[idx + 3] = a;
    }

    getPixel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0];
        const idx = (y * this.width + x) * 4;
        return [this.data[idx], this.data[idx + 1], this.data[idx + 2], this.data[idx + 3]];
    }

    fill(r, g, b, a = 255) {
        for (let i = 0; i < this.width * this.height; i++) {
            this.data[i * 4] = r;
            this.data[i * 4 + 1] = g;
            this.data[i * 4 + 2] = b;
            this.data[i * 4 + 3] = a;
        }
    }

    drawRect(x, y, w, h, r, g, b, a = 255) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                this.setPixel(x + dx, y + dy, r, g, b, a);
            }
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
