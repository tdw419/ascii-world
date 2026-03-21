// tests/time-series-store.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TimeSeriesStore } from '../sync/time-series-store.js';

describe('TimeSeriesStore', () => {
    let store;

    beforeEach(() => {
        store = new TimeSeriesStore({ maxPoints: 100, minInterval: 0 });
    });

    it('starts empty', () => {
        assert.strictEqual(store.history.size, 0);
    });

    it('record adds point', () => {
        store.record('cpu', 0.5);
        const history = store.getHistory('cpu');
        assert.strictEqual(history.length, 1);
        assert.strictEqual(history[0].v, 0.5);
    });

    it('getHistory returns empty array for unknown cell', () => {
        const history = store.getHistory('unknown');
        assert.deepStrictEqual(history, []);
    });

    it('recordAll records multiple cells', () => {
        store.recordAll({ cpu: 0.5, mem: 0.8 });
        assert.strictEqual(store.getHistory('cpu').length, 1);
        assert.strictEqual(store.getHistory('mem').length, 1);
    });

    it('trims to maxPoints', () => {
        const smallStore = new TimeSeriesStore({ maxPoints: 5, minInterval: 0 });
        for (let i = 0; i < 10; i++) {
            smallStore.record('cpu', i);
        }
        const history = smallStore.getHistory('cpu');
        assert.strictEqual(history.length, 5);
    });

    it('getValues returns array without timestamps', () => {
        store.record('cpu', 0.1);
        store.record('cpu', 0.2);
        store.record('cpu', 0.3);
        const values = store.getValues('cpu');
        assert.ok(Array.isArray(values));
        assert.strictEqual(values.length, 3);
    });

    it('clear removes cell history', () => {
        store.record('cpu', 0.5);
        store.clear('cpu');
        assert.strictEqual(store.getHistory('cpu').length, 0);
    });

    it('clearAll removes all history', () => {
        store.record('cpu', 0.5);
        store.record('mem', 0.8);
        store.clearAll();
        assert.strictEqual(store.history.size, 0);
    });

    it('getStats returns storage stats', () => {
        store.record('cpu', 0.5);
        store.record('cpu', 0.6);
        store.record('mem', 0.8);
        const stats = store.getStats();
        assert.strictEqual(stats.cellCount, 2);
        assert.strictEqual(stats.totalPoints, 3);
    });

    it('minInterval enforces spacing', () => {
        const intervalStore = new TimeSeriesStore({ minInterval: 100 });
        intervalStore.record('cpu', 0.5);
        const result = intervalStore.record('cpu', 0.6); // Too soon
        assert.strictEqual(result, false);
        assert.strictEqual(intervalStore.getHistory('cpu').length, 1);
    });

    it('getAllHistory returns all cells', () => {
        store.record('cpu', 0.5);
        store.record('mem', 0.8);
        const all = store.getAllHistory();
        assert.ok(all.cpu);
        assert.ok(all.mem);
    });
});
