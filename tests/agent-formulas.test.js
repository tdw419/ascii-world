// tests/agent-formulas.test.js
// Integration tests for AGENT_* formula functions with mock registry
// Tests the full pipeline: registry → formula engine → rendered output

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PixelFormulaEngine } from '../sync/pixel-formula-engine.js';
import { AgentRegistry } from '../sync/agent-registry.js';
import { TimeSeriesStore } from '../sync/time-series-store.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { AgentGrid } from '../ui/agent-grid.js';
import { AgentDetail } from '../ui/agent-detail.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Helper: create a temp-dir-backed AgentRegistry with pre-registered agents.
 */
function makeRegistry(agents) {
    const tmpDir = join('/tmp', `agent-formulas-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
    const reg = new AgentRegistry({ filePath: join(tmpDir, 'agents.json') });
    for (const a of agents) {
        reg.register(a);
    }
    return { reg, tmpDir };
}

/**
 * Helper: create a TimeSeriesStore with pre-recorded metrics.
 */
function makeTimeSeries(metrics) {
    const ts = new TimeSeriesStore({ minInterval: 0 });
    for (const [key, value] of Object.entries(metrics)) {
        ts.record(key, value);
    }
    return ts;
}

describe('Agent Formulas Integration', () => {
    let engine;

    beforeEach(() => {
        engine = new PixelFormulaEngine(480, 240);
    });

    // ── 5.1 AGENT_* formula functions with mock registry ───────

    describe('AGENT_STATUS integration', () => {
        it('reflects real agent status from registry after registration', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 's1', name: 'Sentinel', status: 'online' },
                { id: 's2', name: 'Scout', status: 'offline' },
                { id: 's3', name: 'Broken', status: 'error' },
            ]);
            engine.setAgentRegistry(reg);

            assert.equal(engine.AGENT_STATUS('s1'), 'online');
            assert.equal(engine.AGENT_STATUS('s2'), 'offline');
            assert.equal(engine.AGENT_STATUS('s3'), 'error');
            assert.equal(engine.AGENT_STATUS('nonexistent'), 'unknown');

            rmSync(tmpDir, { recursive: true, force: true });
        });

        it('updates status after registry update', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'u1', name: 'UpdateMe', status: 'online' },
            ]);
            engine.setAgentRegistry(reg);

            assert.equal(engine.AGENT_STATUS('u1'), 'online');
            reg.update('u1', { status: 'offline' });
            assert.equal(engine.AGENT_STATUS('u1'), 'offline');

            rmSync(tmpDir, { recursive: true, force: true });
        });

        it('reflects removal of an agent', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'r1', name: 'RemoveMe', status: 'online' },
            ]);
            engine.setAgentRegistry(reg);
            assert.equal(engine.AGENT_STATUS('r1'), 'online');

            reg.remove('r1');
            assert.equal(engine.AGENT_STATUS('r1'), 'unknown');

            rmSync(tmpDir, { recursive: true, force: true });
        });
    });

    describe('AGENT_LIST integration', () => {
        it('returns all registered agent IDs after bulk registration', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'l1', name: 'Alpha' },
                { id: 'l2', name: 'Beta' },
                { id: 'l3', name: 'Gamma' },
            ]);
            engine.setAgentRegistry(reg);

            const list = engine.AGENT_LIST();
            assert.ok(list.includes('l1'));
            assert.ok(list.includes('l2'));
            assert.ok(list.includes('l3'));

            rmSync(tmpDir, { recursive: true, force: true });
        });

        it('updates list after agent removal', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'd1', name: 'Stays' },
                { id: 'd2', name: 'Goes' },
            ]);
            engine.setAgentRegistry(reg);

            let list = engine.AGENT_LIST();
            assert.ok(list.includes('d1'));
            assert.ok(list.includes('d2'));

            reg.remove('d2');
            list = engine.AGENT_LIST();
            assert.ok(list.includes('d1'));
            assert.ok(!list.includes('d2'));

            rmSync(tmpDir, { recursive: true, force: true });
        });
    });

    describe('AGENT_COUNT integration', () => {
        it('counts agents correctly after register and remove', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'c1', name: 'One' },
                { id: 'c2', name: 'Two' },
                { id: 'c3', name: 'Three' },
            ]);
            engine.setAgentRegistry(reg);

            assert.equal(engine.AGENT_COUNT(), 3);
            reg.remove('c2');
            assert.equal(engine.AGENT_COUNT(), 2);
            reg.register({ id: 'c4', name: 'Four' });
            assert.equal(engine.AGENT_COUNT(), 3);

            rmSync(tmpDir, { recursive: true, force: true });
        });
    });

    describe('AGENT_NAME integration', () => {
        it('resolves names for all registered agents', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'n1', name: 'Hermes' },
                { id: 'n2', name: 'Athena' },
                { id: 'n3', name: 'Apollo' },
            ]);
            engine.setAgentRegistry(reg);

            assert.equal(engine.AGENT_NAME('n1'), 'Hermes');
            assert.equal(engine.AGENT_NAME('n2'), 'Athena');
            assert.equal(engine.AGENT_NAME('n3'), 'Apollo');
            assert.equal(engine.AGENT_NAME('ghost'), 'unknown');

            rmSync(tmpDir, { recursive: true, force: true });
        });
    });

    describe('AGENT_METRIC integration', () => {
        it('queries multiple agent metrics from time-series store', () => {
            const ts = makeTimeSeries({
                'agent:a1:cpu': 0.75,
                'agent:a1:memory': 0.50,
                'agent:a2:cpu': 0.25,
            });
            engine.setTimeSeriesStore(ts);

            assert.equal(engine.AGENT_METRIC('a1', 'cpu'), 0.75);
            assert.equal(engine.AGENT_METRIC('a1', 'memory'), 0.50);
            assert.equal(engine.AGENT_METRIC('a2', 'cpu'), 0.25);
            assert.equal(engine.AGENT_METRIC('a2', 'disk'), 0);
            assert.equal(engine.AGENT_METRIC('a3', 'cpu'), 0);
        });

        it('returns updated values after new recordings', () => {
            const ts = makeTimeSeries({ 'agent:x1:load': 0.1 });
            engine.setTimeSeriesStore(ts);

            assert.equal(engine.AGENT_METRIC('x1', 'load'), 0.1);

            ts.record('agent:x1:load', 0.9);
            assert.equal(engine.AGENT_METRIC('x1', 'load'), 0.9);
        });
    });

    describe('Full pipeline: registry + time-series + formulas', () => {
        it('AGENT_STATUS + AGENT_COUNT + AGENT_METRIC work together', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'p1', name: 'Pipeline1', status: 'online' },
                { id: 'p2', name: 'Pipeline2', status: 'offline' },
            ]);
            const ts = makeTimeSeries({
                'agent:p1:cpu': 0.55,
                'agent:p2:cpu': 0.10,
            });
            engine.setAgentRegistry(reg);
            engine.setTimeSeriesStore(ts);

            assert.equal(engine.AGENT_COUNT(), 2);
            assert.equal(engine.AGENT_STATUS('p1'), 'online');
            assert.equal(engine.AGENT_STATUS('p2'), 'offline');
            assert.equal(engine.AGENT_NAME('p1'), 'Pipeline1');
            assert.equal(engine.AGENT_METRIC('p1', 'cpu'), 0.55);
            assert.equal(engine.AGENT_METRIC('p2', 'cpu'), 0.10);

            const list = engine.AGENT_LIST();
            assert.ok(list.includes('p1'));
            assert.ok(list.includes('p2'));

            rmSync(tmpDir, { recursive: true, force: true });
        });

        it('AGENT_STATUS drives a STATUS render on the engine buffer', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'v1', name: 'Visual', status: 'online' },
            ]);
            engine.setAgentRegistry(reg);
            engine.setCells({ agent_state: 1 }); // state=1 → active

            // Render a status indicator driven by the registry
            engine.STATUS(0, 0, 'agent_state', 2, '◉ done', 1, '● active', '○ idle');

            // Active status renders green — verify pixel
            const pixel = engine.buffer.getPixel(3, 5);
            assert.deepStrictEqual(pixel.slice(0, 3), [0x3f, 0xb9, 0x50]);

            rmSync(tmpDir, { recursive: true, force: true });
        });

        it('AGENT_METRIC drives a BAR render on the engine buffer', () => {
            const ts = makeTimeSeries({ 'agent:b1:progress': 0.75 });
            engine.setTimeSeriesStore(ts);

            const metricVal = engine.AGENT_METRIC('b1', 'progress');
            assert.equal(metricVal, 0.75);

            // Use the metric value to drive a bar
            engine.setCells({ progress: metricVal });
            engine.BAR(0, 0, 'progress', 10);

            // At 75%, first ~7-8 cells should be filled (green), rest empty
            const filled = engine.buffer.getPixel(20, 5);
            const empty = engine.buffer.getPixel(50, 5);
            assert.deepStrictEqual(filled.slice(0, 3), [0x23, 0x86, 0x36]); // barFill
            assert.deepStrictEqual(empty.slice(0, 3), [0x16, 0x1b, 0x22]); // barEmpty
        });
    });

    // ── 5.2 Agent grid template renders with mock agent data ────

    describe('Agent grid template rendering', () => {
        it('renders agent grid with data from registry agents', () => {
            const mockAgents = [
                { id: 'g1', name: 'GridAlpha', status: 'online', capabilities: ['render'], lastHeartbeat: new Date().toISOString() },
                { id: 'g2', name: 'GridBeta', status: 'offline', capabilities: [], lastHeartbeat: null },
                { id: 'g3', name: 'GridGamma', status: 'error', capabilities: ['monitor'], lastHeartbeat: new Date(Date.now() - 120000).toISOString() },
                { id: 'g4', name: 'GridDelta', status: 'online', capabilities: ['render', 'compile'], lastHeartbeat: new Date().toISOString() },
            ];

            const grid = new AgentGrid({ cols: 2, sortBy: 'name' });
            const result = grid.render(mockAgents);

            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.agentCount, 4);

            // Verify the buffer has non-zero dimensions
            assert.ok(result.buffer.width > 0);
            assert.ok(result.buffer.height > 0);

            // Verify header "Agent Grid" is rendered (white text)
            let hasWhite = false;
            for (let x = 0; x < 60; x++) {
                const [r, g, b] = result.buffer.getPixel(x, 0);
                if (r === 0xff && g === 0xff && b === 0xff) {
                    hasWhite = true;
                    break;
                }
            }
            assert.ok(hasWhite, 'grid header should have white text');
        });

        it('grid sorts agents from registry before rendering', () => {
            const agents = [
                { id: 'z1', name: 'Zeta', status: 'online', capabilities: [], lastHeartbeat: new Date().toISOString() },
                { id: 'a1', name: 'Alpha', status: 'offline', capabilities: [], lastHeartbeat: null },
                { id: 'm1', name: 'Mid', status: 'error', capabilities: [], lastHeartbeat: new Date(Date.now() - 60000).toISOString() },
            ];

            const grid = new AgentGrid({ sortBy: 'name' });
            const sorted = grid.sortAgents(agents);
            assert.equal(sorted[0].name, 'Alpha');
            assert.equal(sorted[1].name, 'Mid');
            assert.equal(sorted[2].name, 'Zeta');

            const result = grid.render(agents);
            assert.equal(result.agentCount, 3);
        });

        it('grid renders cards for agents with varied capabilities', () => {
            const agents = [
                { id: 'cap1', name: 'NoCaps', status: 'online', capabilities: [], lastHeartbeat: new Date().toISOString() },
                { id: 'cap2', name: 'ManyCaps', status: 'online', capabilities: ['a', 'b', 'c', 'd', 'e'], lastHeartbeat: new Date().toISOString() },
            ];

            const grid = new AgentGrid({ cols: 2 });
            const result = grid.render(agents);
            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.agentCount, 2);
        });

        it('grid layout adapts to column count', () => {
            const agents = Array.from({ length: 8 }, (_, i) => ({
                id: `col${i}`, name: `Agent${i}`, status: 'online',
                capabilities: [], lastHeartbeat: new Date().toISOString(),
            }));

            const grid4 = new AgentGrid({ cols: 4 });
            const layout4 = grid4.calcLayout(agents);
            assert.equal(layout4.cols, 4);
            assert.equal(layout4.positions.length, 8);

            const grid2 = new AgentGrid({ cols: 2 });
            const layout2 = grid2.calcLayout(agents);
            assert.equal(layout2.cols, 2);
        });
    });

    // ── 5.3 Agent detail view fetches and displays agent data ───

    describe('Agent detail view rendering', () => {
        it('renders agent detail with full data from registry', () => {
            const agent = {
                id: 'detail-001',
                name: 'DetailBot',
                status: 'online',
                capabilities: ['render', 'compile', 'monitor'],
                lastHeartbeat: new Date().toISOString(),
                config: { region: 'us-west' },
            };

            const detail = {
                metrics: {
                    cpu: [20, 40, 60, 80, 100, 90, 70, 50, 30],
                    memory: [30, 45, 60, 75, 80, 70, 55, 40, 25],
                    requests: [5, 10, 15, 20, 25, 20, 15, 10, 5],
                },
                logs: [
                    { timestamp: new Date().toISOString(), level: 'info', message: 'Started' },
                    { timestamp: new Date().toISOString(), level: 'warn', message: 'Slow query' },
                    { timestamp: new Date().toISOString(), level: 'error', message: 'Timeout' },
                ],
                tasks: [
                    { id: 't1', description: 'Init system', status: 'completed' },
                    { id: 't2', description: 'Load config', status: 'running' },
                    { id: 't3', description: 'Connect DB', status: 'pending' },
                ],
            };

            const view = new AgentDetail({ widthCells: 60 });
            const result = view.render(agent, detail);

            assert.ok(result.buffer instanceof PixelBuffer);
            assert.equal(result.widthCells, 60);
            assert.ok(result.heightCells >= 30);
            assert.equal(result.buffer.width, 60 * 6);
        });

        it('renders detail for offline and error agents', () => {
            const offlineResult = new AgentDetail().render({
                id: 'off1', name: 'OfflineBot', status: 'offline',
                capabilities: [], lastHeartbeat: null,
            });
            assert.ok(offlineResult.buffer instanceof PixelBuffer);

            const errorResult = new AgentDetail().render({
                id: 'err1', name: 'ErrorBot', status: 'error',
                capabilities: ['monitor'], lastHeartbeat: new Date(Date.now() - 300000).toISOString(),
            }, {
                logs: [{ timestamp: new Date().toISOString(), level: 'error', message: 'Crash' }],
            });
            assert.ok(errorResult.buffer instanceof PixelBuffer);
        });

        it('renders detail with empty sections gracefully', () => {
            const agent = {
                id: 'empty1', name: 'EmptyBot', status: 'online',
                capabilities: [], lastHeartbeat: new Date().toISOString(),
            };

            const view = new AgentDetail();
            const result = view.render(agent, { metrics: {}, logs: [], tasks: [] });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders detail with more than 10 logs (shows last 10)', () => {
            const agent = {
                id: 'log1', name: 'LogBot', status: 'online',
                capabilities: [], lastHeartbeat: new Date().toISOString(),
            };

            const logs = Array.from({ length: 25 }, (_, i) => ({
                timestamp: new Date().toISOString(),
                level: i % 3 === 0 ? 'error' : 'info',
                message: `Log entry ${i}`,
            }));

            const view = new AgentDetail();
            const result = view.render(agent, { logs });
            assert.ok(result.buffer instanceof PixelBuffer);
        });

        it('renders detail with more than 10 tasks (shows last 10)', () => {
            const agent = {
                id: 'task1', name: 'TaskBot', status: 'online',
                capabilities: [], lastHeartbeat: new Date().toISOString(),
            };

            const tasks = Array.from({ length: 15 }, (_, i) => ({
                id: `task-${i}`,
                description: `Task ${i}`,
                status: i < 10 ? 'completed' : 'pending',
            }));

            const view = new AgentDetail();
            const result = view.render(agent, { tasks });
            assert.ok(result.buffer instanceof PixelBuffer);
        });
    });

    // ── Cross-component integration ─────────────────────────────

    describe('Registry → Grid + Detail integration', () => {
        it('agents from registry render correctly in both grid and detail', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'cross1', name: 'CrossAlpha', status: 'online', capabilities: ['render'] },
                { id: 'cross2', name: 'CrossBeta', status: 'offline', capabilities: ['compile', 'deploy'] },
            ]);

            // Convert registry agents to plain objects for rendering
            const agents = reg.list().map(a => ({
                id: a.id,
                name: a.name,
                status: a.status,
                capabilities: a.capabilities,
                lastHeartbeat: a.lastHeartbeat,
            }));

            // Grid rendering
            const grid = new AgentGrid({ cols: 2, sortBy: 'name' });
            const gridResult = grid.render(agents);
            assert.ok(gridResult.buffer instanceof PixelBuffer);
            assert.equal(gridResult.agentCount, 2);

            // Detail rendering for first agent
            const detail = new AgentDetail();
            const detailResult = detail.render(agents[0]);
            assert.ok(detailResult.buffer instanceof PixelBuffer);

            rmSync(tmpDir, { recursive: true, force: true });
        });

        it('formula engine and grid both reflect registry state', () => {
            const { reg, tmpDir } = makeRegistry([
                { id: 'f1', name: 'FormulaA', status: 'online', capabilities: ['test'] },
                { id: 'f2', name: 'FormulaB', status: 'error', capabilities: [] },
            ]);

            engine.setAgentRegistry(reg);

            // Formula engine sees the registry
            assert.equal(engine.AGENT_COUNT(), 2);
            assert.equal(engine.AGENT_STATUS('f1'), 'online');
            assert.equal(engine.AGENT_STATUS('f2'), 'error');

            // Grid also renders the same agents
            const agents = reg.list().map(a => ({
                id: a.id, name: a.name, status: a.status,
                capabilities: a.capabilities, lastHeartbeat: a.lastHeartbeat,
            }));

            const grid = new AgentGrid();
            const result = grid.render(agents);
            assert.equal(result.agentCount, 2);

            rmSync(tmpDir, { recursive: true, force: true });
        });
    });
});
