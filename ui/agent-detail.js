// ui/agent-detail.js
// Renders a full detail page for a single agent using GET /api/v1/agents/:id.
// Includes: agent header, metrics sparklines, recent logs, and task history.
// Works with PixelBuffer + GlyphAtlas from the pixel-native rendering system.

import { PixelBuffer } from '../sync/pixel-buffer.js';
import { GlyphAtlas } from '../sync/glyph-atlas.js';
import { formatRelativeTime, getEffectiveStatus } from './agent-card.js';

// Color palette
const BG_COLOR       = [0x0d, 0x11, 0x17]; // Dark background
const HEADER_BG      = [0x16, 0x1b, 0x22]; // Header panel bg
const SECTION_BG     = [0x16, 0x1b, 0x22]; // Section panel bg
const BORDER_COLOR   = [0x30, 0x36, 0x3d]; // Border gray
const NAME_COLOR     = [0xff, 0xff, 0xff]; // White
const TEXT_COLOR     = [0xc9, 0xd1, 0xd9]; // Light gray
const MUTED_COLOR    = [0x8b, 0x94, 0x9e]; // Muted gray
const LABEL_COLOR    = [0x58, 0xa6, 0xff]; // Blue label
const SPARKLINE_BAR  = [0x3f, 0xb9, 0x50]; // Green bar
const SPARKLINE_EMPTY= [0x21, 0x26, 0x2d]; // Empty bar bg
const LOG_TEXT_COLOR = [0xc9, 0xd1, 0xd9]; // Light gray for logs
const TASK_COLOR     = [0xd2, 0xa8, 0xff]; // Purple for tasks
const STATUS_COLORS  = {
    online:  [0x3f, 0xb9, 0x50],
    offline: [0xe3, 0xb3, 0x41],
    error:   [0xf8, 0x51, 0x49],
    unknown: [0x48, 0x4f, 0x58],
};
const STATUS_SYMBOLS = {
    online:  '●',
    offline: '○',
    error:   '✗',
    unknown: '○',
};

// Layout constants
const DETAIL_WIDTH_CELLS = 60;
const HEADER_ROWS = 3;      // border + name/status + caps/info + border
const SPARKLINE_ROWS = 4;   // label + 2 bar rows + spacer
const SPARKLINE_METRICS = 3; // number of sparkline metrics to show
const LOG_ROWS = 12;        // label + 10 log lines + spacer
const TASK_ROWS = 12;       // label + 10 task lines + spacer
const SECTION_GAP = 1;

export class AgentDetail {
    /**
     * @param {object} [options]
     * @param {number} [options.widthCells=60] - Detail page width in cell units
     */
    constructor(options = {}) {
        this.widthCells = options.widthCells || DETAIL_WIDTH_CELLS;
        this.atlas = new GlyphAtlas();
    }

    /**
     * Calculate the total height in cell rows for the detail view.
     * @returns {number}
     */
    calcHeight() {
        return 1 // top border
            + HEADER_ROWS
            + SECTION_GAP
            + SPARKLINE_ROWS
            + SECTION_GAP
            + LOG_ROWS
            + SECTION_GAP
            + TASK_ROWS
            + 1; // bottom border
    }

    /**
     * Render the metrics sparkline section: mini bar charts for the last 20 values.
     * @param {PixelBuffer} buf
     * @param {number} ox - X offset in pixels
     * @param {number} oy - Y offset in pixels
     * @param {object} metrics - { metricName: number[] }
     */
    renderSparklines(buf, ox, oy, metrics) {
        const cellW = this.atlas.glyphW;
        const cellH = this.atlas.glyphH;
        const sectionPxW = this.widthCells * cellW;

        // Section background
        buf.drawRect(ox, oy, sectionPxW, SPARKLINE_ROWS * cellH, ...SECTION_BG);

        // Section label
        this.atlas.drawText(buf, ox + cellW, oy + cellH, 'Metrics', LABEL_COLOR);

        const metricNames = Object.keys(metrics);
        const metricsToShow = metricNames.slice(0, SPARKLINE_METRICS);

        const barAreaWidth = Math.floor((sectionPxW - 2 * cellW) / Math.max(1, metricsToShow.length));
        const barMaxH = cellH; // max bar height is 1 cell
        const barW = 2; // 2px wide bars
        const barGap = 1;

        for (let m = 0; m < metricsToShow.length; m++) {
            const metricName = metricsToShow[m];
            const values = metrics[metricName];
            if (!Array.isArray(values)) continue;

            const metricBaseX = ox + cellW + m * barAreaWidth;
            const metricBaseY = oy + 2 * cellH;

            // Metric name label
            const label = metricName.slice(0, Math.floor(barAreaWidth / cellW) - 1);
            this.atlas.drawText(buf, metricBaseX, oy + cellH, label, MUTED_COLOR);

            // Render last 20 values as mini bars
            const last20 = values.slice(-20);
            if (last20.length === 0) continue;

            const maxVal = Math.max(...last20, 1);

            for (let i = 0; i < last20.length; i++) {
                const barX = metricBaseX + i * (barW + barGap);
                const fraction = last20[i] / maxVal;
                const barH = Math.max(1, Math.round(barMaxH * fraction));
                const barY = metricBaseY + barMaxH - barH;

                // Empty bg
                buf.drawRect(barX, metricBaseY, barW, barMaxH, ...SPARKLINE_EMPTY);
                // Filled bar
                buf.drawRect(barX, barY, barW, barH, ...SPARKLINE_BAR);
            }
        }

        // Border top and bottom
        for (let x = ox; x < ox + sectionPxW; x++) {
            buf.setPixel(x, oy, ...BORDER_COLOR);
            buf.setPixel(x, oy + SPARKLINE_ROWS * cellH - 1, ...BORDER_COLOR);
        }
    }

