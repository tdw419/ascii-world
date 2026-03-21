import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GlyphAtlas } from '../sync/glyph-atlas.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';

describe('GlyphAtlas', () => {
    it('creates atlas with specified glyph dimensions', () => {
        const atlas = new GlyphAtlas(6, 10);
        assert.strictEqual(atlas.glyphW, 6);
        assert.strictEqual(atlas.glyphH, 10);
    });

    it('getGlyph returns bitmap for printable ASCII', () => {
        const atlas = new GlyphAtlas(6, 10);
        const bitmap = atlas.getGlyph('A');
        assert.strictEqual(bitmap.length, 10); // 10 rows
        assert.ok(bitmap.some(row => row !== 0)); // Not all blank
    });

    it('getGlyph returns blank for space', () => {
        const atlas = new GlyphAtlas(6, 10);
        const bitmap = atlas.getGlyph(' ');
        assert.ok(bitmap.every(row => row === 0));
    });

    it('getGlyph returns something for box drawing chars', () => {
        const atlas = new GlyphAtlas(6, 10);
        const bitmap = atlas.getGlyph('─');
        assert.ok(bitmap.some(row => row !== 0));
    });

    it('getGlyph returns something for block elements', () => {
        const atlas = new GlyphAtlas(6, 10);
        const full = atlas.getGlyph('█');
        assert.ok(full.every(row => row !== 0)); // Full block = all rows lit
    });

    it('drawText renders characters to pixel buffer', () => {
        const atlas = new GlyphAtlas(6, 10);
        const buf = new PixelBuffer(480, 240);
        atlas.drawText(buf, 0, 0, 'AB', [255, 255, 255]);
        // Check that some pixels were written in the first glyph region
        let hasPixels = false;
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 6; x++) {
                const [r] = buf.getPixel(x, y);
                if (r > 0) hasPixels = true;
            }
        }
        assert.ok(hasPixels, 'Expected drawText to write some pixels for "A"');
    });

    it('drawText advances cursor by glyph width', () => {
        const atlas = new GlyphAtlas(6, 10);
        const buf = new PixelBuffer(480, 240);
        atlas.drawText(buf, 0, 0, 'AB', [255, 0, 0]);
        // Second char 'B' starts at x=6
        let hasPixelsInB = false;
        for (let y = 0; y < 10; y++) {
            for (let x = 6; x < 12; x++) {
                const [r] = buf.getPixel(x, y);
                if (r > 0) hasPixelsInB = true;
            }
        }
        assert.ok(hasPixelsInB, 'Expected drawText to write pixels for "B" at x=6');
    });
});
