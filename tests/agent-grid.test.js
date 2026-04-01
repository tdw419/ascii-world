// tests/agent-grid.test.js
// Tests for ui/agent-grid.js — Agent Grid View

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentGrid, SORT_FNS } from '../ui/agent-grid.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';

const FIXTURE_AGENTS = [
    { id: 'a1', name: 'Zeta', status: 'online', capabilities: ['render'], lastHeartbeat: new Date().toISOString() },
    { id: 'a2', name: 'Alpha', status: 'offline', capabilities: [], lastHeartbeat: null },
    { id: 'a3', name: 'Mid', status: 'error', capabilities: ['monitor', 'alert'], lastHeartbeat: new Date(Date.now() - 60000).toISOString() },
];

describe('AgentGrid', () => {

    // ── SORT_FNS ──────────────────────────────────────────────

    describe('SORT_FNS', () => {
        it('sorts by name alphabetically', () => {
            const sorted = [...FIXTURE_AGENTS].sort(SORT_FNS.name);
            assert.equal(sorted[0].name, 'Alpha');
            assert.equal(sorted[1].name, 'Mid');
            assert.equal(sorted[2].name, 'Zeta');
        });

        it('sorts by status: online before offline before error', () => {
            const sorted = [...FIXTURE_AGENTS].sort(SORT_FNS.status);
            assert.equal(sorted[0].status, 'online');
            assert.equal(sorted[1].status, 'offline');
            assert.equal(sorted[2].status, 'error');
        });

        it('sorts by heartbeat: most recent first (descending)', () => {
            const sorted = [...FIXTURE_AGENTS].sort(SORT_FNS.heartbeat);
            // a1 has most recent heartbeat, a2 has null (0), a3 is 60s ago
            assert.equal(sorted[0].id, 'a1');
        });

        it('sorts null heartbeats to the end', () => {
            const sorted = [...FIXTURE_AGENTS].sort(SORT_FNS.heartbeat);
            assert.equal(sorted[sorted.length - 1].id, 'a2');
        });

        it('name sort handles missing name', () => {
            const agents = [{ id: 'x' }, { id: 'y', name: 'Beta' }];
            const sorted = agents.sort(SORT_FNS.name);
            // '' < 'Beta'
            assert.equal(sorted[0].id, 'x');
        });

        it('status sort puts unknown status at end', () => {
            const agents = [
                { status: 'unknown' },
                { status: 'online' },
            ];
            const sorted = agents.sort(SORT_FNS.status);
            assert.equal(sorted[0].status, 'online');
            assert.equal(sorted[1].status, 'unknown');
        });
    });

    // ── Constructor ────────────────────────────────────────────

    describe('constructor', () => {
        it('creates grid with default options', () => {
            const grid = new AgentGrid();
            assert.equal(grid.cols, 4);
            assert.equal(grid.cardWidth, 20);
            assert.equal(grid.sortBy, 'name');
            assert.equal(grid.pollInterval, 5000);
        });

        it('accepts custom options', () => {
            const grid = new AgentGrid({ cols: 6, sortBy: 'status', pollInterval: 10000 });
            assert.equal(grid.cols, 6);
            assert.equal(grid.sortBy, 'status');
            assert.equal(grid.pollInterval, 10000);
        });

        it('accepts pollInterval of 0 to disable auto-refresh', () => {
            const grid = new AgentGrid({ pollInterval: 0 });
            assert.equal(grid.pollInterval, 0);
        });
    });

    // ── sortAgents ─────────────────────────────────────────────

    describe('sortAgents()', () => {
        it('returns a new sorted array (does not mutate input)', () => {
            const grid = new AgentGrid({ sortBy: 'name' });
            const original = [...FIXTURE_AGENTS];
            const sorted = grid.sortAgents(FIXTURE_AGENTS);
            // Input not mutated
            assert.equal(FIXTURE_AGENTS[0].name, original[0].name);
            // Output is sorted
            assert.equal(sorted[0].name, 'Alpha');
        });

        it('accepts sortBy override', () => {
            const grid = new AgentGrid({ sortBy: 'name' });
            const sorted = grid.sortAgents(FIXTURE_AGENTS, 'status');
            assert.equal(sorted[0].status, 'online');
        });

        it('returns copy when sortBy key is unrecognized', () => {
            const grid = new AgentGrid({ sortBy: 'bogus' });
            const sorted = grid.sortAgents(FIXTURE_AGENTS);
            assert.equal(sorted.length, FIXTURE_AGENTS.length);
        });
    });

    // ── calcLayout ─────────────────────────────────────────────

    describe('calcLayout()', () => {
        it('returns positions for each agent', () => {
            const grid = new AgentGrid({ cols: 2 });
            const layout = grid.calcLayout(FIXTURE_AGENTS);
            assert.equal(layout.positions.length, 3);
            assert.equal(layout.cols, 2);
            assert.ok(layout.rows >= 2);
        });

        it('positions agents in columns', () => {
            const grid = new AgentGrid({ cols: 2 });
            const layout = grid.calcLayout(FIXTURE_AGENTS);
            // First two agents should be in column 0 and 1
            assert.equal(layout.positions[0].col, 0);
            assert.equal(layout.positions[1].col, 1);
            // Third agent wraps to next row, column 0
            assert.equal(layout.positions[2].col, 0);
            assert.equal(layout.positions[2].row, 1);
        });

        it('handles empty agents array', () => {
            const grid = new AgentGrid();
            const layout = grid.calcLayout([]);
            assert.equal(layout.positions.length, 0);
            assert.equal(layout.rows, 1); // minimum 1 row
        });

        it('calculates non-zero pixel dimensions', () => {
            const grid = new AgentGrid();
            const layout = grid.calcLayout(FIXTURE_AGENTS);
            assert.ok(layout.totalWidthPx > 0);
            assert.ok(layout.totalHeightPx > 0);
        });
    });

    // ── render ─────────────────────────────────────────────────

    describe('render()', () => {
        it('returns a PixelBuffer with agent cards', () => {
            const grid = new AgentGrid();
            const result = grid.render(FIXTURE_AGENTS);
            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.agentCount, 3);
        });

        it('renders header text "Agent Grid"', () => {
            const grid = new AgentGrid();
            const result = grid.render(FIXTURE_AGENTS);
            const buf = result.buffer;
            // Header area: check for white pixels near (0,0)
            let hasWhite = false;
            for (let x = 0; x < 60; x++) {
                const [r, g, b] = buf.getPixel(x, 0);
                if (r === 0xff && g === 0xff && b === 0xff) {
                    hasWhite = true;
                    break;
                }
            }
            assert.ok(hasWhite, 'header should have white text pixels');
        });

        it('renders sort label', () => {
            const grid = new AgentGrid({ sortBy: 'name' });
            const result = grid.render(FIXTURE_AGENTS);
            const buf = result.buffer;
            // Sort label "sort: name" should be in the header area
            // Check top-right area for muted color text
            const labelX = (grid.cellWidth - 10) * 6;
            let hasSortLabel = false;
            for (let x = labelX; x < labelX + 60; x++) {
                const [r, g, b] = buf.getPixel(x, 0);
                if (r === 0x8b && g === 0x94 && b === 0x9e) {
                    hasSortLabel = true;
                    break;
                }
            }
            assert.ok(hasSortLabel, 'sort label should be rendered');
        });

        it('respects sortBy option', () => {
            const grid = new AgentGrid({ sortBy: 'name' });
            const result = grid.render(FIXTURE_AGENTS);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('handles empty agents array', () => {
            const grid = new AgentGrid();
            const result = grid.render([]);
            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.agentCount, 0);
        });

        it('handles single agent', () => {
            const grid = new AgentGrid();
            const result = grid.render([FIXTURE_AGENTS[0]]);
            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.agentCount, 1);
        });

        it('grid background fills the buffer', () => {
            const grid = new AgentGrid();
            const result = grid.render(FIXTURE_AGENTS);
            const buf = result.buffer;
            // Check a pixel in the grid background area (bottom-right corner)
            const [r, g, b] = buf.getPixel(buf.width - 1, buf.height - 1);
            assert.equal(r, 0x0d);
            assert.equal(g, 0x11);
            assert.equal(b, 0x17);
        });

        it('passes nowMs to cards for consistent timestamps', () => {
            const grid = new AgentGrid();
            const now = Date.now();
            const result = grid.render(FIXTURE_AGENTS, { nowMs: now });
            assert.ok(result.buffer instanceof PixelBuffer);
        });
    });

    // ── setSortBy ──────────────────────────────────────────────

    describe('setSortBy()', () => {
        it('changes the sort key', () => {
            const grid = new AgentGrid({ sortBy: 'name' });
            grid.setSortBy('status');
            assert.equal(grid.sortBy, 'status');
        });

        it('ignores invalid sort keys', () => {
            const grid = new AgentGrid({ sortBy: 'name' });
            grid.setSortBy('bogus');
            assert.equal(grid.sortBy, 'name');
        });
    });

    // ── auto-refresh ───────────────────────────────────────────

    describe('startAutoRefresh / stopAutoRefresh', () => {
        it('startAutoRefresh with interval 0 does nothing', () => {
            const grid = new AgentGrid({ pollInterval: 0 });
            grid.startAutoRefresh('http://localhost:3839');
            assert.equal(grid._timer, null);
        });

        it('stopAutoRefresh clears timer when none is active', () => {
            const grid = new AgentGrid();
            // Should not throw
            grid.stopAutoRefresh();
            assert.equal(grid._timer, null);
        });

        it('startAutoRefresh sets a timer', () => {
            const grid = new AgentGrid({ pollInterval: 60000 });
            grid.startAutoRefresh('http://localhost:9999');
            assert.ok(grid._timer !== null);
            grid.stopAutoRefresh();
            assert.equal(grid._timer, null);
        });

        it('stopAutoRefresh clears the timer', () => {
            const grid = new AgentGrid({ pollInterval: 60000 });
            grid.startAutoRefresh('http://localhost:9999');
            assert.ok(grid._timer !== null);
            grid.stopAutoRefresh();
            assert.equal(grid._timer, null);
        });

        it('calling startAutoRefresh twice resets timer', () => {
            const grid = new AgentGrid({ pollInterval: 60000 });
            grid.startAutoRefresh('http://localhost:9999');
            const firstTimer = grid._timer;
            grid.startAutoRefresh('http://localhost:9999');
            // Timer should be a new one
            assert.notEqual(grid._timer, firstTimer);
            grid.stopAutoRefresh();
        });
    });
});
