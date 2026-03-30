// ansi-parser.js — ANSI escape sequence parser with SGR color mapping
//
// From research doc: "The mapping of these codes to RGBA values follows several
// standard patterns. The original 8 ANSI colors (30-37) and their bright
// counterparts (90-97) are typically mapped to a pre-defined palette."
//
// Supports:
// - 3/4-bit colors (8 standard + 8 bright)
// - 256-color extended palette (6×6×6 cube + grayscale)
// - TrueColor 24-bit (ESC[38;2;r;g;bm)
// - SGR attributes (bold, dim, italic, underline, inverse, strikethrough)

// Standard 8 ANSI colors + 8 bright (GitHub dark theme inspired)
const ANSI_PALETTE_16 = [
    // Normal 0-7
    [0x0d, 0x11, 0x17],  // 0: black
    [0xf8, 0x51, 0x49],  // 1: red
    [0x3f, 0xb9, 0x50],  // 2: green
    [0xd2, 0x9e, 0x22],  // 3: yellow
    [0x58, 0xa6, 0xff],  // 4: blue
    [0xbc, 0x8c, 0xff],  // 5: magenta
    [0x39, 0xc5, 0xcf],  // 6: cyan
    [0xc9, 0xd1, 0xd9],  // 7: white
    // Bright 8-15
    [0x48, 0x4f, 0x58],  // 8: bright black (gray)
    [0xff, 0x7b, 0x72],  // 9: bright red
    [0x56, 0xd3, 0x64],  // 10: bright green
    [0xe3, 0xb3, 0x41],  // 11: bright yellow
    [0x79, 0xc0, 0xff],  // 12: bright blue
    [0xd2, 0xa8, 0xff],  // 13: bright magenta
    [0x56, 0xdb, 0xe5],  // 14: bright cyan
    [0xff, 0xff, 0xff],  // 15: bright white
];

/**
 * Build the 256-color palette.
 * 0-15: system colors
 * 16-231: 6×6×6 color cube where index = 16 + 36r + 6g + b
 * 232-255: 24-step grayscale ramp: gray = 8 + 10 * (index - 232)
 */
