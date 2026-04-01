// tests/agent-detail.test.js
// Tests for ui/agent-detail.js — Agent Detail View

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentDetail } from '../ui/agent-detail.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';

const FIXTURE_AGENT = {
    id: 'agent-001',
    name: 'TestBot',
    status: 'online',
    capabilities: ['render', 'compile'],
    lastHeartbeat: new Date().toISOString(),
    config: { region: 'us-east' },
    createdAt: new Date().toISOString(),
};

const FIXTURE_METRICS = {
    cpu: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 95, 85, 75, 65, 55, 45, 35, 25, 15, 5],
    memory: [50, 55, 60, 65, 70, 75, 80, 85, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35],
    requests: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
};

const FIXTURE_LOGS = [
    { timestamp: new Date().toISOString(), level: 'info', message: 'Started successfully' },
    { timestamp: new Date().toISOString(), level: 'warn', message: 'High memory usage' },
    { timestamp: new Date().toISOString(), level: 'error', message: 'Connection failed' },
    { timestamp: new Date().toISOString(), level: 'info', message: 'Retrying connection' },
    { timestamp: new Date().toISOString(), level: 'info', message: 'Connection restored' },
    { timestamp: new Date().toISOString(), level: 'debug', message: 'Cache cleared' },
    { timestamp: new Date().toISOString(), level: 'info', message: 'Task completed' },
    { timestamp: new Date().toISOString(), level: 'warn', message: 'Slow response time' },
    { timestamp: new Date().toISOString(), level: 'info', message: 'Health check passed' },
    { timestamp: new Date().toISOString(), level: 'info', message: 'Shutdown initiated' },
];

const FIXTURE_TASKS = [
    { id: 't1', description: 'Compile shaders', status: 'completed' },
    { id: 't2', description: 'Render frame', status: 'completed' },
    { id: 't3', description: 'Upload results', status: 'running' },
    { id: 't4', description: 'Clean cache', status: 'pending' },
    { id: 't5', description: 'Generate report', status: 'completed' },
    { id: 't6', description: 'Sync data', status: 'failed' },
    { id: 't7', description: 'Validate output', status: 'completed' },
    { id: 't8', description: 'Compress assets', status: 'pending' },
    { id: 't9', description: 'Deploy build', status: 'running' },
    { id: 't10', description: 'Run tests', status: 'pending' },
];

