// software-shader.js — Formula-to-pixel rendering engine
//
// From research doc: "The formula command takes a JavaScript function—for example,
// (x, y) => (x ^ y) & 0xFF—and applies it to every pixel in a target region."
//
// Bridges text-based output and GPU-native rendering by allowing mathematical
// functions to define pixel colors. Serves as a pedagogical tool for understanding
// fragment shaders before transitioning to WebGPU/WGSL.

import { PixelBuffer } from './pixel-buffer.js';

/**
 * Pre-compiled formula cache to avoid repeated Function constructor parsing
 */
const formulaCache = new Map();

/**
 * Compile a formula string into a reusable function.
 * Accepts: "(x, y) => ..." or "function(x, y) { ... }" or just "x ^ y"
 */
function compileFormula(formula) {
    if (formulaCache.has(formula)) return formulaCache.get(formula);

    let fn;
    try {
        if (formula.includes('=>') || formula.startsWith('function')) {
            fn = new Function('return (' + formula + ')')();
        } else {
            // Shorthand: expression using x, y, t (time)
            fn = new Function('x', 'y', 't', `return (${formula});`);
        }
    } catch (e) {
        throw new Error(`Invalid formula "${formula}": ${e.message}`);
    }

    formulaCache.set(formula, fn);
    return fn;
}

/**
 * Software shader result: can be a number (grayscale), [r,g,b], [r,g,b,a], or packed 0xRRGGBB
 */
function normalizeColor(result) {
    if (typeof result === 'number') {
        if (result > 255) {
            // Packed hex: 0xRRGGBB
            return {
                r: (result >> 16) & 0xFF,
                g: (result >> 8) & 0xFF,
                b: result & 0xFF,
                a: 255,
            };
        }
        // Grayscale
        const v = Math.max(0, Math.min(255, result | 0));
        return { r: v, g: v, b: v, a: 255 };
    }

    if (Array.isArray(result)) {
        return {
            r: Math.max(0, Math.min(255, (result[0] || 0) | 0)),
            g: Math.max(0, Math.min(255, (result[1] || 0) | 0)),
            b: Math.max(0, Math.min(255, (result[2] || 0) | 0)),
            a: Math.max(0, Math.min(255, result.length > 3 ? (result[3] | 0) : 255)),
        };
    }

    if (result && typeof result === 'object') {
        return {
            r: Math.max(0, Math.min(255, (result.r || 0) | 0)),
            g: Math.max(0, Math.min(255, (result.g || 0) | 0)),
            b: Math.max(0, Math.min(255, (result.b || 0) | 0)),
            a: Math.max(0, Math.min(255, result.a !== undefined ? (result.a | 0) : 255)),
        };
    }

    return { r: 0, g: 0, b: 0, a: 255 };
}

