// sync/color-picker.js
// Terminal-friendly color picker with 256-color palette grid and hex input.
// Provides preview of selected color on text, border, and background.

/**
 * Standard 16 ANSI colors as RGB arrays.
 */
export const ANSI_16 = [
    [0, 0, 0],       // 0  black
    [128, 0, 0],     // 1  maroon
    [0, 128, 0],     // 2  green
    [128, 128, 0],   // 3  olive
    [0, 0, 128],     // 4  navy
    [128, 0, 128],   // 5  purple
    [0, 128, 128],   // 6  teal
    [192, 192, 192], // 7  silver
    [128, 128, 128], // 8  gray
    [255, 0, 0],     // 9  red
    [0, 255, 0],     // 10 lime
    [255, 255, 0],   // 11 yellow
    [0, 0, 255],     // 12 blue
    [255, 0, 255],   // 13 fuchsia
    [0, 255, 255],   // 14 aqua
    [255, 255, 255], // 15 white
];

/**
 * Generate the 6x6x6 color cube (indices 16-231).
 */
export function colorCube() {
    const cube = [];
    for (let r = 0; r < 6; r++) {
        for (let g = 0; g < 6; g++) {
            for (let b = 0; b < 6; b++) {
                cube.push([
                    r === 0 ? 0 : 55 + r * 40,
                    g === 0 ? 0 : 55 + g * 40,
                    b === 0 ? 0 : 55 + b * 40,
                ]);
            }
        }
    }
    return cube;
}

/**
 * Generate the 24 greyscale ramp (indices 232-255).
 */
export function greyRamp() {
    const ramp = [];
    for (let i = 0; i < 24; i++) {
        const v = 8 + i * 10;
        ramp.push([v, v, v]);
    }
    return ramp;
}

/**
 * Full 256-color palette: ANSI 16 + 216 cube + 24 greys.
 */
export const PALETTE_256 = [...ANSI_16, ...colorCube(), ...greyRamp()];

/**
 * Preset named colors (useful for quick cycling).
 */
export const PRESET_COLORS = {
    black:       [0, 0, 0],
    white:       [255, 255, 255],
    red:         [255, 0, 0],
    green:       [0, 255, 0],
    blue:        [0, 0, 255],
    cyan:        [0, 255, 255],
    magenta:     [255, 0, 255],
    yellow:      [255, 255, 0],
    orange:      [255, 165, 0],
    pink:        [255, 105, 180],
    purple:      [128, 0, 128],
    teal:        [0, 128, 128],
    lime:        [0, 255, 0],
    navy:        [0, 0, 128],
    maroon:      [128, 0, 0],
    olive:       [128, 128, 0],
    silver:      [192, 192, 192],
    gray:        [128, 128, 128],
    darkgray:    [64, 64, 64],
    lightgray:   [211, 211, 211],
};

/**
 * Validate an RGB triplet.
 * @param {any} color
 * @returns {boolean}
 */
export function isValidRGB(color) {
    return Array.isArray(color) &&
        color.length >= 3 &&
        color.every(c => Number.isInteger(c) && c >= 0 && c <= 255);
}

/**
 * Parse a hex color string to [r, g, b].
 * Supports #RGB, #RRGGBB, RGB, RRGGBB.
 * @param {string} hex
 * @returns {number[]|null}
 */
export function parseHex(hex) {
    if (!hex || typeof hex !== 'string') return null;
    const cleaned = hex.replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
        const r = parseInt(cleaned[0] + cleaned[0], 16);
        const g = parseInt(cleaned[1] + cleaned[1], 16);
        const b = parseInt(cleaned[2] + cleaned[2], 16);
        return [r, g, b];
    }
    if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        const r = parseInt(cleaned.substring(0, 2), 16);
        const g = parseInt(cleaned.substring(2, 4), 16);
        const b = parseInt(cleaned.substring(4, 6), 16);
        return [r, g, b];
    }
    return null;
}

/**
 * Convert [r, g, b] to hex string #RRGGBB.
 * @param {number[]} rgb
 * @returns {string}
 */
