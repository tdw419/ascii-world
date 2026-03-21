// tests/cell-store.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CellStore } from '../sync/cell-store.js';

describe('CellStore', () => {
    let store;

    beforeEach(() => {
        store = new CellStore();
    });

    it('starts empty', () => {
        assert.deepStrictEqual(store.getCells(), {});
    });

    it('setCells stores values', () => {
        store.setCells({ cpu: 0.67, mem: 28.1 });
        assert.strictEqual(store.getCell('cpu'), 0.67);
        assert.strictEqual(store.getCell('mem'), 28.1);
    });

    it('getCells returns copy', () => {
        store.setCells({ cpu: 0.5 });
        const cells = store.getCells();
        cells.cpu = 0.9;
        assert.strictEqual(store.getCell('cpu'), 0.5);
    });

    it('setCells returns only changed keys', () => {
        store.setCells({ cpu: 0.5 });
        const changes = store.setCells({ cpu: 0.5, mem: 10 });
        assert.deepStrictEqual(changes, { mem: 10 });
    });

    it('subscribe notifies on change', () => {
        let notified = null;
        store.subscribe((changes, cells) => {
            notified = { changes, cells };
        });
        store.setCells({ cpu: 0.75 });
        assert.deepStrictEqual(notified.changes, { cpu: 0.75 });
        assert.strictEqual(notified.cells.cpu, 0.75);
    });

    it('subscribe returns unsubscribe function', () => {
        let count = 0;
        const unsub = store.subscribe(() => count++);
        store.setCells({ cpu: 0.5 });
        assert.strictEqual(count, 1);
        unsub();
        store.setCells({ cpu: 0.6 });
        assert.strictEqual(count, 1);
    });

    it('no notification if no changes', () => {
        let count = 0;
        store.subscribe(() => count++);
        store.setCells({ cpu: 0.5 });
        store.setCells({ cpu: 0.5 });
        assert.strictEqual(count, 1);
    });
});
