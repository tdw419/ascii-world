import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { SoftwareShader, compileFormula, normalizeColor } from '../sync/software-shader.js';

describe('SoftwareShader', () => {
    describe('normalizeColor', () => {
        it('handles grayscale number', () => {
            const c = normalizeColor(128);
            assert.deepStrictEqual(c, { r: 128, g: 128, b: 128, a: 255 });
        });

        it('handles packed hex color', () => {
            const c = normalizeColor(0xFF0000);
            assert.deepStrictEqual(c, { r: 255, g: 0, b: 0, a: 255 });
        });

        it('handles RGB array', () => {
            const c = normalizeColor([10, 20, 30]);
            assert.deepStrictEqual(c, { r: 10, g: 20, b: 30, a: 255 });
        });

        it('handles RGBA array', () => {
            const c = normalizeColor([10, 20, 30, 128]);
            assert.deepStrictEqual(c, { r: 10, g: 20, b: 30, a: 128 });
        });

        it('handles object with r,g,b', () => {
            const c = normalizeColor({ r: 10, g: 20, b: 30 });
            assert.deepStrictEqual(c, { r: 10, g: 20, b: 30, a: 255 });
        });

        it('clamps values to 0-255', () => {
            const c = normalizeColor([-10, 300, 128]);
            assert.strictEqual(c.r, 0);
            assert.strictEqual(c.g, 255);
            assert.strictEqual(c.b, 128);
        });
    });

    describe('compileFormula', () => {
        it('compiles arrow function string', () => {
            const fn = compileFormula('(x, y) => x + y');
            assert.strictEqual(fn(3, 4), 7);
        });

        it('compiles shorthand expression', () => {
            const fn = compileFormula('(x ^ y) & 0xFF');
            assert.strictEqual(fn(0xAA, 0x55), 0xFF);
        });

        it('throws on invalid formula', () => {
            assert.throws(() => compileFormula('}{invalid'));
        });
    });

    describe('render', () => {
        it('applies formula to entire buffer', () => {
            const buf = new PixelBuffer(10, 10);
            SoftwareShader.render(buf, (x, y) => [x * 25, y * 25, 0]);
            const [r, g] = buf.getPixel(5, 5);
            assert.strictEqual(r, 125);
            assert.strictEqual(g, 125);
        });

        it('applies formula to a sub-region', () => {
            const buf = new PixelBuffer(20, 20);
            SoftwareShader.render(buf, () => [255, 0, 0], { x: 5, y: 5, w: 10, h: 10 });
            const [r1] = buf.getPixel(10, 10);
            assert.strictEqual(r1, 255);
            const [r2] = buf.getPixel(0, 0);
            assert.strictEqual(r2, 0);
        });

        it('passes time parameter', () => {
            const buf = new PixelBuffer(10, 10);
            SoftwareShader.render(buf, (x, y, t) => [t * 255, 0, 0], null, 1.0);
            const [r] = buf.getPixel(0, 0);
            assert.strictEqual(r, 255);
        });
    });

    describe('renderFast', () => {
        it('writes packed Uint32 values', () => {
            const buf = new PixelBuffer(10, 10);
            const packed = PixelBuffer.packRGBA(255, 0, 0, 255);
            SoftwareShader.renderFast(buf, () => packed);
            const [r, g, b, a] = buf.getPixel(5, 5);
            assert.strictEqual(r, 255);
            assert.strictEqual(g, 0);
            assert.strictEqual(b, 0);
            assert.strictEqual(a, 255);
        });
    });

    describe('built-in shaders', () => {
        it('xorPattern produces deterministic output', () => {
            const result = SoftwareShader.xorPattern(0xAA, 0x55);
            assert.deepStrictEqual(result, [0xFF, 0xFF, 0xFF]);
        });

        it('plasma returns RGB array', () => {
            const result = SoftwareShader.plasma(50, 50, 0);
            assert.strictEqual(result.length, 3);
            assert.ok(result[0] >= 0 && result[0] <= 255);
        });

        it('mandelbrot returns RGB array', () => {
            const result = SoftwareShader.mandelbrot(0, 0, 0);
            assert.strictEqual(result.length, 3);
        });

        it('getBuiltin returns known shaders', () => {
            assert.ok(SoftwareShader.getBuiltin('xor'));
            assert.ok(SoftwareShader.getBuiltin('plasma'));
            assert.ok(SoftwareShader.getBuiltin('mandelbrot'));
            assert.strictEqual(SoftwareShader.getBuiltin('nonexistent'), null);
        });

        it('renders full buffer with xor shader', () => {
            const buf = new PixelBuffer(64, 64);
            SoftwareShader.render(buf, SoftwareShader.xorPattern);
            // Verify some pixels
            const [r0] = buf.getPixel(0, 0); // 0 ^ 0 = 0
            assert.strictEqual(r0, 0);
            const [r1] = buf.getPixel(15, 15); // 15 ^ 15 = 0
            assert.strictEqual(r1, 0);
            const [r2] = buf.getPixel(0, 255 % 64); // 0 ^ N
            assert.ok(r2 >= 0);
        });
    });
});
