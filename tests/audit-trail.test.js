// tests/audit-trail.test.js
// Tests for AuditTrail module and audit-related API endpoints

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { PxOSServer } from '../sync/server.js';
import { AuditTrail } from '../sync/audit-trail.js';
import { AgentRegistry } from '../sync/agent-registry.js';
import { TimeSeriesStore } from '../sync/time-series-store.js';

const TEST_PORT = 13840;
const BASE = `http://localhost:${TEST_PORT}`;
const TMP = join('/tmp', `audit-trail-test-${Date.now()}`);

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

// ─────────────────────────────────────────────────────
// Unit tests for AuditTrail module
// ─────────────────────────────────────────────────────

describe('AuditTrail', () => {
    const tmpDir = join(TMP, 'unit');
    const auditFile = join(tmpDir, 'audit.jsonl');

    after(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('appends an entry and returns it', () => {
        const trail = new AuditTrail({ filePath: auditFile });
        const entry = trail.append('agent.registered', { agentId: 'a1', name: 'Bot' });
        assert.equal(entry.event, 'agent.registered');
        assert.equal(entry.data.agentId, 'a1');
        assert.equal(entry.data.name, 'Bot');
        assert.ok(entry.timestamp);
    });

    it('writes JSONL to disk', () => {
        const trail = new AuditTrail({ filePath: auditFile });
        trail.append('test.event', { foo: 'bar' });
        assert.ok(existsSync(auditFile));
        const lines = readFileSync(auditFile, 'utf-8').trim().split('\n');
        assert.equal(lines.length, 2); // from previous test + this one
        const parsed = JSON.parse(lines[lines.length - 1]);
        assert.equal(parsed.event, 'test.event');
        assert.equal(parsed.data.foo, 'bar');
    });

    it('query returns all entries when no filter', () => {
        const trail = new AuditTrail({ filePath: auditFile, maxReadEntries: 100 });
        const entries = trail.query();
        assert.ok(entries.length >= 2);
    });

    it('query filters by agentId', () => {
        const trail = new AuditTrail({ filePath: auditFile });
        trail.append('agent.registered', { agentId: 'filter-me', name: 'X' });
        trail.append('agent.status-change', { agentId: 'other', from: 'online', to: 'offline' });
        trail.append('agent.registered', { agentId: 'filter-me', name: 'Y' });

        const filtered = trail.query({ agentId: 'filter-me' });
        assert.ok(filtered.length >= 2);
        assert.ok(filtered.every(e => e.data.agentId === 'filter-me'));
    });

    it('query respects limit', () => {
        const trail = new AuditTrail({ filePath: auditFile, maxReadEntries: 200 });
        for (let i = 0; i < 20; i++) {
            trail.append('bulk.event', { index: i });
        }
        const limited = trail.query({ limit: 5 });
        assert.equal(limited.length, 5);
        // Should be the last 5
        assert.equal(limited[4].data.index, 19);
    });

    it('query returns empty array if file does not exist', () => {
        const trail = new AuditTrail({ filePath: join(tmpDir, 'nonexistent.jsonl') });
        const entries = trail.query();
        assert.deepStrictEqual(entries, []);
    });

    it('handles maxReadEntries default', () => {
        const trail = new AuditTrail({ filePath: auditFile });
        assert.equal(trail.maxReadEntries, 200);
    });
});

// ─────────────────────────────────────────────────────
// Integration tests for audit API endpoints
// ─────────────────────────────────────────────────────

describe('Audit Trail API Integration', () => {
    let server;

    before(async () => {
        mkdirSync(TMP, { recursive: true });
        server = new PxOSServer(TEST_PORT);
        server.agentRegistry = new AgentRegistry({ filePath: join(TMP, 'agents.json') });
        server.auditTrail = new AuditTrail({ filePath: join(TMP, 'audit.jsonl') });
        server.timeSeriesStore = new TimeSeriesStore({ maxPoints: 1000, minInterval: 0 });
        await server.start();
    });

    after(async () => {
        await server.stop();
        rmSync(TMP, { recursive: true, force: true });
    });

    it('GET /api/v1/audit returns empty array initially', async () => {
        const res = await request('GET', '/api/v1/audit');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    it('POST /api/v1/agents logs agent.registered to audit', async () => {
        const reg = await request('POST', '/api/v1/agents', {
            name: 'AuditBot',
            capabilities: ['test'],
        });
        assert.equal(reg.status, 201);
        const agentId = reg.body.id;

        // Check audit trail
        const audit = await request('GET', '/api/v1/audit');
        assert.equal(audit.status, 200);
        const registered = audit.body.find(e =>
            e.event === 'agent.registered' && e.data.agentId === agentId
        );
        assert.ok(registered, 'agent.registered event should exist');
        assert.equal(registered.data.name, 'AuditBot');
        assert.deepStrictEqual(registered.data.capabilities, ['test']);
    });

    it('PUT /api/v1/agents/:id/heartbeat logs agent.status-change when going online', async () => {
        // Register an agent (starts as offline)
        const reg = await request('POST', '/api/v1/agents', { name: 'HeartbeatAuditBot' });
        const agentId = reg.body.id;
        assert.equal(reg.body.status, 'offline');

        // Send heartbeat
        const hb = await request('PUT', `/api/v1/agents/${agentId}/heartbeat`);
        assert.equal(hb.status, 200);

        // Check audit for status-change
        const audit = await request('GET', `/api/v1/audit?agentId=${agentId}`);
        const statusChange = audit.body.find(e => e.event === 'agent.status-change');
        assert.ok(statusChange, 'agent.status-change event should exist');
        assert.equal(statusChange.data.from, 'offline');
        assert.equal(statusChange.data.to, 'online');
    });

    it('subsequent heartbeats do not log duplicate status-change', async () => {
        const reg = await request('POST', '/api/v1/agents', { name: 'DoubleHB' });
        const agentId = reg.body.id;

        await request('PUT', `/api/v1/agents/${agentId}/heartbeat`);
        await request('PUT', `/api/v1/agents/${agentId}/heartbeat`);

        const audit = await request('GET', `/api/v1/audit?agentId=${agentId}`);
        const statusChanges = audit.body.filter(e => e.event === 'agent.status-change');
        assert.equal(statusChanges.length, 1, 'should only log one status-change');
    });

    it('GET /api/v1/audit?agentId=X filters by agentId', async () => {
        const reg1 = await request('POST', '/api/v1/agents', { name: 'FilterA' });
        const reg2 = await request('POST', '/api/v1/agents', { name: 'FilterB' });
        const id1 = reg1.body.id;
        const id2 = reg2.body.id;

        const audit1 = await request('GET', `/api/v1/audit?agentId=${id1}`);
        assert.equal(audit1.status, 200);
        assert.ok(audit1.body.every(e => e.data.agentId === id1));

        const audit2 = await request('GET', `/api/v1/audit?agentId=${id2}`);
        assert.equal(audit2.status, 200);
        assert.ok(audit2.body.every(e => e.data.agentId === id2));
    });

    it('GET /api/v1/audit?limit=N limits results', async () => {
        const audit = await request('GET', '/api/v1/audit?limit=1');
        assert.equal(audit.status, 200);
        assert.ok(audit.body.length <= 1);
    });

    it('POST /api/v1/agents/:id/tasks logs agent.task-assigned', async () => {
        const reg = await request('POST', '/api/v1/agents', { name: 'TaskBot' });
        const agentId = reg.body.id;

        const task = await request('POST', `/api/v1/agents/${agentId}/tasks`, {
            taskId: 'task-001',
        });
        assert.equal(task.status, 201);
        assert.equal(task.body.ok, true);
        assert.equal(task.body.taskId, 'task-001');

        const audit = await request('GET', `/api/v1/audit?agentId=${agentId}`);
        const assigned = audit.body.find(e => e.event === 'agent.task-assigned');
        assert.ok(assigned, 'agent.task-assigned event should exist');
        assert.equal(assigned.data.agentId, agentId);
        assert.equal(assigned.data.taskId, 'task-001');
    });

    it('POST /api/v1/agents/:id/tasks returns 404 for unknown agent', async () => {
        const res = await request('POST', '/api/v1/agents/nonexistent-id/tasks', {
            taskId: 'task-999',
        });
        assert.equal(res.status, 404);
    });

    it('POST /api/v1/agents/:id/tasks returns 400 without taskId', async () => {
        const reg = await request('POST', '/api/v1/agents', { name: 'NoTaskIdBot' });
        const agentId = reg.body.id;

        const res = await request('POST', `/api/v1/agents/${agentId}/tasks`, {});
        assert.equal(res.status, 400);
    });

    it('POST /api/v1/agents/:id/tasks returns 400 with invalid JSON', async () => {
        const reg = await request('POST', '/api/v1/agents', { name: 'BadJsonBot' });
        const agentId = reg.body.id;

        // Send raw invalid JSON
        const res = await new Promise((resolve, reject) => {
            const url = new URL(`/api/v1/agents/${agentId}/tasks`, BASE);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    let parsed = null;
                    try { parsed = JSON.parse(data); } catch {}
                    resolve({ status: res.statusCode, body: parsed });
                });
            });
            req.on('error', reject);
            req.write('not json');
            req.end();
        });
        assert.equal(res.status, 400);
    });

    it('audit entries have correct structure', async () => {
        const audit = await request('GET', '/api/v1/audit');
        assert.ok(audit.body.length > 0);
        for (const entry of audit.body) {
            assert.ok(entry.timestamp, 'entry should have timestamp');
            assert.ok(entry.event, 'entry should have event');
            assert.ok(entry.data !== undefined, 'entry should have data');
        }
    });

    it('audit trail records agent.registered with capabilities', async () => {
        const reg = await request('POST', '/api/v1/agents', {
            name: 'CapAuditBot',
            capabilities: ['monitor', 'heal'],
        });
        const agentId = reg.body.id;
        const audit = await request('GET', `/api/v1/audit?agentId=${agentId}`);
        const ev = audit.body.find(e => e.event === 'agent.registered');
        assert.ok(ev);
        assert.deepStrictEqual(ev.data.capabilities, ['monitor', 'heal']);
    });

    it('audit trail records agent.task-assigned with taskId', async () => {
        const reg = await request('POST', '/api/v1/agents', { name: 'TaskAuditBot' });
        const agentId = reg.body.id;
        await request('POST', `/api/v1/agents/${agentId}/tasks`, {
            taskId: 'audit-task-42',
        });
        const audit = await request('GET', `/api/v1/audit?agentId=${agentId}`);
        const ev = audit.body.find(e => e.event === 'agent.task-assigned');
        assert.ok(ev);
        assert.equal(ev.data.agentId, agentId);
        assert.equal(ev.data.taskId, 'audit-task-42');
    });

    it('audit timestamps are valid ISO strings', async () => {
        const audit = await request('GET', '/api/v1/audit');
        assert.ok(audit.body.length > 0);
        for (const entry of audit.body) {
            const d = new Date(entry.timestamp);
            assert.ok(!isNaN(d.getTime()), `${entry.timestamp} should be a valid date`);
        }
    });

    it('GET /api/v1/audit without params returns all entries', async () => {
        const audit = await request('GET', '/api/v1/audit');
        assert.equal(audit.status, 200);
        assert.ok(Array.isArray(audit.body));
        // Should include entries from all agents
        const agentIds = new Set(audit.body.map(e => e.data.agentId).filter(Boolean));
        assert.ok(agentIds.size >= 2, 'should have entries from multiple agents');
    });
});
