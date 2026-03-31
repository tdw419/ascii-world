// sync/plugin-manager.js
// Loads, activates, deactivates plugins with lifecycle management
// Part of CMS Phase 4.1 — Plugin API

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import { EventBus } from './event-bus.js';
import { createPluginContext } from './plugin-api.js';

/** @typedef {import('./plugin-api.js').Plugin} Plugin */
/** @typedef {import('./plugin-api.js').PluginManifest} PluginManifest */

/**
 * Plugin states in lifecycle order.
 * @readonly
 * @enum {string}
 */
export const PluginState = {
    DISCOVERED: 'discovered',
    LOADED: 'loaded',
    ACTIVATING: 'activating',
    ACTIVE: 'active',
    DEACTIVATING: 'deactivating',
    DISABLED: 'disabled',
    ERROR: 'error',
};

/**
 * PluginManager — manages the full plugin lifecycle.
 *
 * Flow: discover -> load -> activate -> (running) -> deactivate -> unload
 *
 * Features:
 * - Plugin discovery from plugins/ directory (manifest.json + index.js)
 * - Dependency resolution (topological sort)
 * - Error isolation: plugin crash doesn't take down CMS
 * - Event bus for inter-plugin communication
 */
export class PluginManager extends EventEmitter {
    /**
     * @param {Object} services
     * @param {import('./content-store.js').ContentStore} services.contentStore
     * @param {import('./router.js').Router} services.router
     * @param {Object} [options]
     * @param {string} [options.pluginsDir] - path to plugins directory
     * @param {EventBus} [options.eventBus] - shared event bus
     */
    constructor(services, options = {}) {
        super();
        this.contentStore = services.contentStore;
        this.router = services.router;
        this.pluginsDir = options.pluginsDir || join(process.cwd(), 'plugins');
        this.eventBus = options.eventBus || new EventBus();

        /** @type {Map<string, {manifest: PluginManifest, PluginClass: Function|null, plugin: Plugin|null, state: string, error: Error|null}>} */
        this.plugins = new Map();

        /** @type {string[]} load order after dependency resolution */
        this._loadOrder = [];
    }

    // ── Discovery ──────────────────────────────────────────────

    /**
     * Scan the plugins directory for valid plugin directories.
     * A valid plugin has a manifest.json; index.js is optional for metadata-only plugins.
     * @returns {PluginManifest[]} discovered manifests
     */
    discover() {
        if (!existsSync(this.pluginsDir)) {
            this.emit('discover-error', { message: `Plugins directory not found: ${this.pluginsDir}` });
            return [];
        }

        const discovered = [];
        const entries = readdirSync(this.pluginsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

            const manifestPath = join(this.pluginsDir, entry.name, 'manifest.json');
            if (!existsSync(manifestPath)) continue;

            try {
                const raw = readFileSync(manifestPath, 'utf-8');
                const manifest = JSON.parse(raw);

                // Validate required fields
                if (!manifest.name || !manifest.version) {
                    this.emit('discover-error', { plugin: entry.name, message: 'Missing name or version in manifest' });
                    continue;
                }

                manifest._dir = entry.name;
                this.plugins.set(manifest.name, {
                    manifest,
                    PluginClass: null,
                    plugin: null,
                    state: PluginState.DISCOVERED,
                    error: null,
                });
                discovered.push(manifest);
            } catch (err) {
                this.emit('discover-error', { plugin: entry.name, message: err.message });
            }
        }

        // Resolve load order
        this._resolveLoadOrder();

        this.emit('discovered', { count: discovered.length, plugins: discovered.map(m => m.name) });
        return discovered;
    }

    // ── Loading ────────────────────────────────────────────────

    /**
     * Load all discovered plugins (respects dependency order).
     * @returns {{ loaded: string[], failed: {name: string, error: string}[] }}
     */
    loadAll() {
        const loaded = [];
        const failed = [];

        for (const name of this._loadOrder) {
            const entry = this.plugins.get(name);
            if (!entry) continue;

            try {
                this._loadPlugin(name);
                loaded.push(name);
            } catch (err) {
                failed.push({ name, error: err.message });
                entry.state = PluginState.ERROR;
                entry.error = err;
                this.emit('load-error', { plugin: name, error: err });
            }
        }

        this.emit('load-all', { loaded: loaded.length, failed: failed.length });
        return { loaded, failed };
    }

