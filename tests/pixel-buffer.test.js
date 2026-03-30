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

    it('has Uint32Array view sharing same memory', () => {
        const buf = new PixelBuffer(10, 10);
        assert.strictEqual(buf.data32.length, 100);
        assert.strictEqual(buf.data.buffer, buf.data32.buffer);
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

    it('setPixel marks row as dirty', () => {
        const buf = new PixelBuffer(10, 10);
        buf.clearDirty();
        buf.setPixel(5, 3, 255, 0, 0);
        assert.strictEqual(buf._dirtyRows[3], 1);
        assert.strictEqual(buf._dirtyRows[0], 0);
    });

    it('setPixel ignores out-of-bounds coordinates', () => {
        const buf = new PixelBuffer(10, 10);
        buf.setPixel(-1, 0, 255, 0, 0);
        buf.setPixel(0, -1, 255, 0, 0);
        buf.setPixel(10, 0, 255, 0, 0);
        buf.setPixel(0, 10, 255, 0, 0);
        assert.strictEqual(buf.data[0], 0);
    });

    it('setPixel32 writes packed value and marks dirty', () => {
        const buf = new PixelBuffer(10, 10);
        buf.clearDirty();
        const packed = PixelBuffer.packRGBA(255, 0, 0, 255);
        buf.setPixel32(5, 5, packed);
        const [r, g, b, a] = buf.getPixel(5, 5);
        assert.strictEqual(r, 255);
        assert.strictEqual(g, 0);
        assert.strictEqual(b, 0);
        assert.strictEqual(a, 255);
        assert.strictEqual(buf._dirtyRows[5], 1);
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

    it('getPixel32 returns packed value matching data32 view', () => {
        const buf = new PixelBuffer(10, 10);
        buf.setPixel(3, 7, 100, 200, 50, 128);
        const packed = buf.getPixel32(3, 7);
        // Verify round-trip through unpack
        const [r, g, b, a] = PixelBuffer.unpackRGBA(packed);
        assert.strictEqual(r, 100);
        assert.strictEqual(g, 200);
        assert.strictEqual(b, 50);
        assert.strictEqual(a, 128);
    });

    it('packRGBA/unpackRGBA round-trips correctly', () => {
        const packed = PixelBuffer.packRGBA(100, 200, 50, 128);
        const [r, g, b, a] = PixelBuffer.unpackRGBA(packed);
        assert.strictEqual(r, 100);
        assert.strictEqual(g, 200);
        assert.strictEqual(b, 50);
        assert.strictEqual(a, 128);
    });

    it('fill uses Uint32Array bulk write', () => {
        const buf = new PixelBuffer(4, 4);
        buf.fill(10, 20, 30, 255);
        for (let i = 0; i < 16; i++) {
            assert.strictEqual(buf.data[i * 4], 10);
            assert.strictEqual(buf.data[i * 4 + 1], 20);
            assert.strictEqual(buf.data[i * 4 + 2], 30);
            assert.strictEqual(buf.data[i * 4 + 3], 255);
        }
        // Verify all rows dirty
        for (let y = 0; y < 4; y++) {
            assert.strictEqual(buf._dirtyRows[y], 1);
        }
    });

    it('drawRect fills a rectangular region using Uint32', () => {
        const buf = new PixelBuffer(80, 24);
        buf.drawRect(10, 5, 40, 2, 0, 255, 0, 255);
        const [r1, g1] = buf.getPixel(10, 5);
        assert.strictEqual(r1, 0);
        assert.strictEqual(g1, 255);
        const [r2, g2] = buf.getPixel(49, 6);
        assert.strictEqual(r2, 0);
        assert.strictEqual(g2, 255);
        const [r3, g3] = buf.getPixel(9, 5);
        assert.strictEqual(r3, 0);
        assert.strictEqual(g3, 0);
    });

    it('drawRect clips to buffer bounds', () => {
        const buf = new PixelBuffer(10, 10);
        buf.drawRect(-2, -2, 5, 5, 255, 0, 0);
        // Should not crash, and pixels within bounds should be set
        const [r] = buf.getPixel(0, 0);
        assert.strictEqual(r, 255);
        // Out of rect
        const [r2] = buf.getPixel(3, 3);
        assert.strictEqual(r2, 0);
    });

    it('drawProgressBar renders filled and empty regions', () => {
        const buf = new PixelBuffer(80, 24);
        buf.drawProgressBar(10, 5, 40, 1, 0.75, [0, 255, 0], [128, 128, 128]);
        const [, gFilled] = buf.getPixel(10, 5);
        assert.strictEqual(gFilled, 255);
        const [rEmpty] = buf.getPixel(41, 5);
        assert.strictEqual(rEmpty, 128);
    });

    it('scrollUp shifts pixels and clears bottom', () => {
        const buf = new PixelBuffer(10, 20);
        buf.setPixel(0, 0, 255, 0, 0);
        buf.setPixel(0, 10, 0, 255, 0);
        buf.scrollUp(10);
        // Row 0 should now have what was at row 10
        const [r, g] = buf.getPixel(0, 0);
        assert.strictEqual(r, 0);
        assert.strictEqual(g, 255);
        // Bottom rows should be cleared
        const [r2, g2, b2] = buf.getPixel(0, 15);
        // Should be the background color
        assert.ok(r2 + g2 + b2 < 100); // dark background
    });

    it('scrollUp with full height clears buffer', () => {
        const buf = new PixelBuffer(10, 10);
        buf.fill(255, 0, 0);
        buf.scrollUp(10);
        // All cleared
        const [r] = buf.getPixel(5, 5);
        assert.ok(r < 20); // background color
    });

    it('getDirtyRowRanges returns contiguous ranges', () => {
        const buf = new PixelBuffer(10, 20);
        buf.clearDirty();
        buf.setPixel(0, 3, 255, 0, 0);
        buf.setPixel(0, 4, 255, 0, 0);
        buf.setPixel(0, 5, 255, 0, 0);
        buf.setPixel(0, 10, 0, 255, 0);
        const ranges = buf.getDirtyRowRanges();
        assert.strictEqual(ranges.length, 2);
        assert.deepStrictEqual(ranges[0], { start: 3, count: 3 });
        assert.deepStrictEqual(ranges[1], { start: 10, count: 1 });
    });

    it('getRowSlice returns correct byte range', () => {
        const buf = new PixelBuffer(10, 10);
        buf.setPixel(5, 3, 255, 0, 0);
        const { offset, buffer } = buf.getRowSlice(3, 1);
        assert.strictEqual(offset, 3 * 10 * 4);
        assert.strictEqual(buffer.length, 10 * 4);
        // Pixel at x=5 in the slice
        assert.strictEqual(buffer[5 * 4], 255);
    });

    it('clearDirty and isDirty work correctly', () => {
        const buf = new PixelBuffer(10, 10);
        assert.ok(buf.isDirty()); // dirty initially
        buf.clearDirty();
        assert.ok(!buf.isDirty());
        buf.setPixel(0, 0, 255, 0, 0);
        assert.ok(buf.isDirty());
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
        assert.strictEqual(png[0], 0x89);
        assert.strictEqual(png[1], 0x50);
        assert.strictEqual(png[2], 0x4E);
        assert.strictEqual(png[3], 0x47);
    });
});
