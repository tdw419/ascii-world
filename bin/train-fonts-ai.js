#!/usr/bin/env node
/**
 * Font AI Trainer - Training Ouroboros to render words/ideas on the spatial map.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { VisualScorer } from '../sync/visual-scorer.js';
import { ZaiShaderGenerator } from '../sync/zai-shader-generator.js';
import { GlyphAtlas } from '../sync/glyph-atlas.js';
import { ScreenManager } from '../sync/screen-manager.js';

const DATA_DIR = './.ouroboros/training_data/fonts';
const CHECKPOINT_FILE = './.ouroboros/checkpoint_fonts.json';
mkdirSync(DATA_DIR, { recursive: true });

const generator = new ZaiShaderGenerator();
const localScorer = new VisualScorer();
const atlas = new GlyphAtlas();

async function train(generations = 5) {
    console.log(`🖋️ Starting Font-Centric Spatial Training (${generations} generations)...`);
    
    let bestScore = 0;
    let bestIdea = null;
    
    if (existsSync(CHECKPOINT_FILE)) {
        try {
            const checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
            bestScore = checkpoint.score.total;
            bestIdea = checkpoint;
            console.log(`🔄 RECOVERED: Best font score ${bestScore} from previous session.`);
        } catch (e) {}
    }

    for (let i = 1; i <= generations; i++) {
        console.log(`\n--- Font Generation ${i} ---`);
        
        try {
            // 1. Generate via Z.ai (GLM-5)
            // We ask the AI to generate "Spatial Ideas" - code that uses atlas.drawText
            console.log('🤖 Generating Spatial Document Idea via Z.ai...');
            const prompt = `
Create a JavaScript function (buf, atlas, t) => { ... } that renders a spatial "idea" or "document" fragment.
Use buf.fill() for background and atlas.drawText(buf, text, x, y, color) to place words.
The document should feel like a page from a cybernetic manifest or a spatial filesystem.
Vary the layout over time (t).
buf: 480x240 PixelBuffer.
Return ONLY the raw function code.`;

            const code = await generator.generateShader(prompt, bestIdea?.code);
            
            // Repair/Compile specifically for our new signature
            const renderFn = new Function('buf', 'atlas', 't', `return (${code})(buf, atlas, t)`);
            
            // 2. Render
            const buf = new PixelBuffer(480, 240);
            renderFn(buf, atlas, 0); // Render at t=0 for scoring
            const png = await buf.toPNG();
            
            // 3. Score
            console.log('👁️ Scoring Document Aesthetics (LM Studio)...');
            const score = await localScorer.score(png);
            console.log(`  > Score: ${score.total}/40 (${score.reason})`);

            const timestamp = Date.now();
            const filename = `font_gen${i}_${timestamp}`;
            writeFileSync(join(DATA_DIR, `${filename}.png`), png);
            
            const record = { code, score, timestamp, filename };

            if (score.total > bestScore) {
                bestScore = score.total;
                bestIdea = record;
                console.log('🏆 NEW DOCUMENT BEST | SAVING CHECKPOINT...');
                writeFileSync(CHECKPOINT_FILE, JSON.stringify(record, null, 2));
            }

        } catch (e) {
            console.error(`❌ Font Gen ${i} failed:`, e.message);
            console.error(e.stack);
        }
    }
}

const gens = parseInt(process.argv[2]) || 5;
train(gens).catch(console.error);
