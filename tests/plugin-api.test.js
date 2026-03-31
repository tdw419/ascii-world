// tests/plugin-api.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

import { EventBus, PluginEventBus } from '../sync/event-bus.js';
import { Plugin, createPluginContext } from '../sync/plugin-api.js';
import { PluginManager, PluginState } from '../sync/plugin-manager.js';
import { ContentStore } from '../sync/content-store.js';
import { Router } from '../sync/router.js';

// ── Test plugin classes ────────────────────────────────────────

class TestPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
        this.loadCalled = false;
        this.registerCalled = false;
        this.renderCalled = false;
        this.inputResult = false;
        this.unloadCalled = false;
        this.lastRenderArgs = null;
        this.lastInputArgs = null;
    }

    onLoad(ctx) {
        super.onLoad(ctx);
        this.loadCalled = true;
    }

    registerRegions(layoutEngine) {
        this.registerCalled = true;
        return super.registerRegions(layoutEngine);
    }

    render(screenManager, region) {
        this.renderCalled = true;
        this.lastRenderArgs = { screenManager, region };
    }

    handleInput(keyEvent, focusedRegion) {
        this.lastInputArgs = { keyEvent, focusedRegion };
        return this.inputResult;
    }

    onUnload() {
        this.unloadCalled = true;
        super.onUnload();
    }
}

class BrokenPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
    }
    onLoad() {
        throw new Error('broken on load');
    }
}

class BrokenRenderPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
    }
    onLoad(ctx) {
        super.onLoad(ctx);
    }
    render() {
        throw new Error('broken render');
    }
}

// ── Helpers ────────────────────────────────────────────────────

function makeServices() {
    const contentStore = new ContentStore();
    const router = new Router(contentStore);
    return { contentStore, router };
}

function makeManager(services, options = {}) {
    return new PluginManager(services, options);
}

// ── EventBus Tests ─────────────────────────────────────────────

