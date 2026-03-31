#!/usr/bin/env node
/**
 * Training Data Collector - Captures framebuffer samples for visual training
 * 
 * Part of Phase 4: Visual Intelligence.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { SoftwareShader } from '../sync/software-shader.js';
import { VisualScorer } from '../sync/visual-scorer.js';

const PROJECT_ROOT = '/home/jericho/zion/projects/ascii_world/ascii_world';
const DATA_DIR = join(PROJECT_ROOT, '.ouroboros', 'training_data');

mkdirSync(DATA_DIR, { recursive: true });

const scorer = new VisualScorer();

async function collect() {
    console.log(`[DATA-COLLECT] Capturing built-in shaders to ${DATA_DIR}...`);
    
    const shaders = ['xor', 'plasma', 'gradient', 'checkerboard', 'mandelbrot'];
    const width = 480;
    const height = 240;

    for (const name of shaders) {
        console.log(`[DATA-COLLECT] Rendering ${name}...`);
        const buffer = new PixelBuffer(width, height);
        const shaderFn = SoftwareShader.getBuiltin(name);
        
        if (!shaderFn) {
            console.warn(`[DATA-COLLECT] Shader ${name} not found!`);
            continue;
        }

        // Render at t=0
        SoftwareShader.render(buffer, shaderFn);
        
        const png = await buffer.toPNG();
        const pngPath = join(DATA_DIR, `${name}_v1.png`);
        writeFileSync(pngPath, png);
        console.log(`[DATA-COLLECT] Saved: ${pngPath}`);

        // Score it if vision model is available
        try {
            console.log(`[DATA-COLLECT] Scoring ${name} via vision model...`);
            const scores = await scorer.score(png);
            const scorePath = join(DATA_DIR, `${name}_v1.json`);
            writeFileSync(scorePath, JSON.stringify({
                name,
                timestamp: new Date().toISOString(),
                scores
            }, null, 2));
            console.log(`[DATA-COLLECT] Scored: ${scores.total}/40 - ${scores.reason}`);
        } catch (e) {
            console.error(`[DATA-COLLECT] Vision model scoring failed: ${e.message}`);
        }
    }

    console.log('[DATA-COLLECT] Collection complete.');
}

collect().catch(err => {
    console.error('[DATA-COLLECT] Failed:', err);
    process.exit(1);
});
