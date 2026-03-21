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
    white: [0xff, 0xff, 0xff],
    black: [0x00, 0x00, 0x00],
    red: [0xff, 0x00, 0x00],
    green: [0x00, 0xff, 0x00],
    blue: [0x00, 0x00, 0xff],
    yellow: [0xff, 0xff, 0x00],
    cyan: [0x00, 0xff, 0xff],
    magenta: [0xff, 0x00, 0xff],
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
     * Resolve color from name, array, or hex.
     */
    resolveColor(color) {
        if (typeof color === 'string' && COLORS[color]) {
            return COLORS[color];
        }
        if (Array.isArray(color)) {
            return color;
        }
        if (typeof color === 'number') {
            return [
                (color >> 16) & 0xff,
                (color >> 8) & 0xff,
                color & 0xff
            ];
        }
        return COLORS.text;
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
     * Draw a filled rectangle.
     * =RECT(col, row, w, h, color)
     */
    RECT(col, row, widthCells, heightCells, color = 'barFill') {
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const w = widthCells * this.atlas.glyphW;
        const h = heightCells * this.atlas.glyphH;
        const [r, g, b] = this.resolveColor(color);

        this.buffer.drawRect(px, py, w, h, r, g, b);
    }

    /**
     * Draw a horizontal or vertical line.
     * =LINE(col, row, length, direction, color)
     */
    LINE(col, row, length, direction = 'h', color = 'border') {
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const [r, g, b] = this.resolveColor(color);

        if (direction === 'h') {
            const w = length * this.atlas.glyphW;
            for (let x = px; x < px + w; x++) {
                this.buffer.setPixel(x, py, r, g, b);
            }
        } else {
            const h = length * this.atlas.glyphH;
            for (let y = py; y < py + h; y++) {
                this.buffer.setPixel(px, y, r, g, b);
            }
        }
    }

    /**
     * Draw a circle.
     * =CIRCLE(col, row, radiusCells, color, filled)
     */
    CIRCLE(col, row, radiusCells, color = 'border', filled = false) {
        const cx = col * this.atlas.glyphW + this.atlas.glyphW / 2;
        const cy = row * this.atlas.glyphH + this.atlas.glyphH / 2;
        const r = radiusCells * this.atlas.glyphW;
        const [cr, cg, cb] = this.resolveColor(color);

        if (filled) {
            // Filled circle using midpoint algorithm
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    if (x * x + y * y <= r * r) {
                        this.buffer.setPixel(Math.round(cx + x), Math.round(cy + y), cr, cg, cb);
                    }
                }
            }
        } else {
            // Circle outline using midpoint algorithm
            let x = r;
            let y = 0;
            let err = 0;

            while (x >= y) {
                this.buffer.setPixel(cx + x, cy + y, cr, cg, cb);
                this.buffer.setPixel(cx + y, cy + x, cr, cg, cb);
                this.buffer.setPixel(cx - y, cy + x, cr, cg, cb);
                this.buffer.setPixel(cx - x, cy + y, cr, cg, cb);
                this.buffer.setPixel(cx - x, cy - y, cr, cg, cb);
                this.buffer.setPixel(cx - y, cy - x, cr, cg, cb);
                this.buffer.setPixel(cx + y, cy - x, cr, cg, cb);
                this.buffer.setPixel(cx + x, cy - y, cr, cg, cb);

                y++;
                err += 1 + 2 * y;
                if (2 * (err - x) + 1 > 0) {
                    x--;
                    err += 1 - 2 * x;
                }
            }
        }
    }

    /**
     * Draw a circular gauge (arc showing percentage).
     * =GAUGE(col, row, cellValue, radiusCells, color)
     */
    GAUGE(col, row, cellValue, radiusCells, color = 'active') {
        const cx = col * this.atlas.glyphW + this.atlas.glyphW / 2;
        const cy = row * this.atlas.glyphH + this.atlas.glyphH / 2;
        const r = radiusCells * this.atlas.glyphW;
        const [cr, cg, cb] = this.resolveColor(color);

        const val = this.resolveValue(cellValue);
        const fraction = Math.max(0, Math.min(1, Number(val) || 0));

        // Draw filled arc (from top, clockwise)
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (fraction * 2 * Math.PI);

        for (let angle = startAngle; angle < endAngle; angle += 0.02) {
            for (let dr = 0; dr <= r; dr++) {
                const x = Math.round(cx + dr * Math.cos(angle));
                const y = Math.round(cy + dr * Math.sin(angle));
                this.buffer.setPixel(x, y, cr, cg, cb);
            }
        }
    }

    /**
     * Draw a formatted number.
     * =NUMBER(col, row, cellValue, format)
     * Format: "0%" → "75%", "0.0 GB" → "28.1 GB"
     */
    NUMBER(col, row, cellValue, format = '0') {
        const val = this.resolveValue(cellValue);
        const num = Number(val) || 0;

        let text;
        if (format.includes('%')) {
            // Percentage format
            const zeros = (format.match(/0+/) || ['0'])[0];
            const decimals = Math.max(0, zeros.length - 2);
            text = (num * 100).toFixed(decimals) + '%';
        } else if (format.includes('GB') || format.includes('MB') || format.includes('KB')) {
            // Size format
            const zeros = (format.match(/0+/) || ['0'])[0];
            const decimals = Math.max(0, zeros.length - 1);
            text = num.toFixed(decimals) + format.replace(/[\d.]+/, '').trim();
        } else {
            // Plain number format
            const zeros = (format.match(/0+/) || ['0'])[0];
            const decimals = Math.max(0, zeros.length - 1);
            text = num.toFixed(decimals);
        }

        this.atlas.drawTextCell(this.buffer, col, row, text, COLORS.text);
    }

    /**
     * Draw the current time.
     * =TIME(col, row, format)
     * Format: "HH:mm" → "14:05", "HH:mm:ss" → "14:05:32"
     */
    TIME(col, row, format = 'HH:mm') {
        const now = new Date();
        let text = format
            .replace('HH', String(now.getHours()).padStart(2, '0'))
            .replace('mm', String(now.getMinutes()).padStart(2, '0'))
            .replace('ss', String(now.getSeconds()).padStart(2, '0'));

        this.atlas.drawTextCell(this.buffer, col, row, text, COLORS.text);
    }

    /**
     * Draw a bar chart from array.
     * =CHART(col, row, cellArray, width, height, color)
     */
    CHART(col, row, cellArray, widthCells = 10, heightCells = 3, color = 'barFill') {
        const arr = this.resolveValue(cellArray);
        if (!Array.isArray(arr) || arr.length === 0) return;

        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const chartW = widthCells * this.atlas.glyphW;
        const chartH = heightCells * this.atlas.glyphH;
        const [r, g, b] = this.resolveColor(color);

        const max = Math.max(...arr);
        const barWidth = Math.floor(chartW / arr.length);
        const gap = 1;

        for (let i = 0; i < arr.length; i++) {
            const val = arr[i] || 0;
            const barH = Math.round((val / max) * chartH);
            const x = px + i * barWidth;
            const y = py + chartH - barH;
            
            this.buffer.drawRect(x, y, barWidth - gap, barH, r, g, b);
        }
    }

    /**
     * Draw a donut/ring chart.
     * =DONUT(col, row, cellValue, radius, color, bgColor)
     */
    DONUT(col, row, cellValue, radiusCells = 3, color = 'active', bgColor = 'barEmpty') {
        const cx = col * this.atlas.glyphW + this.atlas.glyphW / 2;
        const cy = row * this.atlas.glyphH + this.atlas.glyphH / 2;
        const outerR = radiusCells * this.atlas.glyphW;
        const innerR = outerR * 0.6;
        const [cr, cg, cb] = this.resolveColor(color);
        const [br, bg, bb] = this.resolveColor(bgColor);

        const val = this.resolveValue(cellValue);
        const fraction = Math.max(0, Math.min(1, Number(val) || 0));

        // Draw background ring
        for (let angle = 0; angle < 2 * Math.PI; angle += 0.02) {
            for (let r = innerR; r <= outerR; r++) {
                const x = Math.round(cx + r * Math.cos(angle));
                const y = Math.round(cy + r * Math.sin(angle));
                this.buffer.setPixel(x, y, br, bg, bb);
            }
        }

        // Draw filled arc
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (fraction * 2 * Math.PI);

        for (let angle = startAngle; angle < endAngle; angle += 0.02) {
            for (let r = innerR; r <= outerR; r++) {
                const x = Math.round(cx + r * Math.cos(angle));
                const y = Math.round(cy + r * Math.sin(angle));
                this.buffer.setPixel(x, y, cr, cg, cb);
            }
        }
    }

    /**
     * Draw circular progress indicator.
     * =PROGRESS(col, row, cellValue, size, color)
     */
    PROGRESS(col, row, cellValue, radiusCells = 3, color = 'active') {
        this.DONUT(col, row, cellValue, radiusCells, color, 'barEmpty');
    }

    /**
     * Draw a status badge.
     * =BADGE(col, row, text, bgColor, textColor)
     */
    BADGE(col, row, text, bgColor = 'active', textColor = 'white') {
        const label = String(this.resolveValue(text) ?? text);
        const [br, bg, bb] = this.resolveColor(bgColor);
        const [tr, tg, tb] = this.resolveColor(textColor);

        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const padding = 3;
        const labelWidth = label.length * this.atlas.glyphW;
        const badgeW = labelWidth + padding * 2;
        const badgeH = this.atlas.glyphH;

        // Draw badge background
        this.buffer.drawRect(px, py, badgeW, badgeH, br, bg, bb);

        // Draw text
        this.atlas.drawText(this.buffer, px + padding, py, label, [tr, tg, tb]);
    }

    /**
     * Conditional cell coloring.
     * =COND(col, row, cellValue, threshold, aboveColor, belowColor)
     */
    COND(col, row, cellValue, threshold = 0.5, aboveColor = 'active', belowColor = 'idle') {
        const val = this.resolveValue(cellValue);
        const num = Number(val) || 0;
        const color = num >= threshold ? aboveColor : belowColor;
        const [r, g, b] = this.resolveColor(color);

        // Fill cell with color
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        this.buffer.drawRect(px, py, this.atlas.glyphW, this.atlas.glyphH, r, g, b);
    }

    /**
     * Show value with trend arrow.
     * =HISTORY(col, row, cellValue, prevValue, format)
     */
    HISTORY(col, row, cellValue, prevValue, format = '0.0') {
        const current = Number(this.resolveValue(cellValue)) || 0;
        const prev = Number(this.resolveValue(prevValue)) || current;
        const diff = current - prev;

        // Format value
        let text;
        if (format.includes('%')) {
            text = (current * 100).toFixed(1) + '%';
        } else {
            text = current.toFixed(1);
        }

        // Add trend arrow
        const arrow = diff > 0.001 ? ' ↑' : diff < -0.001 ? ' ↓' : ' →';
        text += arrow;

        // Color based on direction
        const color = diff > 0 ? COLORS.active : diff < 0 ? COLORS.critical : COLORS.idle;
        this.atlas.drawTextCell(this.buffer, col, row, text, color);
    }

    /**
     * Display array as grid.
     * =GRID(col, row, cellArray, cols, color)
     */
    GRID(col, row, cellArray, cols = 4, color = 'text') {
        const arr = this.resolveValue(cellArray);
        if (!Array.isArray(arr) || arr.length === 0) return;

        const [r, g, b] = this.resolveColor(color);

        for (let i = 0; i < arr.length; i++) {
            const c = col + (i % cols);
            const r = row + Math.floor(i / cols);
            const val = arr[i];
            const text = typeof val === 'number' ? val.toFixed(1) : String(val);
            this.atlas.drawTextCell(this.buffer, c, r, text, [r, g, b]);
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
