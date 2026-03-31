// sync/renderers/ansi.js
// ASCII → ANSI Terminal renderer
// Projects Stratum 1 (ASCII cells) to Stratum 2 (colored terminal output)

const ANSI = {
    // Reset
    reset: '\x1b[0m',

    // Styles
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    underline: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',

    // Extended colors (256-color support)
    color256: (n) => `\x1b[38;5;${n}m`,
    bg256: (n) => `\x1b[48;5;${n}m`,

    // RGB colors (true color support)
    rgb: (r, g, b) => `\x1b[38;2;${r};${g};${b}m`,
    bgRgb: (r, g, b) => `\x1b[48;2;${r};${g};${b}m`,

    // Cursor movement
    clear: '\x1b[2J',
    clearLine: '\x1b[2K',
    home: '\x1b[H',
    hideCursor: '\x1b[?25l',
    showCursor: '\x1b[?25h',

    // Position cursor
    cursorTo: (row, col) => `\x1b[${row};${col}H`,
};

// Map characters to ANSI colors
function charANSI(ch, nextCh) {
    // Status indicators
    if (ch === '●') return ANSI.green;
    if (ch === '○') return ANSI.gray;
    if (ch === '◉') return ANSI.red;
    if (ch === '◐' || ch === '◑') return ANSI.yellow;
    if (ch === '✗') return ANSI.red;
    if (ch === '✓' || ch === '✔') return ANSI.green;

    // Block elements
    if (ch === '█' || ch === '▓') return ANSI.green;
    if (ch === '░') return ANSI.gray;
    if (ch === '▒') return ANSI.cyan;

    // Box drawing - use dim color
    const code = ch.charCodeAt(0);
    if (code >= 0x2500 && code <= 0x257F) return ANSI.dim;
    if (code >= 0x2550 && code <= 0x256C) return ANSI.cyan;

    // Brackets
    if (ch === '[' || ch === ']') return ANSI.cyan;

    // Numbers after status symbols
    if (nextCh && /[0-9]/.test(nextCh)) {
        if (ch === '+' || ch === '-') return ANSI.green;
    }

    // Default
    return ANSI.reset;
}

// Track if we're in a colored region
let inColor = false;

/**
 * Render ASCII content to ANSI-colored terminal output.
 * @param {string} asciiContent - The ASCII substrate (80x24 grid)
 * @param {object} options - Rendering options
 * @param {boolean} options.clearScreen - Clear screen before rendering
 * @param {boolean} options.position - Position cursor at home before rendering
 * @returns {string} ANSI-escaped string
 */
export function renderToANSI(asciiContent, options = {}) {
    const { clearScreen = false, position = false } = options;

    let output = '';

    // Optional screen setup
    if (clearScreen) {
        output += ANSI.clear + ANSI.home;
    } else if (position) {
        output += ANSI.home;
    }

    const lines = asciiContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const chars = [...line];
        let currentColor = ANSI.reset;
        let lineOutput = '';

        for (let j = 0; j < chars.length; j++) {
            const ch = chars[j];
            const nextCh = chars[j + 1];
            const color = charANSI(ch, nextCh);

            // Only emit color code if it changes
            if (color !== currentColor) {
                lineOutput += color;
                currentColor = color;
            }

            lineOutput += ch;
        }

        // Reset at end of line
        if (currentColor !== ANSI.reset) {
            lineOutput += ANSI.reset;
        }

        output += lineOutput;

        // Add newline unless it's the last line
        if (i < lines.length - 1) {
            output += '\n';
        }
    }

    return output;
}

/**
 * Render ASCII content with a background color.
 * @param {string} asciiContent - The ASCII substrate
 * @param {string} bgColor - Background color name or RGB
 * @returns {string} ANSI-escaped string with background
 */
export function renderToANSIWithBg(asciiContent, bgColor = '#0a0a0f') {
    // Parse background color
    let bgCode;
    if (bgColor.startsWith('#')) {
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        bgCode = ANSI.bgRgb(r, g, b);
    } else {
        bgCode = ANSI[`bg${bgColor.charAt(0).toUpperCase()}${bgColor.slice(1)}`] || '';
    }

    return bgCode + renderToANSI(asciiContent) + ANSI.reset;
}

/**
 * Create a TUI frame with border and content.
 * @param {object} options - Frame options
 * @param {string} options.title - Frame title
 * @param {string} options.content - Frame content
 * @param {number} options.width - Frame width (default 80)
 * @param {string} options.style - Border style ('single', 'double', 'rounded')
 * @returns {string} ANSI-rendered frame
 */
export function createTUIFrame(options) {
    const { title = '', content = '', width = 80, style = 'single' } = options;

    const borders = {
        single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
        double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
        rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    };

    const b = borders[style] || borders.single;
    const innerWidth = width - 2; // Account for borders

    // Build frame
    let frame = '';

    // Top border with optional title
    if (title) {
        const titlePadded = ` ${title} `;
        const leftPad = Math.floor((innerWidth - titlePadded.length) / 2);
        const rightPad = innerWidth - titlePadded.length - leftPad;
        frame += b.tl + b.h.repeat(leftPad) + titlePadded + b.h.repeat(rightPad) + b.tr + '\n';
    } else {
        frame += b.tl + b.h.repeat(innerWidth) + b.tr + '\n';
    }

    // Content lines
    const contentLines = content.split('\n');
    for (const line of contentLines) {
        const paddedLine = line.padEnd(innerWidth).slice(0, innerWidth);
        frame += b.v + paddedLine + b.v + '\n';
    }

    // Bottom border
    frame += b.bl + b.h.repeat(innerWidth) + b.br;

    return renderToANSI(frame);
}

/**
 * Print colored output to console.
 * @param {string} asciiContent - The ASCII substrate
 * @param {object} options - Print options
 */
export function printANSI(asciiContent, options = {}) {
    const output = renderToANSI(asciiContent, options);
    process.stdout.write(output);
}

/**
 * Strip ANSI codes from a string.
 * @param {string} str - String with ANSI codes
 * @returns {string} Plain text
 */
export function stripANSI(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Check if terminal supports colors.
 * @returns {object} Terminal color support info
 */
export function detectColorSupport() {
    const TERM = process.env.TERM || '';
    const COLORTERM = process.env.COLORTERM || '';
    const NO_COLOR = process.env.NO_COLOR;

    return {
        hasColor: !NO_COLOR && (TERM.includes('color') || TERM.includes('xterm') || COLORTERM),
        is256Color: TERM.includes('256color'),
        isTrueColor: COLORTERM === 'truecolor' || COLORTERM === '24bit',
        TERM,
        COLORTERM,
    };
}

// Export ANSI codes for direct use
export { ANSI };

export default renderToANSI;
