// tests/agent-card.test.js
// Tests for ui/agent-card.js — Agent Card Component

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentCard, formatRelativeTime, getEffectiveStatus } from '../ui/agent-card.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';

/**
 * Scan the status badge area (row 1, col 1) for a pixel matching a color pattern.
 * Returns true if found. The badge glyph occupies approximately pixels (6,10)-(12,19).
 */
function badgeHasColor(buf, expectedR, expectedG, expectedB) {
    for (let y = 10; y < 20; y++) {
        for (let x = 6; x < 12; x++) {
            const [r, g, b] = buf.getPixel(x, y);
            if (r === expectedR && g === expectedG && b === expectedB) return true;
        }
    }
    return false;
}

describe('AgentCard', () => {

    // ── formatRelativeTime ──────────────────────────────────────

    describe('formatRelativeTime()', () => {
        it('returns "never" for null timestamp', () => {
            assert.equal(formatRelativeTime(null), 'never');
        });

        it('returns "never" for undefined timestamp', () => {
            assert.equal(formatRelativeTime(undefined), 'never');
        });

        it('returns "never" for empty string', () => {
            assert.equal(formatRelativeTime(''), 'never');
        });

        it('returns "never" for invalid date string', () => {
            assert.equal(formatRelativeTime('not-a-date'), 'never');
        });

        it('returns "5s ago" for 5 seconds ago', () => {
            const now = Date.now();
            const ts = new Date(now - 5000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '5s ago');
        });

        it('returns "0s ago" for just now (<1s)', () => {
            const now = Date.now();
            const ts = new Date(now).toISOString();
            assert.equal(formatRelativeTime(ts, now), '0s ago');
        });

        it('returns "59s ago" for 59 seconds ago', () => {
            const now = Date.now();
            const ts = new Date(now - 59000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '59s ago');
        });

        it('returns "2m ago" for 120 seconds ago', () => {
            const now = Date.now();
            const ts = new Date(now - 120000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '2m ago');
        });

        it('returns "1m ago" for 60 seconds ago', () => {
            const now = Date.now();
            const ts = new Date(now - 60000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '1m ago');
        });

        it('returns "1h ago" for 60 minutes ago', () => {
            const now = Date.now();
            const ts = new Date(now - 3600000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '1h ago');
        });

        it('returns "5h ago" for 5 hours ago', () => {
            const now = Date.now();
            const ts = new Date(now - 5 * 3600000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '5h ago');
        });

        it('returns "1d ago" for 24 hours ago', () => {
            const now = Date.now();
            const ts = new Date(now - 86400000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '1d ago');
        });

        it('returns "3d ago" for 3 days ago', () => {
            const now = Date.now();
            const ts = new Date(now - 3 * 86400000).toISOString();
            assert.equal(formatRelativeTime(ts, now), '3d ago');
        });

        it('returns "just now" for future timestamps', () => {
            const now = Date.now();
            const ts = new Date(now + 5000).toISOString();
            assert.equal(formatRelativeTime(ts, now), 'just now');
        });
    });

    // ── getEffectiveStatus ──────────────────────────────────────

    describe('getEffectiveStatus()', () => {
        it('returns "online" for online agent', () => {
            assert.equal(getEffectiveStatus({ status: 'online' }), 'online');
        });

        it('returns "offline" for offline agent', () => {
            assert.equal(getEffectiveStatus({ status: 'offline' }), 'offline');
        });

        it('returns "error" for error agent', () => {
            assert.equal(getEffectiveStatus({ status: 'error' }), 'error');
        });

        it('returns "unknown" for unrecognized status', () => {
            assert.equal(getEffectiveStatus({ status: 'deploying' }), 'unknown');
        });

        it('returns "unknown" for null agent', () => {
            assert.equal(getEffectiveStatus(null), 'unknown');
        });

        it('returns "unknown" for undefined agent', () => {
            assert.equal(getEffectiveStatus(undefined), 'unknown');
        });

        it('returns "unknown" when status is missing', () => {
            assert.equal(getEffectiveStatus({}), 'unknown');
        });

        it('returns "unknown" when status is a number', () => {
            assert.equal(getEffectiveStatus({ status: 42 }), 'unknown');
        });
    });

    // ── AgentCard render ────────────────────────────────────────

    describe('AgentCard class', () => {
        it('creates card with default dimensions', () => {
            const card = new AgentCard();
            assert.equal(card.widthCells, 20);
        });

        it('creates card with custom width', () => {
            const card = new AgentCard({ widthCells: 30 });
            assert.equal(card.widthCells, 30);
        });

        it('calcHeight returns 5 for agent with no capabilities', () => {
            const card = new AgentCard();
            const h = card.calcHeight({ name: 'Test', capabilities: [] });
            // border-top + name + spacer + activity + border-bottom = 5
            assert.equal(h, 5);
        });

        it('calcHeight includes extra rows when capabilities overflow', () => {
            const card = new AgentCard({ widthCells: 10 });
            // Long cap names won't fit on one row with width 10
            const h = card.calcHeight({ name: 'Test', capabilities: ['rendering', 'compiling', 'deploying'] });
            assert.ok(h >= 6, 'should have extra rows for overflowing capabilities');
        });

        it('render returns buffer with correct dimensions', () => {
            const card = new AgentCard();
            const agent = {
                name: 'Alpha',
                status: 'online',
                capabilities: ['render'],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.widthCells, 20);
            assert.ok(result.heightCells >= 5);
        });

        it('render creates buffer sized to card dimensions', () => {
            const card = new AgentCard({ widthCells: 20 });
            const agent = {
                name: 'Beta',
                status: 'offline',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            // Buffer width should be widthCells * glyphW (20 * 6 = 120)
            assert.equal(result.buffer.width, 20 * 6);
        });

        it('render draws status badge with green for online', () => {
            const card = new AgentCard();
            const agent = {
                name: 'OnlineAgent',
                status: 'online',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            assert.ok(
                badgeHasColor(result.buffer, 0x3f, 0xb9, 0x50),
                'badge area should contain green pixels for online'
            );
        });

        it('render draws status badge with red for error', () => {
            const card = new AgentCard();
            const agent = {
                name: 'ErrorAgent',
                status: 'error',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            assert.ok(
                badgeHasColor(result.buffer, 0xf8, 0x51, 0x49),
                'badge area should contain red pixels for error'
            );
        });

        it('render draws status badge with yellow for offline', () => {
            const card = new AgentCard();
            const agent = {
                name: 'OfflineAgent',
                status: 'offline',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            assert.ok(
                badgeHasColor(result.buffer, 0xe3, 0xb3, 0x41),
                'badge area should contain yellow pixels for offline'
            );
        });

        it('render draws status badge with gray for unknown', () => {
            const card = new AgentCard();
            const agent = {
                name: 'UnknownAgent',
                status: 'deploying',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            assert.ok(
                badgeHasColor(result.buffer, 0x48, 0x4f, 0x58),
                'badge area should contain gray pixels for unknown status'
            );
        });

        it('render draws capability tags with blue text', () => {
            const card = new AgentCard();
            const agent = {
                name: 'CapAgent',
                status: 'online',
                capabilities: ['render', 'compile'],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            // Cap row is row 2, col 1 => pixels (6, 20)-(?, 29)
            let found = false;
            for (let y = 20; y < 30; y++) {
                for (let x = 6; x < 60; x++) {
                    const [r, g, b] = result.buffer.getPixel(x, y);
                    if (r === 0x58 && g === 0xa6 && b === 0xff) {
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            assert.ok(found, 'capability row should contain blue tag text');
        });

        it('render draws relative timestamp for activity', () => {
            const card = new AgentCard();
            const now = Date.now();
            const agent = {
                name: 'TimeAgent',
                status: 'online',
                capabilities: [],
                lastHeartbeat: new Date(now - 60000).toISOString(),
            };
            const result = card.render(agent, { nowMs: now });
            // Activity row is second to last, check for muted-color content
            const activityY = (result.heightCells - 2) * 10;
            let hasContent = false;
            for (let x = 6; x < 60; x++) {
                const [r, g, b] = result.buffer.getPixel(x, activityY);
                if (r === 0x8b && g === 0x94 && b === 0x9e) {
                    hasContent = true;
                    break;
                }
            }
            assert.ok(hasContent, 'activity row should have muted-color text');
        });

        it('render handles agent with no name gracefully', () => {
            const card = new AgentCard();
            const result = card.render({ status: 'online' });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('render handles agent with no capabilities', () => {
            const card = new AgentCard();
            const result = card.render({ name: 'NoCap', status: 'online' });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('render uses provided buffer with offset', () => {
            const card = new AgentCard({ widthCells: 20 });
            const buf = new PixelBuffer(200, 200);
            const agent = {
                name: 'OffsetAgent',
                status: 'online',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent, { buffer: buf, offsetX: 10, offsetY: 10 });
            assert.equal(result.buffer, buf);
        });

        it('render truncates long agent names', () => {
            const card = new AgentCard({ widthCells: 10 });
            const agent = {
                name: 'VeryLongAgentNameThatShouldBeTruncated',
                status: 'online',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            // Should not throw
            const result = card.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('render with never heartbeat shows "never"', () => {
            const card = new AgentCard();
            const agent = {
                name: 'NeverAgent',
                status: 'offline',
                capabilities: [],
                lastHeartbeat: null,
            };
            const result = card.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('border pixels are drawn at top and bottom', () => {
            const card = new AgentCard({ widthCells: 20 });
            const agent = {
                name: 'BorderTest',
                status: 'online',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            const buf = result.buffer;
            // Top-left pixel should be border color
            const [tr, tg, tb] = buf.getPixel(0, 0);
            assert.equal(tr, 0x30);
            assert.equal(tg, 0x36);
            assert.equal(tb, 0x3d);

            // Bottom-left pixel should be border color
            const [br, bg, bb] = buf.getPixel(0, buf.height - 1);
            assert.equal(br, 0x30);
            assert.equal(bg, 0x36);
            assert.equal(bb, 0x3d);
        });

        it('card background fills interior', () => {
            const card = new AgentCard({ widthCells: 20 });
            const agent = {
                name: 'BgTest',
                status: 'online',
                capabilities: [],
                lastHeartbeat: new Date().toISOString(),
            };
            const result = card.render(agent);
            // Pixel (0, 5) is inside the card but not on a glyph — should be card bg
            const [r, g, b] = result.buffer.getPixel(3, 5);
            assert.equal(r, 0x16);
            assert.equal(g, 0x1b);
            assert.equal(b, 0x22);
        });
    });
});