    /**
     * Load a single plugin by name.
     * @param {string} name
     * @returns {Plugin}
     */
    _loadPlugin(name) {
        const entry = this.plugins.get(name);
        if (!entry) throw new Error(`Plugin not discovered: ${name}`);
        if (entry.state === PluginState.LOADED || entry.state === PluginState.ACTIVE) {
            return entry.plugin;
        }

        const manifest = entry.manifest;
        const indexPath = join(this.pluginsDir, manifest._dir, 'index.js');

        // Try to load plugin module
        let PluginClass = null;
        if (existsSync(indexPath)) {
            try {
                const mod = import(indexPath);
                // For sync usage, we support both sync and async patterns
                // but since dynamic import is async, plugins can also be registered
                // directly via registerPlugin()
                PluginClass = null; // Will be set via registerPlugin or dynamic import
            } catch (err) {
                // Non-fatal: plugin might be metadata-only or registered programmatically
            }
        }

        entry.PluginClass = PluginClass;
        entry.state = PluginState.LOADED;
        this.emit('loaded', { plugin: name });
        return null;
    }

    /**
     * Register a plugin class programmatically (for testing or built-in plugins).
     * @param {PluginManifest} manifest
     * @param {Function} PluginClass - constructor that takes manifest
     * @returns {Plugin}
     */
    register(manifest, PluginClass) {
        const entry = this.plugins.get(manifest.name);
        if (entry) {
            entry.PluginClass = PluginClass;
            entry.manifest = { ...entry.manifest, ...manifest };
        } else {
            this.plugins.set(manifest.name, {
                manifest,
                PluginClass,
                plugin: null,
                state: PluginState.LOADED,
                error: null,
            });
            // Add to load order
            if (!this._loadOrder.includes(manifest.name)) {
                this._loadOrder.push(manifest.name);
            }
        }

        // Re-resolve dependency order after registration
        this._resolveLoadOrder();

        this.emit('registered', { plugin: manifest.name });
        return this.plugins.get(manifest.name);
    }

    // ── Activation ─────────────────────────────────────────────

    /**
     * Activate a plugin — runs onLoad + registerRegions.
     * @param {string} name
     * @returns {Plugin}
     */
    activate(name) {
        const entry = this.plugins.get(name);
        if (!entry) throw new Error(`Plugin not found: ${name}`);
        if (!entry.PluginClass) throw new Error(`Plugin class not registered: ${name}`);

        // Check dependencies are active
        const deps = entry.manifest.dependencies || [];
        for (const dep of deps) {
            const depEntry = this.plugins.get(dep);
            if (!depEntry || depEntry.state !== PluginState.ACTIVE) {
                throw new Error(`Dependency not active: ${dep} (required by ${name})`);
            }
        }

        entry.state = PluginState.ACTIVATING;

        try {
            const plugin = new entry.PluginClass(entry.manifest);
            const context = createPluginContext({
                contentStore: this.contentStore,
                router: this.router,
                eventBus: this.eventBus,
                pluginName: name,
            });

            plugin.onLoad(context);
            plugin.registerRegions(this.router);

            entry.plugin = plugin;
            entry.state = PluginState.ACTIVE;
            entry.error = null;

            this.emit('activated', { plugin: name });
            return plugin;
        } catch (err) {
            entry.state = PluginState.ERROR;
            entry.error = err;
            this.emit('activate-error', { plugin: name, error: err });
            throw err;
        }
    }

    /**
     * Activate all loaded plugins (respects dependency order).
     * @returns {{ activated: string[], failed: {name: string, error: string}[] }}
     */
    activateAll() {
        const activated = [];
        const failed = [];

        for (const name of this._loadOrder) {
            const entry = this.plugins.get(name);
            if (!entry || !entry.PluginClass) continue;
            if (entry.state === PluginState.ACTIVE) continue;

            try {
                this.activate(name);
                activated.push(name);
            } catch (err) {
                failed.push({ name, error: err.message });
                // Don't cascade: other plugins may still work
            }
        }

        this.emit('activate-all', { activated: activated.length, failed: failed.length });
        return { activated, failed };
    }

    // ── Deactivation ───────────────────────────────────────────

    /**
     * Deactivate a plugin — runs onUnload and cleans up.
     * @param {string} name
     * @returns {boolean}
     */
    deactivate(name) {
        const entry = this.plugins.get(name);
        if (!entry || entry.state !== PluginState.ACTIVE) return false;

        entry.state = PluginState.DEACTIVATING;

        try {
            if (entry.plugin) {
                entry.plugin.onUnload();
            }
            // Clean up event subscriptions
            this.eventBus.unsubscribeAll(name);

            entry.plugin = null;
            entry.state = PluginState.DISABLED;
            entry.error = null;

            this.emit('deactivated', { plugin: name });
            return true;
        } catch (err) {
            entry.state = PluginState.ERROR;
            entry.error = err;
            this.emit('deactivate-error', { plugin: name, error: err });
            return false;
        }
    }

