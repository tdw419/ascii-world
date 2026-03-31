// sync/renderers/html.js
// ASCII → HTML renderer
// Projects Stratum 1 (ASCII cells) to Stratum 2 (DOM elements)

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

// Map characters to semantic color classes
function charClass(ch) {
    if (ch === '●') return 'status-active';
    if (ch === '○') return 'status-idle';
    if (ch === '◉') return 'status-error';
    if (ch === '◐' || ch === '◑') return 'status-warning';
    if (ch === '✗') return 'status-fail';
    if (ch === '█' || ch === '▓') return 'bar-fill';
    if (ch === '░') return 'bar-empty';
    if (ch === '[' || ch === ']') return 'bracket';

    const code = ch.charCodeAt(0);
    if (code >= 0x2500 && code <= 0x257F) return 'box';  // Box Drawing
    if (code >= 0x2580 && code <= 0x259F) return 'block'; // Block elements

    return '';
}

function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Render ASCII content to HTML.
 * @param {string} asciiContent - The ASCII substrate (80x24 grid)
 * @param {object} options - Rendering options
 * @param {string} options.theme - Theme name ('classic', 'light', 'matrix')
 * @param {boolean} options.standalone - Wrap in full HTML document
 * @returns {string} HTML string
 */
export function renderToHTML(asciiContent, options = {}) {
    const { theme = 'classic', standalone = false } = options;
    const lines = asciiContent.split('\n');

    const css = generateCSS(theme);
    const body = lines.map(line => {
        const chars = [...line];
        return chars.map(ch => {
            const cls = charClass(ch);
            const escaped = escapeHTML(ch);
            return cls ? `<span class="${cls}">${escaped}</span>` : escaped;
        }).join('');
    }).join('\n');

    const content = `<pre class="ascii-world ${theme}">${body}</pre>`;

    if (standalone) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ASCII World</title>
    <style>${css}</style>
</head>
<body>
${content}
</body>
</html>`;
    }

    return content;
}

function generateCSS(theme) {
    const themes = {
        classic: {
            bg: COLORS.bg,
            fg: COLORS.fg,
        },
        light: {
            bg: '#ffffff',
            fg: '#1f2328',
        },
        matrix: {
            bg: '#000000',
            fg: '#00ff00',
        },
    };

    const t = themes[theme] || themes.classic;

    return `
.ascii-world {
    background: ${t.bg};
    color: ${t.fg};
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.2;
    padding: 1rem;
    margin: 0;
    white-space: pre;
    overflow-x: auto;
}
.ascii-world .status-active { color: ${COLORS.green}; }
.ascii-world .status-idle { color: ${COLORS.dim}; }
.ascii-world .status-error { color: ${COLORS.red}; }
.ascii-world .status-warning { color: ${COLORS.yellow}; }
.ascii-world .status-fail { color: ${COLORS.red}; }
.ascii-world .bar-fill { color: ${COLORS.green}; }
.ascii-world .bar-empty { color: ${COLORS.dim}; }
.ascii-world .box { color: ${COLORS.border}; }
.ascii-world .block { color: ${COLORS.cyan}; }
.ascii-world .bracket { color: ${COLORS.cyan}; }
`;
}

export default renderToHTML;
