// sync/route-table.js
// Declarative route table for HTTP dispatch.
// Supports exact strings and :param segments with precedence rules.

/**
 * @typedef {Object} RouteEntry
 * @property {string} method    - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @property {string} pattern   - Normalized path pattern (e.g. '/api/agents/:agentId')
 * @property {Function} handler - Route handler function
 */

/**
 * @typedef {Object} RouteMatch
 * @property {Function} handler - Matched handler
 * @property {Object} params    - Extracted path parameters
 */

export class RouteTable {
    constructor() {
        /** @type {RouteEntry[]} */
        this.entries = [];

        /** @type {Map<string, RouteEntry>} exact -> entry (for O(1) exact lookup) */
        this._exact = new Map();

        /** @type {{ regex: RegExp, paramNames: string[], entry: RouteEntry }[]} */
        this._parametric = [];
    }

    /**
     * Register a route.
     * @param {string} method  - HTTP method
     * @param {string} pattern - Path pattern (supports :param segments)
     * @param {Function} handler
     */
    register(method, pattern, handler) {
        const normalized = this._normalize(pattern);

        const entry = { method, pattern: normalized, handler };
        this.entries.push(entry);

        if (normalized.includes(':')) {
            this._parametric.push({
                regex: this._patternToRegex(normalized),
                paramNames: this._extractParamNames(normalized),
                entry,
            });
        } else {
            // Key by method+pattern for exact lookup
            const key = `${method}\0${normalized}`;
            if (!this._exact.has(key)) {
                this._exact.set(key, entry);
            }
        }
    }

    /**
     * Match a pathname + method to a route.
     * @param {string} pathname
     * @param {string} method
     * @returns {RouteMatch|null}
     */
    match(pathname, method) {
        const normalized = this._normalize(pathname);

        // 1. Try exact match first (precedence)
        const exactKey = `${method}\0${normalized}`;
        const exactEntry = this._exact.get(exactKey);
        if (exactEntry) {
            return { handler: exactEntry.handler, params: {} };
        }

        // 2. Try parametric routes (first match wins)
        for (const { regex, paramNames, entry } of this._parametric) {
            if (entry.method !== method) continue;
            const m = normalized.match(regex);
            if (m) {
                const params = {};
                for (let i = 0; i < paramNames.length; i++) {
                    params[paramNames[i]] = m[i + 1];
                }
                return { handler: entry.handler, params };
            }
        }

        return null;
    }

    // ── Internal ──────────────────────────────────────────────

    /** Normalize path: ensure leading /, strip trailing / (except root). */
    _normalize(path) {
        let s = path;
        if (!s.startsWith('/')) s = '/' + s;
        if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
        return s;
    }

    /** Convert a pattern like '/api/agents/:agentId' to a RegExp. */
    _patternToRegex(pattern) {
        const parts = pattern.split('/');
        const regexParts = parts.map(part => {
            if (part.startsWith(':')) return '([^/]+)';
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });
        return new RegExp('^' + regexParts.join('/') + '$');
    }

    /** Extract param names from pattern. */
    _extractParamNames(pattern) {
        const matches = pattern.match(/:(\w+)/g);
        return matches ? matches.map(m => m.slice(1)) : [];
    }
}
