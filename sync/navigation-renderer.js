// sync/navigation-renderer.js
// Renders navigation menus using ScreenManager cells
// Supports horizontal menu bar and vertical sidebar styles
// Keyboard-driven: arrow keys move focus, enter selects

import { EventEmitter } from 'events';

/**
 * @typedef {Object} NavStyle
 * @property {number[]} fg       - Foreground color [r,g,b,a]
 * @property {number[]} bg       - Background color [r,g,b,a]
 * @property {number[]} activeFg - Active/current page foreground
 * @property {number[]} activeBg - Active/current page background
 * @property {number[]} focusFg  - Focused item foreground
 * @property {number[]} focusBg  - Focused item background
 */

const DEFAULT_STYLE = {
    fg: [200, 200, 200, 255],
    bg: [20, 20, 35, 255],
    activeFg: [0, 255, 255, 255],
    activeBg: [20, 20, 35, 255],
    focusFg: [0, 0, 0, 255],
    focusBg: [0, 200, 255, 255],
};

export class NavigationRenderer extends EventEmitter {
    /**
     * @param {import('./router.js').Router} router
     * @param {Object} [options]
     * @param {'horizontal'|'vertical'} [options.style='horizontal']
     * @param {NavStyle} [options.colors] - Custom colors
     * @param {number} [options.padding=1] - Padding between items
     * @param {string} [options.indicator='>'] - Focus indicator
     */
    constructor(router, options = {}) {
        super();
        this.router = router;
        this.layout = options.style || 'horizontal';
        this.colors = { ...DEFAULT_STYLE, ...(options.colors || {}) };
        this.padding = options.padding || 1;
        this.indicator = options.indicator || '>';

        /** @type {number} current focus index */
        this.focusIndex = 0;

        /** @type {Object[]} cached nav items (flattened) */
        this._flatItems = [];

        /** @type {string|null} current page slug for highlight */
        this._currentSlug = null;

        // Listen to router events for auto-updates
        this.router.on('page-change', ({ slug }) => {
            this._currentSlug = slug;
        });
    }

    // ── Public API ────────────────────────────────────────────

    /**
     * Render navigation menu to a ScreenManager.
     * @param {import('./screen-manager.js').ScreenManager} screen
     * @param {number} col - Starting column
     * @param {number} row - Starting row
     * @param {Object} [options]
     * @param {number} [options.maxWidth] - Max width (for truncation)
     * @param {number} [options.maxItems] - Max visible items (for vertical scroll)
     * @param {number} [options.maxDepth] - Max nesting depth (default 1 = flat)
     */
    render(screen, col, row, options = {}) {
        const tree = this.router.getNavigationTree();
        this._flatItems = this._flattenTree(tree, options.maxDepth || 1);

        if (this.focusIndex >= this._flatItems.length) {
            this.focusIndex = Math.max(0, this._flatItems.length - 1);
        }

        if (this.layout === 'horizontal') {
            this._renderHorizontal(screen, col, row, options);
        } else {
            this._renderVertical(screen, col, row, options);
        }
    }

    /**
     * Handle a key event for navigation.
     * @param {Object} keyEvent - From KeyboardInput
     * @param {string} keyEvent.name - Key name (up, down, left, right, enter)
     * @returns {Object|null} Selected nav item on enter, null otherwise
     */
    handleKey(keyEvent) {
        const { name } = keyEvent;

        if (this.layout === 'horizontal') {
            if (name === 'left') {
                this.focusIndex = Math.max(0, this.focusIndex - 1);
                this.emit('focus-changed', { index: this.focusIndex, item: this._flatItems[this.focusIndex] });
                return null;
            }
            if (name === 'right') {
                this.focusIndex = Math.min(this._flatItems.length - 1, this.focusIndex + 1);
                this.emit('focus-changed', { index: this.focusIndex, item: this._flatItems[this.focusIndex] });
                return null;
            }
        } else {
            if (name === 'up') {
                this.focusIndex = Math.max(0, this.focusIndex - 1);
                this.emit('focus-changed', { index: this.focusIndex, item: this._flatItems[this.focusIndex] });
                return null;
            }
            if (name === 'down') {
                this.focusIndex = Math.min(this._flatItems.length - 1, this.focusIndex + 1);
                this.emit('focus-changed', { index: this.focusIndex, item: this._flatItems[this.focusIndex] });
                return null;
            }
        }

        if (name === 'enter') {
            const item = this._flatItems[this.focusIndex];
            if (item) {
                this.emit('selected', { index: this.focusIndex, item });
                return item;
            }
        }

        return null;
    }

    /**
     * Get the currently focused item.
     * @returns {Object|null}
     */
    getFocusedItem() {
        return this._flatItems[this.focusIndex] || null;
    }