    /**
     * Render the recent logs section.
     * @param {PixelBuffer} buf
     * @param {number} ox - X offset in pixels
     * @param {number} oy - Y offset in pixels
     * @param {object[]} logs - Array of { timestamp, level, message }
     */
    renderLogs(buf, ox, oy, logs) {
        const cellW = this.atlas.glyphW;
        const cellH = this.atlas.glyphH;
        const sectionPxW = this.widthCells * cellW;

        // Section background
        buf.drawRect(ox, oy, sectionPxW, LOG_ROWS * cellH, ...SECTION_BG);

        // Section label
        this.atlas.drawText(buf, ox + cellW, oy + cellH, 'Recent Logs', LABEL_COLOR);

        // Render up to 10 log entries
        const entries = Array.isArray(logs) ? logs.slice(-10) : [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const textY = oy + (2 + i) * cellH;
            const level = String(entry.level || 'info').slice(0, 5);
            const msg = String(entry.message || '').slice(0, this.widthCells - 10);
            const ts = entry.timestamp
                ? formatRelativeTime(entry.timestamp).slice(0, 8)
                : '';
            this.atlas.drawText(buf, ox + cellW, textY, `${level}`, MUTED_COLOR);
            this.atlas.drawText(buf, ox + 7 * cellW, textY, msg, LOG_TEXT_COLOR);
            if (ts) {
                this.atlas.drawText(buf, ox + (this.widthCells - 9) * cellW, textY, ts, MUTED_COLOR);
            }
        }

        // Border top and bottom
        for (let x = ox; x < ox + sectionPxW; x++) {
            buf.setPixel(x, oy, ...BORDER_COLOR);
            buf.setPixel(x, oy + LOG_ROWS * cellH - 1, ...BORDER_COLOR);
        }
    }

    /**
     * Render the task history section.
     * @param {PixelBuffer} buf
     * @param {number} ox - X offset in pixels
     * @param {number} oy - Y offset in pixels
     * @param {object[]} tasks - Array of { id, description, status, completedAt }
     */
    renderTasks(buf, ox, oy, tasks) {
        const cellW = this.atlas.glyphW;
        const cellH = this.atlas.glyphH;
        const sectionPxW = this.widthCells * cellW;

        // Section background
        buf.drawRect(ox, oy, sectionPxW, TASK_ROWS * cellH, ...SECTION_BG);

        // Section label
        this.atlas.drawText(buf, ox + cellW, oy + cellH, 'Task History', LABEL_COLOR);

        // Render up to 10 tasks
        const entries = Array.isArray(tasks) ? tasks.slice(-10) : [];
        for (let i = 0; i < entries.length; i++) {
            const task = entries[i];
            const textY = oy + (2 + i) * cellH;
            const desc = String(task.description || task.id || '').slice(0, this.widthCells - 14);
            const status = String(task.status || 'pending').slice(0, 8);
            this.atlas.drawText(buf, ox + cellW, textY, desc, TASK_COLOR);
            this.atlas.drawText(buf, ox + (this.widthCells - 10) * cellW, textY, status, MUTED_COLOR);
        }

        // Border top and bottom
        for (let x = ox; x < ox + sectionPxW; x++) {
            buf.setPixel(x, oy, ...BORDER_COLOR);
            buf.setPixel(x, oy + TASK_ROWS * cellH - 1, ...BORDER_COLOR);
        }
    }

