#!/usr/bin/env node
/**
 * Cortex Painter - Renders the LLM weights into the Infinite Map substrate
 * 
 * Part of Phase 42: The Sovereign Array.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { InfiniteMap } from '../sync/infinite-map.js';

const MANIFEST_PATH = './.ouroboros/spatial_llm/spatial_manifest.json';
const CHUNKS_DIR = './.ouroboros/spatial_llm';

async function paint() {
    console.log(`🎨 Painting Cortex into Infinite Map substrate...`);
    
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    const map = new InfiniteMap({ chunkSize: 256 });

    // Iterate through each mapped tile
    for (const tile of manifest.tiles) {
        const binPath = join(CHUNKS_DIR, tile.file);
        const data = readFileSync(binPath);
        const floats = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);

        // Map each float (weight) to a 2x2 or 4x4 pixel block within the tile
        // Tile coords are (tile.x, tile.y) on a 100x100 grid.
        // We'll scale this up so each tile is 32x32 pixels.
        const px = tile.x * 32;
        const py = tile.y * 32;

        for (let i = 0; i < floats.length; i++) {
            const weight = floats[i];
            const x = px + (i % 32);
            const y = py + Math.floor(i / 32);

            // Color Mapping:
            // Positive -> Cyan pulse
            // Negative -> Purple pulse
            let r = 0, g = 0, b = 0;
            if (weight > 0) {
                const val = Math.min(255, Math.floor(weight * 500));
                g = val; b = val; // Cyan
            } else {
                const val = Math.min(255, Math.floor(Math.abs(weight) * 500));
                r = val; b = val; // Purple
            }

            map.setPixel(x, y, r, g, b, 255, `tile_${tile.id}`);
        }
    }

    const stats = map.getStats();
    console.log(`✅ Cortex painted!`);
    console.log(`   Chunks allocated: ${stats.chunkCount}`);
    console.log(`   Total map footprint: ${stats.totalPixels} pixels`);
    
    // Save a sample chunk visualization
    const png = await map.exportChunk(0, 0);
    if (png) {
        import('fs').then(fs => {
            fs.writeFileSync('./.ouroboros/training_data/cortex_view.png', png);
            console.log(`🖼️  Sample view saved to .ouroboros/training_data/cortex_view.png`);
        });
    }
}

paint().catch(console.error);
