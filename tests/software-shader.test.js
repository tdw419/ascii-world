import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { SoftwareShader, compileFormula, normalizeColor, RgbAnimation, Easing } from '../sync/software-shader.js';

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

        it('plasma produces different values at different times', () => {
            const r1 = SoftwareShader.plasma(50, 50, 0);
            const r2 = SoftwareShader.plasma(50, 50, 5);
            // Should produce different colors at different times
            const diff = Math.abs(r1[0] - r2[0]) + Math.abs(r1[1] - r2[1]) + Math.abs(r1[2] - r2[2]);
            assert.ok(diff > 0);
        });

        it('gradient produces expected spatial values', () => {
            const result = SoftwareShader.gradient(240, 120, 0, 480, 240);
            assert.strictEqual(result[0], 127); // x/w*255 = 240/480*255
            assert.strictEqual(result[1], 127); // y/h*255 = 120/240*255
        });

        it('checkerboard alternates cells', () => {
            const c1 = SoftwareShader.checkerboard(0, 0, 0, 8);
            const c2 = SoftwareShader.checkerboard(8, 0, 0, 8);
            // Different cells should have different colors
            assert.notDeepStrictEqual(c1, c2);
        });
    });
});

describe('Easing functions', () => {
    it('linear returns input unchanged', () => {
        assert.strictEqual(Easing.linear(0), 0);
        assert.strictEqual(Easing.linear(0.5), 0.5);
        assert.strictEqual(Easing.linear(1), 1);
    });

    it('easeInQuad accelerates', () => {
        assert.strictEqual(Easing.easeInQuad(0), 0);
        assert.strictEqual(Easing.easeInQuad(0.5), 0.25);
        assert.strictEqual(Easing.easeInQuad(1), 1);
    });

    it('easeOutQuad decelerates', () => {
        assert.strictEqual(Easing.easeOutQuad(0), 0);
        assert.strictEqual(Easing.easeOutQuad(1), 1);
        assert.ok(Easing.easeOutQuad(0.5) > 0.5);
    });

    it('easeInOutQuad is symmetric at midpoint', () => {
        assert.strictEqual(Easing.easeInOutQuad(0), 0);
        assert.strictEqual(Easing.easeInOutQuad(1), 1);
        assert.strictEqual(Easing.easeInOutQuad(0.5), 0.5);
    });

    it('easeInOutSine bounds', () => {
        assert.ok(Math.abs(Easing.easeInOutSine(0)) < 1e-10);
        assert.ok(Math.abs(Easing.easeInOutSine(1) - 1) < 1e-10);
        assert.ok(Easing.easeInOutSine(0.5) > 0.4 && Easing.easeInOutSine(0.5) < 0.6);
    });

    it('easeInCubic', () => {
        assert.strictEqual(Easing.easeInCubic(0), 0);
        assert.strictEqual(Easing.easeInCubic(1), 1);
        assert.strictEqual(Easing.easeInCubic(0.5), 0.125);
    });

    it('easeOutCubic', () => {
        assert.strictEqual(Easing.easeOutCubic(0), 0);
        assert.ok(Math.abs(Easing.easeOutCubic(1) - 1) < 1e-10);
    });

    it('easeInOutCubic', () => {
        assert.strictEqual(Easing.easeInOutCubic(0), 0);
        assert.strictEqual(Easing.easeInOutCubic(1), 1);
    });
});

