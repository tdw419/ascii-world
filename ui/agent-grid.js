// ui/agent-grid.js
// Renders a grid of Agent Cards from the Agent Registry.
// Fetches GET /api/v1/agents, sorts, and lays out cards in a pixel buffer.

import { PixelBuffer } from '../sync/pixel-buffer.js';
import { GlyphAtlas } from '../sync/glyph-atlas.js';
import { AgentCard } from './agent-card.js';

const GRID_BG = [0x0d, 0x11, 0x17]; // Dark background
const HEADER_COLOR = [0xff, 0xff, 0xff];
const SORT_LABEL_COLOR = [0x8b, 0x94, 0x9e];
const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds

/**
 * Sort comparator functions for agents.
 * Each returns a standard comparator (neg/0/pos).
 */
export const SORT_FNS = {
    name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
    status: (a, b) => {
        const order = { online: 0, offline: 1, error: 2, unknown: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    },
    heartbeat: (a, b) => {
        const tA = a.lastHeartbeat ? new Date(a.lastHeartbeat).getTime() : 0;
        const tB = b.lastHeartbeat ? new Date(b.lastHeartbeat).getTime() : 0;
        // Most recent first (descending)
        return tB - tA;
    },
};

export class AgentGrid {
    /**
     * @param {object} [options]
     * @param {number} [options.cols=4] - Number of card columns
     * @param {number} [options.cardWidth=20] - Card width in cell units
     * @param {number} [options.cellWidth=80] - Grid total width in cell units
     * @param {number} [options.gapX=1] - Horizontal gap between cards in cells
     * @param {number} [options.gapY=1] - Vertical gap between cards in cells
     * @param {string} [options.sortBy='name'] - Default sort key
     * @param {number} [options.pollInterval=5000] - Auto-refresh interval in ms (0 to disable)
     */
    constructor(options = {}) {
        this.cols = options.cols || 4;
        this.cardWidth = options.cardWidth || 20;
        this.cellWidth = options.cellWidth || 80;
        this.gapX = options.gapX ?? 1;
        this.gapY = options.gapY ?? 1;
        this.sortBy = options.sortBy || 'name';
        this.pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;
        this._timer = null;
        this._onRefresh = null;
        this._atlas = new GlyphAtlas();
        this._card = new AgentCard({ widthCells: this.cardWidth });
    }

    /**
     * Sort an array of agents using the current sortBy key.
     * @param {object[]} agents
     * @param {string} [sortBy] - Override sort key
     * @returns {object[]} sorted copy
     */
    sortAgents(agents, sortBy) {
        const key = sortBy || this.sortBy;
        const fn = SORT_FNS[key];
        if (!fn) return [...agents];
        return [...agents].sort(fn);
    }

    /**
     * Calculate the grid layout dimensions for a set of agents.
     * @param {object[]} agents
     * @returns {{ totalWidthPx: number, totalHeightPx: number, cols: number, rows: number, positions: Array<{col: number, row: number, x: number, y: number, heightCells: number}> }}
     */
    calcLayout(agents) {
        const agentsPerPage = Math.max(1, this.cols);
        const rows = Math.max(1, Math.ceil(agents.length / agentsPerPage));
        const cellH = this._atlas.glyphH;
        const cellW = this._atlas.glyphW;

        const positions = [];
        let maxRowHeight = 0;
        let totalHeightCells = 0;

        // Header row: 1 cell
        const headerRows = 1;

        for (let i = 0; i < agents.length; i++) {
            const col = i % this.cols;
            const row = Math.floor(i / this.cols);
            const cardH = this._card.calcHeight(agents[i]);
            const x = col * (this.cardWidth + this.gapX) * cellW;
            const y = (headerRows + row * (8 + this.gapY)) * cellH; // 8 is a reasonable max card height

            positions.push({ col, row, x, y, heightCells: cardH });
        }

        // Calculate actual total height
        let maxBottomCell = headerRows;
        for (let i = 0; i < positions.length; i++) {
            const row = positions[i].row;
            const bottomCell = headerRows + row * (8 + this.gapY) + positions[i].heightCells;
            if (bottomCell > maxBottomCell) maxBottomCell = bottomCell;
        }

        return {
            totalWidthPx: this.cellWidth * cellW,
            totalHeightPx: maxBottomCell * cellH,
            cols: this.cols,
            rows,
            positions,
        };
    }

    /**
     * Render a grid of agent cards into a PixelBuffer.
     * @param {object[]} agents - Array of agent objects
     * @param {object} [options]
     * @param {string} [options.sortBy] - Sort override
     * @param {number} [options.nowMs] - Reference timestamp (testing)
     * @returns {{ buffer: PixelBuffer, agentCount: number }}
     */
    render(agents, options = {}) {
        const sorted = this.sortAgents(agents, options.sortBy);
        const layout = this.calcLayout(sorted);

        const buf = new PixelBuffer(layout.totalWidthPx, layout.totalHeightPx);

        // Grid background
        buf.drawRect(0, 0, layout.totalWidthPx, layout.totalHeightPx, ...GRID_BG);

        // Header: "Agent Grid" title
        this._atlas.drawText(buf, 0, 0, 'Agent Grid', HEADER_COLOR);

        // Sort label
        const sortLabel = `sort: ${this.sortBy}`;
        this._atlas.drawText(buf, (this.cellWidth - sortLabel.length - 2) * this._atlas.glyphW, 0,
            sortLabel, SORT_LABEL_COLOR);

        // Render each agent card
        const nowMs = options.nowMs !== undefined ? options.nowMs : Date.now();
        for (let i = 0; i < sorted.length; i++) {
            const pos = layout.positions[i];
            this._card.render(sorted[i], {
                buffer: buf,
                offsetX: pos.x,
                offsetY: pos.y,
                nowMs,
            });
        }

        return { buffer: buf, agentCount: sorted.length };
    }

    /**
     * Fetch agents from the API endpoint and render the grid.
     * @param {string} baseUrl - Base URL of the pxOS server (e.g. 'http://localhost:3839')
     * @param {object} [options]
     * @param {string} [options.sortBy] - Sort override for this render
     * @param {number} [options.nowMs] - Reference timestamp (testing)
     * @returns {Promise<{ buffer: PixelBuffer, agentCount: number, agents: object[] }>}
     */
    async fetchAndRender(baseUrl, options = {}) {
        const res = await fetch(`${baseUrl}/api/v1/agents`);
        if (!res.ok) {
            throw new Error(`Failed to fetch agents: ${res.status}`);
        }
        const agents = await res.json();
        const result = this.render(agents, options);
        return { ...result, agents };
    }

    /**
     * Start auto-refresh polling.
     * @param {string} baseUrl - Base URL of the pxOS server
     * @param {function} [onRefresh] - Callback called with (result) after each refresh
     */
    startAutoRefresh(baseUrl, onRefresh) {
        this.stopAutoRefresh();
        this._onRefresh = onRefresh;
        if (this.pollInterval <= 0) return;

        this._timer = setInterval(async () => {
            try {
                const result = await this.fetchAndRender(baseUrl);
                if (this._onRefresh) this._onRefresh(result);
            } catch {
                // Silently ignore fetch errors during polling
            }
        }, this.pollInterval);

        // Don't prevent process exit
        if (this._timer.unref) this._timer.unref();
    }

    /**
     * Stop auto-refresh polling.
     */
    stopAutoRefresh() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this._onRefresh = null;
    }

    /**
     * Change the sort key.
     * @param {string} sortBy - One of 'name', 'status', 'heartbeat'
     */
    setSortBy(sortBy) {
        if (SORT_FNS[sortBy]) {
            this.sortBy = sortBy;
        }
    }
}
