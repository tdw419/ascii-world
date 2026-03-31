// sync/renderers/index.js
// Unified renderer interface for ASCII World
// One Substrate (80x24) → Multiple Renderers
//
// Usage:
//   import { renderers } from './renderers/index.js';
//   const html = renderers.html(asciiContent);
//   const python = renderers.python(asciiContent);

import { renderToHTML } from './html.js';
import { renderToPython, renderToPythonMinimal } from './python.js';
import { renderToSVG, renderToSVGDataURL } from './svg.js';
import { renderToANSI } from './ansi.js';
import { renderToTUI, parseASCIIToComponents, createTUISession } from './tui.js';
import { renderToJSON } from './json.js';
import { renderToMarkdown } from './markdown.js';
import { renderToPixels, renderToPNG } from '../pixel-renderer.js';

/**
 * Available renderers for ASCII World substrates.
 * Each renderer takes ASCII content and outputs to a different medium.
 */
export const renderers = {
    // ASCII → Web
    html: renderToHTML,

    // ASCII → Code generation
    python: renderToPython,
    pythonMinimal: renderToPythonMinimal,

    // ASCII → Vector graphics
    svg: renderToSVG,
    svgDataURL: renderToSVGDataURL,

    // ASCII → Terminal
    ansi: renderToANSI,
    tui: renderToTUI,
    tuiParse: parseASCIIToComponents,
    tuiSession: createTUISession,

    // ASCII → Data/Docs
    json: renderToJSON,
    markdown: renderToMarkdown,
    md: renderToMarkdown,

    // ASCII → Pixel buffer (existing)
    pixels: renderToPixels,
    png: renderToPNG,
};

/**
 * Detect format from file extension or explicit hint.
 * @param {string} format - Format name or file extension
 * @returns {string} Canonical format name
 */
export function detectFormat(format) {
    const formatMap = {
        '.html': 'html',
        '.htm': 'html',
        '.py': 'python',
        '.svg': 'svg',
        '.png': 'png',
        '.json': 'json',
        '.md': 'markdown',
        '.markdown': 'markdown',
        '.rgba': 'pixels',
        'tui': 'tui',
        'html': 'html',
        'python': 'python',
        'svg': 'svg',
        'png': 'png',
        'json': 'json',
        'markdown': 'markdown',
        'md': 'markdown',
        'ansi': 'ansi',
        'pixels': 'pixels',
    };
    return formatMap[format.toLowerCase()] || format;
}

/**
 * Render ASCII content to the specified format.
 * @param {string} asciiContent - The ASCII substrate
 * @param {string} format - Output format ('html', 'python', 'svg', 'png', 'pixels', 'json', 'md')
 * @param {object} options - Format-specific options
 * @returns {string|Uint8Array|Promise<Buffer>|object} Rendered output
 */
export function render(asciiContent, format, options = {}) {
    const canonicalFormat = detectFormat(format);
    const renderer = renderers[canonicalFormat];

    if (!renderer) {
        throw new Error(`Unknown renderer format: ${format}. Available: ${Object.keys(renderers).join(', ')}`);
    }

    return renderer(asciiContent, options);
}

/**
 * Get metadata about available renderers.
 */
export function getRendererInfo() {
    return [
        { name: 'html', output: 'string', description: 'ASCII → HTML with CSS styling' },
        { name: 'python', output: 'string', description: 'ASCII → Python class with grid data' },
        { name: 'pythonMinimal', output: 'string', description: 'ASCII → minimal Python script' },
        { name: 'svg', output: 'string', description: 'ASCII → SVG vector graphics' },
        { name: 'svgDataURL', output: 'string', description: 'ASCII → SVG data URL' },
        { name: 'ansi', output: 'string', description: 'ASCII → ANSI terminal colors' },
        { name: 'json', output: 'object', description: 'ASCII → JSON structured data' },
        { name: 'markdown', output: 'string', description: 'ASCII → Markdown document' },
        { name: 'pixels', output: 'Uint8Array', description: 'ASCII → RGBA pixel buffer (480x240)' },
        { name: 'png', output: 'Promise<Buffer>', description: 'ASCII → PNG image buffer' },
    ];
}

// Re-export individual renderers for direct use
export { renderToHTML } from './html.js';
export { renderToPython, renderToPythonMinimal } from './python.js';
export { renderToSVG, renderToSVGDataURL } from './svg.js';
export { renderToANSI } from './ansi.js';
export { renderToJSON } from './json.js';
export { renderToMarkdown } from './markdown.js';
export { renderToPixels, renderToPNG } from '../pixel-renderer.js';