    /**
     * Get all flattened items.
     * @returns {Object[]}
     */
    getItems() {
        return [...this._flatItems];
    }

    /**
     * Set focus to a specific index.
     * @param {number} index
     */
    setFocusIndex(index) {
        this.focusIndex = Math.max(0, Math.min(index, this._flatItems.length - 1));
    }

    /**
     * Get the rendered ASCII representation (for testing without ScreenManager).
     * @param {Object} [options]
     * @param {number} [options.maxWidth=80]
     * @param {number} [options.maxItems=20]
     * @returns {string}
     */
    toASCII(options = {}) {
        const tree = this.router.getNavigationTree();
        this._flatItems = this._flattenTree(tree, options.maxDepth || Infinity);

        if (this.focusIndex >= this._flatItems.length) {
            this.focusIndex = Math.max(0, this._flatItems.length - 1);
        }

        const maxWidth = options.maxWidth || 80;

        if (this.layout === 'horizontal') {
            return this._toASCIIHorizontal(maxWidth);
        } else {
            return this._toASCIIVertical(maxWidth);
        }
    }

    // ── Private Renderers ─────────────────────────────────────

    _renderHorizontal(screen, col, row, options) {
        let x = col;
        const maxWidth = options.maxWidth || screen.cols;

        for (let i = 0; i < this._flatItems.length; i++) {
            const item = this._flatItems[i];
            const label = ` ${item.title} `;

            // Determine colors
            const { fg, bg } = this._getItemColors(i);

            // Write label
            for (let c = 0; c < label.length && x + c < maxWidth; c++) {
                screen.setCell(x + c, row, label[c], fg, bg);
            }

            x += label.length;

            // Padding between items
            for (let p = 0; p < this.padding && x < maxWidth; p++) {
                screen.setCell(x, row, ' ', this.colors.fg, this.colors.bg);
                x++;
            }
        }
    }

    _renderVertical(screen, col, row, options) {
        const maxItems = options.maxItems || this._flatItems.length;
        const startIdx = Math.max(0, this.focusIndex - maxItems + 1);

        for (let i = 0; i < Math.min(maxItems, this._flatItems.length - startIdx); i++) {
            const itemIdx = startIdx + i;
            const item = this._flatItems[itemIdx];
            const y = row + i;

            const { fg, bg } = this._getItemColors(itemIdx);

            // Focus indicator
            const indicator = itemIdx === this.focusIndex ? this.indicator : ' ';
            screen.setCell(col, y, indicator, fg, bg);

            // Label
            const label = ` ${item.title} `;
            screen.write(label, col + 1, y, fg, bg);
        }
    }

    _getItemColors(index) {
        const item = this._flatItems[index];
        const isFocused = index === this.focusIndex;
        const isActive = item.slug === this._currentSlug;

        if (isFocused) {
            return { fg: this.colors.focusFg, bg: this.colors.focusBg };
        }
        if (isActive) {
            return { fg: this.colors.activeFg, bg: this.colors.activeBg };
        }
        return { fg: this.colors.fg, bg: this.colors.bg };
    }

    // ── ASCII Renderers (for testing) ─────────────────────────

    _toASCIIHorizontal(maxWidth) {
        const parts = [];
        for (let i = 0; i < this._flatItems.length; i++) {
            const item = this._flatItems[i];
            const isActive = item.slug === this._currentSlug;
            const isFocused = i === this.focusIndex;
            const marker = isFocused ? '>' : isActive ? '*' : ' ';
            parts.push(`${marker}${item.title}${marker}`);
        }
        const line = parts.join('  ');
        return line.substring(0, maxWidth);
    }

    _toASCIIVertical(maxWidth) {
        const lines = [];
        for (let i = 0; i < this._flatItems.length; i++) {
            const item = this._flatItems[i];
            const isActive = item.slug === this._currentSlug;
            const isFocused = i === this.focusIndex;
            const indicator = isFocused ? this.indicator : isActive ? '*' : ' ';
            let line = `${indicator} ${item.title}`;
            if (line.length > maxWidth) line = line.substring(0, maxWidth);
            lines.push(line);
        }
        return lines.join('\n');
    }

    // ── Tree Helpers ──────────────────────────────────────────

    /**
     * Flatten navigation tree into a linear list.
     * @param {Object[]} tree
     * @param {number} maxDepth
     * @param {number} [depth=0]
     * @returns {Object[]}
     */
    _flattenTree(tree, maxDepth, depth = 0) {
        const items = [];
        if (depth >= maxDepth) return items;

        for (const node of tree) {
            items.push({
                title: node.title,
                slug: node.slug,
                path: node.path,
                depth,
                hasChildren: node.children && node.children.length > 0,
            });
            if (node.children && node.children.length > 0) {
                items.push(...this._flattenTree(node.children, maxDepth, depth + 1));
            }
        }
        return items;
    }
}
