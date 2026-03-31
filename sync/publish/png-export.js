// sync/publish/png-export.js
// Renders a CMS page manifest (or raw ASCII) to a PNG image via sharp.
// Supports multiple resolution scales: 1x (480x240), 2x (960x480), 4x (1920x960).
// Theme colors and effects are baked into the export.

import sharp from 'sharp';
import { renderToPixels, DIMENSIONS } from '../pixel-renderer.js';

const { GRID_W, GRID_H, GLYPH_W, GLYPH_H, PIXEL_W, PIXEL_H } = DIMENSIONS;

/**
 * Export an ASCII page to PNG at a given scale.
 * @param {Object} options
 * @param {string} options.asciiContent  - Raw ASCII substrate content
 * @param {number} [options.scale=1]     - Scale factor: 1, 2, or 4
 * @param {Object} [options.theme]       - Theme overrides (currently uses pixel-renderer defaults)
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function exportPNG({ asciiContent, scale = 1, theme = null }) {
    if (!asciiContent || typeof asciiContent !== 'string') {
        throw new Error('asciiContent is required');
    }

    const validScales = [1, 2, 4];
    if (!validScales.includes(scale)) {
        throw new Error(`Invalid scale: ${scale}. Must be one of: ${validScales.join(', ')}`);
    }

    const { width, height, data } = renderToPixels(asciiContent);

    const targetW = width * scale;
    const targetH = height * scale;

    let pipeline = sharp(Buffer.from(data), {
        raw: { width, height, channels: 4 },
    });

    if (scale > 1) {
        pipeline = pipeline.resize(targetW, targetH, {
            kernel: 'nearest', // Crisp pixel-art scaling
        });
    }

    const pngBuffer = await pipeline.png().toBuffer();
    return pngBuffer;
}

/**
 * Get metadata about the export dimensions for a given scale.
 * @param {number} scale
 * @returns {{ cellWidth: number, cellHeight: number, pixelWidth: number, pixelHeight: number }}
 */
export function getExportDimensions(scale = 1) {
    return {
        cellWidth: GRID_W,
        cellHeight: GRID_H,
        pixelWidth: PIXEL_W * scale,
        pixelHeight: PIXEL_H * scale,
    };
}

/**
 * Export multiple resolutions at once.
 * @param {Object} options
 * @param {string} options.asciiContent
 * @param {number[]} [options.scales=[1,2,4]]
 * @returns {Promise<Object>} Map of scale -> PNG buffer
 */
export async function exportPNGMulti({ asciiContent, scales = [1, 2, 4] }) {
    const results = {};
    for (const scale of scales) {
        results[`${scale}x`] = await exportPNG({ asciiContent, scale });
    }
    return results;
}
