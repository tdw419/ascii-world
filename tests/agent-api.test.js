// tests/agent-api.test.js
// Tests for Agent Registry REST API endpoints

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { PxOSServer } from '../sync/server.js';

const TEST_PORT = 13839;
const BASE = `http://localhost:${TEST_PORT}`;
const TMP_DATA_DIR = join('/tmp', `agent-api-test-${Date.now()}`);

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
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
});
