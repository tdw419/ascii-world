// sync/renderers/svg.js
// ASCII → SVG renderer
// Projects Stratum 1 (ASCII cells) to Stratum 2 (vector graphics)

const COLORS = {
    bg: '#0a0a0f',
    fg: '#c9d1d9',
    green: '#3fb950',
    red: '#f85149',
    yellow: '#d29922',
    cyan: '#00d4ff',
    blue: '#58a6ff',
    dim: '#484f58',
    border: '#30363d',
};

const CHAR_WIDTH = 8;  // Approximate monospace char width
const CHAR_HEIGHT = 14; // Approximate monospace char height

function charColor(ch) {
    if (ch === '●') return COLORS.green;
    if (ch === '○') return COLORS.dim;
    if (ch === '◉') return COLORS.red;
    if (ch === '◐' || ch === '◑') return COLORS.yellow;
    if (ch === '✗') return COLORS.red;
    if (ch === '█' || ch === '▓') return COLORS.green;
    if (ch === '░') return COLORS.dim;

    const code = ch.charCodeAt(0);
    if (code >= 0x2500 && code <= 0x257F) return COLORS.border;
    if (code >= 0x2580 && code <= 0x259F) return COLORS.cyan;
    if (ch === '[' || ch === ']') return COLORS.cyan;

    return COLORS.fg;
}

function escapeXML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Render ASCII content to SVG.
 * @param {string} asciiContent - The ASCII substrate (80x24 grid)
 * @param {object} options - Rendering options
 * @param {number} options.scale - Scale factor for output
 * @param {boolean} options.standalone - Include XML declaration
 * @returns {string} SVG string
 */
export function renderToSVG(asciiContent, options = {}) {
    const { scale = 1, standalone = true } = options;
    const lines = asciiContent.split('\n');

    const width = 80 * CHAR_WIDTH * scale;
    const height = 24 * CHAR_HEIGHT * scale;
    const fontSize = 12 * scale;

    // Build text elements
    const textElements = lines.map((line, row) => {
        const y = (row + 1) * CHAR_HEIGHT * scale;
        const chars = [...line];

        // Group characters by color for efficient rendering
        const groups = {};
        let currentColor = null;
        let currentText = '';

        chars.forEach((ch, col) => {
            const color = charColor(ch);
            if (color !== currentColor && currentText) {
                if (!groups[currentColor]) groups[currentColor] = [];
                groups[currentColor].push({
                    x: (col - currentText.length) * CHAR_WIDTH * scale,
                    text: currentText
                });
                currentText = '';
            }
            currentColor = color;
            currentText += escapeXML(ch);
        });

        // Flush remaining text
        if (currentText) {
            if (!groups[currentColor]) groups[currentColor] = [];
            groups[currentColor].push({
                x: (chars.length - currentText.length) * CHAR_WIDTH * scale,
                text: currentText
            });
        }

        // Generate <text> elements grouped by color
        return Object.entries(groups).map(([color, segments]) => {
            const tspans = segments.map(s =>
                `<tspan x="${s.x}" y="${y}">${s.text}</tspan>`
            ).join('');
            return `<text fill="${color}" font-family="monospace" font-size="${fontSize}">${tspans}</text>`;
        }).join('');
    }).join('\n    ');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}" height="${height}"
     viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${COLORS.bg}"/>
    <g font-family="JetBrains Mono, Consolas, monospace">
    ${textElements}
    </g>
</svg>`;

    if (standalone) {
        return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
    }

    return svg;
}

/**
 * Render ASCII content to a data URL (for embedding in HTML).
 * @param {string} asciiContent - The ASCII substrate
 * @returns {string} data:image/svg+xml,... URL
 */
export function renderToSVGDataURL(asciiContent) {
    const svg = renderToSVG(asciiContent, { standalone: false });
    const encoded = encodeURIComponent(svg);
    return `data:image/svg+xml,${encoded}`;
}

export default renderToSVG;
