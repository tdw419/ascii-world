// plugins/analytics/index.js
// Analytics Plugin — tracks page views, navigation events, time on page
// Part of CMS Phase 4.2 — Built-in Plugins

import { Plugin } from '../../sync/plugin-api.js';

/**
 * AnalyticsPlugin tracks page views, navigation events, and time on page.
 * Renders a compact dashboard in the footer region or a full dashboard in body.
 * Uses time-series-store.js for data storage (when available) or in-memory store.
 *
 * Regions: footer (compact) or body (full dashboard)
 */
export default class AnalyticsPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
        this.pageViews = new Map(); // slug -> count
        this.navEvents = []; // { from, to, timestamp }
        this.timeOnPage = new Map(); // slug -> total ms
        this._currentPage = null;
        this._pageEnterTime = null;
        this.totalSessions = 0;
        this._buffer = [];
        this._timeSeriesStore = null;
        this._unsubs = [];
    }

    onLoad(context) {
        super.onLoad(context);

        // Try to use time-series store if available in context
        if (context.timeSeriesStore) {
            this._timeSeriesStore = context.timeSeriesStore;
        }

        // Track page changes from the router directly (since the router is the source of truth)
        const pageChangeHandler = (data) => {
            this._trackPageChange(data);
        };

        if (context.router && typeof context.router.on === 'function') {
            context.router.on('page-change', pageChangeHandler);
            this._unsubs.push(() => {
                if (context.router) context.router.off('page-change', pageChangeHandler);
            });
        }

        // Also intercept router.navigate to track duplicate navigations
        // (router only emits page-change when slug actually changes)
        if (context.router && typeof context.router.navigate === 'function') {
            const originalNavigate = context.router.navigate.bind(context.router);
            const self = this;
            context.router.navigate = function(slug) {
                // Track even if slug hasn't changed (the router would skip the emit)
                const wasSame = context.router.currentSlug === slug;
                const result = originalNavigate(slug);
                if (wasSame) {
                    // Router didn't emit, so manually track
                    self._trackPageChange({ slug: result.slug, manifest: result.manifest, is404: result.is404 });
                }
                return result;
            };
            this._unsubs.push(() => {
                // Restore on unload if still our wrapper
                if (context.router && context.router.navigate && context.router.navigate._wrapped) {
                    context.router.navigate = originalNavigate;
                }
            });
        }

        // Track navigation events from event bus
        context.events.on('navigation', (data) => {
            this.navEvents.push({
                from: data.from || null,
                to: data.to || null,
                timestamp: Date.now(),
            });
        });
    }

    registerRegions(layoutEngine) {
        return super.registerRegions(layoutEngine);
    }

    /**
     * Track a page change event.
     * @param {Object} data
     * @param {string} data.slug
     */
    _trackPageChange(data) {
        // Record time on previous page
        if (this._currentPage && this._pageEnterTime) {
            const elapsed = Date.now() - this._pageEnterTime;
            const current = this.timeOnPage.get(this._currentPage) || 0;
            this.timeOnPage.set(this._currentPage, current + elapsed);
        }

        // Track page view
        const slug = data.slug;
        const count = this.pageViews.get(slug) || 0;
        this.pageViews.set(slug, count + 1);

        // Record in time-series store if available
        if (this._timeSeriesStore) {
            this._timeSeriesStore.record(`pageview:${slug}`, count + 1);
        }

        // Track nav event
        this.navEvents.push({
            from: this._currentPage,
            to: slug,
            timestamp: Date.now(),
        });

        this._currentPage = slug;
        this._pageEnterTime = Date.now();
        this.totalSessions++;
    }

    /**
     * Get page view count for a slug.
     * @param {string} slug
     * @returns {number}
     */
    getPageViews(slug) {
        return this.pageViews.get(slug) || 0;
    }

    /**
     * Get total page views across all pages.
     * @returns {number}
     */
    getTotalPageViews() {
        let total = 0;
        for (const count of this.pageViews.values()) {
            total += count;
        }
        return total;
    }

    /**
     * Get top pages sorted by view count.
     * @param {number} [limit=10]
     * @returns {Array<{slug: string, views: number}>}
     */
    getTopPages(limit = 10) {
        return Array.from(this.pageViews.entries())
            .map(([slug, views]) => ({ slug, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, limit);
    }

    /**
     * Get time on page for a slug.
     * @param {string} slug
     * @returns {number} milliseconds
     */
    getTimeOnPage(slug) {
        return this.timeOnPage.get(slug) || 0;
    }

    /**
     * Get total sessions (page changes tracked).
     * @returns {number}
     */
    getTotalSessions() {
        return this.totalSessions;
    }

    /**
     * Get navigation events.
     * @param {number} [limit=50]
     * @returns {Array}
     */
    getNavEvents(limit = 50) {
        return this.navEvents.slice(-limit);
    }

    /**
     * Get unique page count.
     * @returns {number}
     */
    getUniquePageCount() {
        return this.pageViews.size;
    }

    /**
     * Render analytics dashboard.
     * @param {Object} screenManager
     * @param {string} region
     */
    render(screenManager, region) {
        if (region !== 'footer' && region !== 'body') return;

        this._buffer = [];

        if (region === 'footer') {
            // Compact footer view
            const totalViews = this.getTotalPageViews();
            const uniquePages = this.getUniquePageCount();
            this._buffer.push(
                `Views:${totalViews} | Pages:${uniquePages} | Sessions:${this.totalSessions}`
            );
        } else {
            // Full dashboard
            this._buffer.push('=== Analytics Dashboard ===');
            this._buffer.push('');

            // Summary
            this._buffer.push(`Total Page Views: ${this.getTotalPageViews()}`);
            this._buffer.push(`Unique Pages: ${this.getUniquePageCount()}`);
            this._buffer.push(`Total Sessions: ${this.totalSessions}`);
            this._buffer.push('');

            // Top pages
            this._buffer.push('Top Pages:');
            const topPages = this.getTopPages(5);
            if (topPages.length === 0) {
                this._buffer.push('  No data yet');
            } else {
                for (const page of topPages) {
                    const bar = '\u2588'.repeat(Math.min(page.views, 30));
                    this._buffer.push(`  ${page.slug}: ${bar} (${page.views})`);
                }
            }

            this._buffer.push('');

            // Time on page
            this._buffer.push('Time on Page:');
            if (this.timeOnPage.size === 0) {
                this._buffer.push('  No data yet');
            } else {
                for (const [slug, ms] of this.timeOnPage) {
                    const seconds = Math.round(ms / 1000);
                    this._buffer.push(`  ${slug}: ${seconds}s`);
                }
            }

            // Recent nav events
            this._buffer.push('');
            this._buffer.push('Recent Navigation:');
            const recentNav = this.navEvents.slice(-5);
            if (recentNav.length === 0) {
                this._buffer.push('  No events yet');
            } else {
                for (const event of recentNav) {
                    const from = event.from || '(start)';
                    this._buffer.push(`  ${from} -> ${event.to}`);
                }
            }
        }

        // Write to screen
        if (screenManager && typeof screenManager.writeAt === 'function') {
            for (let y = 0; y < this._buffer.length; y++) {
                screenManager.writeAt(0, y, this._buffer[y]);
            }
        }
    }

    /**
     * Get the rendered buffer.
     * @returns {string[]}
     */
    getBuffer() {
        return [...this._buffer];
    }

    /**
     * Handle keyboard input (minimal for analytics).
     * @param {Object} keyEvent
     * @param {string} focusedRegion
     * @returns {boolean}
     */
    handleInput(keyEvent, focusedRegion) {
        // Analytics is view-only, no input handling needed
        return false;
    }

    /**
     * Reset all analytics data.
     */
    resetData() {
        this.pageViews.clear();
        this.navEvents = [];
        this.timeOnPage.clear();
        this.totalSessions = 0;
        this._currentPage = null;
        this._pageEnterTime = null;
    }

    onUnload() {
        for (const unsub of this._unsubs) unsub();
        this._unsubs = [];
        this.pageViews.clear();
        this.navEvents = [];
        this.timeOnPage.clear();
        this._buffer = [];
        super.onUnload();
    }
}
