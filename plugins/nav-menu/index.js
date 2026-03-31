// plugins/nav-menu/index.js
// Navigation Menu Plugin — renders horizontal menu bar from router's navigation tree
// Part of CMS Phase 4.2 — Built-in Plugins

import { Plugin } from '../../sync/plugin-api.js';

/**
 * NavMenuPlugin renders a horizontal navigation bar from the router's
 * navigation tree. Supports keyboard navigation (arrow keys + enter)
 * and highlights the current page.
 *
 * Region: header
 */
export default class NavMenuPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
        this.currentIndex = 0;
        this.items = [];
        this.currentSlug = null;
        this.dropdownOpen = -1; // index of open dropdown, -1 = none
        this.dropdownIndex = 0; // cursor within dropdown
        this._buffer = [];
        this._unsubs = [];
    }

    onLoad(context) {
        super.onLoad(context);

        // Subscribe to page changes from both the event bus and the router directly
        const handler = (data) => {
            this.currentSlug = data.slug;
            this._syncCursorToCurrentPage();
        };

        context.events.on('page-change', handler);

        // Also subscribe to router's own EventEmitter for page-change
        if (context.router && typeof context.router.on === 'function') {
            context.router.on('page-change', handler);
            this._unsubs.push(() => context.router.off('page-change', handler));
        }

        // Build initial items
        this._rebuildItems();
    }

    registerRegions(layoutEngine) {
        return super.registerRegions(layoutEngine);
    }

    /**
     * Rebuild the flat items list from the router's navigation tree.
     */
    _rebuildItems() {
        this.items = [];
        if (!this.context || !this.context.router) return;

        const tree = this.context.router.getNavigationTree();
        for (const node of tree) {
            this.items.push({
                title: node.title,
                slug: node.slug,
                path: node.path,
                children: node.children || [],
            });
        }

        // Clamp cursor
        if (this.items.length > 0 && this.currentIndex >= this.items.length) {
            this.currentIndex = this.items.length - 1;
        }
    }

    /**
     * Sync the cursor position to the current page slug.
     */
    _syncCursorToCurrentPage() {
        if (!this.currentSlug) return;
        const idx = this.items.findIndex(item => item.slug === this.currentSlug);
        if (idx !== -1) {
            this.currentIndex = idx;
        }
    }

    /**
     * Get the current items list.
     * @returns {Array}
     */
    getItems() {
        return [...this.items];
    }

    /**
     * Get the currently selected index.
     * @returns {number}
     */
    getSelectedIndex() {
        return this.currentIndex;
    }

    /**
     * Is a dropdown currently open?
     * @returns {boolean}
     */
    isDropdownOpen() {
        return this.dropdownOpen >= 0;
    }

    /**
     * Get the current dropdown index.
     * @returns {number}
     */
    getDropdownIndex() {
        return this.dropdownIndex;
    }

    /**
     * Render the navigation menu into the screen buffer.
     * @param {Object} screenManager - screen manager with writeAt method
     * @param {string} region - region name
     */
    render(screenManager, region) {
        if (region !== 'header') return;

        this._buffer = [];
        this._rebuildItems();

        if (this.items.length === 0) {
            this._buffer.push('  [ No navigation items ]');
        } else {
            let line = '';
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                const isCurrent = item.slug === this.currentSlug;
                const isSelected = i === this.currentIndex;

                let label = ` ${item.title} `;
                if (isCurrent) {
                    label = `[${item.title}]`;
                }
                if (isSelected && !isCurrent) {
                    label = `>${item.title}<`;
                }

                // Dropdown indicator
                if (item.children && item.children.length > 0) {
                    label += ' \u25BE'; // ▾
                }

                line += label;
            }
            this._buffer.push(line);
        }

        // Render dropdown if open
        if (this.dropdownOpen >= 0 && this.dropdownOpen < this.items.length) {
            const parent = this.items[this.dropdownOpen];
            if (parent.children && parent.children.length > 0) {
                for (let i = 0; i < parent.children.length; i++) {
                    const child = parent.children[i];
                    const selected = i === this.dropdownIndex;
                    const prefix = selected ? ' > ' : '   ';
                    this._buffer.push(`${prefix}${child.title}`);
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
     * Get the rendered buffer (for testing).
     * @returns {string[]}
     */
    getBuffer() {
        return [...this._buffer];
    }

    /**
     * Handle keyboard input.
     * @param {Object} keyEvent
     * @param {string} focusedRegion
     * @returns {boolean} true if consumed
     */
    handleInput(keyEvent, focusedRegion) {
        if (focusedRegion !== 'header') return false;

        const key = keyEvent.key || keyEvent.name || '';

        // Dropdown navigation
        if (this.dropdownOpen >= 0) {
            if (key === 'up' || key === 'ArrowUp') {
                this.dropdownIndex = Math.max(0, this.dropdownIndex - 1);
                return true;
            }
            if (key === 'down' || key === 'ArrowDown') {
                const parent = this.items[this.dropdownOpen];
                const maxIdx = (parent.children && parent.children.length) ? parent.children.length - 1 : 0;
                this.dropdownIndex = Math.min(maxIdx, this.dropdownIndex + 1);
                return true;
            }
            if (key === 'enter' || key === 'Return') {
                const parent = this.items[this.dropdownOpen];
                if (parent.children && parent.children[this.dropdownIndex]) {
                    const child = parent.children[this.dropdownIndex];
                    this._navigateTo(child.slug);
                }
                this.dropdownOpen = -1;
                return true;
            }
            if (key === 'escape' || key === 'Escape') {
                this.dropdownOpen = -1;
                return true;
            }
            return false;
        }

        // Top-level navigation
        if (key === 'left' || key === 'ArrowLeft') {
            this.currentIndex = Math.max(0, this.currentIndex - 1);
            return true;
        }
        if (key === 'right' || key === 'ArrowRight') {
            this.currentIndex = Math.min(this.items.length - 1, this.currentIndex + 1);
            return true;
        }
        if (key === 'enter' || key === 'Return') {
            const item = this.items[this.currentIndex];
            if (item && item.children && item.children.length > 0) {
                // Open dropdown
                this.dropdownOpen = this.currentIndex;
                this.dropdownIndex = 0;
            } else if (item) {
                this._navigateTo(item.slug);
            }
            return true;
        }
        if (key === 'down' || key === 'ArrowDown') {
            const item = this.items[this.currentIndex];
            if (item && item.children && item.children.length > 0) {
                this.dropdownOpen = this.currentIndex;
                this.dropdownIndex = 0;
                return true;
            }
        }

        return false;
    }

    /**
     * Navigate to a slug using the router.
     * @param {string} slug
     */
    _navigateTo(slug) {
        if (this.context && this.context.router) {
            this.context.router.navigate(slug);
        }
    }

    onUnload() {
        for (const unsub of this._unsubs) unsub();
        this._unsubs = [];
        this.items = [];
        this._buffer = [];
        super.onUnload();
    }
}