describe('EventBus', () => {
    let bus;

    beforeEach(() => {
        bus = new EventBus();
    });

    describe('Basic pub/sub', () => {
        it('emits events to subscribers', () => {
            let received = null;
            bus.on('page-change', (data) => { received = data; });
            bus.emit('page-change', { slug: 'home' });
            assert.deepStrictEqual(received, { slug: 'home' });
        });

        it('supports multiple subscribers', () => {
            let count = 0;
            bus.on('test', () => count++);
            bus.on('test', () => count++);
            bus.emit('test');
            assert.strictEqual(count, 2);
        });

        it('returns true from emit if handlers called', () => {
            bus.on('test', () => {});
            assert.strictEqual(bus.emit('test'), true);
        });

        it('returns false from emit if no handlers', () => {
            assert.strictEqual(bus.emit('nope'), false);
        });

        it('unsubscribe function removes handler', () => {
            let count = 0;
            const unsub = bus.on('test', () => count++);
            bus.emit('test');
            assert.strictEqual(count, 1);
            unsub();
            bus.emit('test');
            assert.strictEqual(count, 1);
        });

        it('once() fires handler only one time', () => {
            let count = 0;
            bus.once('test', () => count++);
            bus.emit('test');
            bus.emit('test');
            assert.strictEqual(count, 1);
        });
    });

    describe('Plugin scoping', () => {
        it('creates scoped bus for plugin', () => {
            const scoped = bus.forPlugin('my-plugin');
            assert.ok(scoped instanceof PluginEventBus);
        });

        it('scoped bus receives events', () => {
            let received = null;
            const scoped = bus.forPlugin('my-plugin');
            scoped.on('page-change', (data) => { received = data; });
            bus.emit('page-change', { slug: 'about' });
            assert.deepStrictEqual(received, { slug: 'about' });
        });

        it('scoped bus can emit events', () => {
            let received = null;
            bus.on('custom', (data) => { received = data; });
            const scoped = bus.forPlugin('my-plugin');
            scoped.emit('custom', { value: 42 });
            assert.deepStrictEqual(received, { value: 42 });
        });

        it('unsubscribeAll removes all plugin handlers', () => {
            let count = 0;
            const scoped = bus.forPlugin('my-plugin');
            scoped.on('event-a', () => count++);
            scoped.on('event-b', () => count++);
            bus.emit('event-a');
            bus.emit('event-b');
            assert.strictEqual(count, 2);

            const removed = bus.unsubscribeAll('my-plugin');
            assert.strictEqual(removed, 2);
            bus.emit('event-a');
            bus.emit('event-b');
            assert.strictEqual(count, 2); // no new calls
        });

        it('getPluginSubscriptions returns subscribed events', () => {
            const scoped = bus.forPlugin('my-plugin');
            scoped.on('page-change', () => {});
            scoped.on('content-update', () => {});
            const subs = bus.getPluginSubscriptions('my-plugin');
            assert.ok(subs.includes('page-change'));
            assert.ok(subs.includes('content-update'));
        });

        it('getPluginSubscriptions returns empty for unknown plugin', () => {
            const subs = bus.getPluginSubscriptions('unknown');
            assert.deepStrictEqual(subs, []);
        });

        it('unsubscribeAll returns 0 for unknown plugin', () => {
            assert.strictEqual(bus.unsubscribeAll('unknown'), 0);
        });

        it('once() via scoped bus fires once', () => {
            let count = 0;
            const scoped = bus.forPlugin('my-plugin');
            scoped.once('test', () => count++);
            bus.emit('test');
            bus.emit('test');
            assert.strictEqual(count, 1);
        });

        it('scoped off() removes handler', () => {
            let count = 0;
            const handler = () => count++;
            const scoped = bus.forPlugin('my-plugin');
            scoped.on('test', handler);
            bus.emit('test');
            assert.strictEqual(count, 1);
            scoped.off('test', handler);
            bus.emit('test');
            assert.strictEqual(count, 1);
        });
    });

    describe('Canonical events', () => {
        it('lists canonical event names', () => {
            const events = EventBus.getCanonicalEvents();
            assert.ok(events.includes('page-change'));
            assert.ok(events.includes('content-update'));
            assert.ok(events.includes('theme-change'));
            assert.ok(events.includes('input'));
            assert.ok(events.includes('navigation'));
        });
    });

    describe('reset()', () => {
        it('clears all listeners and plugin tracking', () => {
            const scoped = bus.forPlugin('test');
            scoped.on('test', () => {});
            bus.reset();
            assert.deepStrictEqual(bus.getPluginSubscriptions('test'), []);
            assert.strictEqual(bus.emit('test'), false);
        });
    });
});

// ── Plugin Base Class Tests ────────────────────────────────────

describe('Plugin', () => {
    it('stores manifest properties', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0', regions: ['body'], dependencies: [] });
        assert.strictEqual(p.name, 'test');
        assert.strictEqual(p.version, '1.0.0');
        assert.deepStrictEqual(p.regions, ['body']);
        assert.deepStrictEqual(p.dependencies, []);
    });

    it('defaults regions and dependencies to empty arrays', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0' });
        assert.deepStrictEqual(p.regions, []);
        assert.deepStrictEqual(p.dependencies, []);
    });

    it('onLoad sets context and loaded flag', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0' });
        const ctx = { contentStore: {}, router: {}, events: {} };
        p.onLoad(ctx);
        assert.strictEqual(p.context, ctx);
        assert.strictEqual(p.isLoaded(), true);
    });

    it('onUnload clears context and loaded flag', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0' });
        p.onLoad({ contentStore: {}, router: {}, events: {} });
        p.onUnload();
        assert.strictEqual(p.context, null);
        assert.strictEqual(p.isLoaded(), false);
    });

    it('registerRegions returns manifest regions', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0', regions: ['header', 'body'] });
        const regions = p.registerRegions(null);
        assert.deepStrictEqual(regions, ['header', 'body']);
    });

    it('render is a no-op by default', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0' });
        assert.strictEqual(p.render({}, 'body'), undefined);
    });

    it('handleInput returns false by default', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0' });
        assert.strictEqual(p.handleInput({}, 'body'), false);
    });

    it('isLoaded starts false', () => {
        const p = new Plugin({ name: 'test', version: '1.0.0' });
        assert.strictEqual(p.isLoaded(), false);
    });
});

