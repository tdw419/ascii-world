// tests/task-api.test.js
// Tests for Task Queue REST API endpoints

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { PxOSServer } from '../sync/server.js';
import { TaskStore } from '../sync/task-store.js';

const TEST_PORT = 13841;
const BASE = `http://localhost:${TEST_PORT}`;
const TMP_DATA_DIR = join('/tmp', `task-api-test-${Date.now()}`);

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

describe('Task Queue REST API', () => {
    let server;

    before(async () => {
        mkdirSync(TMP_DATA_DIR, { recursive: true });
        server = new PxOSServer(TEST_PORT);
        // Override taskStore with a fresh one so we don't pollute real data
        server.taskStore = new TaskStore({ dataPath: join(TMP_DATA_DIR, 'tasks.json') });
        await server.start();
    });

    after(async () => {
        await server.stop();
        rmSync(TMP_DATA_DIR, { recursive: true, force: true });
    });

    describe('POST /api/v1/tasks', () => {
        it('creates a task and returns 201', async () => {
            const res = await request('POST', '/api/v1/tasks', {
                payload: { action: 'test', data: 42 },
            });
            assert.equal(res.status, 201);
            assert.ok(res.body.id);
            assert.equal(res.body.status, 'pending');
            assert.deepStrictEqual(res.body.payload, { action: 'test', data: 42 });
            assert.equal(res.body.priority, 1);
            assert.equal(res.body.agentId, null);
        });

        it('creates a task with custom priority', async () => {
            const res = await request('POST', '/api/v1/tasks', {
                payload: { action: 'high-priority' },
                priority: 2,
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.priority, 2);
        });

        it('returns 400 when payload is missing', async () => {
            const res = await request('POST', '/api/v1/tasks', {});
            assert.equal(res.status, 400);
            assert.ok(res.body.error);
        });

        it('returns 400 when payload is not an object', async () => {
            const res = await request('POST', '/api/v1/tasks', { payload: 'string' });
            assert.equal(res.status, 400);
            assert.ok(res.body.error);
        });

        it('returns 400 when payload is an array', async () => {
            const res = await request('POST', '/api/v1/tasks', { payload: [1, 2] });
            assert.equal(res.status, 400);
            assert.ok(res.body.error);
        });
    });

    describe('GET /api/v1/tasks', () => {
        it('returns all tasks', async () => {
            const res = await request('GET', '/api/v1/tasks');
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.body));
            assert.ok(res.body.length >= 2); // at least the 2 created above
        });

        it('filters by status', async () => {
            const res = await request('GET', '/api/v1/tasks?status=pending');
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.body));
            for (const t of res.body) {
                assert.equal(t.status, 'pending');
            }
        });

        it('returns empty array for non-matching filter', async () => {
            const res = await request('GET', '/api/v1/tasks?status=failed');
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.body));
            assert.equal(res.body.length, 0);
        });
    });

    describe('GET /api/v1/tasks/:id', () => {
        it('returns a specific task', async () => {
            const created = await request('POST', '/api/v1/tasks', { payload: { find: 'me' } });
            const res = await request('GET', `/api/v1/tasks/${created.body.id}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.id, created.body.id);
            assert.deepStrictEqual(res.body.payload, { find: 'me' });
        });

        it('returns 404 for unknown id', async () => {
            const res = await request('GET', '/api/v1/tasks/nonexistent-id');
            assert.equal(res.status, 404);
            assert.ok(res.body.error);
        });
    });

    describe('PUT /api/v1/tasks/:id/claim', () => {
        it('claims a pending task', async () => {
            const created = await request('POST', '/api/v1/tasks', { payload: { work: 'do-it' } });
            const res = await request('PUT', `/api/v1/tasks/${created.body.id}/claim`, {
                agentId: 'agent-42',
            });
            assert.equal(res.status, 200);
            assert.equal(res.body.agentId, 'agent-42');
            assert.equal(res.body.status, 'running');
            assert.ok(res.body.startedAt);
        });

        it('returns 404 for unknown task', async () => {
            const res = await request('PUT', '/api/v1/tasks/no-such-task/claim', {
                agentId: 'agent-42',
            });
            assert.equal(res.status, 404);
        });

        it('returns 400 when agentId is missing', async () => {
            const created = await request('POST', '/api/v1/tasks', { payload: { a: 1 } });
            const res = await request('PUT', `/api/v1/tasks/${created.body.id}/claim`, {});
            assert.equal(res.status, 400);
        });

        it('returns 409 when task is not pending', async () => {
            const created = await request('POST', '/api/v1/tasks', { payload: { b: 2 } });
            // Claim it first
            await request('PUT', `/api/v1/tasks/${created.body.id}/claim`, { agentId: 'a1' });
            // Try to claim again
            const res = await request('PUT', `/api/v1/tasks/${created.body.id}/claim`, { agentId: 'a2' });
            assert.equal(res.status, 409);
        });
    });

    describe('PUT /api/v1/tasks/:id/complete', () => {
        it('completes a task with a result', async () => {
            const created = await request('POST', '/api/v1/tasks', { payload: { job: 'finish' } });
            const res = await request('PUT', `/api/v1/tasks/${created.body.id}/complete`, {
                result: { output: 'done', count: 5 },
            });
            assert.equal(res.status, 200);
            assert.equal(res.body.status, 'completed');
            assert.deepStrictEqual(res.body.result, { output: 'done', count: 5 });
            assert.ok(res.body.completedAt);
        });

        it('returns 404 for unknown task', async () => {
            const res = await request('PUT', '/api/v1/tasks/no-such-task/complete', {
                result: 'nope',
            });
            assert.equal(res.status, 404);
        });
    });

    describe('PUT /api/v1/tasks/:id/fail', () => {
        it('fails a task with an error message', async () => {
            const created = await request('POST', '/api/v1/tasks', { payload: { job: 'fail-me' } });
            const res = await request('PUT', `/api/v1/tasks/${created.body.id}/fail`, {
                error: 'something went wrong',
            });
            assert.equal(res.status, 200);
            assert.equal(res.body.status, 'failed');
            assert.equal(res.body.error, 'something went wrong');
            assert.ok(res.body.completedAt);
        });

        it('returns 404 for unknown task', async () => {
            const res = await request('PUT', '/api/v1/tasks/no-such-task/fail', {
                error: 'nope',
            });
            assert.equal(res.status, 404);
        });
    });

    describe('GET /api/v1/tasks/stats', () => {
        it('returns task counts by status', async () => {
            // We've created and completed/failed tasks above
            const res = await request('GET', '/api/v1/tasks/stats');
            assert.equal(res.status, 200);
            assert.equal(typeof res.body.pending, 'number');
            assert.equal(typeof res.body.running, 'number');
            assert.equal(typeof res.body.completed, 'number');
            assert.equal(typeof res.body.failed, 'number');
            // At least some tasks exist
            const total = res.body.pending + res.body.running + res.body.completed + res.body.failed;
            assert.ok(total > 0, 'should have at least some tasks');
        });
    });

    describe('Full task lifecycle', () => {
        it('create -> claim -> complete', async () => {
            // Create
            const created = await request('POST', '/api/v1/tasks', {
                payload: { lifecycle: true },
                priority: 2,
            });
            assert.equal(created.status, 201);
            const taskId = created.body.id;

            // Verify in list
            const list = await request('GET', '/api/v1/tasks?status=pending');
            const found = list.body.find(t => t.id === taskId);
            assert.ok(found);

            // Claim
            const claimed = await request('PUT', `/api/v1/tasks/${taskId}/claim`, {
                agentId: 'lifecycle-agent',
            });
            assert.equal(claimed.status, 200);
            assert.equal(claimed.body.status, 'running');
            assert.equal(claimed.body.agentId, 'lifecycle-agent');

            // Filter by agentId
            const byAgent = await request('GET', '/api/v1/tasks?agentId=lifecycle-agent');
            assert.ok(byAgent.body.some(t => t.id === taskId));

            // Complete
            const completed = await request('PUT', `/api/v1/tasks/${taskId}/complete`, {
                result: { success: true },
            });
            assert.equal(completed.status, 200);
            assert.equal(completed.body.status, 'completed');

            // Verify stats updated
            const stats = await request('GET', '/api/v1/tasks/stats');
            assert.ok(stats.body.completed >= 1);
        });

        it('create -> claim -> fail', async () => {
            const created = await request('POST', '/api/v1/tasks', {
                payload: { failFlow: true },
            });
            const taskId = created.body.id;

            await request('PUT', `/api/v1/tasks/${taskId}/claim`, { agentId: 'fail-agent' });
            const failed = await request('PUT', `/api/v1/tasks/${taskId}/fail`, {
                error: 'task exploded',
            });
            assert.equal(failed.status, 200);
            assert.equal(failed.body.status, 'failed');
            assert.equal(failed.body.error, 'task exploded');
        });
    });
});
