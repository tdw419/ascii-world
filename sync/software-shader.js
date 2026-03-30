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

export { compileFormula, normalizeColor };