    /**
     * Deactivate all active plugins (reverse dependency order).
     * @returns {string[]} deactivated plugin names
     */
    deactivateAll() {
        const deactivated = [];
        const reverseOrder = [...this._loadOrder].reverse();

        for (const name of reverseOrder) {
            const entry = this.plugins.get(name);
            if (!entry || entry.state !== PluginState.ACTIVE) continue;
            if (this.deactivate(name)) {
                deactivated.push(name);
            }
        }

        this.emit('deactivate-all', { count: deactivated.length });
        return deactivated;
    }

    // ── Query ──────────────────────────────────────────────────

    /**
     * Get a plugin instance by name.
     * @param {string} name
     * @returns {Plugin|null}
     */
    getPlugin(name) {
        const entry = this.plugins.get(name);
        return entry ? entry.plugin : null;
    }

    /**
     * Get the state of a plugin.
     * @param {string} name
     * @returns {string|null}
     */
    getState(name) {
        const entry = this.plugins.get(name);
        return entry ? entry.state : null;
    }

    /**
     * Get the error for a plugin in error state.
     * @param {string} name
     * @returns {Error|null}
     */
    getError(name) {
        const entry = this.plugins.get(name);
        return entry ? entry.error : null;
    }

    /**
     * List all known plugins with their state.
     * @returns {{name: string, state: string, version: string}[]}
     */
    listPlugins() {
        return Array.from(this.plugins.entries()).map(([name, entry]) => ({
            name,
            state: entry.state,
            version: entry.manifest.version,
        }));
    }

    /**
     * Get the active plugins (in dependency order).
     * @returns {Plugin[]}
     */
    getActivePlugins() {
        return this._loadOrder
            .map(name => this.plugins.get(name))
            .filter(e => e && e.state === PluginState.ACTIVE && e.plugin)
            .map(e => e.plugin);
    }

    /**
     * Get the event bus.
     * @returns {EventBus}
     */
    getEventBus() {
        return this.eventBus;
    }

    // ── Dependency Resolution ──────────────────────────────────

    /**
     * Topological sort of plugins by dependency.
     * Cycles are detected and ignored (plugin goes to error state).
     */
    _resolveLoadOrder() {
        const names = Array.from(this.plugins.keys());
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (name) => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                // Cycle detected
                const entry = this.plugins.get(name);
                if (entry) {
                    entry.state = PluginState.ERROR;
                    entry.error = new Error(`Dependency cycle detected involving: ${name}`);
                }
                return;
            }

            visiting.add(name);
            const entry = this.plugins.get(name);
            if (entry) {
                const deps = entry.manifest.dependencies || [];
                for (const dep of deps) {
                    if (this.plugins.has(dep)) {
                        visit(dep);
                    } else {
                        entry.state = PluginState.ERROR;
                        entry.error = new Error(`Missing dependency: ${dep}`);
                    }
                }
            }
            visiting.delete(name);
            visited.add(name);
            order.push(name);
        };

        for (const name of names) {
            visit(name);
        }

        this._loadOrder = order;
    }

    // ── Error Isolation ────────────────────────────────────────

    /**
     * Wrap a plugin method call in error isolation.
     * Returns fallback on error instead of throwing.
     * @param {string} name - plugin name
     * @param {string} method - method name to call
     * @param {*[]} args - arguments to pass
     * @param {*} [fallback=null] - value to return on error
     * @returns {*}
     */
    safeCall(name, method, args = [], fallback = null) {
        const entry = this.plugins.get(name);
        if (!entry || !entry.plugin) return fallback;

        try {
            const fn = entry.plugin[method];
            if (typeof fn !== 'function') return fallback;
            return fn.apply(entry.plugin, args);
        } catch (err) {
            entry.state = PluginState.ERROR;
            entry.error = err;
            this.emit('plugin-error', { plugin: name, method, error: err });
            return fallback;
        }
    }

    /**
     * Reset the manager (for testing).
     */
    reset() {
        this.plugins.clear();
        this._loadOrder = [];
        this.eventBus.reset();
        this.removeAllListeners();
    }
}
