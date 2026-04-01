// tests/task-sdk.test.js
// Tests for the JS Agent SDK task methods (agents/sdk.js)

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PxOSServer } from '../sync/server.js';
import { TaskStore } from '../sync/task-store.js';
import { AgentSDK } from '../agents/sdk.js';

const TEST_PORT = 13843;
const BASE = `http://localhost:${TEST_PORT}`;
const TMP_DATA_DIR = join('/tmp', `task-sdk-test-${Date.now()}`);

describe('Agent SDK Task Methods', () => {
    let server;
    let sdk;

    before(async () => {
        mkdirSync(TMP_DATA_DIR, { recursive: true });
        server = new PxOSServer(TEST_PORT);
        server.taskStore = new TaskStore({ dataPath: join(TMP_DATA_DIR, 'tasks.json') });
        await server.start();
    });

    after(async () => {
        await server.stop();
        rmSync(TMP_DATA_DIR, { recursive: true, force: true });
    });

    beforeEach(() => {
        // Fresh store + fresh SDK for each test to avoid cross-contamination
        server.taskStore = new TaskStore({ dataPath: join(TMP_DATA_DIR, 'tasks.json') });
        sdk = new AgentSDK({ baseUrl: BASE });
    });

    describe('createTask()', () => {
        it('creates a task with default priority', async () => {
            const task = await sdk.createTask({ action: 'test', data: 42 });
            assert.ok(task.id);
            assert.equal(task.status, 'pending');
            assert.deepStrictEqual(task.payload, { action: 'test', data: 42 });
            assert.equal(task.priority, 1);
        });

        it('creates a task with explicit priority', async () => {
            const task = await sdk.createTask({ action: 'high' }, 2);
            assert.equal(task.priority, 2);
        });

        it('creates a task with low priority', async () => {
            const task = await sdk.createTask({ action: 'low' }, 0);
            assert.equal(task.priority, 0);
        });

        it('throws on invalid payload', async () => {
            await assert.rejects(
                () => sdk.createTask('not-an-object'),
                /HTTP 400/
            );
        });
    });

    describe('claimTask()', () => {
        it('rejects when agent not registered', async () => {
            const unreg = new AgentSDK({ baseUrl: BASE });
            await assert.rejects(
                () => unreg.claimTask(),
                /not registered/
            );
        });

        it('returns null when no pending tasks', async () => {
            await sdk.register('sdk-agent-null', { capabilities: ['tasks'] });
            const result = await sdk.claimTask();
            assert.equal(result, null);
        });

        it('claims the highest-priority pending task', async () => {
            await sdk.register('sdk-agent-claim', { capabilities: ['tasks'] });

            // Create tasks with different priorities
            await sdk.createTask({ name: 'low' }, 0);
            await sdk.createTask({ name: 'high' }, 2);
            await sdk.createTask({ name: 'normal' }, 1);

            const claimed = await sdk.claimTask();
            assert.ok(claimed);
            assert.equal(claimed.status, 'running');
            assert.equal(claimed.agentId, sdk.agentId);
            assert.equal(claimed.payload.name, 'high');
            assert.ok(claimed.startedAt);
        });
    });

    describe('completeTask()', () => {
        it('completes a task with a result', async () => {
            await sdk.register('sdk-agent-complete', { capabilities: ['tasks'] });
            const created = await sdk.createTask({ job: 'finish' });
            // Claim it (it's the only task, so claimTask gets it)
            const claimed = await sdk.claimTask();
            assert.equal(claimed.id, created.id);

            const completed = await sdk.completeTask(created.id, { output: 'done', count: 5 });
            assert.equal(completed.status, 'completed');
            assert.deepStrictEqual(completed.result, { output: 'done', count: 5 });
            assert.ok(completed.completedAt);
        });

        it('completes with null result', async () => {
            await sdk.register('sdk-agent-nullres', { capabilities: ['tasks'] });
            const created = await sdk.createTask({ job: 'no-result' });
            await sdk.claimTask();

            const completed = await sdk.completeTask(created.id, null);
            assert.equal(completed.status, 'completed');
        });

        it('throws on unknown task', async () => {
            await assert.rejects(
                () => sdk.completeTask('nonexistent-id', 'done'),
                /HTTP 404/
            );
        });
    });

    describe('failTask()', () => {
        it('fails a task with an error message', async () => {
            await sdk.register('sdk-agent-fail', { capabilities: ['tasks'] });
            const created = await sdk.createTask({ job: 'fail-me' });
            await sdk.claimTask();

            const failed = await sdk.failTask(created.id, 'something went wrong');
            assert.equal(failed.status, 'failed');
            assert.equal(failed.error, 'something went wrong');
            assert.ok(failed.completedAt);
        });

        it('throws on unknown task', async () => {
            await assert.rejects(
                () => sdk.failTask('nonexistent-id', 'error'),
                /HTTP 404/
            );
        });
    });

    describe('Full task lifecycle via SDK', () => {
        it('create -> claim -> complete', async () => {
            await sdk.register('sdk-agent-lifecycle', { capabilities: ['tasks'] });
            const created = await sdk.createTask({ lifecycle: true }, 2);
            assert.equal(created.status, 'pending');

            const claimed = await sdk.claimTask();
            assert.ok(claimed);
            assert.equal(claimed.id, created.id);
            assert.equal(claimed.status, 'running');
            assert.equal(claimed.agentId, sdk.agentId);

            const completed = await sdk.completeTask(claimed.id, { success: true });
            assert.equal(completed.status, 'completed');
            assert.deepStrictEqual(completed.result, { success: true });
        });

        it('create -> claim -> fail', async () => {
            await sdk.register('sdk-agent-failflow', { capabilities: ['tasks'] });
            const created = await sdk.createTask({ failFlow: true });
            const claimed = await sdk.claimTask();
            assert.ok(claimed);
            assert.equal(claimed.id, created.id);

            const failed = await sdk.failTask(claimed.id, 'task exploded');
            assert.equal(failed.status, 'failed');
            assert.equal(failed.error, 'task exploded');
        });

        it('agent can create tasks for other agents', async () => {
            await sdk.register('sdk-agent-producer', { capabilities: ['tasks'] });
            const created = await sdk.createTask({ work: 'for-someone-else' }, 1);
            assert.equal(created.status, 'pending');
            assert.equal(created.agentId, null);
        });
    });
});