describe('RgbAnimation', () => {
    describe('construction', () => {
        it('initializes with defaults', () => {
            const anim = new RgbAnimation();
            assert.strictEqual(anim.buffer, null);
            assert.strictEqual(anim.shader, null);
            assert.strictEqual(anim.fps, 30);
            assert.strictEqual(anim.duration, 0);
            assert.strictEqual(anim.loop, true);
            assert.strictEqual(anim.useFastPath, false);
            assert.strictEqual(anim.isRunning, false);
            assert.strictEqual(anim.isPaused, false);
            assert.strictEqual(anim.frameCount, 0);
        });

        it('accepts custom options', () => {
            const buf = new PixelBuffer(10, 10);
            const shader = () => [0, 0, 0];
            const anim = new RgbAnimation({
                buffer: buf,
                shader,
                fps: 60,
                duration: 5,
                loop: false,
                useFastPath: true,
            });
            assert.strictEqual(anim.buffer, buf);
            assert.strictEqual(anim.shader, shader);
            assert.strictEqual(anim.fps, 60);
            assert.strictEqual(anim.duration, 5);
            assert.strictEqual(anim.loop, false);
            assert.strictEqual(anim.useFastPath, true);
        });
    });

    describe('renderFrame', () => {
        it('renders a single frame with time-based shader', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: (x, y, t, elapsed, dt) => {
                    return [t * 255, 0, 0];
                },
            });

            anim.renderFrame(0.5, 1.0, 0.016);
            const [r] = buf.getPixel(0, 0);
            // t=0.5, so t*255 = 127.5, truncated to 127
            assert.strictEqual(r, 127);
        });

        it('increments frameCount on each render', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
            });
            assert.strictEqual(anim.frameCount, 0);
            anim.renderFrame(0, 0, 0);
            assert.strictEqual(anim.frameCount, 1);
            anim.renderFrame(0, 0, 0);
            assert.strictEqual(anim.frameCount, 2);
        });

        it('does nothing without buffer', () => {
            const anim = new RgbAnimation({ shader: () => [0, 0, 0] });
            anim.renderFrame(0, 0, 0);
            assert.strictEqual(anim.frameCount, 0);
        });

        it('does nothing without shader', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({ buffer: buf });
            anim.renderFrame(0, 0, 0);
            assert.strictEqual(anim.frameCount, 0);
        });

        it('passes elapsed and dt to shader', () => {
            const buf = new PixelBuffer(10, 10);
            let receivedElapsed = -1;
            let receivedDt = -1;
            const anim = new RgbAnimation({
                buffer: buf,
                shader: (x, y, t, elapsed, dt) => {
                    receivedElapsed = elapsed;
                    receivedDt = dt;
                    return [0, 0, 0];
                },
            });
            anim.renderFrame(0.5, 2.5, 0.033);
            assert.strictEqual(receivedElapsed, 2.5);
            assert.strictEqual(receivedDt, 0.033);
        });

        it('uses fast path when configured', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: (x, y, t) => PixelBuffer.packRGBA(255, 128, 0, 255),
                useFastPath: true,
            });
            anim.renderFrame(0, 0, 0);
            const [r, g, b] = buf.getPixel(5, 5);
            assert.strictEqual(r, 255);
            assert.strictEqual(g, 128);
            assert.strictEqual(b, 0);
        });

        it('respects region bounds', () => {
            const buf = new PixelBuffer(20, 20);
            buf.clear(0);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [255, 0, 0],
                region: { x: 5, y: 5, w: 10, h: 10 },
            });
            anim.renderFrame(0, 0, 0);
            // Inside region
            const [r1] = buf.getPixel(10, 10);
            assert.strictEqual(r1, 255);
            // Outside region
            const [r2] = buf.getPixel(0, 0);
            assert.strictEqual(r2, 0);
        });
    });

    describe('layers', () => {
        it('addLayer returns this for chaining', () => {
            const anim = new RgbAnimation();
            const result = anim.addLayer({ shader: () => [0, 0, 0] });
            assert.strictEqual(result, anim);
        });

        it('clearLayers empties the layer list', () => {
            const anim = new RgbAnimation();
            anim.addLayer({ shader: () => [0, 0, 0] });
            anim.addLayer({ shader: () => [0, 0, 0] });
            const result = anim.clearLayers();
            assert.strictEqual(result, anim);
            assert.strictEqual(anim._layers.length, 0);
        });

        it('renders layers on top of base shader', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [100, 0, 0],
            });
            // Overlay layer that writes a different color
            anim.addLayer({
                shader: () => [0, 200, 0],
                region: { x: 0, y: 0, w: 5, h: 5 },
            });
            anim.renderFrame(0, 0, 0);
            // Layer overwrote the base color in region
            const [r, g] = buf.getPixel(2, 2);
            assert.strictEqual(g, 200);
        });

        it('renders layer with alpha blending', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [100, 0, 0],
            });
            anim.addLayer({
                shader: () => [0, 200, 0],
                opacity: 0.5,
            });
            anim.renderFrame(0, 0, 0);
            const [r, g] = buf.getPixel(5, 5);
            // Blended: r = 100*0.5 + 0*0.5 = 50, g = 0*0.5 + 200*0.5 = 100
            assert.strictEqual(r, 50);
            assert.strictEqual(g, 100);
        });
    });

    describe('lifecycle', () => {
        it('start sets running state', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
                fps: 100, // High fps for quick testing
            });
            anim.start();
            assert.strictEqual(anim.isRunning, true);
            assert.strictEqual(anim._running, true);
            anim.stop();
        });

        it('stop clears running state', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
            });
            anim.start();
            anim.stop();
            assert.strictEqual(anim.isRunning, false);
            assert.strictEqual(anim._running, false);
        });

        it('start is idempotent', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
            });
            anim.start();
            anim.start(); // second call should be no-op
            assert.strictEqual(anim.isRunning, true);
            anim.stop();
        });

        it('pause/resume works', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
            });
            anim.start();
            assert.strictEqual(anim.isRunning, true);
            assert.strictEqual(anim.isPaused, false);

            anim.pause();
            assert.strictEqual(anim.isRunning, false);
            assert.strictEqual(anim.isPaused, true);

            anim.resume();
            assert.strictEqual(anim.isRunning, true);
            assert.strictEqual(anim.isPaused, false);

            anim.stop();
        });

        it('onFrame callback receives context', async () => {
            const buf = new PixelBuffer(10, 10);
            let receivedCtx = null;
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
                fps: 100,
                onFrame: (ctx) => { receivedCtx = ctx; },
            });
            anim.start();
            // Wait for at least one tick
            await new Promise(r => setTimeout(r, 50));
            anim.stop();
            assert.ok(receivedCtx !== null);
            assert.ok(receivedCtx.buffer === buf);
            assert.strictEqual(typeof receivedCtx.elapsed, 'number');
            assert.strictEqual(typeof receivedCtx.frameCount, 'number');
            assert.strictEqual(typeof receivedCtx.dt, 'number');
        });

        it('auto-stops when duration expires and loop=false', async () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
                fps: 100,
                duration: 0.05, // 50ms
                loop: false,
            });
            anim.start();
            assert.strictEqual(anim._running, true);
            await new Promise(r => setTimeout(r, 200));
            assert.strictEqual(anim._running, false);
        });

        it('loops when duration expires and loop=true', async () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
                fps: 100,
                duration: 0.05,
                loop: true,
            });
            anim.start();
            await new Promise(r => setTimeout(r, 150));
            assert.strictEqual(anim._running, true);
            assert.ok(anim.frameCount > 0);
            anim.stop();
        });
    });

    describe('mouse state', () => {
        it('setMouseState updates position and button', () => {
            const anim = new RgbAnimation();
            anim.setMouseState(100, 200, true);
            assert.strictEqual(anim.mouseX, 100);
            assert.strictEqual(anim.mouseY, 200);
            assert.strictEqual(anim.mouseDown, true);
        });

        it('setMouseState can update position only', () => {
            const anim = new RgbAnimation();
            anim.mouseDown = true;
            anim.setMouseState(50, 60);
            assert.strictEqual(anim.mouseX, 50);
            assert.strictEqual(anim.mouseY, 60);
            assert.strictEqual(anim.mouseDown, true); // unchanged
        });
    });

    describe('animation with time-varying shaders', () => {
        it('produces different frames at different times', () => {
            const buf = new PixelBuffer(64, 64);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: (x, y, t) => {
                    return [
                        (Math.sin(x * 0.1 + t) * 127 + 128) | 0,
                        (Math.cos(y * 0.1 + t) * 127 + 128) | 0,
                        (Math.sin(t * 2) * 127 + 128) | 0,
                    ];
                },
            });

            anim.renderFrame(0, 0, 0);
            const [r1, g1, b1] = buf.getPixel(32, 32);

            anim.renderFrame(2, 2, 0);
            const [r2, g2, b2] = buf.getPixel(32, 32);

            // Different t values should produce different colors
            const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            assert.ok(diff > 0, 'Different time values should produce different pixels');
        });

        it('plasma shader animation across frames', () => {
            const buf = new PixelBuffer(64, 64);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: (x, y, t) => SoftwareShader.plasma(x, y, t),
            });

            anim.renderFrame(0, 0, 0);
            const p1 = buf.getPixel(32, 32);

            anim.renderFrame(5, 5, 0);
            const p2 = buf.getPixel(32, 32);

            // Plasma should vary with time
            assert.ok(
                p1[0] !== p2[0] || p1[1] !== p2[1] || p1[2] !== p2[2],
                'Plasma shader should produce different output at different times'
            );
        });

        it('gradient shader with easing', () => {
            const buf = new PixelBuffer(64, 64);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: (x, y, t) => SoftwareShader.gradient(x, y, t, 64, 64),
                easing: Easing.easeInOutSine,
                duration: 2.0,
            });

            // At t=0 (eased from 0)
            anim.renderFrame(0, 0, 0);
            const [r1] = buf.getPixel(32, 32);

            // At t=0.5 (eased)
            anim.renderFrame(0.5, 1.0, 0);
            const [r2] = buf.getPixel(32, 32);

            // Both should be valid pixel values
            assert.ok(r1 >= 0 && r1 <= 255);
            assert.ok(r2 >= 0 && r2 <= 255);
        });

        it('fast path animation produces correct packed output', () => {
            const buf = new PixelBuffer(10, 10);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: (x, y, t) => {
                    const r = (Math.sin(t) * 127 + 128) | 0;
                    return PixelBuffer.packRGBA(r, 100, 50, 255);
                },
                useFastPath: true,
            });

            anim.renderFrame(1.0, 1.0, 0);
            const [r, g, b] = buf.getPixel(5, 5);
            assert.strictEqual(g, 100);
            assert.strictEqual(b, 50);
            assert.ok(r >= 0 && r <= 255);
        });
    });
});