export class SoftwareShader {
    /**
     * Apply a formula to a region of a PixelBuffer.
     *
     * @param {PixelBuffer} buffer - Target pixel buffer
     * @param {string|Function} formula - Formula: (x, y, t) => color
     * @param {Object} region - { x, y, w, h } target region (defaults to full buffer)
     * @param {number} time - Time parameter for animated shaders
     */
    static render(buffer, formula, region = null, time = 0) {
        const fn = typeof formula === 'function' ? formula : compileFormula(formula);

        const x0 = region?.x || 0;
        const y0 = region?.y || 0;
        const x1 = region?.w ? x0 + region.w : buffer.width;
        const y1 = region?.h ? y0 + region.h : buffer.height;

        const startX = Math.max(0, x0);
        const startY = Math.max(0, y0);
        const endX = Math.min(buffer.width, x1);
        const endY = Math.min(buffer.height, y1);

        // Tight loop: simple for loops for JIT optimization (no closures, no HOFs)
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const result = fn(x, y, time);
                const c = normalizeColor(result);
                buffer.setPixel(x, y, c.r, c.g, c.b, c.a);
            }
        }
    }

    /**
     * Render with Uint32Array for maximum throughput.
     * Formula must return a packed ABGR Uint32 value.
     */
    static renderFast(buffer, formula, region = null, time = 0) {
        const fn = typeof formula === 'function' ? formula : compileFormula(formula);

        const x0 = Math.max(0, region?.x || 0);
        const y0 = Math.max(0, region?.y || 0);
        const x1 = Math.min(buffer.width, region?.w ? (region.x || 0) + region.w : buffer.width);
        const y1 = Math.min(buffer.height, region?.h ? (region.y || 0) + region.h : buffer.height);

        const data32 = buffer.data32;
        const width = buffer.width;

        for (let y = y0; y < y1; y++) {
            const rowOff = y * width;
            for (let x = x0; x < x1; x++) {
                data32[rowOff + x] = fn(x, y, time);
            }
            buffer._dirtyRows[y] = 1;
        }
    }

    /**
     * Built-in shader: XOR pattern (classic demo effect)
     */
    static xorPattern(x, y) {
        const v = (x ^ y) & 0xFF;
        return [v, v, v];
    }

    /**
     * Built-in shader: plasma effect
     */
    static plasma(x, y, t) {
        const v1 = Math.sin(x / 16 + t);
        const v2 = Math.sin(y / 8 + t);
        const v3 = Math.sin((x + y) / 16 + t);
        const v4 = Math.sin(Math.sqrt(x * x + y * y) / 8 + t);
        const v = (v1 + v2 + v3 + v4 + 4) / 8; // normalize to 0-1
        const r = Math.sin(v * Math.PI * 2) * 127 + 128;
        const g = Math.sin(v * Math.PI * 2 + 2.094) * 127 + 128;
        const b = Math.sin(v * Math.PI * 2 + 4.189) * 127 + 128;
        return [r | 0, g | 0, b | 0];
    }

    /**
     * Built-in shader: gradient
     */
    static gradient(x, y, t, w = 480, h = 240) {
        const r = (x / w * 255) | 0;
        const g = (y / h * 255) | 0;
        const b = ((Math.sin(t) + 1) / 2 * 255) | 0;
        return [r, g, b];
    }

    /**
     * Built-in shader: checkerboard
     */
    static checkerboard(x, y, t, size = 8) {
        const cx = (x / size) | 0;
        const cy = (y / size) | 0;
        return (cx + cy) & 1 ? [200, 200, 200] : [50, 50, 50];
    }

    /**
     * Built-in shader: Mandelbrot fractal
     */
    static mandelbrot(x, y, t, w = 480, h = 240) {
        const cx = (x - w * 0.7) / (w * 0.35);
        const cy = (y - h * 0.5) / (h * 0.5);
        let zx = 0, zy = 0;
        let iter = 0;
        const maxIter = 64;
        while (zx * zx + zy * zy < 4 && iter < maxIter) {
            const tmp = zx * zx - zy * zy + cx;
            zy = 2 * zx * zy + cy;
            zx = tmp;
            iter++;
        }
        if (iter === maxIter) return [0, 0, 0];
        const t2 = iter / maxIter;
        return [
            (Math.sin(t2 * 6.28 + 0) * 127 + 128) | 0,
            (Math.sin(t2 * 6.28 + 2) * 127 + 128) | 0,
            (Math.sin(t2 * 6.28 + 4) * 127 + 128) | 0,
        ];
    }

    /**
     * Get a named built-in shader
     */
    static getBuiltin(name) {
        const builtins = {
            xor: SoftwareShader.xorPattern,
            plasma: SoftwareShader.plasma,
            gradient: SoftwareShader.gradient,
            checkerboard: SoftwareShader.checkerboard,
            mandelbrot: SoftwareShader.mandelbrot,
        };
        return builtins[name] || null;
    }
}

/**
 * Easing functions for animation interpolation
 */