function build256Palette() {
    const palette = new Array(256);

    // 0-15: system colors
    for (let i = 0; i < 16; i++) {
        palette[i] = ANSI_PALETTE_16[i];
    }

    // 16-231: 6×6×6 color cube
    const levels = [0, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
    for (let r = 0; r < 6; r++) {
        for (let g = 0; g < 6; g++) {
            for (let b = 0; b < 6; b++) {
                palette[16 + 36 * r + 6 * g + b] = [levels[r], levels[g], levels[b]];
            }
        }
    }

    // 232-255: grayscale ramp
    for (let i = 0; i < 24; i++) {
        const gray = 8 + 10 * i;
        palette[232 + i] = [gray, gray, gray];
    }

    return palette;
}

const PALETTE_256 = build256Palette();

/**
 * SGR attribute state for styled text rendering
 */
export class TextStyle {
    constructor() {
        this.fg = [0xc9, 0xd1, 0xd9, 255]; // default text color
        this.bg = [0x0d, 0x11, 0x17, 255]; // default background
        this.bold = false;
        this.dim = false;
        this.italic = false;
        this.underline = false;
        this.blink = false;
        this.inverse = false;
        this.hidden = false;
        this.strikethrough = false;
    }

    clone() {
        const s = new TextStyle();
        s.fg = [...this.fg];
        s.bg = [...this.bg];
        s.bold = this.bold;
        s.dim = this.dim;
        s.italic = this.italic;
        s.underline = this.underline;
        s.blink = this.blink;
        s.inverse = this.inverse;
        s.hidden = this.hidden;
        s.strikethrough = this.strikethrough;
        return s;
    }

    /**
     * Get effective fg/bg (handles inverse attribute)
     */
    getEffectiveColors() {
        if (this.inverse) {
            return { fg: this.bg, bg: this.fg };
        }
        return { fg: this.fg, bg: this.bg };
    }

    reset() {
        this.fg = [0xc9, 0xd1, 0xd9, 255];
        this.bg = [0x0d, 0x11, 0x17, 255];
        this.bold = false;
        this.dim = false;
        this.italic = false;
        this.underline = false;
        this.blink = false;
        this.inverse = false;
        this.hidden = false;
        this.strikethrough = false;
    }
}

// Parser states
const P_TEXT = 0;
const P_ESC = 1;
const P_CSI = 2;
const P_OSC = 3;

/**
 * Parse ANSI escape sequences from a string.
 * Yields styled character segments.
 */
export class AnsiParser {
    constructor() {
        this.style = new TextStyle();
    }

    /**
     * Parse an ANSI string into an array of { char, style } objects.
     * Each char is a single printable character with its computed style.
     */
    parse(input) {
        const result = [];
        let state = P_TEXT;
        let paramBuf = '';

        for (let i = 0; i < input.length; i++) {
            const ch = input[i];
            const code = input.charCodeAt(i);

            switch (state) {
                case P_TEXT:
                    if (code === 0x1B) {
                        state = P_ESC;
                    } else if (code >= 0x20) {
                        result.push({ char: ch, style: this.style.clone() });
                    }
                    // Ignore other control chars in text mode
                    break;

                case P_ESC:
                    if (ch === '[') {
                        state = P_CSI;
                        paramBuf = '';
                    } else if (ch === ']') {
                        state = P_OSC;
                        paramBuf = '';
                    } else {
                        // Unknown escape — return to text mode
                        state = P_TEXT;
                    }
                    break;

                case P_CSI:
                    if ((code >= 0x30 && code <= 0x3F)) {
                        // Parameter bytes (0-9, ;, <, =, >, ?)
                        paramBuf += ch;
                    } else if (code >= 0x20 && code <= 0x2F) {
                        // Intermediate bytes
                        paramBuf += ch;
                    } else if (code >= 0x40 && code <= 0x7E) {
                        // Final byte
                        if (ch === 'm') {
                            this._applySGR(paramBuf);
                        }
                        // Other CSI sequences (cursor movement, etc.) - skip
                        state = P_TEXT;
                    } else {
                        state = P_TEXT;
                    }
                    break;

                case P_OSC:
                    // OSC sequences end with BEL (0x07) or ST (ESC \)
                    if (code === 0x07) {
                        state = P_TEXT;
                    } else if (code === 0x1B && i + 1 < input.length && input[i + 1] === '\\') {
                        i++; // skip the backslash
                        state = P_TEXT;
                    }
                    break;
            }
        }

        return result;
    }

    /**
     * Apply SGR (Select Graphic Rendition) parameters to current style
     */
    _applySGR(params) {
        const parts = params === '' ? [0] : params.split(';').map(Number);

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];

            // Reset
            if (p === 0) {
                this.style.reset();
                continue;
            }

            // Attributes
            if (p === 1) { this.style.bold = true; continue; }
            if (p === 2) { this.style.dim = true; continue; }
            if (p === 3) { this.style.italic = true; continue; }
            if (p === 4) { this.style.underline = true; continue; }
            if (p === 5) { this.style.blink = true; continue; }
            if (p === 7) { this.style.inverse = true; continue; }
            if (p === 8) { this.style.hidden = true; continue; }
            if (p === 9) { this.style.strikethrough = true; continue; }

            // Reset attributes
            if (p === 21 || p === 22) { this.style.bold = false; this.style.dim = false; continue; }
            if (p === 23) { this.style.italic = false; continue; }
            if (p === 24) { this.style.underline = false; continue; }
            if (p === 25) { this.style.blink = false; continue; }
            if (p === 27) { this.style.inverse = false; continue; }
            if (p === 28) { this.style.hidden = false; continue; }
            if (p === 29) { this.style.strikethrough = false; continue; }

            // Standard foreground colors (30-37)
            if (p >= 30 && p <= 37) {
                this.style.fg = [...ANSI_PALETTE_16[p - 30], 255];
                continue;
            }

            // Default foreground
            if (p === 39) {
                this.style.fg = [0xc9, 0xd1, 0xd9, 255];
                continue;
            }

            // Standard background colors (40-47)
            if (p >= 40 && p <= 47) {
                this.style.bg = [...ANSI_PALETTE_16[p - 40], 255];
                continue;
            }

            // Default background
            if (p === 49) {
                this.style.bg = [0x0d, 0x11, 0x17, 255];
                continue;
            }

            // Bright foreground colors (90-97)
            if (p >= 90 && p <= 97) {
                this.style.fg = [...ANSI_PALETTE_16[p - 90 + 8], 255];
                continue;
            }

            // Bright background colors (100-107)
            if (p >= 100 && p <= 107) {
                this.style.bg = [...ANSI_PALETTE_16[p - 100 + 8], 255];
                continue;
            }

            // Extended color: 38;5;N (256-color) or 38;2;R;G;B (TrueColor)
            if (p === 38 && i + 1 < parts.length) {
                const mode = parts[i + 1];
                if (mode === 5 && i + 2 < parts.length) {
                    // 256-color: ESC[38;5;Nm
                    const idx = parts[i + 2];
                    if (idx >= 0 && idx < 256) {
                        this.style.fg = [...PALETTE_256[idx], 255];
                    }
                    i += 2;
                } else if (mode === 2 && i + 4 < parts.length) {
                    // TrueColor: ESC[38;2;R;G;Bm
                    this.style.fg = [
                        Math.max(0, Math.min(255, parts[i + 2])),
                        Math.max(0, Math.min(255, parts[i + 3])),
                        Math.max(0, Math.min(255, parts[i + 4])),
                        255
                    ];
                    i += 4;
                }
                continue;
            }

            // Extended background: 48;5;N or 48;2;R;G;B
            if (p === 48 && i + 1 < parts.length) {
                const mode = parts[i + 1];
                if (mode === 5 && i + 2 < parts.length) {
                    const idx = parts[i + 2];
                    if (idx >= 0 && idx < 256) {
                        this.style.bg = [...PALETTE_256[idx], 255];
                    }
                    i += 2;
                } else if (mode === 2 && i + 4 < parts.length) {
                    this.style.bg = [
                        Math.max(0, Math.min(255, parts[i + 2])),
                        Math.max(0, Math.min(255, parts[i + 3])),
                        Math.max(0, Math.min(255, parts[i + 4])),
                        255
                    ];
                    i += 4;
                }
                continue;
            }
        }
    }

    /**
     * Reset parser state
     */
    reset() {
        this.style = new TextStyle();
    }
}

/**
 * Convenience: convert ANSI color index (0-255) to [r, g, b]
 */
export function ansiToRGB(index) {
    if (index < 0 || index > 255) return [255, 255, 255];
    return PALETTE_256[index];
}

/**
 * Convenience: strip all ANSI escape sequences from a string
 */
export function stripAnsi(str) {
    return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
              .replace(/\x1B\][^\x07]*\x07/g, '')
              .replace(/\x1B\][^\x1B]*\x1B\\/g, '');
}

export { ANSI_PALETTE_16, PALETTE_256 };
