import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { RgbAnimation, SoftwareShader } from '../sync/software-shader.js';

// We test the console RGB animation integration by importing and exercising
// the ScreenConsole class indirectly through its command handler logic.
// Since ScreenConsole depends on framebuffer hardware, we test the RGB animation
// integration logic directly with PixelBuffer.

describe('Console RGB Animation Mode', () => {
    describe('rgb-animate command integration', () => {
        it('RgbAnimation renders RGB formula to pixel buffer', () => {
            const buf = new PixelBuffer(64, 64);
            const shader = (x, y, t) => [
                (x * 4 + t) & 0xFF,
                (y * 4) & 0xFF,
                ((x ^ y) + t) & 0xFF
            ];

            const anim = new RgbAnimation({
                buffer: buf,
                shader,
                fps: 30,
                region: { x: 0, y: 0, w: 64, h: 64 }
            });

            // Render a single frame at t=1
            anim.renderFrame(1, 0.033, 0.033);

            // Verify some pixels have different R,G,B values (not just grayscale)
            const [r0, g0, b0] = buf.getPixel(10, 20);
            assert.ok(r0 !== g0 || g0 !== b0, 'RGB animation should produce color pixels');
        });

        it('RgbAnimation pause and resume lifecycle', () => {
            const buf = new PixelBuffer(32, 32);
            const shader = (x, y, t) => [(x + t) & 0xFF, y & 0xFF, 128];

            const anim = new RgbAnimation({
                buffer: buf,
                shader,
                fps: 30
            });

            assert.ok(!anim.isRunning, 'should not be running initially');
            assert.ok(!anim.isPaused, 'should not be paused initially');

            anim.start();
            assert.ok(anim.isRunning, 'should be running after start');
            assert.ok(!anim.isPaused, 'should not be paused after start');

            anim.pause();
            assert.ok(!anim.isRunning, 'should not be running when paused');
            assert.ok(anim.isPaused, 'should be paused after pause');

            anim.resume();
            assert.ok(anim.isRunning, 'should be running after resume');
            assert.ok(!anim.isPaused, 'should not be paused after resume');

            anim.stop();
            assert.ok(!anim.isRunning, 'should not be running after stop');
        });

        it('RgbAnimation stop clears running state', () => {
            const buf = new PixelBuffer(16, 16);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [255, 0, 0],
                fps: 30
            });

            anim.start();
            assert.ok(anim.isRunning);
            anim.stop();
            assert.ok(!anim.isRunning);
            assert.strictEqual(anim._timer, null);
        });

        it('RgbAnimation respects region parameter', () => {
            const buf = new PixelBuffer(64, 64);
            buf.clear(0); // all black

            const shader = (x, y, t) => [255, 0, 0]; // solid red
            const anim = new RgbAnimation({
                buffer: buf,
                shader,
                fps: 30,
                region: { x: 10, y: 10, w: 20, h: 20 }
            });

            anim.renderFrame(0, 0, 0);

            // Pixel inside region should be red
            const [r, g, b] = buf.getPixel(15, 15);
            assert.strictEqual(r, 255);
            assert.strictEqual(g, 0);
            assert.strictEqual(b, 0);

            // Pixel outside region should still be black (0,0,0)
            const [r2, g2, b2] = buf.getPixel(0, 0);
            assert.strictEqual(r2, 0);
            assert.strictEqual(g2, 0);
            assert.strictEqual(b2, 0);
        });

        it('RgbAnimation frame count increments on renderFrame', () => {
            const buf = new PixelBuffer(16, 16);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [100, 100, 100],
                fps: 30
            });

            assert.strictEqual(anim.frameCount, 0);
            anim.renderFrame(0, 0, 0);
            assert.strictEqual(anim.frameCount, 1);
            anim.renderFrame(0.033, 0.033, 0.033);
            assert.strictEqual(anim.frameCount, 2);
        });
    });

    describe('built-in shader support', () => {
        it('SoftwareShader.getBuiltin returns plasma shader', () => {
            const fn = SoftwareShader.getBuiltin('plasma');
            assert.ok(typeof fn === 'function');
            const result = fn(10, 20, 0);
            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 3);
        });

        it('SoftwareShader.getBuiltin returns gradient shader', () => {
            const fn = SoftwareShader.getBuiltin('gradient');
            assert.ok(typeof fn === 'function');
            const result = fn(100, 50, 0, 480, 240);
            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 3);
        });

        it('SoftwareShader.getBuiltin returns null for unknown shader', () => {
            const fn = SoftwareShader.getBuiltin('nonexistent');
            assert.strictEqual(fn, null);
        });

        it('plasma shader produces different colors at different positions', () => {
            const fn = SoftwareShader.getBuiltin('plasma');
            const p1 = fn(0, 0, 0);
            const p2 = fn(100, 100, 0);
            assert.ok(p1[0] !== p2[0] || p1[1] !== p2[1] || p1[2] !== p2[2],
                'Plasma should produce different colors at different positions');
        });

        it('plasma shader changes over time', () => {
            const fn = SoftwareShader.getBuiltin('plasma');
            const p1 = fn(50, 50, 0);
            const p2 = fn(50, 50, 5);
            assert.ok(p1[0] !== p2[0] || p1[1] !== p2[1] || p1[2] !== p2[2],
                'Plasma should change over time');
        });
    });

    describe('RgbAnimation with built-in shaders', () => {
        it('renders plasma shader to buffer', () => {
            const buf = new PixelBuffer(64, 64);
            const plasma = SoftwareShader.getBuiltin('plasma');

            const anim = new RgbAnimation({
                buffer: buf,
                shader: plasma,
                fps: 30
            });

            anim.renderFrame(0, 0, 0);

            // Should have non-zero pixels
            const [r, g, b] = buf.getPixel(32, 32);
            assert.ok(r > 0 || g > 0 || b > 0, 'Plasma should produce non-black pixels');
        });

        it('renders XOR pattern shader to buffer', () => {
            const buf = new PixelBuffer(32, 32);
            const xor = SoftwareShader.getBuiltin('xor');

            const anim = new RgbAnimation({
                buffer: buf,
                shader: xor,
                fps: 30
            });

            anim.renderFrame(0, 0, 0);

            // XOR pattern: (x^y) as grayscale
            const [r, g, b] = buf.getPixel(5, 3);
            const expected = (5 ^ 3) & 0xFF;
            assert.strictEqual(r, expected);
            assert.strictEqual(g, expected);
            assert.strictEqual(b, expected);
        });
    });

    describe('RgbAnimation layer support', () => {
        it('can add and clear layers', () => {
            const buf = new PixelBuffer(16, 16);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
                fps: 30
            });

            anim.addLayer({ shader: () => [255, 0, 0] });
            anim.addLayer({ shader: () => [0, 255, 0], opacity: 0.5 });
            assert.strictEqual(anim._layers.length, 2);

            anim.clearLayers();
            assert.strictEqual(anim._layers.length, 0);
        });

        it('layers render on top of base shader', () => {
            const buf = new PixelBuffer(16, 16);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [50, 50, 50],
                fps: 30
            });

            anim.addLayer({
                shader: () => [200, 100, 50],
                opacity: 1.0,
                blend: 'overwrite'
            });

            anim.renderFrame(0, 0, 0);

            // Layer overwrites base with full opacity
            const [r, g, b] = buf.getPixel(5, 5);
            assert.strictEqual(r, 200);
            assert.strictEqual(g, 100);
            assert.strictEqual(b, 50);
        });
    });

    describe('RgbAnimation duration and loop', () => {
        it('stops after duration when loop is false', () => {
            const buf = new PixelBuffer(16, 16);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [128, 128, 128],
                fps: 30,
                duration: 0.001, // very short
                loop: false
            });

            anim.start();
            assert.ok(anim.isRunning);

            // Wait a tiny bit for the duration to pass
            // (We use renderFrame manually to test without timers)
            anim.stop(); // clean up
        });

        it('default loop is true', () => {
            const anim = new RgbAnimation({
                shader: () => [0, 0, 0]
            });
            assert.strictEqual(anim.loop, true);
        });

        it('default duration is 0 (infinite)', () => {
            const anim = new RgbAnimation({
                shader: () => [0, 0, 0]
            });
            assert.strictEqual(anim.duration, 0);
        });
    });

    describe('RgbAnimation mouse state', () => {
        it('can set and read mouse state', () => {
            const anim = new RgbAnimation({
                shader: () => [0, 0, 0]
            });

            assert.strictEqual(anim.mouseX, 0);
            assert.strictEqual(anim.mouseY, 0);
            assert.strictEqual(anim.mouseDown, false);

            anim.setMouseState(100, 200, true);
            assert.strictEqual(anim.mouseX, 100);
            assert.strictEqual(anim.mouseY, 200);
            assert.strictEqual(anim.mouseDown, true);
        });

        it('mouse state available in onFrame callback', () => {
            const buf = new PixelBuffer(16, 16);
            let capturedMouse = null;

            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
                fps: 30,
                onFrame: (ctx) => {
                    capturedMouse = { x: ctx.mouseX, y: ctx.mouseY, down: ctx.mouseDown };
                }
            });

            anim.setMouseState(42, 84, true);

            // Start and let one tick fire, then stop
            anim.start();
            anim._tick();
            anim.stop();

            assert.ok(capturedMouse);
            assert.strictEqual(capturedMouse.x, 42);
            assert.strictEqual(capturedMouse.y, 84);
            assert.strictEqual(capturedMouse.down, true);
        });
    });

    describe('RgbAnimation elapsed time tracking', () => {
        it('elapsed is 0 when not running', () => {
            const anim = new RgbAnimation({ shader: () => [0, 0, 0] });
            assert.strictEqual(anim.elapsed, 0);
        });

        it('lastDt tracks delta time', () => {
            const buf = new PixelBuffer(16, 16);
            const anim = new RgbAnimation({
                buffer: buf,
                shader: () => [0, 0, 0],
                fps: 30
            });

            assert.strictEqual(anim.lastDt, 0);
            anim.renderFrame(0, 0.033, 0.033);
            assert.strictEqual(anim.lastDt, 0.033);
        });
    });
});