describe('AgentDetail', () => {

    // ── Constructor ────────────────────────────────────────────

    describe('constructor', () => {
        it('creates detail view with default width', () => {
            const detail = new AgentDetail();
            assert.equal(detail.widthCells, 60);
        });

        it('creates detail view with custom width', () => {
            const detail = new AgentDetail({ widthCells: 80 });
            assert.equal(detail.widthCells, 80);
        });
    });

    // ── calcHeight ─────────────────────────────────────────────

    describe('calcHeight()', () => {
        it('returns consistent height value', () => {
            const detail = new AgentDetail();
            const h = detail.calcHeight();
            // Must account for all sections + borders + gaps
            // 1 + 3 + 1 + 4 + 1 + 12 + 1 + 12 + 1 = 36
            assert.ok(h >= 30, `height should be >= 30, got ${h}`);
        });

        it('height is deterministic', () => {
            const detail = new AgentDetail();
            assert.equal(detail.calcHeight(), detail.calcHeight());
        });
    });

    // ── render ─────────────────────────────────────────────────

    describe('render()', () => {
        it('returns a PixelBuffer with correct dimensions', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT);
            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.widthCells, 60);
            assert.ok(result.heightCells >= 30);
        });

        it('buffer width matches widthCells * glyphW', () => {
            const detail = new AgentDetail({ widthCells: 60 });
            const result = detail.render(FIXTURE_AGENT);
            assert.equal(result.buffer.width, 60 * 6);
        });

        it('buffer height matches heightCells * glyphH', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT);
            assert.equal(result.buffer.height, result.heightCells * 10);
        });

        it('renders agent name in header', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT);
            const buf = result.buffer;
            // Name area is at row 2 (headerY + cellH = 2*cellH = y=20)
            // Scan broader area for white pixels in the header region
            let foundWhite = false;
            for (let y = 10; y < 40; y++) {
                for (let x = 6; x < 120; x++) {
                    const [r, g, b] = buf.getPixel(x, y);
                    if (r === 0xff && g === 0xff && b === 0xff) {
                        foundWhite = true;
                        break;
                    }
                }
                if (foundWhite) break;
            }
            assert.ok(foundWhite, 'header should contain white pixels for agent name');
        });

        it('renders status badge with green for online agent', () => {
            const detail = new AgentDetail();
            const result = detail.render({ ...FIXTURE_AGENT, status: 'online' });
            const buf = result.buffer;
            // Badge at row 2: x=6..12, y=20..30 (headerY + cellH = 2*10 = 20)
            let foundGreen = false;
            for (let y = 10; y < 40; y++) {
                for (let x = 6; x < 18; x++) {
                    const [r, g, b] = buf.getPixel(x, y);
                    if (r === 0x3f && g === 0xb9 && b === 0x50) {
                        foundGreen = true;
                        break;
                    }
                }
                if (foundGreen) break;
            }
            assert.ok(foundGreen, 'badge should be green for online agent');
        });

        it('renders status badge with red for error agent', () => {
            const detail = new AgentDetail();
            const result = detail.render({ ...FIXTURE_AGENT, status: 'error' });
            const buf = result.buffer;
            let foundRed = false;
            for (let y = 10; y < 40; y++) {
                for (let x = 6; x < 18; x++) {
                    const [r, g, b] = buf.getPixel(x, y);
                    if (r === 0xf8 && g === 0x51 && b === 0x49) {
                        foundRed = true;
                        break;
                    }
                }
                if (foundRed) break;
            }
            assert.ok(foundRed, 'badge should be red for error agent');
        });

        it('renders agent with no capabilities', () => {
            const detail = new AgentDetail();
            const agent = { ...FIXTURE_AGENT, capabilities: [] };
            const result = detail.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders agent with no heartbeat', () => {
            const detail = new AgentDetail();
            const agent = { ...FIXTURE_AGENT, lastHeartbeat: null };
            const result = detail.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders agent with no name', () => {
            const detail = new AgentDetail();
            const agent = { status: 'online' };
            const result = detail.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('draws top and bottom border lines', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT);
            const buf = result.buffer;
            // Top-left pixel should be border
            const [tr, tg, tb] = buf.getPixel(0, 0);
            assert.equal(tr, 0x30);
            assert.equal(tg, 0x36);
            assert.equal(tb, 0x3d);
            // Bottom-left pixel should be border
            const [br, bg, bb] = buf.getPixel(0, buf.height - 1);
            assert.equal(br, 0x30);
            assert.equal(bg, 0x36);
            assert.equal(bb, 0x3d);
        });

        it('background fills the buffer', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT);
            const buf = result.buffer;
            // A pixel in the gap between sections should be background
            // Check at a spot unlikely to be text/border
            const [r, g, b] = buf.getPixel(3, 3);
            assert.equal(r, 0x0d);
            assert.equal(g, 0x11);
            assert.equal(b, 0x17);
        });

        it('uses provided buffer with offset', () => {
            const detail = new AgentDetail({ widthCells: 60 });
            const buf = new PixelBuffer(400, 400);
            const result = detail.render(FIXTURE_AGENT, {}, { buffer: buf, offsetX: 10, offsetY: 10 });
            assert.equal(result.buffer, buf);
        });

        it('handles nowMs option for deterministic timestamps', () => {
            const detail = new AgentDetail();
            const now = Date.now();
            const result = detail.render(FIXTURE_AGENT, {}, { nowMs: now });
            assert.ok(result.buffer instanceof PixelBuffer);
        });
    });

    // ── render with full detail ────────────────────────────────

    describe('render() with detail data', () => {
        it('renders with metrics sparklines', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, { metrics: FIXTURE_METRICS });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders with log entries', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, { logs: FIXTURE_LOGS });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders with task history', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, { tasks: FIXTURE_TASKS });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders with all sections populated', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, {
                metrics: FIXTURE_METRICS,
                logs: FIXTURE_LOGS,
                tasks: FIXTURE_TASKS,
            });
            assert.ok(result.buffer instanceof PixelBuffer);
        });
    });

    // ── renderSparklines ───────────────────────────────────────

    describe('renderSparklines()', () => {
        it('renders sparklines section with metrics', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 4 * cellH);
            detail.renderSparklines(buf, 0, 0, FIXTURE_METRICS);
            // Should have green sparkline bars
            let foundGreen = false;
            for (let x = 0; x < buf.width; x++) {
                for (let y = 0; y < buf.height; y++) {
                    const [r, g, b] = buf.getPixel(x, y);
                    if (r === 0x3f && g === 0xb9 && b === 0x50) {
                        foundGreen = true;
                        break;
                    }
                }
                if (foundGreen) break;
            }
            assert.ok(foundGreen, 'sparkline section should have green bars');
        });

        it('renders section label "Metrics"', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 4 * cellH);
            detail.renderSparklines(buf, 0, 0, FIXTURE_METRICS);
            // Check for blue label pixels in first row
            let foundBlue = false;
            for (let x = 6; x < 50; x++) {
                const [r, g, b] = buf.getPixel(x, 10);
                if (r === 0x58 && g === 0xa6 && b === 0xff) {
                    foundBlue = true;
                    break;
                }
            }
            assert.ok(foundBlue, 'sparkline section should have blue "Metrics" label');
        });

        it('handles empty metrics', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 4 * cellH);
            // Should not throw
            detail.renderSparklines(buf, 0, 0, {});
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles non-array metric values', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 4 * cellH);
            // Should not throw
            detail.renderSparklines(buf, 0, 0, { cpu: 'not-an-array' });
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles single value in metrics', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 4 * cellH);
            detail.renderSparklines(buf, 0, 0, { cpu: [42] });
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles more than 3 metrics (renders first 3)', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 4 * cellH);
            const metrics = {
                cpu: [1, 2, 3],
                memory: [4, 5, 6],
                disk: [7, 8, 9],
                network: [10, 11, 12],
            };
            // Should not throw — only first 3 rendered
            detail.renderSparklines(buf, 0, 0, metrics);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('draws top and bottom borders', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 4 * cellH);
            detail.renderSparklines(buf, 0, 0, { cpu: [50] });
            const [tr, tg, tb] = buf.getPixel(0, 0);
            assert.equal(tr, 0x30);
            assert.equal(tg, 0x36);
            assert.equal(tb, 0x3d);
            const [br, bg, bb] = buf.getPixel(0, buf.height - 1);
            assert.equal(br, 0x30);
            assert.equal(bg, 0x36);
            assert.equal(bb, 0x3d);
        });
    });

    // ── renderLogs ─────────────────────────────────────────────

    describe('renderLogs()', () => {
        it('renders log section with entries', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderLogs(buf, 0, 0, FIXTURE_LOGS);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('renders "Recent Logs" label', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderLogs(buf, 0, 0, FIXTURE_LOGS);
            // Check for blue label in first row
            let foundBlue = false;
            for (let x = 6; x < 80; x++) {
                const [r, g, b] = buf.getPixel(x, 10);
                if (r === 0x58 && g === 0xa6 && b === 0xff) {
                    foundBlue = true;
                    break;
                }
            }
            assert.ok(foundBlue, 'logs section should have blue label');
        });

        it('renders log message text', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderLogs(buf, 0, 0, FIXTURE_LOGS);
            // Check for light gray log text in rows 2-11
            let foundText = false;
            for (let y = 20; y < 120; y++) {
                for (let x = 42; x < 100; x++) {
                    const [r, g, b] = buf.getPixel(x, y);
                    if (r === 0xc9 && g === 0xd1 && b === 0xd9) {
                        foundText = true;
                        break;
                    }
                }
                if (foundText) break;
            }
            assert.ok(foundText, 'log entries should have text pixels');
        });

        it('handles empty logs array', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderLogs(buf, 0, 0, []);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles non-array logs', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderLogs(buf, 0, 0, null);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles more than 10 logs (shows last 10)', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            const manyLogs = Array.from({ length: 15 }, (_, i) => ({
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `Log entry ${i}`,
            }));
            detail.renderLogs(buf, 0, 0, manyLogs);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles log entry with missing fields', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderLogs(buf, 0, 0, [{}, { message: 'hello' }, { level: 'error' }]);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('draws top and bottom borders', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderLogs(buf, 0, 0, FIXTURE_LOGS);
            const [tr, tg, tb] = buf.getPixel(0, 0);
            assert.equal(tr, 0x30);
            const [br, bg, bb] = buf.getPixel(0, buf.height - 1);
            assert.equal(br, 0x30);
        });
    });

    // ── renderTasks ────────────────────────────────────────────

    describe('renderTasks()', () => {
        it('renders task section with entries', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderTasks(buf, 0, 0, FIXTURE_TASKS);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('renders "Task History" label', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderTasks(buf, 0, 0, FIXTURE_TASKS);
            // Check for blue label
            let foundBlue = false;
            for (let x = 6; x < 90; x++) {
                const [r, g, b] = buf.getPixel(x, 10);
                if (r === 0x58 && g === 0xa6 && b === 0xff) {
                    foundBlue = true;
                    break;
                }
            }
            assert.ok(foundBlue, 'task section should have blue label');
        });

        it('renders task description text', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderTasks(buf, 0, 0, FIXTURE_TASKS);
            // Check for purple task text
            let foundPurple = false;
            for (let y = 20; y < 120; y++) {
                for (let x = 6; x < 100; x++) {
                    const [r, g, b] = buf.getPixel(x, y);
                    if (r === 0xd2 && g === 0xa8 && b === 0xff) {
                        foundPurple = true;
                        break;
                    }
                }
                if (foundPurple) break;
            }
            assert.ok(foundPurple, 'task entries should have purple text');
        });

        it('handles empty tasks array', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderTasks(buf, 0, 0, []);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles non-array tasks', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderTasks(buf, 0, 0, undefined);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles more than 10 tasks (shows last 10)', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            const manyTasks = Array.from({ length: 15 }, (_, i) => ({
                id: `t${i}`,
                description: `Task ${i}`,
                status: 'pending',
            }));
            detail.renderTasks(buf, 0, 0, manyTasks);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('handles task with missing fields', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderTasks(buf, 0, 0, [{}, { id: 'x' }, { description: 'hello' }]);
            assert.ok(buf instanceof PixelBuffer);
        });

        it('draws top and bottom borders', () => {
            const detail = new AgentDetail();
            const cellW = detail.atlas.glyphW;
            const cellH = detail.atlas.glyphH;
            const buf = new PixelBuffer(detail.widthCells * cellW, 12 * cellH);
            detail.renderTasks(buf, 0, 0, FIXTURE_TASKS);
            const [tr] = buf.getPixel(0, 0);
            assert.equal(tr, 0x30);
            const [br] = buf.getPixel(0, buf.height - 1);
            assert.equal(br, 0x30);
        });
    });

    // ── render edge cases ──────────────────────────────────────

    describe('render() edge cases', () => {
        it('handles empty detail object', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, {});
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('handles undefined detail', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, undefined);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('handles null detail', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, null);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('handles agent with very long name', () => {
            const detail = new AgentDetail({ widthCells: 20 });
            const agent = { ...FIXTURE_AGENT, name: 'A'.repeat(200) };
            const result = detail.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('handles agent with many capabilities', () => {
            const detail = new AgentDetail({ widthCells: 30 });
            const agent = {
                ...FIXTURE_AGENT,
                capabilities: Array.from({ length: 20 }, (_, i) => `capability_${i}`),
            };
            const result = detail.render(agent);
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders offline status badge', () => {
            const detail = new AgentDetail();
            const result = detail.render({ ...FIXTURE_AGENT, status: 'offline' });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders unknown status badge', () => {
            const detail = new AgentDetail();
            const result = detail.render({ ...FIXTURE_AGENT, status: 'deploying' });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders with all empty data sections', () => {
            const detail = new AgentDetail();
            const result = detail.render(FIXTURE_AGENT, {
                metrics: {},
                logs: [],
                tasks: [],
            });
            assert.ok(result.buffer instanceof PixelBuffer);
        });
    });
});
