// tests/pixel-formula-engine.test.js
// Tests for pixel-native formula engine

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PixelFormulaEngine } from '../sync/pixel-formula-engine.js';

describe('PixelFormulaEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new PixelFormulaEngine(480, 240);
    });

    it('creates buffer with correct dimensions', () => {
        assert.strictEqual(engine.width, 480);
        assert.strictEqual(engine.height, 240);
        assert.strictEqual(engine.buffer.data.length, 480 * 240 * 4);
    });

    it('clear fills buffer with dark color', () => {
        engine.clear();
        const [r, g, b] = engine.buffer.getPixel(0, 0);
        assert.strictEqual(r, 0x0a);
        assert.strictEqual(g, 0x0a);
        assert.strictEqual(b, 0x0f);
    });

    it('setCells stores cell values', () => {
        engine.setCells({ cpu: 0.67, mem: 28.1 });
        assert.strictEqual(engine.cells.cpu, 0.67);
        assert.strictEqual(engine.cells.mem, 28.1);
    });

    it('resolveValue returns literal values', () => {
        assert.strictEqual(engine.resolveValue(42), 42);
        assert.strictEqual(engine.resolveValue('hello'), 'hello');
    });

    it('resolveValue looks up cell references', () => {
        engine.setCells({ cpu: 0.67 });
        assert.strictEqual(engine.resolveValue('cpu'), 0.67);
    });

    it('BAR draws progress bar', () => {
        engine.setCells({ cpu: 0.5 });
        engine.BAR(0, 0, 'cpu', 10);

        // At 50%, first 5 cells should be green, last 5 should be dark
        const filled = engine.buffer.getPixel(15, 5);  // 3rd cell (inside filled area)
        const empty = engine.buffer.getPixel(40, 5);   // 7th cell (inside empty area)

        assert.deepStrictEqual(filled.slice(0, 3), [0x23, 0x86, 0x36]); // barFill
        assert.deepStrictEqual(empty.slice(0, 3), [0x16, 0x1b, 0x22]); // barEmpty
    });

    it('TEXT draws text at cell coordinates', () => {
        engine.setCells({ label: 'CPU' });
        engine.TEXT(0, 0, 'label');

        // Check that pixels are non-zero (text was drawn)
        // Character 'C' starts at pixel 0
        const pixel = engine.buffer.getPixel(1, 2);
        assert.ok(pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0, 'Text should draw non-zero pixels');
    });

    it('STATUS draws status indicator', () => {
        engine.setCells({ state: 1 });
        engine.STATUS(0, 0, 'state', 2, '◉ done', 1, '● active', '○ idle');

        // Should render '● active' in green
        const pixel = engine.buffer.getPixel(3, 5);
        assert.deepStrictEqual(pixel.slice(0, 3), [0x3f, 0xb9, 0x50]); // active green
    });

    it('BOX draws a box outline', () => {
        engine.BOX(0, 0, 10, 5);

        // Check corners have border color
        const tl = engine.buffer.getPixel(0, 0);
        const tr = engine.buffer.getPixel(59, 0);  // 10 cells * 6 pixels - 1
        const bl = engine.buffer.getPixel(0, 49);  // 5 cells * 10 pixels - 1
        const br = engine.buffer.getPixel(59, 49);

        for (const corner of [tl, tr, bl, br]) {
            assert.deepStrictEqual(corner.slice(0, 3), [0x30, 0x36, 0x3d], 'Corner should be border color');
        }
    });

    it('SPARKLINE draws sparkline from history', () => {
        engine.setCells({ history: [0.2, 0.4, 0.6, 0.8, 1.0] });
        engine.SPARKLINE(0, 0, 'history', 5);

        // Last bar should be tallest (value 1.0)
        // Check bottom row of last bar - should have fill color
        const lastBarBottom = engine.buffer.getPixel(29, 9); // 5th cell bottom row
        assert.deepStrictEqual(lastBarBottom.slice(0, 3), [0x23, 0x86, 0x36]); // barFill
    });

    it('renderTemplate evaluates a pixel template', () => {
        engine.setCells({ cpu: 0.75 });

        const template = [
            { fn: 'BAR', args: [0, 0, 'cpu', 20] },
            { fn: 'TEXT', args: [22, 0, 'cpu'] },
        ];

        const buf = engine.renderTemplate(template);

        // Verify buffer was rendered (not just cleared)
        assert.ok(buf instanceof engine.buffer.constructor);

        // Check that bar was drawn (pixel at 15,5 should be barFill)
        const barPixel = engine.buffer.getPixel(45, 5); // Inside 75% filled area
        assert.deepStrictEqual(barPixel.slice(0, 3), [0x23, 0x86, 0x36]); // barFill
    });

    it('toPNG produces valid PNG buffer', async () => {
        engine.BAR(0, 0, 0.5, 10);
        const png = await engine.toPNG();

        // PNG magic bytes
        assert.strictEqual(png[0], 0x89);
        assert.strictEqual(png[1], 0x50); // 'P'
        assert.strictEqual(png[2], 0x4E); // 'N'
        assert.strictEqual(png[3], 0x47); // 'G'
    });

    // New formula tests

    it('resolveColor returns color array', () => {
        assert.deepStrictEqual(engine.resolveColor('active'), [0x3f, 0xb9, 0x50]);
        assert.deepStrictEqual(engine.resolveColor([255, 0, 0]), [255, 0, 0]);
        assert.deepStrictEqual(engine.resolveColor(0xff0000), [255, 0, 0]);
    });

    it('RECT draws filled rectangle', () => {
        engine.clear();
        engine.RECT(0, 0, 5, 3, 'barFill');

        // Check inside rect has color
        const inside = engine.buffer.getPixel(10, 10);
        assert.deepStrictEqual(inside.slice(0, 3), [0x23, 0x86, 0x36]);
    });

    it('LINE draws horizontal line', () => {
        engine.clear();
        engine.LINE(0, 5, 10, 'h', 'border');

        // Check line pixels at row 5 (y = 5 * 10 = 50)
        const pixel = engine.buffer.getPixel(30, 50);
        assert.deepStrictEqual(pixel.slice(0, 3), [0x30, 0x36, 0x3d]);
    });

    it('LINE draws vertical line', () => {
        engine.clear();
        engine.LINE(5, 0, 5, 'v', 'border');

        // Check line pixels at col 5 (x = 5 * 6 = 30)
        const pixel = engine.buffer.getPixel(30, 25);
        assert.deepStrictEqual(pixel.slice(0, 3), [0x30, 0x36, 0x3d]);
    });

    it('CIRCLE draws filled circle', () => {
        engine.clear();
        engine.CIRCLE(5, 3, 2, 'active', true);

        // Check center pixel (col 5 = 30px, row 3 = 30px, center at ~33, 35)
        const center = engine.buffer.getPixel(33, 35);
        assert.deepStrictEqual(center.slice(0, 3), [0x3f, 0xb9, 0x50]);
    });

    it('GAUGE draws circular gauge', () => {
        engine.clear();
        engine.setCells({ cpu: 0.75 });
        engine.GAUGE(5, 3, 'cpu', 2, 'active');

        // Check center pixel is filled
        const center = engine.buffer.getPixel(33, 35);
        assert.deepStrictEqual(center.slice(0, 3), [0x3f, 0xb9, 0x50]);
    });

    it('NUMBER formats percentage', () => {
        engine.clear();
        engine.setCells({ cpu: 0.75 });
        engine.NUMBER(0, 0, 'cpu', '0%');

        // Check text was drawn (7 should be visible)
        const pixel = engine.buffer.getPixel(10, 5);
        assert.ok(pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0, 'NUMBER should draw pixels');
    });

    it('TIME draws current time', () => {
        engine.clear();
        engine.TIME(0, 0, 'HH:mm');

        // Check text was drawn
        const pixel = engine.buffer.getPixel(10, 5);
        assert.ok(pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0, 'TIME should draw pixels');
    });
});
