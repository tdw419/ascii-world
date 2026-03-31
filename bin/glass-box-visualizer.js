#!/usr/bin/env node
/**
 * Glass Box LLM Visualizer - Renders both Cortex and Archive, animates saccades
 *
 * This is the main visualization for watching the AI think.
 * It shows:
 * 1. The Cortex (neural weights) - left side, cyan/purple glow
 * 2. The Archive (training data) - right side, colored by category
 * 3. Saccade lines - glowing connections when attention fires
 *
 * Usage:
 *   node glass-box-visualizer.js           # Show static view
 *   node glass-box-visualizer.js --animate # Animate a demo saccade
 *   node glass-box-visualizer.js --query "What is gravity?"
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = '/home/jericho/zion/projects/ascii_world/ascii_world';
const CORTEX_MANIFEST = join(PROJECT_ROOT, '.ouroboros', 'spatial_llm', 'spatial_manifest.json');
const ARCHIVE_MANIFEST = join(PROJECT_ROOT, '.ouroboros', 'archive', 'archive_manifest.json');
const OUTPUT_DIR = join(PROJECT_ROOT, '.ouroboros', 'visualizations');

class GlassBoxVisualizer {
    constructor() {
        this.cortex = this.loadManifest(CORTEX_MANIFEST);
        this.archive = this.loadManifest(ARCHIVE_MANIFEST);
        this.width = 8192;
        this.height = 2048;
        this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
        this.saccades = []; // Active attention connections
    }

    loadManifest(path) {
        try {
            return JSON.parse(readFileSync(path, 'utf-8'));
        } catch (e) {
            console.warn(`Warning: Could not load ${path}: ${e.message}`);
            return null;
        }
    }

    /**
     * Render the complete Glass Box view
     */
    render() {
        console.log('🖼️  Rendering Glass Box LLM...\n');

        // Clear to dark background
        this.pixels.fill(10); // Dark but not black

        // Render Cortex (left side)
        if (this.cortex) {
            this.renderCortex();
        }

        // Render Archive (right side)
        if (this.archive) {
            this.renderArchive();
        }

        // Render any active saccades
        this.renderSaccades();

        // Add continent labels
        this.addLabels();

        console.log('✅ Render complete');
        return this.pixels;
    }

    renderCortex() {
        console.log('  🧠 Rendering Cortex (neural weights)...');
        const tiles = this.cortex.tiles || [];
        let activeTiles = 0;

        tiles.forEach(tile => {
            // Each tile is 32x32 pixels at (tile.x * 32, tile.y * 32)
            const baseX = tile.x * 32;
            const baseY = tile.y * 32;

            // Load the actual weight data if available
            const binPath = join(PROJECT_ROOT, '.ouroboros', 'spatial_llm', tile.file);
            try {
                const data = readFileSync(binPath);
                const floats = new Float32Array(data.buffer);

                for (let i = 0; i < Math.min(floats.length, 1024); i++) {
                    const weight = floats[i];
                    const px = baseX + (i % 32);
                    const py = baseY + Math.floor(i / 32);

                    if (px < this.width && py < this.height) {
                        const idx = (py * this.width + px) * 4;

                        // Map weight to color
                        // Positive -> Cyan, Negative -> Purple, Near-zero -> Dark
                        if (Math.abs(weight) > 0.01) {
                            activeTiles++;
                            if (weight > 0) {
                                const intensity = Math.min(255, Math.abs(weight) * 200);
                                this.pixels[idx] = 0;           // R
                                this.pixels[idx + 1] = intensity; // G
                                this.pixels[idx + 2] = intensity; // B
                            } else {
                                const intensity = Math.min(255, Math.abs(weight) * 200);
                                this.pixels[idx] = intensity;    // R
                                this.pixels[idx + 1] = 0;        // G
                                this.pixels[idx + 2] = intensity;// B
                            }
                            this.pixels[idx + 3] = 255;
                        }
                    }
                }
            } catch (e) {
                // Tile file not found, skip
            }
        });

        console.log(`     ${tiles.length} tiles, ${activeTiles} active neurons`);
    }

    renderArchive() {
        console.log('  📚 Rendering Archive (training data)...');
        const docs = this.archive.documents || [];

        docs.forEach(doc => {
            const { x, y } = doc.coords;
            const text = doc.text;
            const category = doc.category;

            // Get category color
            const colors = {
                physics: [100, 200, 255],
                math: [255, 200, 100],
                biology: [100, 255, 150],
                history: [255, 180, 200],
                language: [200, 150, 255],
                programming: [255, 255, 100]
            };
            const [baseR, baseG, baseB] = colors[category] || [128, 128, 128];

            // Render text characters as pixels
            let px = x;
            let py = y;
            const maxWidth = 80;

            text.split('').forEach(char => {
                if (px < this.width && py < this.height) {
                    const idx = (py * this.width + px) * 4;
                    const code = char.charCodeAt(0);

                    // Modulate color by character for visual texture
                    this.pixels[idx] = Math.min(255, baseR + (code % 64));
                    this.pixels[idx + 1] = Math.min(255, baseG + ((code * 2) % 64));
                    this.pixels[idx + 2] = Math.min(255, baseB + ((code * 3) % 64));
                    this.pixels[idx + 3] = 255;

                    px++;
                    if (px >= x + maxWidth || char === '\n') {
                        px = x;
                        py++;
                    }
                }
            });
        });

        console.log(`     ${docs.length} documents rendered`);
    }

    /**
     * Add a saccade (attention connection) between cortex tile and archive doc
     */
    addSaccade(tileId, docId, intensity = 1.0) {
        const tile = this.cortex?.tiles?.find(t => t.id === tileId);
        const doc = this.archive?.documents?.find(d => d.id === docId);

        if (tile && doc) {
            this.saccades.push({
                from: { x: tile.x * 32 + 16, y: tile.y * 32 + 16 },
                to: { x: doc.coords.x + 40, y: doc.coords.y + 5 },
                intensity,
                age: 0
            });
        }
    }

    renderSaccades() {
        if (this.saccades.length === 0) return;
        console.log(`  ⚡ Rendering ${this.saccades.length} saccade connections...`);

        this.saccades.forEach(sac => {
            // Draw a line from cortex to archive with Bresenham's algorithm
            const dx = Math.abs(sac.to.x - sac.from.x);
            const dy = Math.abs(sac.to.y - sac.from.y);
            const sx = sac.from.x < sac.to.x ? 1 : -1;
            const sy = sac.from.y < sac.to.y ? 1 : -1;
            let err = dx - dy;

            let x = sac.from.x;
            let y = sac.from.y;

            const maxSteps = 1000; // Prevent infinite loops
            let steps = 0;

            while (steps < maxSteps) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    const idx = (y * this.width + x) * 4;

                    // Bright yellow/white line for attention
                    const brightness = Math.floor(255 * sac.intensity * (1 - sac.age / 100));
                    this.pixels[idx] = brightness;
                    this.pixels[idx + 1] = brightness;
                    this.pixels[idx + 2] = Math.floor(brightness * 0.5);
                    this.pixels[idx + 3] = 255;
                }

                if (x === sac.to.x && y === sac.to.y) break;

                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
                steps++;
            }
        });
    }

    addLabels() {
        // Add simple text labels at top of each continent
        const labels = [
            { text: "CORTEX", x: 100, y: 50, color: [0, 200, 200] },
            { text: "ARCHIVE", x: 5200, y: 50, color: [200, 200, 100] }
        ];

        labels.forEach(({ text, x, y, color }) => {
            // Simple block letters
            text.split('').forEach((char, i) => {
                const code = char.charCodeAt(0);
                for (let dy = 0; dy < 10; dy++) {
                    for (let dx = 0; dx < 8; dx++) {
                        const px = x + i * 10 + dx;
                        const py = y + dy;
                        if (px < this.width && py < this.height) {
                            // Simple pattern based on char
                            if ((dx + dy + code) % 3 !== 0) {
                                const idx = (py * this.width + px) * 4;
                                this.pixels[idx] = color[0];
                                this.pixels[idx + 1] = color[1];
                                this.pixels[idx + 2] = color[2];
                                this.pixels[idx + 3] = 255;
                            }
                        }
                    }
                }
            });
        });
    }

    /**
     * Simulate a saccade for demo purposes
     */
    simulateSaccade(query) {
        console.log(`\n⚡ Simulating saccade for: "${query}"\n`);

        // Find relevant archive docs by simple keyword matching
        const queryWords = query.toLowerCase().split(/\s+/);
        const matches = [];

        if (this.archive?.documents) {
            this.archive.documents.forEach(doc => {
                const docWords = doc.text.toLowerCase().split(/\s+/);
                const overlap = queryWords.filter(w => docWords.some(dw => dw.includes(w))).length;
                if (overlap > 0) {
                    matches.push({ doc, score: overlap });
                }
            });
        }

        matches.sort((a, b) => b.score - a.score);

        // Create saccades from random cortex tiles to top matches
        const tiles = this.cortex?.tiles || [];
        const topMatches = matches.slice(0, 3);

        topMatches.forEach(match => {
            // Pick tiles from the layer that would handle this
            const relevantTiles = tiles.filter(t =>
                t.parameter?.includes('attn') || t.parameter?.includes('embed')
            ).slice(0, 5 + match.score * 2);

            relevantTiles.forEach(tile => {
                this.addSaccade(tile.id, match.doc.id, match.score / queryWords.length);
            });
        });

        console.log(`  Found ${matches.length} relevant documents`);
        console.log(`  Created ${this.saccades.length} attention connections`);

        return topMatches.map(m => ({
            category: m.doc.category,
            snippet: m.doc.text.slice(0, 50) + '...',
            score: m.score
        }));
    }

    /**
     * Export to PNG (simplified - creates raw RGBA for now)
     */
    async exportPNG(filename) {
        // For now, write as raw RGBA data
        // In production, use a proper PNG encoder
        const outputPath = join(OUTPUT_DIR, filename);
        writeFileSync(outputPath + '.raw', this.pixels);

        console.log(`\n📸 Exported: ${outputPath}.raw`);
        console.log(`   Size: ${this.width}x${this.height}`);
        console.log(`   View with: convert -size ${this.width}x${this.height} -depth 8 rgba:${outputPath}.raw ${outputPath}.png`);
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    const viz = new GlassBoxVisualizer();

    if (args.includes('--query')) {
        const queryIdx = args.indexOf('--query');
        const query = args.slice(queryIdx + 1).join(' ') || 'What is gravity?';
        viz.simulateSaccade(query);
    }

    if (args.includes('--animate')) {
        // Demo: simulate attention to physics docs
        viz.simulateSaccade('gravity force pull');
    }

    viz.render();
    await viz.exportPNG('glass_box_view');
}

main().catch(console.error);
