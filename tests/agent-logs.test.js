// tests/agent-logs.test.js
// Tests for agent log posting, retrieval, level filtering, WebSocket broadcast

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { WebSocket } from 'ws';
import { PxOSServer } from '../sync/server.js';
import { AgentRegistry } from '../sync/agent-registry.js';
import { TimeSeriesStore } from '../sync/time-series-store.js';
import { AuditTrail } from '../sync/audit-trail.js';

const TEST_PORT = 13842;
const BASE = `http://localhost:${TEST_PORT}`;
const WS_URL = `ws://localhost:${TEST_PORT}`;
const TMP = join('/tmp', `agent-logs-test-${Date.now()}`);

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

function wsConnect() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

function wsNextMessage(ws, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WS timeout')), timeout);
        ws.once('message', (raw) => {
            clearTimeout(timer);
            resolve(JSON.parse(raw.toString()));
        });
    });
}

describe('Agent Logs API', () => {
    let server;
    let agentId;

    before(async () => {
        mkdirSync(TMP, { recursive: true });
        server = new PxOSServer(TEST_PORT);
        server.agentRegistry = new AgentRegistry({ filePath: join(TMP, 'agents.json') });
        server.timeSeriesStore = new TimeSeriesStore({ maxPoints: 1000, minInterval: 0 });
        server.auditTrail = new AuditTrail({ filePath: join(TMP, 'audit.jsonl') });
        await server.start();
        const reg = await request('POST', '/api/v1/agents', { name: 'LogsTestBot' });
        agentId = reg.body.id;
    });

    after(async () => {
        await server.stop();
        rmSync(TMP, { recursive: true, force: true });
    });

    describe('POST /api/v1/agents/:id/logs (posting)', () => {
        it('accepts a log entry with level and message', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/logs`, {
                level: 'error', message: 'something went wrong',
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.level, 'error');
            assert.equal(res.body.message, 'something went wrong');
            assert.ok(res.body.timestamp > 0);
        });

        it('defaults level to info when omitted', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/logs`, {
                message: 'default level test',
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.level, 'info');
        });

        it('accepts warn level', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/logs`, {
                level: 'warn', message: 'be careful',
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.level, 'warn');
        });

        it('rejects invalid level', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/logs`, {
                level: 'debug', message: 'nope',
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('level'));
        });

        it('rejects missing message', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/logs`, {
                level: 'info',
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('message'));
        });

        it('rejects empty string message', async () => {
            const res = await request('POST', `/api/v1/agents/${agentId}/logs`, {
                level: 'info', message: '',
            });
            assert.equal(res.status, 400);
            assert.ok(res.body.error.includes('message'));
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('POST', '/api/v1/agents/ghost/logs', {
                message: 'nobody here',
            });
            assert.equal(res.status, 404);
        });

        it('returns 400 for invalid JSON', async () => {
            const res = await new Promise((resolve, reject) => {
                const url = new URL(`/api/v1/agents/${agentId}/logs`, BASE);
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
                req.write('{bad json');
                req.end();
            });
            assert.equal(res.status, 400);
        });
    });

    describe('GET /api/v1/agents/:id/logs (retrieval)', () => {
        it('returns log entries in order', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'OrderBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'first' });
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'second' });
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'third' });

            const res = await request('GET', `/api/v1/agents/${id}/logs`);
            assert.equal(res.status, 200);
            assert.equal(res.body.agentId, id);
            assert.equal(res.body.logs.length, 3);
            assert.equal(res.body.logs[0].message, 'first');
            assert.equal(res.body.logs[1].message, 'second');
            assert.equal(res.body.logs[2].message, 'third');
        });

        it('returns empty array for agent with no logs', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'NoLogsBot' });
            const res = await request('GET', `/api/v1/agents/${reg.body.id}/logs`);
            assert.equal(res.status, 200);
            assert.deepStrictEqual(res.body.logs, []);
        });

        it('returns 404 for unknown agent', async () => {
            const res = await request('GET', '/api/v1/agents/nonexistent/logs');
            assert.equal(res.status, 404);
        });

        it('each log entry has timestamp, level, and message', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'StructBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'error', message: 'check fields' });

            const res = await request('GET', `/api/v1/agents/${id}/logs`);
            assert.equal(res.body.logs.length, 1);
            const entry = res.body.logs[0];
            assert.ok(entry.timestamp > 0);
            assert.equal(entry.level, 'error');
            assert.equal(entry.message, 'check fields');
        });
    });

    describe('GET /api/v1/agents/:id/logs?limit=N', () => {
        it('returns last N entries', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'LimitBot' });
            const id = reg.body.id;
            for (let i = 0; i < 15; i++) {
                await request('POST', `/api/v1/agents/${id}/logs`, { message: `msg-${i}` });
            }
            const res = await request('GET', `/api/v1/agents/${id}/logs?limit=5`);
            assert.equal(res.body.logs.length, 5);
            assert.equal(res.body.logs[0].message, 'msg-10');
            assert.equal(res.body.logs[4].message, 'msg-14');
        });

        it('returns all entries if limit exceeds total', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'SmallLimitBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/logs`, { message: 'only-one' });
            const res = await request('GET', `/api/v1/agents/${id}/logs?limit=100`);
            assert.equal(res.body.logs.length, 1);
        });

        it('defaults to 50 when limit is not provided', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'DefaultLimitBot' });
            const id = reg.body.id;
            for (let i = 0; i < 60; i++) {
                await request('POST', `/api/v1/agents/${id}/logs`, { message: `msg-${i}` });
            }
            const res = await request('GET', `/api/v1/agents/${id}/logs`);
            assert.equal(res.body.logs.length, 50);
        });
    });

    describe('GET /api/v1/agents/:id/logs?level=X (level filtering)', () => {
        it('filters to error level only', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'FilterErrorBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'error', message: 'e1' });
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'i1' });
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'warn', message: 'w1' });
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'error', message: 'e2' });

            const res = await request('GET', `/api/v1/agents/${id}/logs?level=error`);
            assert.equal(res.body.logs.length, 2);
            assert.ok(res.body.logs.every(e => e.level === 'error'));
        });

        it('filters to warn level only', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'FilterWarnBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'warn', message: 'w1' });
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'i1' });

            const res = await request('GET', `/api/v1/agents/${id}/logs?level=warn`);
            assert.equal(res.body.logs.length, 1);
            assert.equal(res.body.logs[0].message, 'w1');
        });

        it('filters to info level only', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'FilterInfoBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'i1' });
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'error', message: 'e1' });

            const res = await request('GET', `/api/v1/agents/${id}/logs?level=info`);
            assert.equal(res.body.logs.length, 1);
            assert.equal(res.body.logs[0].level, 'info');
        });

        it('returns empty when no entries match filter', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'NoMatchBot' });
            const id = reg.body.id;
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'only info' });
            const res = await request('GET', `/api/v1/agents/${id}/logs?level=error`);
            assert.equal(res.body.logs.length, 0);
        });

        it('combines level filter with limit', async () => {
            const reg = await request('POST', '/api/v1/agents', { name: 'FilterLimitBot' });
            const id = reg.body.id;
            for (let i = 0; i < 10; i++) {
                await request('POST', `/api/v1/agents/${id}/logs`, { level: 'error', message: `e-${i}` });
            }
            await request('POST', `/api/v1/agents/${id}/logs`, { level: 'info', message: 'noise' });

            const res = await request('GET', `/api/v1/agents/${id}/logs?level=error&limit=3`);
            assert.equal(res.body.logs.length, 3);
            assert.equal(res.body.logs[0].message, 'e-7');
            assert.equal(res.body.logs[2].message, 'e-9');
        });
    });

    describe('WebSocket broadcast on log post', () => {
        it('broadcasts agent:log event when a log is posted', async () => {
            const ws = await wsConnect();
            try {
                // Drain any existing messages
                const drainPromise = new Promise((resolve) => {
                    let count = 0;
                    const timer = setTimeout(resolve, 200);
                    ws.on('message', () => {
                        count++;
                        if (count > 20) { clearTimeout(timer); resolve(); }
                    });
                });
                await drainPromise;
                ws.removeAllListeners('message');

                // Now post a log
                const reg = await request('POST', '/api/v1/agents', { name: 'WSLogBot' });
                const id = reg.body.id;

                const msgPromise = wsNextMessage(ws, 3000);
                await request('POST', `/api/v1/agents/${id}/logs`, {
                    level: 'warn', message: 'ws broadcast test',
                });

                const msg = await msgPromise;
                assert.equal(msg.type, 'agent:log');
                assert.equal(msg.agentId, id);
                assert.equal(msg.entry.level, 'warn');
                assert.equal(msg.entry.message, 'ws broadcast test');
                assert.ok(msg.entry.timestamp > 0);
            } finally {
                ws.close();
            }
        });

        it('broadcasts for each log entry posted', async () => {
            const ws = await wsConnect();
            try {
                // Drain
                await new Promise((resolve) => {
                    const timer = setTimeout(resolve, 200);
                    ws.on('message', () => {});
                    setTimeout(() => { clearTimeout(timer); resolve(); }, 200);
                });
                ws.removeAllListeners('message');

                const reg = await request('POST', '/api/v1/agents', { name: 'WSMultiBot' });
                const id = reg.body.id;

                const messages = [];
                const collectPromise = new Promise((resolve) => {
                    ws.on('message', (raw) => {
                        const msg = JSON.parse(raw.toString());
                        if (msg.type === 'agent:log') messages.push(msg);
                        if (messages.length >= 3) resolve();
                    });
                    setTimeout(resolve, 3000);
                });

                await request('POST', `/api/v1/agents/${id}/logs`, { message: 'ws1' });
                await request('POST', `/api/v1/agents/${id}/logs`, { message: 'ws2' });
                await request('POST', `/api/v1/agents/${id}/logs`, { message: 'ws3' });

                await collectPromise;
                const logMsgs = messages.filter(m => m.agentId === id);
                assert.equal(logMsgs.length, 3);
                assert.equal(logMsgs[0].entry.message, 'ws1');
                assert.equal(logMsgs[1].entry.message, 'ws2');
                assert.equal(logMsgs[2].entry.message, 'ws3');
            } finally {
                ws.close();
            }
        });
    });
});
