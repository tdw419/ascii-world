import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PixelBuffer } from '../sync/pixel-buffer.js';

describe('PixelBuffer', () => {
    it('creates RGBA buffer with correct dimensions', () => {
        const buf = new PixelBuffer(480, 240);
        assert.strictEqual(buf.width, 480);
        assert.strictEqual(buf.height, 240);
        assert.strictEqual(buf.data.length, 480 * 240 * 4);
    });

    it('setPixel writes RGBA values', () => {
        const buf = new PixelBuffer(10, 10);
        buf.setPixel(5, 5, 255, 0, 0, 255);
        const idx = (5 * 10 + 5) * 4;
        assert.strictEqual(buf.data[idx], 255);     // R
        assert.strictEqual(buf.data[idx + 1], 0);   // G
        assert.strictEqual(buf.data[idx + 2], 0);   // B
        assert.strictEqual(buf.data[idx + 3], 255); // A
    });

    it('setPixel ignores out-of-bounds coordinates', () => {
        const buf = new PixelBuffer(10, 10);
        buf.setPixel(-1, 0, 255, 0, 0);
        buf.setPixel(0, -1, 255, 0, 0);
        buf.setPixel(10, 0, 255, 0, 0);
        buf.setPixel(0, 10, 255, 0, 0);
        // No crash, buffer unchanged
        assert.strictEqual(buf.data[0], 0);
    });

    it('getPixel reads RGBA values', () => {
        const buf = new PixelBuffer(10, 10);
        buf.setPixel(3, 7, 100, 200, 50, 128);
        const [r, g, b, a] = buf.getPixel(3, 7);
        assert.strictEqual(r, 100);
        assert.strictEqual(g, 200);
        assert.strictEqual(b, 50);
        assert.strictEqual(a, 128);
    });

    it('drawRect fills a rectangular region', () => {
        const buf = new PixelBuffer(80, 24);
        buf.drawRect(10, 5, 40, 2, 0, 255, 0, 255);
        // First pixel of rect
        const [r1, g1] = buf.getPixel(10, 5);
        assert.strictEqual(r1, 0);
        assert.strictEqual(g1, 255);
        // Last pixel of rect
        const [r2, g2] = buf.getPixel(49, 6);
        assert.strictEqual(r2, 0);
        assert.strictEqual(g2, 255);
        // Outside rect
        const [r3, g3] = buf.getPixel(9, 5);
        assert.strictEqual(r3, 0);
        assert.strictEqual(g3, 0);
    });

    it('drawProgressBar renders filled and empty regions', () => {
        const buf = new PixelBuffer(80, 24);
        buf.drawProgressBar(10, 5, 40, 1, 0.75, [0, 255, 0], [128, 128, 128]);
        // 75% of 40 = 30 filled pixels
        const [, gFilled] = buf.getPixel(10, 5);
        assert.strictEqual(gFilled, 255); // Green fill
        const [rEmpty] = buf.getPixel(41, 5);
        assert.strictEqual(rEmpty, 128);  // Gray empty
    });

    it('fill sets entire buffer to color', () => {
        const buf = new PixelBuffer(4, 4);
        buf.fill(10, 20, 30, 255);
        for (let i = 0; i < 16; i++) {
            assert.strictEqual(buf.data[i * 4], 10);
            assert.strictEqual(buf.data[i * 4 + 1], 20);
            assert.strictEqual(buf.data[i * 4 + 2], 30);
        }
    });

    it('getRegion extracts sub-buffer', () => {
        const buf = new PixelBuffer(10, 10);
        buf.setPixel(2, 3, 255, 0, 0);
        const region = buf.getRegion(2, 3, 1, 1);
        assert.strictEqual(region[0], 255);
    });

    it('toPNG returns valid PNG buffer', async () => {
        const buf = new PixelBuffer(10, 10);
        buf.fill(255, 0, 0, 255);
        const png = await buf.toPNG();
        // PNG magic bytes
        assert.strictEqual(png[0], 0x89);
        assert.strictEqual(png[1], 0x50); // P
        assert.strictEqual(png[2], 0x4E); // N
        assert.strictEqual(png[3], 0x47); // G
    });
});
