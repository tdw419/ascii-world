// tests/task-formulas.test.js
// Tests for TASK_QUEUE_STATUS, TASK_COUNT, TASK_LIST formula functions

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PixelFormulaEngine } from '../sync/pixel-formula-engine.js';
import { TaskStore } from '../sync/task-store.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(process.cwd(), '.test-fixtures', 'task-formulas');

describe('Task Queue Formulas', () => {
    let engine;
    let store;

    beforeEach(() => {
        engine = new PixelFormulaEngine(480, 240);
        store = new TaskStore({ dataPath: join(FIXTURE_DIR, `tasks-${Date.now()}.json`) });
        engine.setTaskStore(store);
    });

    // ── TASK_QUEUE_STATUS ──────────────────────────────────────

    describe('TASK_QUEUE_STATUS()', () => {
        it('returns all zeros for empty store', () => {
            const result = engine.TASK_QUEUE_STATUS();
            assert.equal(result, 'pending:0 running:0 completed:0 failed:0');
        });

        it('returns counts after creating tasks', () => {
            store.create({ action: 'a' });
            store.create({ action: 'b' });
            const result = engine.TASK_QUEUE_STATUS();
            assert.equal(result, 'pending:2 running:0 completed:0 failed:0');
        });

        it('reflects status transitions correctly', () => {
            const t1 = store.create({ action: 'render' });
            const t2 = store.create({ action: 'compile' });
            const t3 = store.create({ action: 'test' });

            store.claim('agent-1'); // claims t1 (highest priority pending)
            store.complete(t1.id, { ok: true });

            store.claim('agent-2'); // claims t2
            store.fail(t2.id, 'timeout');

            // t3 still pending
            const result = engine.TASK_QUEUE_STATUS();
            assert.equal(result, 'pending:1 running:0 completed:1 failed:1');
        });

        it('reflects mixed state with multiple tasks in each status', () => {
            const tasks = [];
            for (let i = 0; i < 6; i++) {
                tasks.push(store.create({ idx: i }, i % 3));
            }
            // 6 pending
            store.claim('a1'); // claims highest priority (priority 2)
            store.claim('a2'); // claims next priority 2
            // 4 pending, 2 running
            const running = store.list({ status: 'running' });
            store.complete(running[0].id, { done: true });
            store.fail(running[1].id, 'err');
            // 4 pending, 0 running, 1 completed, 1 failed

            const result = engine.TASK_QUEUE_STATUS();
            assert.equal(result, 'pending:4 running:0 completed:1 failed:1');
        });

        it('returns all zeros when no task store is set', () => {
            const bareEngine = new PixelFormulaEngine(480, 240);
            const result = bareEngine.TASK_QUEUE_STATUS();
            assert.equal(result, 'pending:0 running:0 completed:0 failed:0');
        });
    });

    // ── TASK_COUNT ─────────────────────────────────────────────

    describe('TASK_COUNT(status?)', () => {
        it('returns 0 for all statuses on empty store', () => {
            assert.equal(engine.TASK_COUNT('pending'), 0);
            assert.equal(engine.TASK_COUNT('running'), 0);
            assert.equal(engine.TASK_COUNT('completed'), 0);
            assert.equal(engine.TASK_COUNT('failed'), 0);
        });

        it('returns total count when no status given', () => {
            store.create({ a: 1 });
            store.create({ b: 2 });
            store.create({ c: 3 });
            assert.equal(engine.TASK_COUNT(), 3);
        });

        it('returns count for specific status', () => {
            const t1 = store.create({ action: 'x' });
            const t2 = store.create({ action: 'y' });
            store.create({ action: 'z' });

            store.claim('agent-1'); // claims highest priority
            store.complete(t1.id, 'done');

            assert.equal(engine.TASK_COUNT('pending'), 2);
            assert.equal(engine.TASK_COUNT('completed'), 1);
            assert.equal(engine.TASK_COUNT('running'), 0);
        });

        it('returns 0 for unknown status string', () => {
            store.create({ a: 1 });
            assert.equal(engine.TASK_COUNT('nonexistent'), 0);
        });

        it('returns 0 when no task store is set', () => {
            const bareEngine = new PixelFormulaEngine(480, 240);
            assert.equal(bareEngine.TASK_COUNT(), 0);
            assert.equal(bareEngine.TASK_COUNT('pending'), 0);
        });

        it('resolves cell references for status parameter', () => {
            engine.setCells({ task_status: 'pending' });
            store.create({ x: 1 });
            store.create({ x: 2 });
            assert.equal(engine.TASK_COUNT('task_status'), 2);
        });
    });

    // ── TASK_LIST ──────────────────────────────────────────────

    describe('TASK_LIST(status?)', () => {
        it('returns empty string for empty store', () => {
            assert.equal(engine.TASK_LIST(), '');
            assert.equal(engine.TASK_LIST('pending'), '');
        });

        it('returns comma-separated IDs for all tasks', () => {
            const t1 = store.create({ a: 1 });
            const t2 = store.create({ b: 2 });
            const list = engine.TASK_LIST();
            assert.ok(list.includes(t1.id));
            assert.ok(list.includes(t2.id));
            assert.equal(list.split(',').length, 2);
        });

        it('returns IDs filtered by status', () => {
            const t1 = store.create({ a: 1 });
            const t2 = store.create({ b: 2 });
            const t3 = store.create({ c: 3 });

            store.claim('agent-1');
            const running = store.list({ status: 'running' });

            const pendingList = engine.TASK_LIST('pending');
            const runningList = engine.TASK_LIST('running');

            // t1 was claimed (now running), t2 and t3 still pending
            assert.ok(!pendingList.includes(running[0].id));
            assert.ok(runningList.includes(running[0].id));
            assert.equal(pendingList.split(',').length, 2);
            assert.equal(runningList.split(',').length, 1);
        });

        it('returns empty string for status with no tasks', () => {
            store.create({ a: 1 });
            assert.equal(engine.TASK_LIST('failed'), '');
            assert.equal(engine.TASK_LIST('completed'), '');
        });

        it('returns empty string when no task store is set', () => {
            const bareEngine = new PixelFormulaEngine(480, 240);
            assert.equal(bareEngine.TASK_LIST(), '');
            assert.equal(bareEngine.TASK_LIST('pending'), '');
        });

        it('resolves cell references for status parameter', () => {
            engine.setCells({ status_filter: 'pending' });
            const t1 = store.create({ x: 1 });
            const list = engine.TASK_LIST('status_filter');
            assert.equal(list, t1.id);
        });
    });

    // ── Cross-function integration ─────────────────────────────

    describe('TASK formulas work together', () => {
        it('TASK_QUEUE_STATUS matches individual TASK_COUNT calls', () => {
            store.create({ a: 1 });
            store.create({ b: 2 });
            store.create({ c: 3 }, 2); // high priority

            store.claim('agent-1');
            store.claim('agent-2'); // won't claim - only 1 highest priority, then next

            const claimed = store.list({ status: 'running' });
            for (const t of claimed) {
                store.complete(t.id, { done: true });
            }

            // Now: 1 completed (first claim), 2 pending (remaining), rest claimable
            const statusStr = engine.TASK_QUEUE_STATUS();
            assert.ok(statusStr.includes(`completed:${claimed.length}`));

            // Individual counts should add up to total
            const total = engine.TASK_COUNT();
            const byStatus =
                engine.TASK_COUNT('pending') +
                engine.TASK_COUNT('running') +
                engine.TASK_COUNT('completed') +
                engine.TASK_COUNT('failed');
            assert.equal(total, byStatus);
        });

        it('TASK_LIST and TASK_COUNT agree for each status', () => {
            store.create({ x: 1 });
            store.create({ x: 2 });
            store.create({ x: 3 });

            const t1 = store.claim('a1');
            store.complete(t1.id, 'done');

            const t2 = store.claim('a2');
            store.fail(t2.id, 'error');

            for (const status of ['pending', 'running', 'completed', 'failed']) {
                const count = engine.TASK_COUNT(status);
                const list = engine.TASK_LIST(status);
                if (count === 0) {
                    assert.equal(list, '');
                } else {
                    assert.equal(list.split(',').length, count);
                }
            }
        });
    });
});
