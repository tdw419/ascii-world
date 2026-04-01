// ui/agent-card.js
// Renders a single agent as a pixel block with name, status badge,
// last activity timestamp, and capability tags.
// Works with PixelBuffer + GlyphAtlas from the pixel-native rendering system.

import { PixelBuffer } from '../sync/pixel-buffer.js';
import { GlyphAtlas } from '../sync/glyph-atlas.js';

// Status badge colors: green (online), yellow (offline), red (error), gray (unknown)
const STATUS_COLORS = {
    online:  [0x3f, 0xb9, 0x50],   // Green
    offline: [0xe3, 0xb3, 0x41],   // Yellow
    error:   [0xf8, 0x51, 0x49],   // Red
    unknown: [0x48, 0x4f, 0x58],   // Gray
};

// Status badge symbols
const STATUS_SYMBOLS = {
    online:  '●',
    offline: '○',
    error:   '✗',
    unknown: '○',
};

const CARD_BG       = [0x16, 0x1b, 0x22];   // Card background
const CARD_BORDER   = [0x30, 0x36, 0x3d];   // Border gray
const NAME_COLOR    = [0xff, 0xff, 0xff];   // White
const TEXT_COLOR    = [0xc9, 0xd1, 0xd9];   // Light gray
const MUTED_COLOR   = [0x8b, 0x94, 0x9e];   // Muted gray
const TAG_BG        = [0x21, 0x26, 0x2d];   // Tag background
const TAG_TEXT      = [0x58, 0xa6, 0xff];   // Blue tag text

/**
 * Format a timestamp into a relative time string.
 * Examples: "5s ago", "2m ago", "1h ago", "3d ago"
 *
 * @param {string|null} isoTimestamp - ISO date string
 * @param {number} [nowMs] - Optional reference time in ms (for testing)
 * @returns {string}
 */
export function formatRelativeTime(isoTimestamp, nowMs = Date.now()) {
    if (!isoTimestamp) return 'never';

    let ts;
    try {
        ts = new Date(isoTimestamp).getTime();
    } catch {
        return 'never';
    }

    if (isNaN(ts)) return 'never';

    const diffMs = nowMs - ts;
    if (diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Determine the effective display status from an agent's data.
 * Falls back to 'unknown' for unrecognized status strings.
 *
 * @param {{ status?: string }} agent
 * @returns {'online'|'offline'|'error'|'unknown'}
 */
export function getEffectiveStatus(agent) {
    if (!agent || typeof agent.status !== 'string') return 'unknown';
    if (STATUS_COLORS[agent.status]) return agent.status;
    return 'unknown';
}

export class AgentCard {
    /**
     * @param {object} [options]
     * @param {number} [options.widthCells=20] - Card width in cell units
     * @param {number} [options.maxCapRows=2] - Max rows of capability tags
     */
    constructor(options = {}) {
        this.widthCells = options.widthCells || 20;
        this.maxCapRows = options.maxCapRows || 2;
        this.atlas = new GlyphAtlas();
    }

    /**
     * Calculate the height in cell rows needed for a given agent.
     * Layout:
     *   Row 0: border top
     *   Row 1: [status-badge] AgentName
     *   Row 2: capability tags line 1 (or blank if no caps)
     *   Row 3: capability tags line 2 (if needed)
     *   Row N: last activity
     *   Row N+1: border bottom
     *
     * @param {object} agent
     * @returns {number}
     */
    calcHeight(agent) {
        const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
        let capRows = 0;
        if (caps.length > 0) {
            const perRow = this._capsPerRow(caps);
            capRows = Math.min(this.maxCapRows, Math.ceil(caps.length / perRow));
        }
        // border-top + name-row + cap-rows + (spacer if no caps) + activity-row + border-bottom
        const spacer = capRows === 0 ? 1 : 0;
        return 2 + 1 + capRows + spacer + 1;
    }

    /**
     * How many capability tags fit per row (each tag is text + padding).
     * Tags are comma-separated, rendered inline.
     */
    _capsPerRow(caps) {
        if (caps.length === 0) return 1;
        // Estimate: each cap averages ~6 chars, comma+space = 2
        // Available width = widthCells - 2 (for left/right padding)
        const avail = this.widthCells - 2;
        const avgLen = caps.reduce((sum, c) => sum + String(c).length, 0) / caps.length;
        return Math.max(1, Math.floor(avail / (avgLen + 2)));
    }

    /**
     * Render an agent card into a PixelBuffer.
     *
     * @param {object} agent - Agent data (name, status, capabilities, lastHeartbeat)
     * @param {object} [options]
     * @param {PixelBuffer} [options.buffer] - Target buffer (creates one if not given)
     * @param {number} [options.offsetX=0] - Pixel X offset within buffer
     * @param {number} [options.offsetY=0] - Pixel Y offset within buffer
     * @param {number} [options.nowMs] - Reference timestamp for relative time (testing)
     * @returns {{ buffer: PixelBuffer, widthCells: number, heightCells: number }}
     */
    render(agent, options = {}) {
        const status = getEffectiveStatus(agent);
        const heightCells = this.calcHeight(agent);
        const pxW = this.widthCells * this.atlas.glyphW;
        const pxH = heightCells * this.atlas.glyphH;

        const buf = options.buffer || new PixelBuffer(pxW, pxH);
        const ox = options.offsetX || 0;
        const oy = options.offsetY || 0;
        const nowMs = options.nowMs !== undefined ? options.nowMs : Date.now();

        // Card background
        buf.drawRect(ox, oy, pxW, pxH, ...CARD_BG);

        // Border (top and bottom lines)
        for (let x = ox; x < ox + pxW; x++) {
            buf.setPixel(x, oy, ...CARD_BORDER);
            buf.setPixel(x, oy + pxH - 1, ...CARD_BORDER);
        }

        // Row 1: Status badge + name
        const statusSymbol = STATUS_SYMBOLS[status] || STATUS_SYMBOLS.unknown;
        const statusColor = STATUS_COLORS[status] || STATUS_COLORS.unknown;

        this.atlas.drawText(buf, ox + this.atlas.glyphW, oy + this.atlas.glyphH,
            statusSymbol, statusColor);
        this.atlas.drawText(buf, ox + this.atlas.glyphW * 3, oy + this.atlas.glyphH,
            String(agent.name || 'unnamed').slice(0, this.widthCells - 4), NAME_COLOR);

        // Capability tags or spacer
        const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
        if (caps.length > 0) {
            const tagLine = caps.map(c => String(c)).join(', ');
            this.atlas.drawText(buf,
                ox + this.atlas.glyphW,
                oy + 2 * this.atlas.glyphH,
                tagLine.slice(0, this.widthCells - 2),
                TAG_TEXT
            );
        }

        // Activity row (last row before border)
        const activityText = formatRelativeTime(agent.lastHeartbeat, nowMs);
        this.atlas.drawText(buf,
            ox + this.atlas.glyphW,
            oy + (heightCells - 2) * this.atlas.glyphH,
            activityText.slice(0, this.widthCells - 2),
            MUTED_COLOR
        );

        return { buffer: buf, widthCells: this.widthCells, heightCells };
    }
}
