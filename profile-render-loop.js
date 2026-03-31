#!/usr/bin/env node
/**
 * profile-render-loop.js — Benchmarks the ScreenManager render and flush performance.
 */

import { ScreenManager } from './sync/screen-manager.js';
import { PixelBuffer } from './sync/pixel-buffer.js';

async function benchmark() {
    const width = 1920;
    const height = 1080;
    const screen = new ScreenManager({
        width,
        height,
        framebuffer: false // Don't actually write to hardware during benchmark
    });

    console.log(`Profiling Render Loop (${width}x${height})...`);

    // Scenario 1: Full Redraw (all cells dirty)
    console.log('\n--- Scenario 1: Full Redraw ---');
    screen.clear();
    for (let r = 0; r < screen.rows; r++) {
        for (let c = 0; c < screen.cols; c++) {
            screen.setCell(c, r, String.fromCharCode(33 + (c % 94)), [255, 255, 255, 255], [10, 10, 20, 255]);
        }
    }

    let start = performance.now();
    let iters = 10;
    for (let i = 0; i < iters; i++) {
        screen.forceRedraw();
        screen.render();
    }
    let end = performance.now();
    console.log(`Full Render: ${((end - start) / iters).toFixed(2)}ms per frame`);

    // Scenario 2: Partial Redraw (10% of cells dirty)
    console.log('\n--- Scenario 2: Partial Redraw (10%) ---');
    start = performance.now();
    iters = 100;
    for (let i = 0; i < iters; i++) {
        // Randomly dirt 10% of rows
        for (let r = 0; r < screen.rows / 10; r++) {
            const row = Math.floor(Math.random() * screen.rows);
            const col = Math.floor(Math.random() * screen.cols);
            screen.setCell(col, row, 'X');
        }
        screen.render();
    }
    end = performance.now();
    console.log(`Partial Render: ${((end - start) / iters).toFixed(2)}ms per frame`);

    // Scenario 3: PixelBuffer scroll performance
    console.log('\n--- Scenario 3: PixelBuffer Scroll ---');
    start = performance.now();
    iters = 100;
    for (let i = 0; i < iters; i++) {
        screen.buffer.scrollUp(10);
    }
    end = performance.now();
    console.log(`Pixel Scroll (10px): ${((end - start) / iters).toFixed(4)}ms per op`);

    // Scenario 4: Uint32 fill performance
    console.log('\n--- Scenario 4: Uint32 Fill ---');
    start = performance.now();
    iters = 100;
    const packed = PixelBuffer.packRGBA(255, 0, 0, 255);
    for (let i = 0; i < iters; i++) {
        screen.buffer.data32.fill(packed);
    }
    end = performance.now();
    console.log(`Uint32 Fill: ${((end - start) / iters).toFixed(2)}ms per frame`);
}

benchmark().catch(console.error);
