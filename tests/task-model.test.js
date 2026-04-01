// tests/task-model.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../sync/task-model.js';

describe('Task Model', () => {
    describe('constructor', () => {
        it('creates a task with defaults', () => {
            const task = new Task();
            assert.ok(task.id, 'id should be generated');
            assert.match(task.id, /^[0-9a-f-]{36}$/, 'id should be a UUID');
            assert.equal(task.agentId, null);
            assert.equal(task.status, 'pending');
            assert.deepStrictEqual(task.payload, {});
            assert.equal(task.result, null);
            assert.equal(task.error, null);
            assert.ok(task.createdAt, 'createdAt should be set');
            assert.equal(task.startedAt, null);
            assert.equal(task.completedAt, null);
            assert.equal(task.priority, 1, 'default priority is normal (1)');
        });

        it('accepts all fields from data', () => {
            const ts = new Date().toISOString();
            const task = new Task({
                id: 'task-123',
                agentId: 'agent-456',
                status: 'running',
                payload: { action: 'render', target: 'dashboard' },
                result: { pixels: 100 },
                error: null,
                createdAt: ts,
                startedAt: ts,
                completedAt: null,
                priority: 2,
            });
            assert.equal(task.id, 'task-123');
            assert.equal(task.agentId, 'agent-456');
            assert.equal(task.status, 'running');
            assert.deepStrictEqual(task.payload, { action: 'render', target: 'dashboard' });
            assert.deepStrictEqual(task.result, { pixels: 100 });
            assert.equal(task.error, null);
            assert.equal(task.createdAt, ts);
            assert.equal(task.startedAt, ts);
            assert.equal(task.completedAt, null);
            assert.equal(task.priority, 2);
        });

        it('copies payload object (no shared references)', () => {
            const payload = { key: 'value' };
            const task = new Task({ payload });
            payload.key = 'mutated';
            assert.equal(task.payload.key, 'value');
        });

        it('sets all valid statuses', () => {
            for (const s of ['pending', 'running', 'completed', 'failed']) {
                const task = new Task({ status: s, payload: {} });
                assert.equal(task.status, s);
            }
        });

        it('sets all valid priorities', () => {
            for (const p of [0, 1, 2]) {
                const task = new Task({ priority: p, payload: {} });
                assert.equal(task.priority, p);
            }
        });
    });

    describe('validate()', () => {
        it('returns empty array for valid data with payload', () => {
            const errors = Task.validate({ payload: { action: 'test' } });
            assert.deepStrictEqual(errors, []);
        });

        it('returns error for missing payload', () => {
            const errors = Task.validate({});
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('payload'));
        });

        it('returns error for null payload', () => {
            const errors = Task.validate({ payload: null });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('payload'));
        });

        it('returns error for array payload', () => {
            const errors = Task.validate({ payload: [1, 2, 3] });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('payload'));
        });

        it('returns error for string payload', () => {
            const errors = Task.validate({ payload: 'not an object' });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('payload'));
        });

        it('accepts empty object payload', () => {
            const errors = Task.validate({ payload: {} });
            assert.deepStrictEqual(errors, []);
        });

        it('returns error for invalid status', () => {
            const errors = Task.validate({ payload: {}, status: 'flying' });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('status'));
        });

        it('returns error for invalid priority', () => {
            const errors = Task.validate({ payload: {}, priority: 5 });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('priority'));
        });

        it('returns error for non-string agentId', () => {
            const errors = Task.validate({ payload: {}, agentId: 123 });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('agentId'));
        });

        it('accepts null agentId', () => {
            const errors = Task.validate({ payload: {}, agentId: null });
            assert.deepStrictEqual(errors, []);
        });

        it('returns error for null input', () => {
            const errors = Task.validate(null);
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('required'));
        });

        it('returns error for undefined input', () => {
            const errors = Task.validate(undefined);
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('required'));
        });

        it('returns multiple errors at once', () => {
            const errors = Task.validate({ status: 'bad', priority: 99, agentId: 42 });
            assert.ok(errors.length >= 3);
        });
    });

    describe('toJSON()', () => {
        it('serializes to a plain object with all fields', () => {
            const task = new Task({ payload: { x: 1 }, status: 'running' });
            const json = task.toJSON();
            assert.equal(typeof json, 'object');
            assert.ok('id' in json);
            assert.ok('agentId' in json);
            assert.ok('status' in json);
            assert.ok('payload' in json);
            assert.ok('result' in json);
            assert.ok('error' in json);
            assert.ok('createdAt' in json);
            assert.ok('startedAt' in json);
            assert.ok('completedAt' in json);
            assert.ok('priority' in json);
            assert.equal(json.status, 'running');
            assert.deepStrictEqual(json.payload, { x: 1 });
        });

        it('returns a copy (no shared references)', () => {
            const task = new Task({ payload: { a: 1 } });
            const json = task.toJSON();
            json.payload.a = 99;
            assert.deepStrictEqual(task.payload, { a: 1 });
        });
    });

    describe('fromJSON()', () => {
        it('reconstructs a Task from a plain object', () => {
            const original = new Task({ payload: { k: 'v' }, status: 'completed', priority: 2 });
            const json = original.toJSON();
            const restored = Task.fromJSON(json);
            assert.ok(restored instanceof Task);
            assert.equal(restored.id, original.id);
            assert.equal(restored.status, original.status);
            assert.equal(restored.priority, original.priority);
            assert.deepStrictEqual(restored.payload, original.payload);
        });

        it('returns null for null/undefined input', () => {
            assert.equal(Task.fromJSON(null), null);
            assert.equal(Task.fromJSON(undefined), null);
        });

        it('round-trips cleanly', () => {
            const task = new Task({ payload: { x: 1 }, result: { y: 2 }, priority: 0 });
            const round = Task.fromJSON(task.toJSON());
            assert.deepStrictEqual(round.toJSON(), task.toJSON());
        });

        it('handles empty object input', () => {
            const restored = Task.fromJSON({});
            assert.ok(restored instanceof Task);
            assert.equal(restored.status, 'pending');
            assert.deepStrictEqual(restored.payload, {});
            assert.equal(restored.priority, 1);
        });
    });

    describe('isExpired()', () => {
        it('returns false for pending task', () => {
            const task = new Task({ payload: {} });
            assert.equal(task.isExpired(1000), false);
        });

        it('returns false for completed task', () => {
            const task = new Task({ payload: {}, status: 'completed', startedAt: new Date().toISOString() });
            assert.equal(task.isExpired(1000), false);
        });

        it('returns false for running task within timeout', () => {
            const task = new Task({ payload: {}, status: 'running', startedAt: new Date().toISOString() });
            assert.equal(task.isExpired(60_000), false);
        });

        it('returns true for running task past timeout', () => {
            const startedAt = new Date(Date.now() - 120_000).toISOString();
            const task = new Task({ payload: {}, status: 'running', startedAt });
            assert.equal(task.isExpired(60_000), true);
        });

        it('returns false for running task with no startedAt', () => {
            const task = new Task({ payload: {}, status: 'running' });
            task.startedAt = null;
            assert.equal(task.isExpired(1000), false);
        });

        it('works with zero timeout', () => {
            // A task that started any time in the past is expired with 0 timeout
            const startedAt = new Date(Date.now() - 1).toISOString();
            const task = new Task({ payload: {}, status: 'running', startedAt });
            assert.equal(task.isExpired(0), true);
        });
    });
});
