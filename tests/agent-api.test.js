// tests/agent-api.test.js
// Tests for Agent Registry REST API endpoints

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { PxOSServer } from '../sync/server.js';
import { TimeSeriesStore } from '../sync/time-series-store.js';

const TEST_PORT = 13839;
const BASE = `http://localhost:${TEST_PORT}`;
const TMP_DATA_DIR = join('/tmp', `agent-api-test-${Date.now()}`);

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch {}
                resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
            });
        });
        req.on('error', reject);
        if (body !== undefined) req.write(JSON.stringify(body));
        req.end();
    });
}

describe('Agent Registry REST API', () => {
    let server;

    before(async () => {
        mkdirSync(TMP_DATA_DIR, { recursive: true });
        server = new PxOSServer(TEST_PORT);
        // Override the agentRegistry to use a temp file so we don't pollute real data
        const { AgentRegistry } = await import('../sync/agent-registry.js');
        server.agentRegistry = new AgentRegistry({ filePath: join(TMP_DATA_DIR, 'agents.json') });
        // Override timeSeriesStore with no minInterval for fast test writes
        server.timeSeriesStore = new TimeSeriesStore({ maxPoints: 1000, minInterval: 0 });
        await server.start();
    });

    after(async () => {
        await server.stop();
        rmSync(TMP_DATA_DIR, { recursive: true, force: true });
    });

    describe('POST /api/v1/agents', () => {
        it('registers a new agent and returns 201', async () => {
            const res = await request('POST', '/api/v1/agents', { name: 'TestBot' });
            assert.equal(res.status, 201);
            assert.ok(res.body.id);
            assert.equal(res.body.name, 'TestBot');
            assert.equal(res.body.status, 'offline');
            assert.ok(Array.isArray(res.body.capabilities));
        });

        it('returns 400 for invalid data', async () => {
            const res = await request('POST', '/api/v1/agents', {});
            assert.equal(res.status, 400);
            assert.ok(res.body.error);
        });

        it('accepts capabilities and config', async () => {
            const res = await request('POST', '/api/v1/agents', {
                name: 'CapBot',
                capabilities: ['monitor', 'alert'],
                config: { region: 'us-east' },
            });
            assert.equal(res.status, 201);
            assert.deepStrictEqual(res.body.capabilities, ['monitor', 'alert']);
            assert.deepStrictEqual(res.body.config, { region: 'us-east' });
        });
    });

    describe('GET /api/v1/agents', () => {
        it('returns all registered agents', async () => {
            // Register two agents
            await request('POST', '/api/v1/agents', { name: 'ListA' });
            await request('POST', '/api/v1/agents', { name: 'ListB' });

            const res = await request('GET', '/api/v1/agents');
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.body));
            const names = res.body.map(a => a.name);
            assert.ok(names.includes('ListA'));
            assert.ok(names.includes('ListB'));
        });
    });

    describe('GET /api/v1/agents/:id', () => {
        it('returns a specific agent', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'GetMe' });
            const res = await request('GET', `/api/v1/agents/${created.body.id}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.name, 'GetMe');
            assert.equal(res.body.id, created.body.id);
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('GET', '/api/v1/agents/no-such-agent');
            assert.equal(res.status, 404);
        });
    });

    describe('PUT /api/v1/agents/:id/heartbeat', () => {
        it('records a heartbeat and returns 200', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'Beater' });
            const res = await request('PUT', `/api/v1/agents/${created.body.id}/heartbeat`);
            assert.equal(res.status, 200);
            assert.equal(res.body.ok, true);

            // Verify agent is now online
            const agent = await request('GET', `/api/v1/agents/${created.body.id}`);
            assert.equal(agent.body.status, 'online');
            assert.ok(agent.body.lastHeartbeat);
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('PUT', '/api/v1/agents/ghost/heartbeat');
            assert.equal(res.status, 404);
        });
    });

    describe('DELETE /api/v1/agents/:id', () => {
        it('deletes an agent and returns 204', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'DeleteMe' });
            const res = await request('DELETE', `/api/v1/agents/${created.body.id}`);
            assert.equal(res.status, 204);

            // Verify it's gone
            const check = await request('GET', `/api/v1/agents/${created.body.id}`);
            assert.equal(check.status, 404);
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('DELETE', '/api/v1/agents/phantom');
            assert.equal(res.status, 404);
        });
    });

    describe('GET /api/v1/agents after operations', () => {
        it('reflects heartbeat status in list', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'ListHB' });
            await request('PUT', `/api/v1/agents/${created.body.id}/heartbeat`);
            const list = await request('GET', '/api/v1/agents');
            const found = list.body.find(a => a.id === created.body.id);
            assert.ok(found);
            assert.equal(found.status, 'online');
        });

        it('returns empty array after all agents deleted', async () => {
            const a1 = await request('POST', '/api/v1/agents', { name: 'Tmp1' });
            const a2 = await request('POST', '/api/v1/agents', { name: 'Tmp2' });
            await request('DELETE', `/api/v1/agents/${a1.body.id}`);
            await request('DELETE', `/api/v1/agents/${a2.body.id}`);
            const list = await request('GET', '/api/v1/agents');
            const remaining = list.body.filter(a => a.id === a1.body.id || a.id === a2.body.id);
            assert.equal(remaining.length, 0);
        });
    });

    describe('POST /api/v1/agents/:id/metrics', () => {
        it('accepts a metric and returns 201', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'MetricBot' });
            const res = await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'cpu', value: 0.72,
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.ok, true);
            assert.equal(res.body.key, 'cpu');
        });

        it('rejects missing key', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'NoKeyBot' });
            const res = await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                value: 42,
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('key'));
        });

        it('rejects missing value', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'NoValBot' });
            const res = await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'mem',
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('value'));
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('POST', '/api/v1/agents/ghost-agent/metrics', {
                key: 'cpu', value: 0.5,
            });
            assert.equal(res.status, 404);
        });

        it('stores multiple metrics for same agent', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'MultiMetric' });
            await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'cpu', value: 0.5,
            });
            await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'mem', value: 0.8,
            });
            // Retrieve and verify both are present
            const getRes = await request('GET', `/api/v1/agents/${created.body.id}/metrics`);
            assert.equal(getRes.status, 200);
            assert.equal(getRes.body.metrics.cpu, 0.5);
            assert.equal(getRes.body.metrics.mem, 0.8);
        });

        it('accepts numeric, string, and boolean values', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'ValTypes' });
            const r1 = await request('POST', `/api/v1/agents/${created.body.id}/metrics`, { key: 'num', value: 42 });
            assert.equal(r1.status, 201);
            const r2 = await request('POST', `/api/v1/agents/${created.body.id}/metrics`, { key: 'str', value: 'ok' });
            assert.equal(r2.status, 201);
            const r3 = await request('POST', `/api/v1/agents/${created.body.id}/metrics`, { key: 'bool', value: true });
            assert.equal(r3.status, 201);
        });
    });

    describe('GET /api/v1/agents/:id/metrics', () => {
        it('returns latest values for all agent metrics', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'GetMetrics' });
            await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'cpu', value: 0.3,
            });
            await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'cpu', value: 0.7,
            });
            const res = await request('GET', `/api/v1/agents/${created.body.id}/metrics`);
            assert.equal(res.status, 200);
            assert.equal(res.body.agentId, created.body.id);
            assert.equal(res.body.metrics.cpu, 0.7); // latest value
        });

        it('returns empty metrics object for agent with no metrics', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'EmptyMetrics' });
            const res = await request('GET', `/api/v1/agents/${created.body.id}/metrics`);
            assert.equal(res.status, 200);
            assert.deepStrictEqual(res.body.metrics, {});
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('GET', '/api/v1/agents/no-such-agent/metrics');
            assert.equal(res.status, 404);
        });
    });

    describe('GET /api/v1/agents/:id/metrics/:key/history', () => {
        it('returns time-series history for a specific metric', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'HistoryBot' });
            await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'cpu', value: 0.1,
            });
            await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'cpu', value: 0.2,
            });
            await request('POST', `/api/v1/agents/${created.body.id}/metrics`, {
                key: 'cpu', value: 0.3,
            });
            const res = await request('GET', `/api/v1/agents/${created.body.id}/metrics/cpu/history`);
            assert.equal(res.status, 200);
            assert.equal(res.body.agentId, created.body.id);
            assert.equal(res.body.key, 'cpu');
            assert.equal(res.body.history.length, 3);
            assert.equal(res.body.history[0].v, 0.1);
            assert.equal(res.body.history[1].v, 0.2);
            assert.equal(res.body.history[2].v, 0.3);
            // Each point should have a timestamp
            assert.ok(res.body.history[0].t > 0);
        });

        it('returns empty history for unknown metric key', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'NoHistory' });
            const res = await request('GET', `/api/v1/agents/${created.body.id}/metrics/nonexistent/history`);
            assert.equal(res.status, 200);
            assert.deepStrictEqual(res.body.history, []);
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('GET', '/api/v1/agents/no-such-agent/metrics/cpu/history');
            assert.equal(res.status, 404);
        });

        it('isolates metrics between different agents', async () => {
            const a1 = await request('POST', '/api/v1/agents', { name: 'Isolated1' });
            const a2 = await request('POST', '/api/v1/agents', { name: 'Isolated2' });
            await request('POST', `/api/v1/agents/${a1.body.id}/metrics`, {
                key: 'cpu', value: 0.9,
            });
            await request('POST', `/api/v1/agents/${a2.body.id}/metrics`, {
                key: 'cpu', value: 0.1,
            });
            const h1 = await request('GET', `/api/v1/agents/${a1.body.id}/metrics/cpu/history`);
            const h2 = await request('GET', `/api/v1/agents/${a2.body.id}/metrics/cpu/history`);
            assert.equal(h1.body.history[0].v, 0.9);
            assert.equal(h2.body.history[0].v, 0.1);
        });
    });

    describe('POST /api/v1/agents/:id/logs', () => {
        it('appends a log entry and returns 201', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'LogBot' });
            const res = await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'error', message: 'something broke',
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.level, 'error');
            assert.equal(res.body.message, 'something broke');
            assert.ok(res.body.timestamp > 0);
        });

        it('defaults level to info', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'DefaultLevel' });
            const res = await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                message: 'just info',
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.level, 'info');
        });

        it('rejects missing message', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'NoMsg' });
            const res = await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'info',
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('message'));
        });

        it('rejects invalid level', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'BadLevel' });
            const res = await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'debug', message: 'test',
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('level'));
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('POST', '/api/v1/agents/ghost/logs', {
                level: 'info', message: 'nobody home',
            });
            assert.equal(res.status, 404);
        });
    });

    describe('GET /api/v1/agents/:id/logs', () => {
        it('returns log entries for an agent', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'LogReader' });
            await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'info', message: 'first',
            });
            await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'error', message: 'second',
            });
            const res = await request('GET', `/api/v1/agents/${created.body.id}/logs`);
            assert.equal(res.status, 200);
            assert.equal(res.body.agentId, created.body.id);
            assert.equal(res.body.logs.length, 2);
            assert.equal(res.body.logs[0].message, 'first');
            assert.equal(res.body.logs[1].message, 'second');
        });

        it('respects limit parameter', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'Limited' });
            for (let i = 0; i < 10; i++) {
                await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                    message: `msg-${i}`,
                });
            }
            const res = await request('GET', `/api/v1/agents/${created.body.id}/logs?limit=3`);
            assert.equal(res.status, 200);
            assert.equal(res.body.logs.length, 3);
            assert.equal(res.body.logs[0].message, 'msg-7');
            assert.equal(res.body.logs[2].message, 'msg-9');
        });

        it('filters by level', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'FilterBot' });
            await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'error', message: 'e1',
            });
            await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'info', message: 'i1',
            });
            await request('POST', `/api/v1/agents/${created.body.id}/logs`, {
                level: 'error', message: 'e2',
            });

            const res = await request('GET', `/api/v1/agents/${created.body.id}/logs?level=error`);
            assert.equal(res.status, 200);
            assert.equal(res.body.logs.length, 2);
            assert.equal(res.body.logs[0].message, 'e1');
            assert.equal(res.body.logs[1].message, 'e2');
        });

        it('returns empty logs for agent with no logs', async () => {
            const created = await request('POST', '/api/v1/agents', { name: 'NoLogs' });
            const res = await request('GET', `/api/v1/agents/${created.body.id}/logs`);
            assert.equal(res.status, 200);
            assert.deepStrictEqual(res.body.logs, []);
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('GET', '/api/v1/agents/no-such/logs');
            assert.equal(res.status, 404);
        });
    });
});
