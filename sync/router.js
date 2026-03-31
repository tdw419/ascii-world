// sync/router.js
// CMS Router — Maps slugs to page manifests, supports nested routes,
// generates navigation trees, and maintains a history stack for back navigation.

import { EventEmitter } from 'events';

/**
 * @typedef {Object} RouteMatch
 * @property {string} slug        - Matched route slug
 * @property {Object|null} manifest - Resolved PageManifest (null for 404)
 * @property {Object} params      - Extracted route parameters (e.g., { slug: 'hello' })
 * @property {boolean} is404      - True if no route matched
 */

/**
 * @typedef {Object} NavItem
 * @property {string} title       - Display title
 * @property {string} slug        - Route slug
 * @property {string} path        - Full path (e.g., /blog/my-post)
 * @property {NavItem[]} children - Nested navigation items
 * @property {Object|null} manifest - PageManifest reference
 * @property {string|null} parent  - Parent route slug
 */

export class Router extends EventEmitter {
    /**
     * @param {import('./content-store.js').ContentStore} contentStore
     * @param {Object} [options]
     * @param {number} [options.maxHistory=50] - Max history entries
     */
    constructor(contentStore, options = {}) {
        super();
        this.contentStore = contentStore;
        this.maxHistory = options.maxHistory || 50;

        /** @type {Map<string, Object>} slug -> route definition */
        this.routes = new Map();

        /** @type {Map<string, Object>} pattern -> route with params */
        this.dynamicRoutes = new Map();

        /** @type {string[]} navigation history */
        this.history = [];

        /** @type {number} current position in history (-1 = empty) */
        this.historyIndex = -1;

        /** @type {string|null} current slug */
        this.currentSlug = null;

        // Build initial routes from existing manifests
        this._buildRoutes();
    }

    // ── Route Registration ────────────────────────────────────

    /**
     * Register a route manually.
     * @param {string} slug - Route slug (e.g., '/blog' or '/blog/:slug')
     * @param {Object} [manifest] - Optional page manifest to bind
     */
    addRoute(slug, manifest = null) {
        const normalized = this._normalizeSlug(slug);

        if (normalized.includes(':')) {
            // Dynamic route: /blog/:slug
            this.dynamicRoutes.set(normalized, {
                pattern: normalized,
                manifest,
                regex: this._patternToRegex(normalized),
                paramNames: this._extractParamNames(normalized),
            });
        } else {
            this.routes.set(normalized, {
                slug: normalized,
                manifest,
            });
        }

        this.emit('route-added', { slug: normalized });
    }

    /**
     * Remove a route.
     * @param {string} slug
     * @returns {boolean}
     */
    removeRoute(slug) {
        const normalized = this._normalizeSlug(slug);
        const hadStatic = this.routes.delete(normalized);
        const hadDynamic = this.dynamicRoutes.delete(normalized);
        if (hadStatic || hadDynamic) {
            this.emit('route-removed', { slug: normalized });
            return true;
        }
        return false;
    }

    // ── Route Resolution ──────────────────────────────────────

    /**
     * Resolve a slug/path to a page manifest.
     * @param {string} slug
     * @returns {RouteMatch}
     */
    resolve(slug) {
        const normalized = this._normalizeSlug(slug);

        // 1. Try exact static match
        const staticRoute = this.routes.get(normalized);
        if (staticRoute) {
            // Try to find manifest by slug in content store
            const manifest = staticRoute.manifest || this._findManifestBySlug(normalized);
            return {
                slug: normalized,
                manifest,
                params: {},
                is404: manifest === null,
            };
        }

        // 2. Try dynamic routes
        for (const [pattern, route] of this.dynamicRoutes) {
            const match = normalized.match(route.regex);
            if (match) {
                const params = {};
                for (let i = 0; i < route.paramNames.length; i++) {
                    params[route.paramNames[i]] = match[i + 1];
                }
                // Try to resolve the manifest using params
                let manifest = route.manifest;
                if (!manifest && params.slug) {
                    manifest = this._findManifestBySlug(params.slug);
                }
                return {
                    slug: normalized,
                    manifest,
                    params,
                    is404: manifest === null,
                };
            }
        }

        // 3. Try direct lookup in content store manifests
        const manifest = this._findManifestBySlug(normalized);
        if (manifest) {
            return {
                slug: normalized,
                manifest,
                params: {},
                is404: false,
            };
        }

        // 4. 404
        return {
            slug: normalized,
            manifest: null,
            params: {},
            is404: true,
        };
    }

