// sync/renderers/json.js
// ASCII → JSON renderer
// Projects Stratum 1 (ASCII cells) to structured metadata + grid data

/**
 * Render ASCII content to JSON.
 * @param {string} asciiContent - The ASCII substrate (80x24 grid)
 * @param {object} options - Rendering options
 * @returns {object} JSON object
 */
export function renderToJSON(asciiContent, options = {}) {
    const lines = asciiContent.split('\n');
    const width = Math.max(...lines.map(l => l.length));
    const height = lines.length;

    // Extract basic semantic markers
    const markers = [];
    const statusSymbols = { '●': 'active', '○': 'idle', '◉': 'error', '◐': 'warning', '◑': 'warning' };

    for (let y = 0; y < lines.length; y++) {
        const line = lines[y];
        const chars = [...line];
        for (let x = 0; x < chars.length; x++) {
            const ch = chars[x];
            if (statusSymbols[ch]) {
                markers.push({
                    type: 'status',
                    symbol: ch,
                    state: statusSymbols[ch],
                    x, y
                });
            }
        }
    }

    return {
        metadata: {
            format: 'ascii-world-substrate',
            version: '1.0.0',
            dimensions: { width, height },
            timestamp: new Date().toISOString(),
            ...options
        },
        grid: lines,
        semantics: {
            markers
        }
    };
}

export default renderToJSON;
