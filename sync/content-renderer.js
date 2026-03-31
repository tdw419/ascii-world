// sync/content-renderer.js
// Renders content items from ContentStore into ScreenManager cells
// based on page manifest layout regions provided by a layout engine.

import { AnsiParser } from './ansi-parser.js';

// Default colors (RGBA arrays matching ScreenManager conventions)
const DEFAULT_FG = [0xc9, 0xd1, 0xd9, 255];
const DEFAULT_BG = [0x0d, 0x11, 0x17, 255];
const HEADING_FG = [0xff, 0xff, 0xff, 255];      // bold white
const HEADING_BG = [0x16, 0x1a, 0x22, 255];      // slightly lighter bg
const CODE_FG    = [0x3f, 0xb9, 0x50, 255];       // green
const CODE_BG    = [0x0d, 0x11, 0x17, 255];
const CODE_BORDER_FG = [0x48, 0x4f, 0x58, 255];   // gray
const LINK_FG    = [0x58, 0xa6, 0xff, 255];        // blue
const LINK_BG    = [0x0d, 0x11, 0x17, 255];
const IMAGE_FG   = [0xd2, 0x9e, 0x22, 255];        // yellow
const IMAGE_BG   = [0x0d, 0x11, 0x17, 255];
const LIST_FG    = [0xc9, 0xd1, 0xd9, 255];
const LIST_BULLET = [0x58, 0xa6, 0xff, 255];       // blue bullet
const CLIP_INDICATOR = '...';

/**
 * Word-wrap a string into lines of at most `maxWidth` characters.
 * Preserves explicit newlines from the source text.
 *
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wordWrap(text, maxWidth) {
    if (maxWidth <= 0) return [];
    const paragraphs = text.split('\n');
    const lines = [];

    for (const para of paragraphs) {
        if (para.length === 0) {
            lines.push('');
            continue;
        }
        const words = para.split(/\s+/).filter(w => w.length > 0);
        let current = '';

        for (const word of words) {
            // Break long words into maxWidth chunks
            let remaining = word;
            while (remaining.length > 0) {
                const avail = current.length === 0 ? maxWidth : maxWidth - current.length - 1;
                if (avail <= 0) {
                    lines.push(current);
                    current = '';
                    continue;
                }
                if (remaining.length <= avail) {
                    current = current.length === 0 ? remaining : current + ' ' + remaining;
                    remaining = '';
                } else {
                    // Take what fits
                    const chunk = remaining.slice(0, avail);
                    remaining = remaining.slice(avail);
                    current = current.length === 0 ? chunk : current + ' ' + chunk;
                    lines.push(current);
                    current = '';
                }
            }
        }
        if (current.length > 0) {
            lines.push(current);
        }
    }
    return lines;
}

/**
 * ContentRenderer renders ContentStore items into ScreenManager cells,
 * respecting layout region bounds with word-wrapping and clipping.
 */
export class ContentRenderer {
    /**
     * @param {Object} deps
     * @param {import('./screen-manager.js').ScreenManager} deps.screenManager
     * @param {import('./content-store.js').ContentStore} deps.contentStore
     */
    constructor({ screenManager, contentStore }) {
        this.screen = screenManager;
        this.store = contentStore;
        this._ansi = new AnsiParser();
    }

    /**
     * Resolve content from the store — supports both getById() and read().
     * @param {string} id
     * @returns {Object|null}
     */
    _getContent(id) {
        if (!id) return null;
        if (typeof this.store.getById === 'function') {
            return this.store.getById(id);
        }
        if (typeof this.store.read === 'function') {
            return this.store.read(id);
        }
        return null;
    }

    /**
     * Render a full page manifest onto the screen.
     *
     * @param {Object} pageManifest - Page manifest with `.layout` array
     * @param {Object} layoutEngine - Provides region bounds via getRegion(name) -> { x, y, w, h }
     */
    renderPage(pageManifest, layoutEngine) {
        if (!pageManifest || !Array.isArray(pageManifest.layout)) return;

        for (const entry of pageManifest.layout) {
            const regionName = entry.region;
            const contentId = entry.contentId;
            const inline = entry.inline;

            // Get region bounds from layout engine
            const bounds = layoutEngine.getRegion(regionName);
            if (!bounds) continue;

            const x = bounds.x ?? bounds.col ?? 0;
            const y = bounds.y ?? bounds.row ?? 0;
            const w = bounds.w ?? bounds.width ?? 0;
            const h = bounds.h ?? bounds.height ?? 0;

            if (w <= 0 || h <= 0) continue;

            // Resolve content: from store by ID, or inline text
            let content;
            if (contentId) {
                content = this._getContent(contentId);
            } else if (inline !== null && inline !== undefined) {
                // Synthesize an inline content item
                content = {
                    id: '__inline__',
                    type: 'page',
                    title: '',
                    body: String(inline),
                    metadata: { renderAs: 'text' },
                };
            }

            if (!content) continue;

            // Clear the region first
            this.screen.fillRect(x, y, w, h, ' ', DEFAULT_FG, DEFAULT_BG);

            // Render content into the region
            this.renderContent(content, x, y, w, h);
        }
    }

