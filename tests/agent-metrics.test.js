// tests/agent-metrics.test.js
// Tests for agent metric ingestion, retrieval, and history endpoints

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { PxOSServer } from '../sync/server.js';
import { AgentRegistry } from '../sync/agent-registry.js';
import { TimeSeriesStore } from '../sync/time-series-store.js';
import { AuditTrail } from '../sync/audit-trail.js';

const TEST_PORT = 13841;
const BASE = `http://localhost:${TEST_PORT}`;
const TMP = join('/tmp', `agent-metrics-test-${Date.now()}`);

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

describe('Agent Metrics API', () => {
    let server;
    let agentId;

    before(async () => {
        mkdirSync(TMP, { recursive: true });
        server = new PxOSServer(TEST_PORT);
        server.agentRegistry = new AgentRegistry({ filePath: join(TMP, 'agents.json') });
        server.timeSeriesStore = new TimeSeriesStore({ maxPoints: 1000, minInterval: 0 });
        server.auditTrail = new AuditTrail({ filePath: join(TMP, 'audit.jsonl') });
        await server.start();
        // Register a test agent
        const reg = await request('POST', '/api/v1/agents', { name: 'MetricsTestBot' });
        agentId = reg.body.id;
    });

    after(async () => {
        await server.stop();
        rmSync(TMP, { recursive: true, force: true });
    });

    describe('POST /api/v1/agents/:id/metrics (ingestion)', () => {
        it('accepts a numeric metric', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                key: 'cpu', value: 0.75,
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.ok, true);
            assert.equal(res.body.key, 'cpu');
        });

        it('accepts a zero value', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                key: 'zero_metric', value: 0,
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.ok, true);
        });

        it('accepts a negative value', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                key: 'delta', value: -3.14,
            });
            assert.equal(res.status, 201);
        });

        it('accepts a string value', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                key: 'status', value: 'healthy',
            });
            assert.equal(res.status, 201);
        });

        it('accepts a boolean value', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                key: 'alive', value: false,
            });
            assert.equal(res.status, 201);
        });

        it('rejects missing key', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                value: 42,
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('key'));
        });

        it('rejects null value', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                key: 'bad', value: null,
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('value'));
        });

        it('rejects missing value', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/metrics`, {
                key: 'orphan',
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('value'));
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('POST', '/api/v1/agents/nonexistent/metrics', {
                key: 'cpu', value: 0.5,
            });
            assert.equal(res.status, 404);
        });

        it('returns 400 for invalid JSON', async () => {
            const res = await new Promise((resolve, reject) => {
                const url = new URL(`/api/v1/agents/${agentId}/metrics`, BASE);
                const req = http.request({
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => (data += chunk));
                    res.on('end', () => {
                        let parsed = null;
                        try { parsed = JSON.parse(data); } catch {}
                        resolve({ status: res.statusCode, body: parsed });
                    });
                });
                req.on('error', reject);
                req.write('not valid json');
                req.end();
            });
            assert.equal(res.status, 400);
        });

        it('overwrites previous value for same key', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'OverwriteBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'temp', value: 10 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'temp', value: 20 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'temp', value: 30 });
            const getRes = await request('GET', `/api/v1/agents/${id}/metrics`);
            assert.equal(getRes.body.metrics.temp, 30);
        });
    });

    describe('GET /api/v1/agents/:id/metrics (retrieval)', () => {
        it('returns latest values for all metrics', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'RetrievalBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.4 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'mem', value: 0.6 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'disk', value: 0.8 });

            const res = await request('GET', `/api/v1/agents/${id}/metrics`);
            assert.equal(res.status, 200);
            assert.equal(res.body.agentId, id);
            assert.equal(Object.keys(res.body.metrics).length, 3);
            assert.equal(res.body.metrics.cpu, 0.4);
            assert.equal(res.body.metrics.mem, 0.6);
            assert.equal(res.body.metrics.disk, 0.8);
        });

        it('returns latest value after multiple writes', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'LatestBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.1 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.5 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.9 });

            const res = await request('GET', `/api/v1/agents/${id}/metrics`);
            assert.equal(res.body.metrics.cpu, 0.9);
        });

        it('returns empty object for agent with no metrics', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'NoMetricsBot' });
            const res = await request('GET', `/api/v1/agents/${reg.body.id}/metrics`);
            assert.equal(res.status, 200);
            assert.deepStrictEqual(res.body.metrics, {});
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('GET', '/api/v1/agents/ghost/metrics');
            assert.equal(res.status, 404);
        });

        it('isolates metrics between agents', async () => {
            const a1 = await request('POST', '/api/v1/agents', { name: 'Isolated1' });
            const a2 = await request('POST', '/api/v1/agents', { name: 'Isolated2' });
            await request('POST', `/api/v1/agents/${a1.body.id}/metrics`, { key: 'cpu', value: 0.99 });
            await request('POST', `/api/v1/agents/${a2.body.id}/metrics`, { key: 'cpu', value: 0.01 });

            const r1 = await request('GET', `/api/v1/agents/${a1.body.id}/metrics`);
            const r2 = await request('GET', `/api/v1/agents/${a2.body.id}/metrics`);
            assert.equal(r1.body.metrics.cpu, 0.99);
            assert.equal(r2.body.metrics.cpu, 0.01);
        });
    });

    describe('GET /api/v1/agents/:id/metrics/:key/history', () => {
        it('returns time-series history with timestamps and values', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'HistoryBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.1 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.2 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.3 });

            const res = await request('GET', `/api/v1/agents/${id}/metrics/cpu/history`);
            assert.equal(res.status, 200);
            assert.equal(res.body.agentId, id);
            assert.equal(res.body.key, 'cpu');
            assert.equal(res.body.history.length, 3);
            assert.equal(res.body.history[0].v, 0.1);
            assert.equal(res.body.history[1].v, 0.2);
            assert.equal(res.body.history[2].v, 0.3);
            // Verify timestamps are numeric and increasing
            assert.ok(res.body.history[0].t > 0);
            assert.ok(res.body.history[1].t >= res.body.history[0].t);
        });

        it('returns empty array for non-existent key', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'NoKeyBot' });
            const res = await request('GET', `/api/v1/agents/${reg.body.id}/metrics/nonexistent/history`);
            assert.equal(res.status, 200);
            assert.deepStrictEqual(res.body.history, []);
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('GET', '/api/v1/agents/phantom/metrics/cpu/history');
            assert.equal(res.status, 404);
        });

        it('isolates history between agents', async () => {
            const a1 = await request('POST', '/api/v1/agents', { name: 'HIsolated1' });
            const a2 = await request('POST', '/api/v1/agents', { name: 'HIsolated2' });
            await request('POST', `/api/v1/agents/${a1.body.id}/metrics`, { key: 'cpu', value: 0.77 });
            await request('POST', `/api/v1/agents/${a2.body.id}/metrics`, { key: 'cpu', value: 0.33 });

            const h1 = await request('GET', `/api/v1/agents/${a1.body.id}/metrics/cpu/history`);
            const h2 = await request('GET', `/api/v1/agents/${a2.body.id}/metrics/cpu/history`);
            assert.equal(h1.body.history.length, 1);
            assert.equal(h1.body.history[0].v, 0.77);
            assert.equal(h2.body.history.length, 1);
            assert.equal(h2.body.history[0].v, 0.33);
        });

        it('tracks multiple keys independently', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'MultiKeyBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.5 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'mem', value: 0.8 });
            await request('POST', `/api/v1/agents/${id}/metrics`, { key: 'cpu', value: 0.6 });

            const cpuH = await request('GET', `/api/v1/agents/${id}/metrics/cpu/history`);
            const memH = await request('GET', `/api/v1/agents/${id}/metrics/mem/history`);
            assert.equal(cpuH.body.history.length, 2);
            assert.equal(memH.body.history.length, 1);
            assert.equal(memH.body.history[0].v, 0.8);
        });
    });
});
