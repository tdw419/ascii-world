// tests/agent-log-store.test.js
// Tests for AgentLogStore ring buffer

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentLogStore } from '../sync/agent-log-store.js';

describe('AgentLogStore', () => {
    it('appends a log entry and returns it with timestamp', () => {
        const store = new AgentLogStore();
        const entry = store.append('agent-1', { level: 'info', message: 'hello' });
        assert.equal(entry.level, 'info');
        assert.equal(entry.message, 'hello');
        assert.ok(entry.timestamp > 0);
    });

    it('defaults level to info when not provided', () => {
        const store = new AgentLogStore();
        const entry = store.append('agent-1', { message: 'no level' });
        assert.equal(entry.level, 'info');
    });

    it('returns empty array for unknown agent', () => {
        const store = new AgentLogStore();
        const logs = store.getLogs('ghost');
        assert.deepStrictEqual(logs, []);
    });

    it('returns last N entries with limit', () => {
        const store = new AgentLogStore();
        for (let i = 0; i < 10; i++) {
            store.append('agent-1', { message: `msg-${i}` });
        }
        const logs = store.getLogs('agent-1', { limit: 3 });
        assert.equal(logs.length, 3);
        assert.equal(logs[0].message, 'msg-7');
        assert.equal(logs[1].message, 'msg-8');
        assert.equal(logs[2].message, 'msg-9');
    });

    it('defaults limit to 50', () => {
        const store = new AgentLogStore();
        for (let i = 0; i < 60; i++) {
            store.append('agent-1', { message: `msg-${i}` });
        }
        const logs = store.getLogs('agent-1');
        assert.equal(logs.length, 50);
        assert.equal(logs[0].message, 'msg-10');
        assert.equal(logs[49].message, 'msg-59');
    });

    it('filters by level', () => {
        const store = new AgentLogStore();
        store.append('agent-1', { level: 'error', message: 'err1' });
        store.append('agent-1', { level: 'info', message: 'info1' });
        store.append('agent-1', { level: 'error', message: 'err2' });
        store.append('agent-1', { level: 'warn', message: 'warn1' });

        const errors = store.getLogs('agent-1', { level: 'error' });
        assert.equal(errors.length, 2);
        assert.equal(errors[0].message, 'err1');
        assert.equal(errors[1].message, 'err2');

        const warns = store.getLogs('agent-1', { level: 'warn' });
        assert.equal(warns.length, 1);
        assert.equal(warns[0].message, 'warn1');
    });

    it('applies both limit and level filter', () => {
        const store = new AgentLogStore();
        for (let i = 0; i < 10; i++) {
            store.append('agent-1', { level: 'error', message: `err-${i}` });
        }
        store.append('agent-1', { level: 'info', message: 'noise' });

        const logs = store.getLogs('agent-1', { level: 'error', limit: 3 });
        assert.equal(logs.length, 3);
        assert.equal(logs[0].message, 'err-7');
        assert.equal(logs[2].message, 'err-9');
    });

    it('enforces ring buffer max capacity', () => {
        const store = new AgentLogStore({ maxEntries: 5 });
        for (let i = 0; i < 10; i++) {
            store.append('agent-1', { message: `msg-${i}` });
        }
        const logs = store.getLogs('agent-1', { limit: 100 });
        assert.equal(logs.length, 5);
        assert.equal(logs[0].message, 'msg-5');
        assert.equal(logs[4].message, 'msg-9');
    });

    it('isolates buffers between agents', () => {
        const store = new AgentLogStore();
        store.append('a1', { message: 'hello a1' });
        store.append('a2', { message: 'hello a2' });
        store.append('a1', { message: 'second a1' });

        const a1 = store.getLogs('a1', { limit: 100 });
        const a2 = store.getLogs('a2', { limit: 100 });
        assert.equal(a1.length, 2);
        assert.equal(a2.length, 1);
        assert.equal(a1[0].message, 'hello a1');
        assert.equal(a2[0].message, 'hello a2');
    });

    it('clear() removes entries for a specific agent', () => {
        const store = new AgentLogStore();
        store.append('a1', { message: 'keep' });
        store.append('a2', { message: 'also keep' });
        store.clear('a1');
        assert.deepStrictEqual(store.getLogs('a1'), []);
        assert.equal(store.getLogs('a2').length, 1);
    });

    it('clearAll() removes all entries', () => {
        const store = new AgentLogStore();
        store.append('a1', { message: 'x' });
        store.append('a2', { message: 'y' });
        store.clearAll();
        assert.deepStrictEqual(store.getLogs('a1'), []);
        assert.deepStrictEqual(store.getLogs('a2'), []);
    });
});
