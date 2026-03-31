#!/usr/bin/env node
/**
 * Doc-AI Generator - Manual bridge for font-centric spatial ideas.
 * Since Z.ai is not connected, this provides the "Simulation" component.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { GlyphAtlas } from '../sync/glyph-atlas.js';

const atlas = new GlyphAtlas();
const buf = new PixelBuffer(480, 240);

const templates = [
    (buf, atlas) => {
        buf.fill(13, 17, 23); // GitHub Dark
        atlas.drawText(buf, 10, 10, "SYS: INITIALIZING DOCUMENT SUBSTRATE", [88, 166, 255]);
        atlas.drawText(buf, 10, 22, "------------------------------------", [48, 54, 61]);
        atlas.drawText(buf, 10, 35, "● PHASE 1: BOOTSTRAPPING", [63, 185, 80]);
        atlas.drawText(buf, 10, 47, "● PHASE 2: SPATIAL MAPPING", [137, 87, 229]);
        atlas.drawText(buf, 10, 59, "● PHASE 3: NEURAL EVOLUTION", [248, 81, 73]);
        
        atlas.drawText(buf, 200, 100, "╔═══════════════════════════╗", [210, 153, 34]);
        atlas.drawText(buf, 200, 112, "║   MANIFESTO OF GEOMETRY   ║", [210, 153, 34]);
        atlas.drawText(buf, 200, 124, "╚═══════════════════════════╝", [210, 153, 34]);
        
        atlas.drawText(buf, 10, 220, "READY.", [88, 166, 255]);
    },
    (buf, atlas) => {
        buf.fill(0, 0, 0); // Pure black
        for(let i=0; i<20; i++) {
           const color = [0, Math.random()*100+155, 0];
           atlas.drawText(buf, 20, 10 + i*11, "01101001 01100100 01100101 01100001", color);
        }
        atlas.drawText(buf, 200, 100, "█ IDEA: SPATIAL COMPUTING █", [255, 255, 255]);
    }
];

async function generate() {
    mkdirSync('./.ouroboros/training_data/fonts', { recursive: true });
    for(let i=0; i<templates.length; i++) {
        const buf = new PixelBuffer(480, 240);
        templates[i](buf, atlas);
        const png = await buf.toPNG();
        writeFileSync(`./.ouroboros/training_data/fonts/template_${i}.png`, png);
        console.log(`✅ Template ${i} saved.`);
    }
}

generate().catch(console.error);