    /**
     * Render a single content item into the given bounds.
     *
     * @param {Object} content - Content item { id, type, title, body, metadata }
     * @param {number} x       - Column offset
     * @param {number} y       - Row offset
     * @param {number} w       - Width in cells
     * @param {number} h       - Height in cells
     */
    renderContent(content, x, y, w, h) {
        if (!content || w <= 0 || h <= 0) return;

        const renderType = (content.metadata && content.metadata.renderAs) || 'text';

        switch (renderType) {
            case 'heading':
                this._renderHeading(content, x, y, w, h);
                break;
            case 'list':
                this._renderList(content, x, y, w, h);
                break;
            case 'code':
                this._renderCode(content, x, y, w, h);
                break;
            case 'image':
                this._renderImage(content, x, y, w, h);
                break;
            case 'link':
                this._renderLink(content, x, y, w, h);
                break;
            case 'text':
            default:
                this._renderText(content, x, y, w, h);
                break;
        }
    }

    // ── Private renderers ──────────────────────────────────────

    /**
     * Render plain text with word-wrapping.
     */
    _renderText(content, x, y, w, h) {
        const text = content.body || content.title || '';
        if (!text && content.title) {
            this._writeLines(wordWrap(content.title, w), x, y, w, h, DEFAULT_FG, DEFAULT_BG);
            return;
        }
        if (!text) return;
        const lines = wordWrap(text, w);
        this._writeLines(lines, x, y, w, h, DEFAULT_FG, DEFAULT_BG);
    }

    /**
     * Render centered heading text using ANSI bold (bright white).
     */
    _renderHeading(content, x, y, w, h) {
        const text = content.title || content.body || '';
        if (!text) return;

        // Use only 1 line for heading (centered)
        const padded = this._center(text, w);
        // Write bold heading — we use setCell with bright white to simulate bold
        const line = padded.slice(0, w);
        for (let i = 0; i < line.length; i++) {
            this.screen.setCell(x + i, y, line[i], HEADING_FG, HEADING_BG);
        }

        // If there's body text too, render it below
        if (content.body && content.body !== content.title && h > 1) {
            const bodyLines = wordWrap(content.body, w);
            this._writeLines(bodyLines, x, y + 1, w, h - 1, DEFAULT_FG, DEFAULT_BG);
        }
    }

    /**
     * Render a bulleted list, one item per line.
     */
    _renderList(content, x, y, w, h) {
        // Items can come from body (newline-separated) or metadata.items array
        let items;
        if (content.metadata && Array.isArray(content.metadata.items)) {
            items = content.metadata.items.map(String);
        } else {
            items = (content.body || '').split('\n').filter(l => l.trim().length > 0);
        }

        if (items.length === 0) return;

        const bulletStr = '\u2022 ';  // •
        const indent = bulletStr.length;  // 2 chars
        const contentWidth = Math.max(1, w - indent);
        const allLines = [];

        for (const item of items) {
            const wrapped = wordWrap(item, contentWidth);
            for (let i = 0; i < wrapped.length; i++) {
                allLines.push({ text: wrapped[i], isFirst: i === 0 });
            }
        }

        // Clip to region height
        const maxLines = Math.min(allLines.length, h);
        const clipped = allLines.length > h;

        for (let row = 0; row < maxLines; row++) {
            const { text, isFirst } = allLines[row];
            const isLastLine = (row === maxLines - 1) && clipped;

            // Write bullet or indent padding
            if (isFirst) {
                for (let c = 0; c < indent && c < w; c++) {
                    this.screen.setCell(x + c, y + row, bulletStr[c] || ' ', LIST_BULLET, DEFAULT_BG);
                }
            } else {
                for (let c = 0; c < indent && c < w; c++) {
                    this.screen.setCell(x + c, y + row, ' ', DEFAULT_FG, DEFAULT_BG);
                }
            }

            // Write text content
            let lineText = text;
            if (isLastLine && lineText.length + indent > w) {
                // Replace last 3 chars with clip indicator
                const avail = w - indent;
                if (avail > CLIP_INDICATOR.length) {
                    lineText = lineText.slice(0, avail - CLIP_INDICATOR.length) + CLIP_INDICATOR;
                } else {
                    lineText = CLIP_INDICATOR.slice(0, avail);
                }
            }
            lineText = lineText.slice(0, w - indent);
            for (let c = 0; c < lineText.length; c++) {
                this.screen.setCell(x + indent + c, y + row, lineText[c], LIST_FG, DEFAULT_BG);
            }
        }
    }

