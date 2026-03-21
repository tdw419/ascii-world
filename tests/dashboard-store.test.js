// tests/dashboard-store.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DashboardStore } from '../sync/dashboard-store.js';

describe('DashboardStore', () => {
    let store;

    beforeEach(() => {
        store = new DashboardStore();
    });

    it('starts empty', () => {
        assert.strictEqual(store.list().length, 0);
    });

    it('save stores dashboard', () => {
        const template = [{ fn: 'BAR', args: [0, 0, 'cpu', 40] }];
        const alerts = [{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8 }];
        
        store.save('system-monitor', template, alerts);
        
        assert.strictEqual(store.list().length, 1);
    });

    it('load returns dashboard', () => {
        const template = [{ fn: 'BAR', args: [0, 0, 'cpu', 40] }];
        store.save('test', template);
        
        const loaded = store.load('test');
        assert.ok(loaded);
        assert.strictEqual(loaded.template.length, 1);
    });

    it('load returns null for unknown', () => {
        const loaded = store.load('unknown');
        assert.strictEqual(loaded, null);
    });

    it('list returns summary', () => {
        store.save('test', [{ fn: 'BAR', args: [] }], [{ name: 'alert' }]);
        const list = store.list();
        
        assert.strictEqual(list[0].name, 'test');
        assert.strictEqual(list[0].templateSize, 1);
        assert.strictEqual(list[0].alertCount, 1);
    });

    it('delete removes dashboard', () => {
        store.save('test', []);
        store.delete('test');
        
        assert.strictEqual(store.list().length, 0);
    });

    it('has checks existence', () => {
        store.save('test', []);
        assert.strictEqual(store.has('test'), true);
        assert.strictEqual(store.has('other'), false);
    });

    it('clear removes all', () => {
        store.save('a', []);
        store.save('b', []);
        store.clear();
        
        assert.strictEqual(store.list().length, 0);
    });
});
