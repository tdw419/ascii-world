// sync/plugin-api.js
// Plugin lifecycle interface for CMS cartridge extensions
// Part of CMS Phase 4.1 — Plugin API

/**
 * @typedef {Object} PluginManifest
 * @property {string} name         - Unique plugin identifier (kebab-case)
 * @property {string} version      - Semver version string
 * @property {string} [description] - Human-readable description
 * @property {string[]} [regions]  - Regions this plugin wants (header, body, sidebar, footer)
 * @property {string[]} [dependencies] - Names of plugins that must load first
 */

/**
 * @typedef {Object} PluginContext
 * @property {import('./content-store.js').ContentStore} contentStore
 * @property {import('./router.js').Router} router
 * @property {import('./event-bus.js').PluginEventBus} events
 * @property {Object} themeManager - Theme manager (placeholder)
 * @property {Function} getLogger  - Returns a scoped logger for the plugin
 */

/**
 * Base plugin interface. Plugins can extend this or implement the same methods.
 *
 * Lifecycle:
 *   1. onLoad(pluginContext)       — receive context, do init
 *   2. registerRegions(layout)     — declare needed regions
 *   3. render(screenManager, region) — render into assigned region
 *   4. handleInput(keyEvent, focusedRegion) — handle keyboard/mouse
 *   5. onUnload()                  — cleanup
 */
export class Plugin {
    /** @param {PluginManifest} manifest */
    constructor(manifest) {
        this.manifest = manifest;
        this.name = manifest.name;
        this.version = manifest.version;
        /** @type {PluginContext|null} */
        this.context = null;
        /** @type {string[]} */
        this.regions = manifest.regions || [];
        /** @type {string[]} */
        this.dependencies = manifest.dependencies || [];
        this._loaded = false;
    }

    /**
     * Called when the plugin is loaded. Receives a context object with
     * access to CMS services.
     * @param {PluginContext} context
     */
    onLoad(context) {
        this.context = context;
        this._loaded = true;
    }

    /**
     * Declare which layout regions this plugin needs.
     * @param {Object} layoutEngine - layout engine to register regions with
     * @returns {string[]} array of region names claimed
     */
    registerRegions(layoutEngine) {
        // Default: return manifest regions
        return [...this.regions];
    }

    /**
     * Render content into the assigned region.
     * @param {Object} screenManager - screen manager for drawing
     * @param {string} region        - region name being rendered
     */
    render(screenManager, region) {
        // Default: no-op
    }

    /**
     * Handle keyboard/mouse input when this plugin's region is focused.
     * @param {Object} keyEvent       - input event
     * @param {string} focusedRegion  - which region has focus
     * @returns {boolean} true if event was consumed
     */
    handleInput(keyEvent, focusedRegion) {
        return false;
    }

    /**
     * Called when the plugin is deactivated/unloaded.
     * Plugins should clean up any subscriptions or resources.
     */
    onUnload() {
        this.context = null;
        this._loaded = false;
    }

    /**
     * Check if plugin is currently loaded.
     * @returns {boolean}
     */
    isLoaded() {
        return this._loaded;
    }
}

/**
 * Create a PluginContext object for a plugin.
 * @param {Object} services
 * @param {import('./content-store.js').ContentStore} services.contentStore
 * @param {import('./router.js').Router} services.router
 * @param {import('./event-bus.js').EventBus} services.eventBus
 * @param {string} services.pluginName
 * @returns {PluginContext}
 */
export function createPluginContext({ contentStore, router, eventBus, pluginName, themeManager = null }) {
    const events = eventBus.forPlugin(pluginName);
    return {
        contentStore,
        router,
        events,
        themeManager,
        getLogger: () => ({
            info: (...args) => console.log(`[plugin:${pluginName}]`, ...args),
            warn: (...args) => console.warn(`[plugin:${pluginName}]`, ...args),
            error: (...args) => console.error(`[plugin:${pluginName}]`, ...args),
        }),
    };
}
