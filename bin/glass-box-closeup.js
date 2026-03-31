#!/usr/bin/env node
/**
 * Glass Box Closeup Viewer - Generates zoomed views of specific regions
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = '/home/jericho/zion/projects/ascii_world/ascii_world';
const CORTEX_MANIFEST = join(PROJECT_ROOT, '.ouroboros', 'spatial_llm', 'spatial_manifest.json');
const ARCHIVE_MANIFEST = join(PROJECT_ROOT, '.ouroboros', 'archive', 'archive_manifest.json');
const OUTPUT_DIR = join(PROJECT_ROOT, '.ouroboros', 'visualizations');

function generateCloseup() {
    console.log('🔍 Generating closeup views...\n');

    const cortex = JSON.parse(readFileSync(CORTEX_MANIFEST, 'utf-8'));
    const archive = JSON.parse(readFileSync(ARCHIVE_MANIFEST, 'utf-8'));

    // View 1: Cortex detail (320x320 pixels, showing the neural weight structure)
    console.log('  📸 Cortex closeup (neural weights)...');
    const cortexWidth = 320;
    const cortexHeight = 320;
    const cortexPixels = new Uint8ClampedArray(cortexWidth * cortexHeight * 4);
    cortexPixels.fill(5); // Dark background

    cortex.tiles.forEach(tile => {
        const px = tile.x * 3 + 10; // Scale up for visibility
        const py = tile.y * 3 + 10;

        if (px >= 0 && px < cortexWidth && py >= 0 && py < cortexHeight) {
            // Load weight data
            try {
                const binPath = join(PROJECT_ROOT, '.ouroboros', 'spatial_llm', tile.file);
                const data = readFileSync(binPath);
                const floats = new Float32Array(data.buffer);

                // Summarize this tile as a single colored pixel
                let sum = 0, count = 0;
                for (let i = 0; i < floats.length; i++) {
                    sum += floats[i];
                    count++;
                }
                const avg = sum / count;
                const spread = floats.reduce((acc, f) => acc + Math.abs(f - avg), 0) / count;

                // Color based on layer type and values
                const idx = (py * cortexWidth + px) * 4;
                if (tile.parameter?.includes('embed')) {
                    // Embeddings: Blue-cyan
                    cortexPixels[idx] = 50;
                    cortexPixels[idx + 1] = 150 + Math.min(100, Math.floor(spread * 200));
                    cortexPixels[idx + 2] = 255;
                } else if (tile.parameter?.includes('attn')) {
                    // Attention: Cyan-green
                    cortexPixels[idx] = 50;
                    cortexPixels[idx + 1] = 255;
                    cortexPixels[idx + 2] = 150 + Math.min(100, Math.floor(spread * 200));
                } else if (tile.parameter?.includes('mlp')) {
                    // MLP: Magenta-purple
                    cortexPixels[idx] = 200 + Math.min(55, Math.floor(spread * 100));
                    cortexPixels[idx + 1] = 50;
                    cortexPixels[idx + 2] = 255;
                } else {
                    // Default: White based on activity
                    const brightness = Math.min(255, Math.floor(spread * 500));
                    cortexPixels[idx] = brightness;
                    cortexPixels[idx + 1] = brightness;
                    cortexPixels[idx + 2] = brightness;
                }
                cortexPixels[idx + 3] = 255;
            } catch (e) {}
        }
    });

    // Save cortex closeup
    const cortexRaw = join(OUTPUT_DIR, 'cortex_closeup.raw');
    writeFileSync(cortexRaw, cortexPixels);
    execSync(`convert -size ${cortexWidth}x${cortexHeight} -depth 8 rgba:${cortexRaw} ${join(OUTPUT_DIR, 'cortex_closeup.png')}`);
    console.log(`     Saved: cortex_closeup.png`);

    // View 2: Archive detail (showing training data documents)
    console.log('  📸 Archive closeup (training data)...');
    const archiveWidth = 800;
    const archiveHeight = 400;
    const archivePixels = new Uint8ClampedArray(archiveWidth * archiveHeight * 4);
    archivePixels.fill(8); // Dark background

    archive.documents.forEach(doc => {
        // Normalize coordinates to fit in view
        const offsetX = (doc.coords.x - 5000) / 4; // Archive starts at x=5000
        const offsetY = doc.coords.y / 5;

        const baseX = Math.floor(offsetX);
        const baseY = Math.floor(offsetY);

        // Category colors
        const colors = {
            physics: [100, 200, 255],
            math: [255, 200, 100],
            biology: [100, 255, 150],
            history: [255, 180, 200],
            language: [200, 150, 255],
            programming: [255, 255, 100]
        };
        const [baseR, baseG, baseB] = colors[doc.category] || [128, 128, 128];

        // Render document title/border
        for (let dy = 0; dy < 30; dy++) {
            for (let dx = 0; dx < 100; dx++) {
                const px = baseX + dx;
                const py = baseY + dy;
                if (px >= 0 && px < archiveWidth && py >= 0 && py < archiveHeight) {
                    const idx = (py * archiveWidth + px) * 4;
                    // Border glow
                    if (dy < 2 || dy >= 28 || dx < 2 || dx >= 98) {
                        archivePixels[idx] = baseR;
                        archivePixels[idx + 1] = baseG;
                        archivePixels[idx + 2] = baseB;
                        archivePixels[idx + 3] = 255;
                    } else {
                        // Text area - slightly lit
                        archivePixels[idx] = Math.floor(baseR * 0.3);
                        archivePixels[idx + 1] = Math.floor(baseG * 0.3);
                        archivePixels[idx + 2] = Math.floor(baseB * 0.3);
                        archivePixels[idx + 3] = 255;
                    }
                }
            }
        }

        // Add category label as simple dots
        const label = doc.category.toUpperCase().slice(0, 8);
        for (let i = 0; i < label.length; i++) {
            const lx = baseX + 5 + i * 8;
            const ly = baseY + 5;
            for (let dy = 0; dy < 6; dy++) {
                for (let dx = 0; dx < 6; dx++) {
                    if ((dx + dy + label.charCodeAt(i)) % 2 === 0) {
                        const px = lx + dx;
                        const py = ly + dy;
                        if (px >= 0 && px < archiveWidth && py >= 0 && py < archiveHeight) {
                            const idx = (py * archiveWidth + px) * 4;
                            archivePixels[idx] = baseR;
                            archivePixels[idx + 1] = baseG;
                            archivePixels[idx + 2] = baseB;
                            archivePixels[idx + 3] = 255;
                        }
                    }
                }
            }
        }
    });

    // Save archive closeup
    const archiveRaw = join(OUTPUT_DIR, 'archive_closeup.raw');
    writeFileSync(archiveRaw, archivePixels);
    execSync(`convert -size ${archiveWidth}x${archiveHeight} -depth 8 rgba:${archiveRaw} ${join(OUTPUT_DIR, 'archive_closeup.png')}`);
    console.log(`     Saved: archive_closeup.png`);

    // View 3: Saccade animation frame (showing attention flow)
    console.log('  📸 Saccade frame (attention connections)...');
    const saccadeWidth = 1200;
    const saccadeHeight = 400;
    const saccadePixels = new Uint8ClampedArray(saccadeWidth * saccadeHeight * 4);
    saccadePixels.fill(5);

    // Draw cortex region (left side)
    cortex.tiles.slice(0, 200).forEach(tile => {
        const px = tile.x * 2 + 50;
        const py = tile.y * 2 + 50;
        if (px >= 0 && px < 300 && py >= 0 && py < saccadeHeight) {
            try {
                const binPath = join(PROJECT_ROOT, '.ouroboros', 'spatial_llm', tile.file);
                const data = readFileSync(binPath);
                const floats = new Float32Array(data.buffer);
                const spread = floats.reduce((acc, f) => acc + Math.abs(f), 0) / floats.length;

                const idx = (py * saccadeWidth + px) * 4;
                if (tile.parameter?.includes('attn')) {
                    saccadePixels[idx] = 0;
                    saccadePixels[idx + 1] = Math.min(255, 100 + spread * 300);
                    saccadePixels[idx + 2] = Math.min(255, 100 + spread * 300);
                } else {
                    saccadePixels[idx] = Math.min(255, 50 + spread * 200);
                    saccadePixels[idx + 1] = 0;
                    saccadePixels[idx + 2] = Math.min(255, 50 + spread * 200);
                }
                saccadePixels[idx + 3] = 255;
            } catch (e) {}
        }
    });

    // Draw archive region (right side)
    archive.documents.forEach((doc, i) => {
        const baseX = 800 + (i % 3) * 120;
        const baseY = 50 + Math.floor(i / 3) * 100;

        const colors = {
            physics: [100, 200, 255],
            math: [255, 200, 100],
            biology: [100, 255, 150],
            history: [255, 180, 200],
            language: [200, 150, 255],
            programming: [255, 255, 100]
        };
        const [r, g, b] = colors[doc.category] || [128, 128, 128];

        for (let dy = 0; dy < 60; dy++) {
            for (let dx = 0; dx < 100; dx++) {
                const px = baseX + dx;
                const py = baseY + dy;
                if (px >= 0 && px < saccadeWidth && py >= 0 && py < saccadeHeight) {
                    const idx = (py * saccadeWidth + px) * 4;
                    if (dy < 2 || dy >= 58 || dx < 2 || dx >= 98) {
                        saccadePixels[idx] = r;
                        saccadePixels[idx + 1] = g;
                        saccadePixels[idx + 2] = b;
                    } else {
                        saccadePixels[idx] = Math.floor(r * 0.4);
                        saccadePixels[idx + 1] = Math.floor(g * 0.4);
                        saccadePixels[idx + 2] = Math.floor(b * 0.4);
                    }
                    saccadePixels[idx + 3] = 255;
                }
            }
        }
    });

    // Draw saccade lines (attention connections)
    const saccades = [
        { from: { x: 150, y: 100 }, to: { x: 850, y: 80 }, intensity: 1.0 },
        { from: { x: 180, y: 150 }, to: { x: 860, y: 85 }, intensity: 0.8 },
        { from: { x: 200, y: 120 }, to: { x: 970, y: 80 }, intensity: 0.6 },
        { from: { x: 170, y: 180 }, to: { x: 1090, y: 85 }, intensity: 0.9 },
        { from: { x: 220, y: 140 }, to: { x: 850, y: 180 }, intensity: 0.7 },
    ];

    saccades.forEach(sac => {
        const dx = sac.to.x - sac.from.x;
        const dy = sac.to.y - sac.from.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.floor(sac.from.x + dx * t);
            const y = Math.floor(sac.from.y + dy * t);

            if (x >= 0 && x < saccadeWidth && y >= 0 && y < saccadeHeight) {
                const idx = (y * saccadeWidth + x) * 4;
                const brightness = Math.floor(255 * sac.intensity * (1 - Math.abs(t - 0.5)));
                saccadePixels[idx] = brightness;
                saccadePixels[idx + 1] = brightness;
                saccadePixels[idx + 2] = Math.floor(brightness * 0.3);
                saccadePixels[idx + 3] = 255;
            }
        }
    });

    // Save saccade view
    const saccadeRaw = join(OUTPUT_DIR, 'saccade_view.raw');
    writeFileSync(saccadeRaw, saccadePixels);
    execSync(`convert -size ${saccadeWidth}x${saccadeHeight} -depth 8 rgba:${saccadeRaw} ${join(OUTPUT_DIR, 'saccade_view.png')}`);
    console.log(`     Saved: saccade_view.png`);

    console.log('\n✅ All closeups generated!');
    console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
}

generateCloseup().catch(console.error);