    /**
     * Navigate to a slug, pushing onto history stack.
     * @param {string} slug
     * @returns {RouteMatch}
     */
    navigate(slug) {
        const result = this.resolve(slug);

        // Only push to history if it's a different slug
        if (this.currentSlug !== result.slug) {
            // Truncate forward history if we're not at the end
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }

            this.history.push(result.slug);

            // Enforce max history
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }

            this.historyIndex = this.history.length - 1;
            this.currentSlug = result.slug;

            this.emit('page-change', { slug: result.slug, manifest: result.manifest, is404: result.is404 });
        }

        return result;
    }

    /**
     * Go back in history.
     * @returns {RouteMatch|null}
     */
    back() {
        if (this.historyIndex <= 0) return null;

        this.historyIndex--;
        const slug = this.history[this.historyIndex];
        this.currentSlug = slug;

        const result = this.resolve(slug);
        this.emit('back', { slug, manifest: result.manifest });
        return result;
    }

    /**
     * Go forward in history.
     * @returns {RouteMatch|null}
     */
    forward() {
        if (this.historyIndex >= this.history.length - 1) return null;

        this.historyIndex++;
        const slug = this.history[this.historyIndex];
        this.currentSlug = slug;

        const result = this.resolve(slug);
        this.emit('forward', { slug, manifest: result.manifest });
        return result;
    }

    /**
     * Check if back navigation is possible.
     * @returns {boolean}
     */
    canGoBack() {
        return this.historyIndex > 0;
    }

    /**
     * Check if forward navigation is possible.
     * @returns {boolean}
     */
    canGoForward() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Get the current history stack.
     * @returns {{ history: string[], index: number, current: string|null }}
     */
    getHistory() {
        return {
            history: [...this.history],
            index: this.historyIndex,
            current: this.currentSlug,
        };
    }

    /**
     * Clear history.
     */
    clearHistory() {
        this.history = [];
        this.historyIndex = -1;
        this.currentSlug = null;
    }

    // ── Navigation Tree ───────────────────────────────────────

    /**
     * Generate a navigation tree from all published page manifests.
     * @returns {NavItem[]}
     */
    getNavigationTree() {
        const manifests = this.contentStore.listManifests();
        const items = [];
        const childMap = new Map(); // parentSlug -> children

        for (const manifest of manifests) {
            const slug = manifest.slug || '';
            const parts = slug.split('/').filter(Boolean);

            // Determine parent
            let parent = null;
            if (parts.length > 1) {
                parent = parts.slice(0, -1).join('/');
            }

            const navItem = {
                title: manifest.title,
                slug: manifest.slug,
                path: '/' + manifest.slug,
                children: [],
                manifest,
                parent,
            };

            if (parent) {
                if (!childMap.has(parent)) childMap.set(parent, []);
                childMap.get(parent).push(navItem);
            } else {
                items.push(navItem);
            }
        }

        // Attach children to parents
        const attachChildren = (navItems) => {
            for (const item of navItems) {
                const children = childMap.get(item.slug);
                if (children) {
                    item.children = children;
                    attachChildren(item.children);
                }
            }
        };

        attachChildren(items);
        return items;
    }

    // ── Internal Helpers ──────────────────────────────────────

    /**
     * Build routes from existing manifests in the content store.
     */
    _buildRoutes() {
        const manifests = this.contentStore.listManifests();
        for (const manifest of manifests) {
            this.routes.set(manifest.slug, {
                slug: manifest.slug,
                manifest,
            });
        }
    }

    /**
     * Find a manifest by slug from the content store.
     * @param {string} slug
     * @returns {Object|null}
     */
    _findManifestBySlug(slug) {
        const manifests = this.contentStore.listManifests();
        return manifests.find(m => m.slug === slug) || null;
    }

    /**
     * Normalize a slug (strip leading/trailing slashes).
     * @param {string} slug
     * @returns {string}
     */
    _normalizeSlug(slug) {
        return slug.replace(/^\/+|\/+$/g, '');
    }

    /**
     * Convert a route pattern like '/blog/:slug' to a RegExp.
     * @param {string} pattern
     * @returns {RegExp}
     */
    _patternToRegex(pattern) {
        const parts = pattern.split('/');
        const regexParts = parts.map(part => {
            if (part.startsWith(':')) {
                return '([^/]+)';
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });
        return new RegExp('^' + regexParts.join('/') + '$');
    }

    /**
     * Extract parameter names from a route pattern.
     * @param {string} pattern
     * @returns {string[]}
     */
    _extractParamNames(pattern) {
        const matches = pattern.match(/:(\w+)/g);
        return matches ? matches.map(m => m.slice(1)) : [];
    }
}
