// tests/task-store.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { TaskStore } from '../sync/task-store.js';

const FIXTURE_DIR = join(process.cwd(), '.test-fixtures', 'task-store');

describe('TaskStore', () => {
    let store;

    beforeEach(() => {
        store = new TaskStore({ dataPath: join(FIXTURE_DIR, `tasks-${Date.now()}.json`) });
    });

    describe('create()', () => {
        it('creates a pending task with payload', () => {
            const task = store.create({ action: 'render' });
            assert.equal(task.status, 'pending');
            assert.deepStrictEqual(task.payload, { action: 'render' });
            assert.equal(task.priority, 1);
            assert.equal(task.agentId, null);
            assert.ok(task.id);
            assert.ok(task.createdAt);
        });

        it('creates a task with explicit priority', () => {
            const task = store.create({ x: 1 }, 2);
            assert.equal(task.priority, 2);
        });

        it('stores the task and makes it retrievable via get()', () => {
            const task = store.create({ test: true });
            const retrieved = store.get(task.id);
            assert.ok(retrieved);
            assert.equal(retrieved.id, task.id);
        });

        it('creates independent tasks with unique IDs', () => {
            const a = store.create({ a: 1 });
            const b = store.create({ b: 2 });
            assert.notEqual(a.id, b.id);
        });
    });

    describe('get()', () => {
        it('returns null for unknown ID', () => {
            assert.equal(store.get('nonexistent'), null);
        });

        it('returns the task by ID', () => {
            const task = store.create({ find: 'me' });
            assert.strictEqual(store.get(task.id), task);
        });
    });

    describe('list()', () => {
        it('returns empty array when no tasks', () => {
            assert.deepStrictEqual(store.list(), []);
        });

        it('returns all tasks sorted by priority desc then createdAt asc', async () => {
            // Ensure different createdAt values by waiting a tiny bit
            const low = store.create({ name: 'low' }, 0);
            await new Promise(r => setTimeout(r, 2));
            const high = store.create({ name: 'high' }, 2);
            await new Promise(r => setTimeout(r, 2));
            const normal = store.create({ name: 'normal' }, 1);

            const list = store.list();
            assert.equal(list[0].id, high.id);
            assert.equal(list[1].id, normal.id);
            assert.equal(list[2].id, low.id);
        });

        it('filters by status', () => {
            store.create({ a: 1 });
            const running = store.create({ b: 2 });
            store.claim('agent-1'); // claims highest priority pending

            const pending = store.list({ status: 'pending' });
            const runningList = store.list({ status: 'running' });

            assert.ok(pending.every(t => t.status === 'pending'));
            assert.ok(runningList.every(t => t.status === 'running'));
        });

        it('filters by agentId', () => {
            store.create({ a: 1 });
            store.create({ b: 2 });
            store.claim('agent-x');
            store.claim('agent-y');

            const byX = store.list({ agentId: 'agent-x' });
            const byY = store.list({ agentId: 'agent-y' });

            assert.equal(byX.length, 1);
            assert.equal(byX[0].agentId, 'agent-x');
            assert.equal(byY.length, 1);
            assert.equal(byY[0].agentId, 'agent-y');
        });

        it('combines status and agentId filters', () => {
            store.create({ a: 1 });
            store.create({ b: 2 });
            store.claim('agent-x');
            store.claim('agent-y');
            store.fail(store.list({ agentId: 'agent-y' })[0].id, 'boom');

            const result = store.list({ status: 'failed', agentId: 'agent-y' });
            assert.equal(result.length, 1);
            assert.equal(result[0].status, 'failed');
            assert.equal(result[0].agentId, 'agent-y');
        });
    });

    describe('claim()', () => {
        it('returns null when no pending tasks', () => {
            assert.equal(store.claim('agent-1'), null);
        });

        it('claims highest-priority pending task', () => {
            const low = store.create({ name: 'low' }, 0);
            const high = store.create({ name: 'high' }, 2);

            const claimed = store.claim('agent-1');
            assert.equal(claimed.id, high.id);
            assert.equal(claimed.status, 'running');
            assert.equal(claimed.agentId, 'agent-1');
            assert.ok(claimed.startedAt);
        });

        it('does not claim already-running tasks', () => {
            store.create({ a: 1 });
            const first = store.claim('agent-1');
            assert.ok(first);

            const second = store.claim('agent-2');
            assert.equal(second, null);
        });

        it('picks oldest among equal-priority tasks', async () => {
            const first = store.create({ name: 'first' }, 1);
            await new Promise(r => setTimeout(r, 2));
            const second = store.create({ name: 'second' }, 1);

            const claimed = store.claim('agent-1');
            assert.equal(claimed.id, first.id);
        });
    });

    describe('complete()', () => {
        it('completes a running task', () => {
            store.create({ a: 1 });
            const claimed = store.claim('agent-1');

            const completed = store.complete(claimed.id, { success: true });
            assert.equal(completed.status, 'completed');
            assert.deepStrictEqual(completed.result, { success: true });
            assert.ok(completed.completedAt);
        });

        it('returns null for unknown id', () => {
            assert.equal(store.complete('nope', { ok: true }), null);
        });

        it('can complete a pending task (edge case)', () => {
            const task = store.create({ x: 1 });
            const completed = store.complete(task.id, { done: true });
            assert.equal(completed.status, 'completed');
        });
    });

    describe('fail()', () => {
        it('fails a running task', () => {
            store.create({ a: 1 });
            const claimed = store.claim('agent-1');

            const failed = store.fail(claimed.id, 'something went wrong');
            assert.equal(failed.status, 'failed');
            assert.equal(failed.error, 'something went wrong');
            assert.ok(failed.completedAt);
        });

        it('returns null for unknown id', () => {
            assert.equal(store.fail('nope', 'error'), null);
        });

        it('converts non-string error to string', () => {
            const task = store.create({ x: 1 });
            const failed = store.fail(task.id, { code: 500 });
            assert.equal(failed.error, '[object Object]');
        });
    });

    describe('getStats()', () => {
        it('returns zeros for empty store', () => {
            assert.deepStrictEqual(store.getStats(), {
                pending: 0, running: 0, completed: 0, failed: 0,
            });
        });

        it('counts tasks by status', () => {
            store.create({ a: 1 });
            store.create({ b: 2 });
            const t1 = store.claim('agent-1');
            store.claim('agent-2');
            store.fail(t1.id, 'boom');

            const stats = store.getStats();
            assert.equal(stats.pending, 0);
            assert.equal(stats.running, 1);
            assert.equal(stats.failed, 1);
            assert.equal(stats.completed, 0);
        });

        it('counts all four statuses', () => {
            const t1 = store.create({ a: 1 });
            const t2 = store.create({ b: 2 });
            store.create({ c: 3 });
            store.create({ d: 4 });

            store.complete(t1.id, { ok: true });   // completed
            store.fail(t2.id, 'broken');             // failed
            const claimed = store.claim('agent-x');  // running (claims t3, oldest of remaining pending)

            const stats = store.getStats();
            assert.equal(stats.completed, 1);
            assert.equal(stats.failed, 1);
            assert.equal(stats.running, 1);
            assert.equal(stats.pending, 1);
        });
    });

    describe('persist() and load()', () => {
        it('round-trips tasks through file', async () => {
            const dataPath = join(FIXTURE_DIR, `roundtrip-${Date.now()}.json`);
            const s = new TaskStore({ dataPath });

            const t1 = s.create({ action: 'alpha' }, 2);
            const t2 = s.create({ action: 'beta' }, 0);
            s.claim('agent-1'); // claims t1 (high priority)
            s.complete(t1.id, { done: true });

            await s.persist();

            const s2 = new TaskStore({ dataPath });
            await s2.load();

            assert.equal(s2.get(t1.id).status, 'completed');
            assert.equal(s2.get(t2.id).status, 'pending');
            assert.deepStrictEqual(s2.getStats(), { pending: 1, running: 0, completed: 1, failed: 0 });

            // Cleanup
            await rm(dataPath, { force: true });
        });

        it('load() handles missing file gracefully', async () => {
            const dataPath = join(FIXTURE_DIR, `missing-${Date.now()}.json`);
            const s = new TaskStore({ dataPath });
            await s.load();
            assert.deepStrictEqual(s.getStats(), { pending: 0, running: 0, completed: 0, failed: 0 });
        });

        it('load() handles invalid JSON gracefully', async () => {
            const dataPath = join(FIXTURE_DIR, `invalid-${Date.now()}.json`);
            await mkdir(FIXTURE_DIR, { recursive: true });
            await writeFile(dataPath, 'not json at all', 'utf8');

            const s = new TaskStore({ dataPath });
            await s.load();
            assert.deepStrictEqual(s.getStats(), { pending: 0, running: 0, completed: 0, failed: 0 });

            await rm(dataPath, { force: true });
        });

        it('persist() creates directories as needed', async () => {
            const dataPath = join(FIXTURE_DIR, `deep-${Date.now()}`, 'sub', 'tasks.json');
            const s = new TaskStore({ dataPath });
            s.create({ test: true });
            await s.persist();

            const raw = await readFile(dataPath, 'utf8');
            const parsed = JSON.parse(raw);
            assert.equal(parsed.tasks.length, 1);

            // Cleanup
            await rm(join(FIXTURE_DIR, `deep-${Date.now()}`), { force: true, recursive: true }).catch(() => {});
        });
    });
});