    /**
     * Render the full agent detail view into a PixelBuffer.
     *
     * @param {object} agent - Agent data (id, name, status, capabilities, lastHeartbeat, config)
     * @param {object} [detail]
     * @param {object} [detail.metrics] - { metricName: number[] } for sparklines
     * @param {object[]} [detail.logs] - Array of { timestamp, level, message }
     * @param {object[]} [detail.tasks] - Array of { id, description, status, completedAt }
     * @param {object} [options]
     * @param {PixelBuffer} [options.buffer] - Target buffer (creates one if not given)
     * @param {number} [options.offsetX=0] - Pixel X offset within buffer
     * @param {number} [options.offsetY=0] - Pixel Y offset within buffer
     * @param {number} [options.nowMs] - Reference timestamp for relative time (testing)
     * @returns {{ buffer: PixelBuffer, widthCells: number, heightCells: number }}
     */
    render(agent, detail = {}, options = {}) {
        const cellW = this.atlas.glyphW;
        const cellH = this.atlas.glyphH;
        const totalRows = this.calcHeight();
        const pxW = this.widthCells * cellW;
        const pxH = totalRows * cellH;

        const buf = options.buffer || new PixelBuffer(pxW, pxH);
        const ox = options.offsetX || 0;
        const oy = options.offsetY || 0;
        const nowMs = options.nowMs !== undefined ? options.nowMs : Date.now();

        // Full background
        buf.drawRect(ox, oy, pxW, pxH, ...BG_COLOR);

        // ── Header section ──
        const headerY = oy + cellH; // after top border
        buf.drawRect(ox, headerY, pxW, HEADER_ROWS * cellH, ...HEADER_BG);

        // Status badge + name
        const status = getEffectiveStatus(agent);
        const statusSymbol = STATUS_SYMBOLS[status] || STATUS_SYMBOLS.unknown;
        const statusColor = STATUS_COLORS[status] || STATUS_COLORS.unknown;
        this.atlas.drawText(buf, ox + cellW, headerY + cellH, statusSymbol, statusColor);
        this.atlas.drawText(buf, ox + 3 * cellW, headerY + cellH,
            String(agent.name || 'unnamed').slice(0, this.widthCells - 4), NAME_COLOR);

        // Capabilities line
        const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
        if (caps.length > 0) {
            const capText = caps.map(c => String(c)).join(', ');
            this.atlas.drawText(buf, ox + cellW, headerY + 2 * cellH,
                capText.slice(0, this.widthCells - 2), MUTED_COLOR);
        }

        // Info line (id, heartbeat, created)
        const hb = formatRelativeTime(agent.lastHeartbeat, nowMs);
        const infoText = `id: ${String(agent.id || '').slice(0, 8)}  hb: ${hb}`;
        this.atlas.drawText(buf, ox + (this.widthCells - infoText.length - 1) * cellW,
            headerY + 2 * cellH, infoText, MUTED_COLOR);

        // Header borders
        for (let x = ox; x < ox + pxW; x++) {
            buf.setPixel(x, headerY, ...BORDER_COLOR);
            buf.setPixel(x, headerY + HEADER_ROWS * cellH - 1, ...BORDER_COLOR);
        }

        // ── Sparkline section ──
        const metrics = (detail.metrics && typeof detail.metrics === 'object') ? detail.metrics : {};
        const sparkY = headerY + HEADER_ROWS * cellH + SECTION_GAP * cellH;
        this.renderSparklines(buf, ox, sparkY, metrics);

        // ── Logs section ──
        const logs = Array.isArray(detail.logs) ? detail.logs : [];
        const logY = sparkY + SPARKLINE_ROWS * cellH + SECTION_GAP * cellH;
        this.renderLogs(buf, ox, logY, logs);

        // ── Tasks section ──
        const tasks = Array.isArray(detail.tasks) ? detail.tasks : [];
        const taskY = logY + LOG_ROWS * cellH + SECTION_GAP * cellH;
        this.renderTasks(buf, ox, taskY, tasks);

        // Top and bottom borders
        for (let x = ox; x < ox + pxW; x++) {
            buf.setPixel(x, oy, ...BORDER_COLOR);
            buf.setPixel(x, oy + pxH - 1, ...BORDER_COLOR);
        }

        return { buffer: buf, widthCells: this.widthCells, heightCells: totalRows };
    }

    /**
     * Fetch agent detail from the API endpoint and render the detail view.
     * @param {string} baseUrl - Base URL of the pxOS server (e.g. 'http://localhost:3839')
     * @param {string} agentId - Agent ID to fetch
     * @param {object} [options]
     * @param {number} [options.nowMs] - Reference timestamp (testing)
     * @returns {Promise<{ buffer: PixelBuffer, agent: object }>}
     */
    async fetchAndRender(baseUrl, agentId, options = {}) {
        const res = await fetch(`${baseUrl}/api/v1/agents/${agentId}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch agent ${agentId}: ${res.status}`);
        }
        const agent = await res.json();

        // Fetch optional detail endpoints (logs, tasks, metrics)
        // These may 404 on servers that don't support them yet — that's fine.
        const detail = {};

        try {
            const logsRes = await fetch(`${baseUrl}/api/v1/agents/${agentId}/logs`);
            if (logsRes.ok) detail.logs = await logsRes.json();
        } catch { /* optional */ }

        try {
            const tasksRes = await fetch(`${baseUrl}/api/v1/agents/${agentId}/tasks`);
            if (tasksRes.ok) detail.tasks = await tasksRes.json();
        } catch { /* optional */ }

        try {
            const metricsRes = await fetch(`${baseUrl}/api/v1/agents/${agentId}/metrics`);
            if (metricsRes.ok) detail.metrics = await metricsRes.json();
        } catch { /* optional */ }

        const result = this.render(agent, detail, options);
        return { ...result, agent };
    }
}
