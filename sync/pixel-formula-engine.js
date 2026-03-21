// pixel-formula-engine.js — Evaluates pixel formulas directly to PixelBuffer operations
// No text intermediary — formulas write pixels directly.
// Part of Phase 2: Pixel-native reactive cell system.

import { PixelBuffer } from './pixel-buffer.js';
import { GlyphAtlas } from './glyph-atlas.js';

const COLORS = {
    active: [0x3f, 0xb9, 0x50],     // Green #3fb950
    idle: [0x48, 0x4f, 0x58],       // Dim gray #484f58
    critical: [0xf8, 0x51, 0x49],   // Red #f85149
    barFill: [0x23, 0x86, 0x36],    // Dark green #238636
    barEmpty: [0x16, 0x1b, 0x22],   // Near black #161b22
    border: [0x30, 0x36, 0x3d],     // Gray #30363d
    borderHighlight: [0x00, 0xd4, 0xff], // Cyan #00d4ff
    text: [0xc9, 0xd1, 0xd9],       // Light gray #c9d1d9
    textMuted: [0x8b, 0x94, 0x9e],  // Muted #8b949e
};

export class PixelFormulaEngine {
    constructor(width = 480, height = 240) {
        this.width = width;
        this.height = height;
        this.buffer = new PixelBuffer(width, height);
        this.atlas = new GlyphAtlas();
        this.cells = {};
    }

    /**
     * Set reactive cell values for formula evaluation.
     */
    setCells(cells) {
        this.cells = cells;
    }

    /**
     * Resolve a cell reference or return literal value.
     */
    resolveValue(cellValue) {
        if (typeof cellValue === 'string' && cellValue in this.cells) {
            return this.cells[cellValue];
        }
        return cellValue;
    }

    /**
     * Clear the buffer with dark background.
     */
    clear() {
        this.buffer.clear(0x0a0a0f);
    }

    /**
     * Export buffer as PNG.
     */
    async toPNG() {
        return this.buffer.toPNG();
    }

    /**
     * Draw a progress bar at cell position.
     * =BAR(cpu, 40) → 40-cell wide progress bar
     */
    BAR(col, row, cellValue, widthCells) {
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const w = widthCells * this.atlas.glyphW;
        const h = this.atlas.glyphH;

        const val = this.resolveValue(cellValue);
        const fraction = Math.max(0, Math.min(1, Number(val) || 0));

        this.buffer.drawProgressBar(px, py, w, h, fraction, COLORS.barFill, COLORS.barEmpty);
    }

    /**
     * Draw text at cell position.
     * =TEXT(cpu_display) → renders the value as text
     */
    TEXT(col, row, cellValue) {
        const text = String(this.resolveValue(cellValue) ?? '');
        this.atlas.drawTextCell(this.buffer, col, row, text, COLORS.text);
    }

    /**
     * Draw status indicator with semantic color.
     * =STATUS(state, 2, "◉ done", 1, "● active", "○ idle")
     */
    STATUS(col, row, cellValue, ...thresholds) {
        const val = this.resolveValue(cellValue);

        let displayText = '';
        let color = COLORS.idle;

        // Parse threshold pairs: level, text, level, text, ..., default
        for (let i = 0; i < thresholds.length - 1; i += 2) {
            const level = thresholds[i];
            const text = thresholds[i + 1];
            if (val === level) {
                displayText = text;
                if (text.includes('◉')) color = COLORS.critical;
                else if (text.includes('●')) color = COLORS.active;
                else color = COLORS.idle;
                break;
            }
        }

        // Default is last element if no match
        if (!displayText && thresholds.length > 0) {
            displayText = thresholds[thresholds.length - 1];
        }

        this.atlas.drawTextCell(this.buffer, col, row, displayText, color);
    }

    /**
     * Draw a box outline.
     * =BOX(40, 5) → 40×5 cell box
     */
    BOX(col, row, widthCells, heightCells) {
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const w = widthCells * this.atlas.glyphW;
        const h = heightCells * this.atlas.glyphH;

        // Draw four sides
        for (let x = px; x < px + w; x++) {
            this.buffer.setPixel(x, py, ...COLORS.border);
            this.buffer.setPixel(x, py + h - 1, ...COLORS.border);
        }
        for (let y = py; y < py + h; y++) {
            this.buffer.setPixel(px, y, ...COLORS.border);
            this.buffer.setPixel(px + w - 1, y, ...COLORS.border);
        }
    }

    /**
     * Draw a sparkline from array values.
     * =SPARKLINE(cpu_history, 50) → 50-cell wide sparkline
     */
    SPARKLINE(col, row, cellValue, widthCells) {
        const arr = this.resolveValue(cellValue);
        if (!Array.isArray(arr) || arr.length === 0) return;

        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const barH = this.atlas.glyphH;

        const max = Math.max(...arr);
        const min = Math.min(...arr);
        const range = max - min || 1;

        const step = arr.length / widthCells;

        for (let i = 0; i < widthCells; i++) {
            const idx = Math.floor(i * step);
            const val = arr[idx] ?? 0;
            const frac = (val - min) / range;
            const barW = this.atlas.glyphW;

            // Draw vertical bar from bottom
            const filledH = Math.round(frac * barH);
            this.buffer.drawRect(
                px + i * barW,
                py + barH - filledH,
                barW,
                filledH,
                ...COLORS.barFill
            );
        }
    }

    /**
     * Evaluate a pixel template (array of formula calls).
     * Each entry: { fn: 'BAR', args: [col, row, 'cpu', 40] }
     */
    renderTemplate(template) {
        this.clear();

        for (const op of template) {
            const fn = this[op.fn];
            if (typeof fn === 'function') {
                fn.call(this, ...op.args);
            }
        }

        return this.buffer;
    }
}
