#!/usr/bin/env node
/**
 * FB AI Trainer - Evolutionary shader optimization via Dual Substrate (Z.ai + Local)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { SoftwareShader } from '../sync/software-shader.js';
import { VisualScorer } from '../sync/visual-scorer.js';
import { ZaiShaderGenerator } from '../sync/zai-shader-generator.js';
import { GlassBoxAugmentor } from '../sync/glass-box-augmentor.js';

const DATA_DIR = './.ouroboros/training_data';
const CHECKPOINT_FILE = './.ouroboros/checkpoint.json';
mkdirSync(DATA_DIR, { recursive: true });

const generator = new ZaiShaderGenerator();
const localScorer = new VisualScorer(); 
const augmentor = new GlassBoxAugmentor();

async function train(generations = 5) {
    console.log(`🚀 Starting Dual-Substrate Training (${generations} generations)...`);
    
    // Recovery: load existing best
    let bestScore = 0;
    let bestShader = null;
    
    if (existsSync(CHECKPOINT_FILE)) {
        try {
            const checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
            bestScore = typeof checkpoint.score === 'object' ? checkpoint.score.total : checkpoint.score;
            bestShader = checkpoint;
            console.log(`🔄 RECOVERED: Best score ${bestScore} from previous session.`);
        } catch (e) {}
    }

    const basePrompt = "Create a high-contrast reaction-diffusion pattern with organic flow and neon gradients.";

    for (let i = 1; i <= generations; i++) {
        console.log(`\n--- Generation ${i} ---`);
        
        try {
            // 0. Augment prompt with Glass Box attention data
            const aug = await augmentor.getAugmentationData();
            let prompt = basePrompt;
            if (aug) {
                console.log(`👁️  NEURAL PULSE | Query: "${aug.query}"`);
                console.log(`   Saccades active on: ${aug.neural_state}`);
                console.log(`   Top Documents: ${aug.snippets.length}`);
                
                prompt += `\n\n[GEOMETRY OS NEURAL CONTEXT]
The following concepts are currently active in the neural substrate:
1. NEURAL LAYERS: ${aug.neural_state}
2. ARCHIVE KNOWLEDGE: ${aug.snippets.join(' | ')}
3. TOTAL SACCADE INTENSITY: ${aug.active_tiles}

Evolve the shader to embody these concepts while maintaining HIGH DENSITY and UI UTILITY.`;
            }

            // 1. Generate via Z.ai (GLM-5)
            console.log('🤖 Generating via Z.ai GLM-5...');
            const code = await generator.generateShader(
                prompt,
                bestShader?.code // Pass the best shader so far as context
            );
            const shaderFn = generator.compile(code);
            
            // 2. Render
            const buf = new PixelBuffer(480, 240);
            SoftwareShader.render(buf, shaderFn, null, 2.0);
            const png = await buf.toPNG();
            
            // 3. Fast Score via Local Qwen3-VL
            console.log('👁️ Local Scoring (LM Studio)...');
            const score = await localScorer.score(png);
            console.log(`  > Score: ${score.total}/40 (${score.reason})`);

            const timestamp = Date.now();
            const filename = `gen${i}_${timestamp}`;
            writeFileSync(join(DATA_DIR, `${filename}.png`), png);
            
            const record = { code, score, timestamp, filename };
            generator.saveHistory(record);

            if (score.total > bestScore) {
                bestScore = score.total;
                bestShader = record;
                console.log('🏆 NEW PERSONAL BEST | SAVING CHECKPOINT...');
                writeFileSync(CHECKPOINT_FILE, JSON.stringify(record, null, 2));
            }

        } catch (e) {
            console.error(`❌ Gen ${i} failed:`, e.message);
        }
    }

    if (bestShader) {
        console.log(`\n══════════════════════════════════════════════`);
        console.log(`TRAINING COMPLETE | Best Score: ${bestScore}/40`);
        console.log(`Winner: ${bestShader.filename}.png`);
        console.log(`══════════════════════════════════════════════`);
    }
}

const gens = parseInt(process.argv[2]) || 5;
train(gens).catch(console.error);
