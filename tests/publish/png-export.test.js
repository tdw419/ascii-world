// tests/publish/png-export.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import { exportPNG, exportPNGMulti, getExportDimensions } from '../../sync/publish/png-export.js';

describe('PNG Export', () => {
    const sampleASCII = [
        '╔══════════════════════════════════╗',
        '║ Hello ASCII World                ║',
        '╠══════════════════════════════════╣',
        '║ Status: ● Active                 ║',
        '║ Memory: ▓▓▓▓▓▓░░░░ 60%          ║',
        '╚══════════════════════════════════╝',
    ].join('\n');

    it('exports at 1x scale (480x240)', async () => {
        const png = await exportPNG({ asciiContent: sampleASCII, scale: 1 });

        assert.ok(Buffer.isBuffer(png), 'Should return a Buffer');
        assert.ok(png.length > 0, 'Buffer should not be empty');

        // Verify it's a valid PNG by reading with sharp
        const metadata = await sharp(png).metadata();
        assert.strictEqual(metadata.width, 480);
        assert.strictEqual(metadata.height, 240);
        assert.strictEqual(metadata.format, 'png');
    });

    it('exports at 2x scale (960x480)', async () => {
        const png = await exportPNG({ asciiContent: sampleASCII, scale: 2 });

        const metadata = await sharp(png).metadata();
        assert.strictEqual(metadata.width, 960);
        assert.strictEqual(metadata.height, 480);
        assert.strictEqual(metadata.format, 'png');
    });

    it('exports at 4x scale (1920x960)', async () => {
        const png = await exportPNG({ asciiContent: sampleASCII, scale: 4 });

        const metadata = await sharp(png).metadata();
        assert.strictEqual(metadata.width, 1920);
        assert.strictEqual(metadata.height, 960);
        assert.strictEqual(metadata.format, 'png');
    });

    it('throws for missing asciiContent', async () => {
        await assert.rejects(
            () => exportPNG({ asciiContent: '' }),
            /asciiContent is required/
        );
    });

    it('throws for invalid scale', async () => {
        await assert.rejects(
            () => exportPNG({ asciiContent: 'hello', scale: 3 }),
            /Invalid scale/
        );
    });

    it('getExportDimensions returns correct values for each scale', () => {
        const d1 = getExportDimensions(1);
        assert.strictEqual(d1.cellWidth, 80);
        assert.strictEqual(d1.cellHeight, 24);
        assert.strictEqual(d1.pixelWidth, 480);
        assert.strictEqual(d1.pixelHeight, 240);

        const d2 = getExportDimensions(2);
        assert.strictEqual(d2.pixelWidth, 960);
        assert.strictEqual(d2.pixelHeight, 480);

        const d4 = getExportDimensions(4);
        assert.strictEqual(d4.pixelWidth, 1920);
        assert.strictEqual(d4.pixelHeight, 960);
    });

    it('exportPNGMulti exports all scales at once', async () => {
        const results = await exportPNGMulti({ asciiContent: sampleASCII, scales: [1, 2] });

        assert.ok(results['1x'], 'Should have 1x result');
        assert.ok(results['2x'], 'Should have 2x result');

        const meta1 = await sharp(results['1x']).metadata();
        assert.strictEqual(meta1.width, 480);

        const meta2 = await sharp(results['2x']).metadata();
        assert.strictEqual(meta2.width, 960);
    });

    it('handles empty content gracefully', async () => {
        // Single space — still valid
        const png = await exportPNG({ asciiContent: ' ', scale: 1 });
        const metadata = await sharp(png).metadata();
        assert.strictEqual(metadata.width, 480);
        assert.strictEqual(metadata.height, 240);
    });

    it('handles unicode box drawing characters', async () => {
        const unicodeContent = '┌─┐\n│█│\n└─┘';
        const png = await exportPNG({ asciiContent: unicodeContent, scale: 1 });
        assert.ok(Buffer.isBuffer(png));
        const metadata = await sharp(png).metadata();
        assert.strictEqual(metadata.format, 'png');
    });
});