export function toHex(rgb) {
    if (!isValidRGB(rgb)) return '#000000';
    const h = (v) => v.toString(16).padStart(2, '0');
    return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}

/**
 * Find the nearest 256-color index for a given RGB.
 * Uses simple Euclidean distance in RGB space.
 * @param {number[]} rgb
 * @returns {number}
 */
export function nearestColorIndex(rgb) {
    if (!isValidRGB(rgb)) return 0;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < PALETTE_256.length; i++) {
        const p = PALETTE_256[i];
        const dr = rgb[0] - p[0];
        const dg = rgb[1] - p[1];
        const db = rgb[2] - p[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
        }
    }
    return bestIdx;
}

/**
 * Generate an ANSI escape code for a 256-color foreground.
 * @param {number} idx - 0-255 color index
 * @returns {string}
 */
export function ansi256Fg(idx) {
    return `\x1b[38;5;${idx}m`;
}

/**
 * Generate an ANSI escape code for a 256-color background.
 * @param {number} idx - 0-255 color index
 * @returns {string}
 */
export function ansi256Bg(idx) {
    return `\x1b[48;5;${idx}m`;
}

/**
 * Generate an ANSI escape code for a 24-bit foreground color.
 * @param {number[]} rgb
 * @returns {string}
 */
export function ansiTrueFg(rgb) {
    return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

/**
 * Generate an ANSI escape code for a 24-bit background color.
 * @param {number[]} rgb
 * @returns {string}
 */
export function ansiTrueBg(rgb) {
    return `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

export const ANSI_RESET = '\x1b[0m';

/**
 * ColorPicker class — manages a cursor over the 256-color palette,
 * named preset cycling, and hex input mode.
 */
export class ColorPicker {
    /**
     * @param {Object} [options]
     * @param {number[]} [options.initial=[255,255,255]] - Starting color
     */
    constructor(options = {}) {
        this.selected = options.initial || [255, 255, 255];
        this.cursorIndex = nearestColorIndex(this.selected);
        this.presetNames = Object.keys(PRESET_COLORS);
        this.presetIndex = this.presetNames.indexOf('white');
        this.hexInput = '';
        this.mode = 'palette'; // 'palette' | 'preset' | 'hex'
    }

    /**
     * Get the current selected color.
     * @returns {number[]}
     */
    getColor() {
        return [...this.selected];
    }

    /**
     * Set the color directly.
     * @param {number[]} rgb
     */
    setColor(rgb) {
        if (!isValidRGB(rgb)) return;
        this.selected = [...rgb];
        this.cursorIndex = nearestColorIndex(rgb);
    }

    /**
     * Move cursor in the palette grid.
     * @param {'up'|'down'|'left'|'right'} direction
     * @param {number} [cols=16] - Grid columns for palette layout
     */
    moveCursor(direction, cols = 16) {
        const total = PALETTE_256.length;
        switch (direction) {
            case 'up':
                this.cursorIndex = Math.max(0, this.cursorIndex - cols);
                break;
            case 'down':
                this.cursorIndex = Math.min(total - 1, this.cursorIndex + cols);
                break;
            case 'left':
                this.cursorIndex = Math.max(0, this.cursorIndex - 1);
                break;
            case 'right':
                this.cursorIndex = Math.min(total - 1, this.cursorIndex + 1);
                break;
        }
        this.selected = [...PALETTE_256[this.cursorIndex]];
    }

    /**
     * Cycle through named preset colors.
     * @param {'next'|'prev'} direction
     */
    cyclePreset(direction) {
        if (direction === 'next') {
            this.presetIndex = (this.presetIndex + 1) % this.presetNames.length;
        } else {
            this.presetIndex = (this.presetIndex - 1 + this.presetNames.length) % this.presetNames.length;
        }
        const name = this.presetNames[this.presetIndex];
        this.selected = [...PRESET_COLORS[name]];
        this.cursorIndex = nearestColorIndex(this.selected);
    }

    /**
     * Append a character to hex input.
     * @param {string} ch - Hex digit [0-9a-fA-F]
     */
    appendHex(ch) {
        if (this.hexInput.length < 6 && /^[0-9a-fA-F]$/.test(ch)) {
            this.hexInput += ch;
            if (this.hexInput.length === 6) {
                const rgb = parseHex(this.hexInput);
                if (rgb) {
                    this.selected = rgb;
                    this.cursorIndex = nearestColorIndex(rgb);
                }
            }
        }
    }

    /**
     * Clear hex input.
     */
    clearHex() {
        this.hexInput = '';
    }

    /**
     * Finalize hex input and apply the color.
     * @returns {boolean} True if a valid color was applied
     */
    commitHex() {
        const rgb = parseHex(this.hexInput);
        if (rgb) {
            this.selected = rgb;
            this.cursorIndex = nearestColorIndex(rgb);
            return true;
        }
        return false;
    }

    /**
     * Switch the picker mode.
     * @param {'palette'|'preset'|'hex'} mode
     */
    setMode(mode) {
        if (['palette', 'preset', 'hex'].includes(mode)) {
            this.mode = mode;
            if (mode === 'hex') this.hexInput = '';
        }
    }

    /**
     * Render a preview string showing the selected color.
     * @param {Object} [options]
     * @param {string} [options.text='Sample'] - Preview text
     * @param {boolean} [options.showBorder=true] - Include border preview
     * @returns {string} ANSI-styled preview string
     */
    renderPreview(options = {}) {
        const text = options.text || 'Sample';
        const showBorder = options.showBorder !== false;
        const rgb = this.selected;
        const idx = nearestColorIndex(rgb);

        const parts = [];
        parts.push(ansi256Bg(idx) + ' '.repeat(text.length + 4) + ANSI_RESET);
        parts.push(ansi256Fg(idx) + ansi256Bg(0) + ` ${text} ` + ANSI_RESET);
        if (showBorder) {
            const border = ansi256Fg(idx) + '─'.repeat(20) + ANSI_RESET;
            parts.push(border);
        }
        parts.push(toHex(rgb) + ` (${idx})`);
        return parts.join('\n');
    }

    /**
     * Render the full color picker UI as a string (for terminal output).
     * @param {Object} [options]
     * @param {number} [options.cols=16] - Palette grid columns
     * @returns {string}
     */
    renderASCII(options = {}) {
        const cols = options.cols || 16;
        const lines = [];

        // Header
        lines.push(`Color Picker [${this.mode}]`);
        lines.push('─'.repeat(40));

        if (this.mode === 'palette') {
            // Render palette grid
            for (let row = 0; row < PALETTE_256.length / cols; row++) {
                let line = '';
                for (let col = 0; col < cols; col++) {
                    const idx = row * cols + col;
                    if (idx >= PALETTE_256.length) break;
                    const isCursor = idx === this.cursorIndex;
                    if (isCursor) {
                        line += ansi256Bg(idx) + ansi256Fg(idx < 128 ? 255 : 0) + 'XX' + ANSI_RESET;
                    } else {
                        line += ansi256Bg(idx) + '  ' + ANSI_RESET;
                    }
                }
                lines.push(line);
            }
        } else if (this.mode === 'preset') {
            for (let i = 0; i < this.presetNames.length; i++) {
                const name = this.presetNames[i];
                const rgb = PRESET_COLORS[name];
                const idx = nearestColorIndex(rgb);
                const cursor = i === this.presetIndex ? '>' : ' ';
                lines.push(`${cursor} ${ansi256Fg(idx)}████${ANSI_RESET} ${name} (${toHex(rgb)})`);
            }
        } else if (this.mode === 'hex') {
            lines.push(`Enter hex: ${this.hexInput}_`);
            lines.push('');
            const rgb = this.hexInput.length >= 3 ? parseHex(this.hexInput) : null;
            if (rgb) {
                lines.push(`Preview: ${toHex(rgb)}`);
            }
        }

        lines.push('');
        lines.push(`Selected: ${toHex(this.selected)} (idx ${this.cursorIndex})`);
        return lines.join('\n');
    }
}
