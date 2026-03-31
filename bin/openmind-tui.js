#!/usr/bin/env node
/**
 * OpenMind TUI - Live visualization of neural attention
 *
 * Connects to real OpenMind data:
 * - Cortex: 79,946 tiles from distilgpt2
 * - Archive: Knowledge documents with semantic embeddings
 * - Saccades: Real attention routing via sentence-transformers
 *
 * Usage:
 *   node bin/openmind-tui.js
 *   node bin/openmind-tui.js --query "What is gravity?"
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// OpenMind paths (sibling to ascii_world)
const OPENMIND_ROOT = process.env.OPENMIND_ROOT || join(process.env.HOME, 'zion', 'projects', 'openmind');
const CORTEX_MANIFEST = join(OPENMIND_ROOT, 'cortex', 'spatial_manifest.json');
const ARCHIVE_MANIFEST = join(OPENMIND_ROOT, 'archive', 'archive_manifest.json');
const ATTENTION_DATA = join(OPENMIND_ROOT, 'visualizations', 'real_attention.json');

// Terminal dimensions
const WIDTH = 120;
const HEIGHT = 36;

// ANSI helpers
const ANSI = {
    reset: '\x1b[0m',
    clear: '\x1b[2J',
    home: '\x1b[H',
    hide: '\x1b[?25l',
    show: '\x1b[?25h',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cursor: (row, col) => `\x1b[${row};${col}H`,
    rgb: (r, g, b) => `\x1b[38;2;${r};${g};${b}m`,
    bgRgb: (r, g, b) => `\x1b[48;2;${r};${g};${b}m`,
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    white: '\x1b[37m',
};

// Strip ANSI codes to get visible string length
function visLen(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

// Pad string to visible width, accounting for ANSI codes
function visPad(str, width) {
    const pad = width - visLen(str);
    return pad > 0 ? str + ' '.repeat(pad) : str;
}

class OpenMindTUI {
    constructor(query = "What is gravity?") {
        this.query = query;
        this.frame = 0;
        this.running = false;

        // Real data
        this.cortex = null;
        this.archive = null;
        this.attention = null;

        // Animation state
        this.activeTiles = new Map(); // tile_id -> intensity
        this.saccades = [];
        this.docAttention = new Map(); // doc_id -> count

        // Attention cursor (for animation)
        this.cursor = { x: 0, y: 0 };
        this.cursorTarget = { x: 0, y: 0 };
        this.currentSaccade = 0;
    }

    loadRealData() {
        try {
            this.cortex = JSON.parse(readFileSync(CORTEX_MANIFEST, 'utf-8'));
            // Build tile lookup by id (avoids O(n) scan of 79,946 tiles)
            this.tileById = new Map();
            for (const tile of this.cortex.tiles) {
                this.tileById.set(tile.id, tile);
            }
        } catch (e) {
            this.cortex = { tiles: [], metadata: {} };
            this.tileById = new Map();
        }

        try {
            this.archive = JSON.parse(readFileSync(ARCHIVE_MANIFEST, 'utf-8'));
        } catch (e) {
            this.archive = { documents: [] };
        }

        try {
            this.attention = JSON.parse(readFileSync(ATTENTION_DATA, 'utf-8'));
            this.saccades = this.attention.saccades || [];
            this.query = this.attention.input_text || this.query;
            this._computeActiveGrid();
        } catch (e) {
            this.attention = { saccades: [], input_text: this.query };
            this.saccades = [];
        }
    }

    _computeActiveGrid() {
        // Pre-compute which screen cells are active and their intensity
        // This avoids the O(saccades × tiles × grid) inner loop
        this.activeGrid = new Map(); // "col,row" -> { intensity, count }
        this.docAttention = new Map();
        this.docMaxSim = new Map();

        const scale = this.cortex?.metadata?.grid_size || 300;

        for (const s of this.saccades) {
            // Doc attention
            this.docAttention.set(s.doc_id, (this.docAttention.get(s.doc_id) || 0) + 1);
            this.docMaxSim.set(s.doc_id, Math.max(this.docMaxSim.get(s.doc_id) || 0, s.semantic_similarity || 0));

            // Tile position on screen
            const tile = this.tileById.get(s.tile_id);
            if (!tile) continue;

            const col = Math.floor((tile.x / scale) * 56);
            const row = Math.floor((tile.y / scale) * 18);
            
            // Add "bloom" effect - spread intensity to neighbors
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ncol = col + dx;
                    const nrow = row + dy;
                    if (ncol < 0 || ncol >= 56 || nrow < 0 || nrow >= 18) continue;
                    
                    const key = `${ncol},${nrow}`;
                    const falloff = (dx === 0 && dy === 0) ? 1.0 : 0.4;
                    const intensity = (s.semantic_similarity || 0) * falloff;

                    const prev = this.activeGrid.get(key);
                    if (!prev || intensity > prev.intensity) {
                        this.activeGrid.set(key, {
                            intensity: intensity,
                            count: (prev?.count || 0) + 1
                        });
                    }
                }
            }
        }
    }

    // Map cortex tile (x,y) to terminal grid position
    tileToScreen(x, y) {
        const gridWidth = 56;
        const gridHeight = 18;
        const scale = this.cortex?.metadata?.grid_size || 300;

        return {
            col: 2 + Math.floor((x / scale) * gridWidth),
            row: 5 + Math.floor((y / scale) * gridHeight)
        };
    }

    // Map archive doc index to screen position
    docToScreen(docId) {
        const startCol = 62;
        const startRow = 5;
        
        return {
            col: startCol,
            row: startRow + (docId * 2)
        };
    }

    render() {
        const lines = [];

        // Header
        const title = ` OPENMIND — Watch AI Think `;
        const titlePad = ' '.repeat(Math.floor((WIDTH - title.length) / 2));
        lines.push(ANSI.bold + ANSI.cyan + '┌' + '─'.repeat(WIDTH - 2) + '┐' + ANSI.reset);
        lines.push(ANSI.bold + ANSI.cyan + '│' + ANSI.white + titlePad + title + titlePad + (title.length % 2 === 0 ? '' : ' ') + '│' + ANSI.reset);

        // Status bar
        const status = this.running
            ? ANSI.yellow + ' ⏳ Running inference...' + ANSI.reset
            : ANSI.green + ` ✓ ${this.saccades.length} saccades` + ANSI.reset;
        const queryDisplay = this.query.length > 60 ? this.query.slice(0, 60) + '...' : this.query;
        lines.push(ANSI.dim + '├' + '─'.repeat(WIDTH - 2) + '┤' + ANSI.reset);
        
        const queryLine = `│ Query: "${ANSI.white}${queryDisplay}${ANSI.reset}"`;
        lines.push(visPad(queryLine, WIDTH - 1) + '│');

        // Separator
        lines.push(ANSI.dim + '├' + '─'.repeat(58) + '┬' + '─'.repeat(WIDTH - 61) + '┤' + ANSI.reset);

        // Main grid area
        const catColors = {
            physics: ANSI.cyan,
            math: ANSI.yellow,
            biology: ANSI.green,
            history: ANSI.red,
            language: ANSI.rgb(200, 150, 255),
            programming: ANSI.rgb(255, 255, 100)
        };

        for (let row = 0; row < 18; row++) {
            let line = '│ ';

            // Cortex grid (left side) - uses pre-computed activeGrid
            for (let col = 0; col < 56; col++) {
                const cell = this.activeGrid.get(`${col},${row}`);
                if (cell) {
                    const i = cell.intensity;
                    if (i > 0.4) {
                        line += ANSI.rgb(0, 255, 200) + '█' + ANSI.reset;
                    } else if (i > 0.2) {
                        line += ANSI.rgb(100, 200, 255) + '▓' + ANSI.reset;
                    } else if (i > 0.05) {
                        line += ANSI.rgb(150, 150, 200) + '▒' + ANSI.reset;
                    } else {
                        line += ANSI.dim + '░' + ANSI.reset;
                    }
                } else {
                    line += ANSI.dim + '░' + ANSI.reset;
                }
            }

            line += ' │ ';

            // Archive panel (right side)
            const docIdx = Math.floor(row / 2);
            if (row % 2 === 0 && docIdx < (this.archive?.documents?.length || 0)) {
                const doc = this.archive.documents[docIdx];
                const attnCount = this.docAttention.get(docIdx) || 0;
                const maxSim = this.docMaxSim.get(docIdx) || 0;
                const catColor = catColors[doc.category] || ANSI.white;

                // Attention bar scaled by similarity
                const barLen = Math.min(15, Math.floor(maxSim * 25));
                const bar = attnCount > 0
                    ? (maxSim > 0.3 ? ANSI.rgb(0, 255, 200) : ANSI.dim) + '●'.repeat(Math.max(1, barLen)) + ANSI.reset
                    : '';

                line += catColor + doc.category.slice(0, 10).padEnd(10) + ANSI.reset;
                line += ' ' + bar;

                if (attnCount > 0) {
                    line += ANSI.dim + ` ${attnCount}× ${maxSim > 0.01 ? maxSim.toFixed(2) : ''}` + ANSI.reset;
                }
            }

            lines.push(visPad(line, WIDTH - 1) + '│');
        }

        // Footer
        lines.push(ANSI.dim + '├' + '─'.repeat(WIDTH - 2) + '┤' + ANSI.reset);

        // Token display
        if (this.attention?.saccades?.length > 0) {
            const tokens = new Set(this.saccades.map(s => s.to_token_text).filter(Boolean));
            const tokenStr = Array.from(tokens).slice(0, 8).join(' → ');
            const tokenLine = `│ Active: ${ANSI.cyan}${tokenStr}${ANSI.reset}`;
            lines.push(visPad(tokenLine, WIDTH - 1) + '│');
        } else {
            lines.push('│ No active attention connections'.padEnd(WIDTH - 1) + '│');
        }

        // Controls
        lines.push(ANSI.dim + '├' + '─'.repeat(WIDTH - 2) + '┤' + ANSI.reset);
        const controlsLine = '│ ' + ANSI.bold + '[Enter]' + ANSI.reset + ' New query  ' +
            ANSI.bold + '[R]' + ANSI.reset + ' Re-run  ' +
            ANSI.bold + '[Q]' + ANSI.reset + ' Quit';
        lines.push(visPad(controlsLine, WIDTH - 1) + '│');
        lines.push(ANSI.dim + '└' + '─'.repeat(WIDTH - 2) + '┘' + ANSI.reset);

        // Render to screen
        process.stdout.write(ANSI.home + lines.join('\n'));
    }

    async start() {
        process.stdout.write(ANSI.clear + ANSI.hide);
        this.loadRealData();

        // Initial render
        this.render();

        // Handle input (only if TTY)
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.on('data', async (key) => {
            const k = key.toString();

            if (k === 'q' || k === 'Q' || k === '\x03') {
                this.stop();
                return;
            }

            if (k === 'r' || k === 'R') {
                await this.runInference(this.query);
                this.render();
            }

            if (k === '\r' || k === '\n') {
                // For now, just cycle through example queries
                const queries = [
                    "What is gravity and how does it affect objects?",
                    "How do cells divide in biology?",
                    "Write a function to sort a list in Python",
                    "What is the history of ancient Egypt?",
                    "Explain language and communication systems"
                ];
                const nextQuery = queries[Math.floor(Math.random() * queries.length)];
                await this.runInference(nextQuery);
                this.render();
            }
        });

        // Animation loop (for future saccade animation)
        this.animationInterval = setInterval(() => {
            this.frame++;
            // Could animate saccade cursor here
        }, 100);
    }

    stop() {
        process.stdout.write(ANSI.show + ANSI.reset);
        process.stdout.write(ANSI.clear + ANSI.home);
        console.log('\nOpenMind TUI closed.\n');
        process.exit(0);
    }
}

// Parse args
const args = process.argv.slice(2);
let query = "What is gravity?";
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--query' || args[i] === '-q') {
        query = args[++i];
    }
}

// Start
const tui = new OpenMindTUI(query);
tui.start();