// ── createPluginContext Tests ──────────────────────────────────

describe('createPluginContext', () => {
    it('provides contentStore, router, events, and getLogger', () => {
        const bus = new EventBus();
        const contentStore = new ContentStore();
        const router = new Router(contentStore);
        const ctx = createPluginContext({
            contentStore,
            router,
            eventBus: bus,
            pluginName: 'test-plugin',
        });

        assert.strictEqual(ctx.contentStore, contentStore);
        assert.strictEqual(ctx.router, router);
        assert.ok(ctx.events instanceof PluginEventBus);
        assert.strictEqual(typeof ctx.getLogger, 'function');
    });

    it('getLogger returns a scoped logger', () => {
        const bus = new EventBus();
        const ctx = createPluginContext({
            contentStore: {},
            router: {},
            eventBus: bus,
            pluginName: 'my-plg',
        });
        const logger = ctx.getLogger();
        assert.strictEqual(typeof logger.info, 'function');
        assert.strictEqual(typeof logger.warn, 'function');
        assert.strictEqual(typeof logger.error, 'function');
    });
});

// ── PluginManager Tests ────────────────────────────────────────

describe('PluginManager', () => {
    let services, manager, tmpDir;

    beforeEach(() => {
        services = makeServices();
        tmpDir = mkdtempSync(join(tmpdir(), 'plugin-test-'));
        manager = makeManager(services, { pluginsDir: tmpDir });
    });

    afterEach(() => {
        try { rmSync(tmpDir, { recursive: true }); } catch {}
    });

    describe('Discovery', () => {
        it('returns empty array when plugins dir does not exist', () => {
            const mgr = makeManager(services, { pluginsDir: '/nonexistent' });
            const discovered = mgr.discover();
            assert.deepStrictEqual(discovered, []);
        });

        it('discovers plugins with valid manifest.json', () => {
            mkdirSync(join(tmpDir, 'hello'));
            writeFileSync(join(tmpDir, 'hello', 'manifest.json'), JSON.stringify({
                name: 'hello', version: '1.0.0', regions: ['body'],
            }));

            const discovered = manager.discover();
            assert.strictEqual(discovered.length, 1);
            assert.strictEqual(discovered[0].name, 'hello');
            assert.strictEqual(discovered[0].version, '1.0.0');
        });

        it('skips directories starting with _', () => {
            mkdirSync(join(tmpDir, '_skeleton'));
            writeFileSync(join(tmpDir, '_skeleton', 'manifest.json'), JSON.stringify({
                name: 'skeleton', version: '1.0.0',
            }));

            const discovered = manager.discover();
            assert.strictEqual(discovered.length, 0);
        });

        it('skips directories starting with .', () => {
            mkdirSync(join(tmpDir, '.hidden'));
            writeFileSync(join(tmpDir, '.hidden', 'manifest.json'), JSON.stringify({
                name: 'hidden', version: '1.0.0',
            }));

            const discovered = manager.discover();
            assert.strictEqual(discovered.length, 0);
        });

        it('skips directories without manifest.json', () => {
            mkdirSync(join(tmpDir, 'no-manifest'));

            const discovered = manager.discover();
            assert.strictEqual(discovered.length, 0);
        });

        it('skips manifests missing name or version', () => {
            mkdirSync(join(tmpDir, 'bad'));
            writeFileSync(join(tmpDir, 'bad', 'manifest.json'), JSON.stringify({
                name: 'bad', // no version
            }));

            const discovered = manager.discover();
            assert.strictEqual(discovered.length, 0);
        });

        it('emits discovered event', () => {
            mkdirSync(join(tmpDir, 'hello'));
            writeFileSync(join(tmpDir, 'hello', 'manifest.json'), JSON.stringify({
                name: 'hello', version: '1.0.0',
            }));

            let eventData = null;
            manager.on('discovered', (data) => { eventData = data; });
            manager.discover();
            assert.ok(eventData);
            assert.strictEqual(eventData.count, 1);
            assert.deepStrictEqual(eventData.plugins, ['hello']);
        });
    });

    describe('Programmatic Registration', () => {
        it('registers a plugin class', () => {
            const manifest = { name: 'test', version: '1.0.0', regions: ['body'] };
            manager.register(manifest, TestPlugin);

            assert.strictEqual(manager.getState('test'), PluginState.LOADED);
        });

        it('emits registered event', () => {
            let eventData = null;
            manager.on('registered', (data) => { eventData = data; });
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            assert.deepStrictEqual(eventData, { plugin: 'test' });
        });

        it('register adds to load order', () => {
            manager.register({ name: 'a', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'b', version: '1.0.0' }, TestPlugin);
            assert.ok(manager._loadOrder.includes('a'));
            assert.ok(manager._loadOrder.includes('b'));
        });
    });

    describe('Activation', () => {
        it('activates a registered plugin', () => {
            manager.register({ name: 'test', version: '1.0.0', regions: ['body'] }, TestPlugin);
            const plugin = manager.activate('test');

            assert.ok(plugin instanceof TestPlugin);
            assert.strictEqual(plugin.loadCalled, true);
            assert.strictEqual(plugin.registerCalled, true);
            assert.strictEqual(manager.getState('test'), PluginState.ACTIVE);
        });

        it('provides plugin context on activation', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            const plugin = manager.activate('test');

            assert.ok(plugin.context);
            assert.strictEqual(plugin.context.contentStore, services.contentStore);
            assert.strictEqual(plugin.context.router, services.router);
            assert.ok(plugin.context.events);
        });

        it('throws on unknown plugin', () => {
            assert.throws(() => manager.activate('nope'), /Plugin not found/);
        });

        it('throws when class not registered', () => {
            manager.plugins.set('noclass', {
                manifest: { name: 'noclass', version: '1.0.0' },
                PluginClass: null,
                plugin: null,
                state: PluginState.LOADED,
                error: null,
            });
            assert.throws(() => manager.activate('noclass'), /Plugin class not registered/);
        });

        it('emits activated event', () => {
            let eventData = null;
            manager.on('activated', (data) => { eventData = data; });
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            manager.activate('test');
            assert.deepStrictEqual(eventData, { plugin: 'test' });
        });

        it('isolates errors during activation', () => {
            manager.register({ name: 'broken', version: '1.0.0' }, BrokenPlugin);
            assert.throws(() => manager.activate('broken'), /broken on load/);
            assert.strictEqual(manager.getState('broken'), PluginState.ERROR);
            assert.ok(manager.getError('broken'));
        });
    });

    describe('Dependency Resolution', () => {
        it('resolves load order with dependencies', () => {
            manager.register({ name: 'child', version: '1.0.0', dependencies: ['parent'] }, TestPlugin);
            manager.register({ name: 'parent', version: '1.0.0' }, TestPlugin);

            // After registration, parent should come before child
            const parentIdx = manager._loadOrder.indexOf('parent');
            const childIdx = manager._loadOrder.indexOf('child');
            assert.ok(parentIdx < childIdx);
        });

        it('activates dependencies before dependents', () => {
            manager.register({ name: 'parent', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'child', version: '1.0.0', dependencies: ['parent'] }, TestPlugin);

            const { activated, failed } = manager.activateAll();
            assert.deepStrictEqual(activated, ['parent', 'child']);
            assert.strictEqual(failed.length, 0);
        });

        it('detects missing dependencies', () => {
            manager.plugins.set('orphan', {
                manifest: { name: 'orphan', version: '1.0.0', dependencies: ['missing'] },
                PluginClass: TestPlugin,
                plugin: null,
                state: PluginState.DISCOVERED,
                error: null,
            });
            manager._loadOrder = ['orphan'];

            assert.throws(() => manager.activate('orphan'), /Dependency not active: missing/);
        });

        it('detects dependency cycles during discovery', () => {
            mkdirSync(join(tmpDir, 'a'));
            writeFileSync(join(tmpDir, 'a', 'manifest.json'), JSON.stringify({
                name: 'a', version: '1.0.0', dependencies: ['b'],
            }));
            mkdirSync(join(tmpDir, 'b'));
            writeFileSync(join(tmpDir, 'b', 'manifest.json'), JSON.stringify({
                name: 'b', version: '1.0.0', dependencies: ['a'],
            }));

            mgr_discover: {
                const mgr = makeManager(services, { pluginsDir: tmpDir });
                mgr.discover();
                // At least one should be in error state
                const states = [mgr.getState('a'), mgr.getState('b')];
                assert.ok(states.includes(PluginState.ERROR));
            }
        });
    });

    describe('Deactivation', () => {
        it('deactivates an active plugin', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            manager.activate('test');
            const result = manager.deactivate('test');

            assert.strictEqual(result, true);
            assert.strictEqual(manager.getState('test'), PluginState.DISABLED);
        });

        it('calls onUnload on deactivation', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            const plugin = manager.activate('test');
            manager.deactivate('test');

            assert.strictEqual(plugin.unloadCalled, true);
        });

        it('cleans up event bus subscriptions on deactivation', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            manager.activate('test');
            const bus = manager.getEventBus();
            const subs = bus.getPluginSubscriptions('test');
            // No subs since TestPlugin doesn't subscribe, but verify cleanup runs
            manager.deactivate('test');
            assert.strictEqual(bus.getPluginSubscriptions('test').length, 0);
        });

        it('returns false for inactive plugin', () => {
            assert.strictEqual(manager.deactivate('nope'), false);
        });

        it('deactivateAll reverses order', () => {
            manager.register({ name: 'a', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'b', version: '1.0.0', dependencies: ['a'] }, TestPlugin);
            manager.activateAll();

            const deactivated = manager.deactivateAll();
            // b should deactivate before a
            assert.deepStrictEqual(deactivated, ['b', 'a']);
        });
    });

    describe('Query Methods', () => {
        it('getPlugin returns active plugin instance', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            manager.activate('test');
            const plugin = manager.getPlugin('test');
            assert.ok(plugin instanceof TestPlugin);
        });

        it('getPlugin returns null for inactive plugin', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            assert.strictEqual(manager.getPlugin('test'), null);
        });

        it('getPlugin returns null for unknown plugin', () => {
            assert.strictEqual(manager.getPlugin('nope'), null);
        });

        it('getState returns null for unknown plugin', () => {
            assert.strictEqual(manager.getState('nope'), null);
        });

        it('getError returns null for unknown plugin', () => {
            assert.strictEqual(manager.getError('nope'), null);
        });

        it('listPlugins returns all plugins with state', () => {
            manager.register({ name: 'a', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'b', version: '2.0.0' }, TestPlugin);
            manager.activate('a');

            const list = manager.listPlugins();
            assert.strictEqual(list.length, 2);
            const a = list.find(p => p.name === 'a');
            const b = list.find(p => p.name === 'b');
            assert.strictEqual(a.state, PluginState.ACTIVE);
            assert.strictEqual(a.version, '1.0.0');
            assert.strictEqual(b.state, PluginState.LOADED);
            assert.strictEqual(b.version, '2.0.0');
        });

        it('getActivePlugins returns active instances in order', () => {
            manager.register({ name: 'a', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'b', version: '1.0.0' }, TestPlugin);
            manager.activate('a');
            manager.activate('b');

            const active = manager.getActivePlugins();
            assert.strictEqual(active.length, 2);
            assert.strictEqual(active[0].name, 'a');
            assert.strictEqual(active[1].name, 'b');
        });

        it('getEventBus returns the event bus', () => {
            assert.ok(manager.getEventBus() instanceof EventBus);
        });
    });

    describe('Error Isolation', () => {
        it('safeCall catches errors and sets plugin to error state', () => {
            manager.register({ name: 'broken', version: '1.0.0' }, BrokenRenderPlugin);
            manager.activate('broken');

            const result = manager.safeCall('broken', 'render', [{}, 'body'], 'fallback');
            assert.strictEqual(result, 'fallback');
            assert.strictEqual(manager.getState('broken'), PluginState.ERROR);
            assert.ok(manager.getError('broken'));
        });

        it('safeCall returns fallback for unknown plugin', () => {
            assert.strictEqual(manager.safeCall('nope', 'render', [], 'default'), 'default');
        });

        it('safeCall returns fallback when method missing', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            manager.activate('test');
            assert.strictEqual(manager.safeCall('test', 'nonexistent', [], 42), 42);
        });

        it('safeCall returns method result on success', () => {
            manager.register({ name: 'test', version: '1.0.0' }, TestPlugin);
            manager.activate('test');
            manager.getPlugin('test').inputResult = true;
            const result = manager.safeCall('test', 'handleInput', [{ key: 'a' }, 'body']);
            assert.strictEqual(result, true);
        });
    });

    describe('Load All', () => {
        it('loadAll returns loaded and failed lists', () => {
            mkdirSync(join(tmpDir, 'good'));
            writeFileSync(join(tmpDir, 'good', 'manifest.json'), JSON.stringify({
                name: 'good', version: '1.0.0',
            }));

            manager.discover();
            const result = manager.loadAll();
            assert.ok(result.loaded.includes('good'));
            assert.strictEqual(result.failed.length, 0);
        });
    });

    describe('Activate All', () => {
        it('activateAll activates all registered plugins', () => {
            manager.register({ name: 'a', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'b', version: '1.0.0' }, TestPlugin);

            const { activated, failed } = manager.activateAll();
            assert.strictEqual(activated.length, 2);
            assert.strictEqual(failed.length, 0);
            assert.strictEqual(manager.getState('a'), PluginState.ACTIVE);
            assert.strictEqual(manager.getState('b'), PluginState.ACTIVE);
        });

        it('activateAll skips already active plugins', () => {
            manager.register({ name: 'a', version: '1.0.0' }, TestPlugin);
            manager.activate('a');
            const { activated } = manager.activateAll();
            assert.ok(!activated.includes('a'));
        });

        it('activateAll isolates individual failures', () => {
            manager.register({ name: 'good', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'bad', version: '1.0.0' }, BrokenPlugin);

            const { activated, failed } = manager.activateAll();
            assert.ok(activated.includes('good'));
            assert.ok(failed.find(f => f.name === 'bad'));
            assert.strictEqual(manager.getState('good'), PluginState.ACTIVE);
            assert.strictEqual(manager.getState('bad'), PluginState.ERROR);
        });
    });

    describe('Full Lifecycle Integration', () => {
        it('discovers, loads, activates, deactivates a plugin', () => {
            mkdirSync(join(tmpDir, 'my-plugin'));
            writeFileSync(join(tmpDir, 'my-plugin', 'manifest.json'), JSON.stringify({
                name: 'my-plugin', version: '1.0.0', regions: ['body'],
            }));

            manager.discover();
            manager.register(
                { name: 'my-plugin', version: '1.0.0', regions: ['body'] },
                TestPlugin
            );

            const plugin = manager.activate('my-plugin');
            assert.ok(plugin.loadCalled);
            assert.ok(plugin.registerCalled);
            assert.strictEqual(manager.getState('my-plugin'), PluginState.ACTIVE);

            manager.deactivate('my-plugin');
            assert.strictEqual(manager.getState('my-plugin'), PluginState.DISABLED);
            assert.ok(plugin.unloadCalled);
        });

        it('event bus connects plugins', () => {
            manager.register({ name: 'sender', version: '1.0.0' }, TestPlugin);
            manager.register({ name: 'receiver', version: '1.0.0' }, TestPlugin);
            manager.activate('sender');
            manager.activate('receiver');

            let received = null;
            const receiverPlugin = manager.getPlugin('receiver');
            receiverPlugin.context.events.on('custom-event', (data) => {
                received = data;
            });

            const senderPlugin = manager.getPlugin('sender');
            senderPlugin.context.events.emit('custom-event', { msg: 'hello' });
            assert.deepStrictEqual(received, { msg: 'hello' });
        });
    });

    describe('Reset', () => {
        it('clears all state', () => {
            manager.register({ name: 'a', version: '1.0.0' }, TestPlugin);
            manager.activate('a');
            manager.reset();
            assert.strictEqual(manager.plugins.size, 0);
            assert.strictEqual(manager._loadOrder.length, 0);
            assert.deepStrictEqual(manager.listPlugins(), []);
        });
    });
});
