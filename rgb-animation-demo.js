#!/usr/bin/env node
/**
 * rgb-animation-demo.js — Demonstrates high-performance RGB animation on framebuffer
 */

import { ScreenManager } from './sync/screen-manager.js';
import { SoftwareShader } from './sync/software-shader.js';
import { PixelBuffer } from './sync/pixel-buffer.js';

async function main() {
    const screen = new ScreenManager({
        width: 1920,
        height: 1080,
        device: '/dev/fb0'
    });

    console.log('Starting RGB Animation Demo...');
    console.log('Press Ctrl+C to exit.');

    let t = 0;
    const startTime = Date.now();
    let frameCount = 0;

    // Define a custom RGB plasma-like animation
    const rgbFormula = (x, y, time) => {
        const scale = 0.05;
        const r = Math.sin(x * scale + time) * 127 + 128;
        const g = Math.sin(y * scale + time * 1.2) * 127 + 128;
        const b = Math.sin((x + y) * scale + time * 0.8) * 127 + 128;
        
        // Return ABGR packed for fast rendering
        return PixelBuffer.packRGBA(r | 0, g | 0, b | 0, 255);
    };

    const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        
        // Render animated background using Fast path
        SoftwareShader.renderFast(screen.buffer, rgbFormula, null, elapsed);
        
        // Render text on top
        screen.forceRedraw(); // Mark all cells dirty to re-render over pixels
        screen.writeAnsi('\x1b[1;37;44m pxOS HIGH-PERFORMANCE RGB CONSOLE \x1b[0m', 2, 1);
        screen.write(`Time: ${elapsed.toFixed(2)}s`, 2, 3);
        screen.write(`Frames: ${frameCount}`, 2, 4);
        
        const fps = frameCount / elapsed;
        if (frameCount > 10) {
            screen.write(`FPS: ${fps.toFixed(1)}`, 2, 5);
        }

        // Flush to framebuffer
        screen.flush();
        
        frameCount++;
        
        if (frameCount > 300) { // Auto-stop after 300 frames (~10s)
            clearInterval(interval);
            console.log('Demo finished.');
            process.exit(0);
        }
    }, 33); // ~30 FPS

    process.on('SIGINT', () => {
        clearInterval(interval);
        console.log('\nExiting...');
        process.exit(0);
    });
}

main().catch(console.error);