export const Easing = {
    linear: (t) => t,
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => (--t) * t * t + 1,
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/**
 * RgbAnimation — Time-based animation controller for software shaders.
 *
 * Provides:
 * - Managed animation loop with configurable FPS
 * - Easing functions for smooth transitions
 * - Shader layering (background + foreground)
 * - Per-frame time delta and elapsed time tracking
 * - Start/stop/pause/resume lifecycle
 */
export class RgbAnimation {
    /**
     * @param {Object} options
     * @param {PixelBuffer} options.buffer - Target pixel buffer
     * @param {Function} options.shader - Shader function (x, y, t, elapsed, dt) => color
     * @param {number} [options.fps=30] - Target frames per second
     * @param {Object} [options.region] - Render region { x, y, w, h }
     * @param {boolean} [options.useFastPath=false] - Use renderFast (shader must return packed Uint32)
     * @param {Function} [options.onFrame] - Callback after each frame render(context)
     * @param {Function} [options.easing] - Easing function for time interpolation
     * @param {number} [options.duration] - Duration in seconds (0 = infinite)
     * @param {boolean} [options.loop=true] - Loop animation when duration is set
     */
    constructor(options = {}) {
        this.buffer = options.buffer || null;
        this.shader = options.shader || null;
        this.fps = options.fps || 30;
        this.region = options.region || null;
        this.useFastPath = options.useFastPath || false;
        this.onFrame = options.onFrame || null;
        this.easing = options.easing || Easing.linear;
        this.duration = options.duration || 0;
        this.loop = options.loop !== false;

        // State
        this._running = false;
        this._paused = false;
        this._startTime = 0;
        this._pausedAt = 0;
        this._pauseAccum = 0;
        this._frameCount = 0;
        this._lastFrameTime = 0;
        this._timer = null;
        this._lastDt = 0;

        // Layer support
        this._layers = [];

        // Mouse state (updated by user code or attached MouseInput)
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
    }

    /**
     * Add an additional shader layer.
     * Layers are rendered in order; later layers draw on top.
     * Each layer: { shader, region?, blend?, opacity? }
     */
    addLayer(layer) {
        this._layers.push({
            shader: layer.shader,
            region: layer.region || null,
            blend: layer.blend || 'overwrite',
            opacity: layer.opacity !== undefined ? layer.opacity : 1.0,
        });
        return this;
    }

    /**
     * Remove all layers
     */
    clearLayers() {
        this._layers = [];
        return this;
    }

    /**
     * Start the animation loop
     */
    start() {
        if (this._running) return this;
        this._running = true;
        this._paused = false;
        this._startTime = performance.now();
        this._pauseAccum = 0;
        this._frameCount = 0;
        this._lastFrameTime = this._startTime;

        const interval = Math.max(1, Math.floor(1000 / this.fps));
        this._timer = setInterval(() => this._tick(), interval);
        return this;
    }

    /**
     * Stop the animation loop
     */
    stop() {
        this._running = false;
        this._paused = false;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        return this;
    }

    /**
     * Pause the animation
     */
    pause() {
        if (!this._running || this._paused) return this;
        this._paused = true;
        this._pausedAt = performance.now();
        return this;
    }

    /**
     * Resume from pause
     */
    resume() {
        if (!this._paused) return this;
        this._paused = false;
        this._pauseAccum += performance.now() - this._pausedAt;
        return this;
    }

    /**
     * Check if animation is running
     */
    get isRunning() { return this._running && !this._paused; }

    /**
     * Check if animation is paused
     */
    get isPaused() { return this._paused; }

    /**
     * Get total elapsed seconds (excluding paused time)
     */
    get elapsed() {
        if (!this._running) return 0;
        const now = this._paused ? this._pausedAt : performance.now();
        return (now - this._startTime - this._pauseAccum) / 1000;
    }

    /**
     * Get total frame count
     */
    get frameCount() { return this._frameCount; }

    /**
     * Get last frame delta time in seconds
     */
    get lastDt() { return this._lastDt; }

    /**
     * Internal tick: render one frame
     */
    _tick() {
        if (!this._running || this._paused || !this.buffer || !this.shader) return;

        const now = performance.now();
        const elapsed = this.elapsed;
        this._lastDt = (now - this._lastFrameTime) / 1000;
        this._lastFrameTime = now;

        // Check duration
        if (this.duration > 0 && elapsed >= this.duration) {
            if (this.loop) {
                // Reset timing for loop
                this._startTime = now;
                this._pauseAccum = 0;
            } else {
                this.stop();
                return;
            }
        }

        // Compute eased time
        let t = elapsed;
        if (this.duration > 0) {
            const rawProgress = (elapsed % this.duration) / this.duration;
            t = this.easing(rawProgress);
        }

        // Render base shader
        this._renderShader(this.shader, this.region, t, elapsed);

        // Render layers
        for (const layer of this._layers) {
            this._renderLayer(layer, t, elapsed);
        }

        this._frameCount++;

        // Callback
        if (this.onFrame) {
            this.onFrame({
                elapsed,
                t,
                dt: this._lastDt,
                frameCount: this._frameCount,
                mouseX: this.mouseX,
                mouseY: this.mouseY,
                mouseDown: this.mouseDown,
                buffer: this.buffer,
            });
        }
    }

    /**
     * Render a single shader
     */
    _renderShader(shader, region, t, elapsed) {
        // Wrap shader to pass additional animation context
        const wrappedShader = (x, y, time) => {
            return shader(x, y, time, elapsed, this._lastDt);
        };

        if (this.useFastPath) {
            SoftwareShader.renderFast(this.buffer, wrappedShader, region, t);
        } else {
            SoftwareShader.render(this.buffer, wrappedShader, region, t);
        }
    }

    /**
     * Render a layer with optional alpha blending
     */
    _renderLayer(layer, t, elapsed) {
        if (layer.opacity >= 1.0 && layer.blend === 'overwrite') {
            this._renderShader(layer.shader, layer.region, t, elapsed);
            return;
        }

        // Alpha blend: render to temp, composite
        if (layer.opacity < 1.0 && this.buffer) {
            const region = layer.region;
            const x0 = region?.x || 0;
            const y0 = region?.y || 0;
            const w = region?.w || this.buffer.width;
            const h = region?.h || this.buffer.height;

            for (let y = Math.max(0, y0); y < Math.min(this.buffer.height, y0 + h); y++) {
                for (let x = Math.max(0, x0); x < Math.min(this.buffer.width, x0 + w); x++) {
                    const result = layer.shader(x, y, t, elapsed, this._lastDt);
                    const c = normalizeColor(result);
                    const alpha = layer.opacity;
                    const [or, og, ob] = this.buffer.getPixel(x, y);
                    this.buffer.setPixel(x, y,
                        (or * (1 - alpha) + c.r * alpha) | 0,
                        (og * (1 - alpha) + c.g * alpha) | 0,
                        (ob * (1 - alpha) + c.b * alpha) | 0,
                        255
                    );
                }
            }
        } else {
            this._renderShader(layer.shader, layer.region, t, elapsed);
        }
    }

    /**
     * Render a single frame manually (no timer). Useful for testing.
     * @param {number} t - Time parameter
     * @param {number} elapsed - Elapsed seconds
     * @param {number} dt - Delta time
     */
    renderFrame(t = 0, elapsed = 0, dt = 0) {
        if (!this.buffer || !this.shader) return;

        this._lastDt = dt;
        const wrappedShader = (x, y, time) => {
            return this.shader(x, y, time, elapsed, dt);
        };

        if (this.useFastPath) {
            SoftwareShader.renderFast(this.buffer, wrappedShader, this.region, t);
        } else {
            SoftwareShader.render(this.buffer, wrappedShader, this.region, t);
        }

        for (const layer of this._layers) {
            if (layer.opacity >= 1.0 && layer.blend === 'overwrite') {
                this._renderShader(layer.shader, layer.region, t, elapsed);
            } else if (layer.opacity < 1.0) {
                this._renderLayer(layer, t, elapsed);
            } else {
                this._renderShader(layer.shader, layer.region, t, elapsed);
            }
        }

        this._frameCount++;
    }

    /**
     * Update mouse state (called by user code or MouseInput integration)
     */
    setMouseState(x, y, down) {
        this.mouseX = x;
        this.mouseY = y;
        if (down !== undefined) this.mouseDown = down;
    }
}

export { compileFormula, normalizeColor };
