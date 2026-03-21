// tests/dashboard-store.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, unlinkSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { DashboardStore } from '../sync/dashboard-store.js';

describe('DashboardStore', () => {
    let store;
    const testDir = '/tmp/pxos-test-dashboards';
    const testFile = `${testDir}/dashboards.json`;

    beforeEach(() => {
        store = new DashboardStore();
        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true });
        }
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

    // File persistence tests

    it('saveToFile creates file', (t, done) => {
        const fileStore = new DashboardStore({ 
            filePath: testFile,
            saveDelay: 10
        });
        fileStore.save('test', [{ fn: 'BAR', args: [] }]);
        
        setTimeout(() => {
            assert.ok(existsSync(testFile), 'File should be created');
            done();
        }, 50);
    });

    it('loadFromFile restores dashboards', () => {
        // Create file manually
        mkdirSync(testDir, { recursive: true });
        const data = {
            version: 1,
            dashboards: {
                'saved': {
                    name: 'saved',
                    template: [{ fn: 'BAR', args: [] }],
                    alerts: [],
                    created: 1711050000000
                }
            }
        };
        writeFileSync(testFile, JSON.stringify(data));
        
        const fileStore = new DashboardStore({ filePath: testFile });
        
        assert.strictEqual(fileStore.list().length, 1);
        assert.ok(fileStore.has('saved'));
    });

    it('persists across store instances', (t, done) => {
        const store1 = new DashboardStore({ 
            filePath: testFile,
            saveDelay: 10
        });
        store1.save('persistent', [{ fn: 'TEST', args: [] }]);
        
        setTimeout(() => {
            const store2 = new DashboardStore({ filePath: testFile });
            assert.ok(store2.has('persistent'));
            done();
        }, 50);
    });
});