    /**
     * Render code block with a border.
     */
    _renderCode(content, x, y, w, h) {
        const text = content.body || '';
        if (w < 3 || h < 3) {
            // Too small for border, just render plain
            this._renderText(content, x, y, w, h);
            return;
        }

        // Draw border box
        if (typeof this.screen.drawBox === 'function') {
            this.screen.drawBox(x, y, w, h, 'single', CODE_BORDER_FG, CODE_BG);
        } else {
            // Manual border fallback
            this.screen.setCell(x, y, '+', CODE_BORDER_FG, CODE_BG);
            this.screen.setCell(x + w - 1, y, '+', CODE_BORDER_FG, CODE_BG);
            this.screen.setCell(x, y + h - 1, '+', CODE_BORDER_FG, CODE_BG);
            this.screen.setCell(x + w - 1, y + h - 1, '+', CODE_BORDER_FG, CODE_BG);
            for (let cx = x + 1; cx < x + w - 1; cx++) {
                this.screen.setCell(cx, y, '-', CODE_BORDER_FG, CODE_BG);
                this.screen.setCell(cx, y + h - 1, '-', CODE_BORDER_FG, CODE_BG);
            }
            for (let cy = y + 1; cy < y + h - 1; cy++) {
                this.screen.setCell(x, cy, '|', CODE_BORDER_FG, CODE_BG);
                this.screen.setCell(x + w - 1, cy, '|', CODE_BORDER_FG, CODE_BG);
            }
        }

        // Interior bounds
        const innerX = x + 1;
        const innerY = y + 1;
        const innerW = w - 2;
        const innerH = h - 2;

        if (innerW <= 0 || innerH <= 0) return;

        // Clear interior
        this.screen.fillRect(innerX, innerY, innerW, innerH, ' ', CODE_FG, CODE_BG);

        // Render code lines (no word wrapping — clip at width)
        const codeLines = text.split('\n');
        const maxLines = Math.min(codeLines.length, innerH);
        const clipped = codeLines.length > innerH;

        for (let row = 0; row < maxLines; row++) {
            let line = codeLines[row];
            const isLastLine = (row === maxLines - 1) && clipped;

            if (isLastLine) {
                if (line.length + CLIP_INDICATOR.length <= innerW) {
                    line = line + CLIP_INDICATOR;
                } else if (innerW > CLIP_INDICATOR.length) {
                    line = line.slice(0, innerW - CLIP_INDICATOR.length) + CLIP_INDICATOR;
                } else {
                    line = CLIP_INDICATOR.slice(0, innerW);
                }
            }

            line = line.slice(0, innerW);
            for (let c = 0; c < line.length; c++) {
                this.screen.setCell(innerX + c, innerY + row, line[c], CODE_FG, CODE_BG);
            }
        }
    }

    /**
     * Render an image placeholder.
     */
    _renderImage(content, x, y, w, h) {
        const alt = content.metadata?.alt || content.title || 'image';
        const label = `[IMAGE: ${alt}]`;
        const centered = this._center(label, w);
        const line = centered.slice(0, w);

        for (let i = 0; i < line.length; i++) {
            this.screen.setCell(x + i, y, line[i], IMAGE_FG, IMAGE_BG);
        }

        // Fill remaining rows with placeholder dots pattern
        for (let row = 1; row < h; row++) {
            for (let col = 0; col < w; col++) {
                const ch = ((row + col) % 2 === 0) ? '.' : ' ';
                this.screen.setCell(x + col, y + row, ch, IMAGE_FG, IMAGE_BG);
            }
        }
    }

    /**
     * Render underlined link text.
     */
    _renderLink(content, x, y, w, h) {
        const label = content.metadata?.label || content.title || content.body || '';
        if (!label) return;

        // Render text content
        const lines = wordWrap(label, w);
        this._writeLines(lines, x, y, w, h, LINK_FG, LINK_BG);
    }

    // ── Utilities ──────────────────────────────────────────────

    /**
     * Write an array of lines into bounds, clipping at region height.
     * Last line gets '...' appended if content overflows.
     */
    _writeLines(lines, x, y, w, h, fg, bg) {
        if (h <= 0 || w <= 0) return;

        const maxLines = Math.min(lines.length, h);
        const clipped = lines.length > h;

        for (let row = 0; row < maxLines; row++) {
            let line = lines[row] || '';
            const isLastLine = (row === maxLines - 1) && clipped;

            if (isLastLine) {
                // Ensure space for clip indicator
                if (line.length >= w) {
                    if (w > CLIP_INDICATOR.length) {
                        line = line.slice(0, w - CLIP_INDICATOR.length) + CLIP_INDICATOR;
                    } else {
                        line = CLIP_INDICATOR.slice(0, w);
                    }
                } else {
                    line = line + CLIP_INDICATOR;
                    // If it fits, great. If not, truncate.
                    if (line.length > w) {
                        line = CLIP_INDICATOR.slice(0, w);
                    }
                }
            }

            line = line.slice(0, w);
            for (let c = 0; c < line.length; c++) {
                this.screen.setCell(x + c, y + row, line[c], fg, bg);
            }
        }
    }

    /**
     * Center a string within a given width.
     * @param {string} text
     * @param {number} width
     * @returns {string}
     */
    _center(text, width) {
        if (text.length >= width) return text.slice(0, width);
        const totalPad = width - text.length;
        const leftPad = Math.floor(totalPad / 2);
        return ' '.repeat(leftPad) + text + ' '.repeat(totalPad - leftPad);
    }
}
