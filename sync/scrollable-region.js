// sync/scrollable-region.js
// Wraps a layout region to support scrolling long content
// Companion to content-renderer — manages a viewport window into content

import { EventEmitter } from 'events';

/**
 * ScrollableRegion — manages a viewport into an array of content lines.
 *
 * When content is longer than the region height, the scrollable region
 * tracks a scrollOffset and provides methods to navigate up/down by
 * line or by page. Emits 'scroll' on every offset change.
 */
export class ScrollableRegion extends EventEmitter {
    /**
     * @param {{ width: number, height: number, content?: string[] }} opts
     */
    constructor({ width, height, content = [] }) {
        super();
        /** @type {number} */
        this.width = width;
        /** @type {number} visible lines in the viewport */
        this.viewportHeight = height;
        /** @type {string[]} full content lines */
        this.content = content;
        /** @type {number} current top-of-viewport line index */
        this.scrollOffset = 0;
    }

    // ── Viewport ─────────────────────────────────────────────────

    /**
     * Returns the lines currently visible in the viewport.
     * @returns {string[]}
     */
    getVisibleLines() {
        return this.content.slice(
            this.scrollOffset,
            this.scrollOffset + this.viewportHeight
        );
    }

    /**
     * Total number of content lines.
     * @returns {number}
     */
    getTotalLines() {
        return this.content.length;
    }

    /**
     * Scroll position as a percentage (0–100).
     * Returns 0 when content fits entirely in the viewport.
     * @returns {number}
     */
    getScrollPercent() {
        const maxOffset = this._maxOffset();
        if (maxOffset === 0) return 0;
        return Math.round((this.scrollOffset / maxOffset) * 100);
    }

    // ── Scrolling ────────────────────────────────────────────────

    /**
     * Scroll up by n lines. Clamped to 0.
     * @param {number} [n=1]
     */
    scrollUp(n = 1) {
        const prev = this.scrollOffset;
        this.scrollOffset = Math.max(0, this.scrollOffset - n);
        if (this.scrollOffset !== prev) {
            this.emit('scroll', { offset: this.scrollOffset, direction: 'up' });
        }
    }

    /**
     * Scroll down by n lines. Clamped to max offset.
     * @param {number} [n=1]
     */
    scrollDown(n = 1) {
        const prev = this.scrollOffset;
        this.scrollOffset = Math.min(this._maxOffset(), this.scrollOffset + n);
        if (this.scrollOffset !== prev) {
            this.emit('scroll', { offset: this.scrollOffset, direction: 'down' });
        }
    }

    /**
     * Scroll to a specific line index. Clamped to valid range.
     * @param {number} line
     */
    scrollTo(line) {
        const prev = this.scrollOffset;
        this.scrollOffset = Math.max(0, Math.min(this._maxOffset(), line));
        if (this.scrollOffset !== prev) {
            this.emit('scroll', { offset: this.scrollOffset, direction: 'absolute' });
        }
    }

    /**
     * Scroll up by one full viewport page.
     */
    getPageUp() {
        this.scrollUp(this.viewportHeight);
    }

    /**
     * Scroll down by one full viewport page.
     */
    getPageDown() {
        this.scrollDown(this.viewportHeight);
    }

    // ── Content management ───────────────────────────────────────

    /**
     * Replace the content lines and reset scroll offset to 0.
     * @param {string[]} newLines
     */
    setContent(newLines) {
        this.content = newLines;
        this.scrollOffset = 0;
        this.emit('scroll', { offset: 0, direction: 'reset' });
    }

    /**
     * Whether the content exceeds the viewport height (scrolling needed).
     * @returns {boolean}
     */
    hasScroll() {
        return this.viewportHeight > 0 && this.content.length > this.viewportHeight;
    }

    // ── Scrollbar indicator ──────────────────────────────────────

    /**
     * Returns a visual scrollbar indicator string.
     * Uses a single character to represent thumb position within a track.
     *
     * @param {number} [position] — optional override for thumb position (0–100)
     * @returns {string}
     */
    getScrollBar(position) {
        const pct = position !== undefined ? position : this.getScrollPercent();

        // No scrollbar needed if content fits
        if (!this.hasScroll()) return '';

        // Build a simple indicator: track chars with a thumb marker
        const trackLen = this.viewportHeight;
        if (trackLen <= 0) return '';

        const track = [];
        for (let i = 0; i < trackLen; i++) {
            track.push('\u2502'); // │ box-drawing light vertical
        }

        // Place thumb
        const thumbIdx = Math.min(
            Math.round((pct / 100) * (trackLen - 1)),
            trackLen - 1
        );
        track[thumbIdx] = '\u2588'; // █ full block — thumb

        return track.join('\n');
    }

    // ── Internal ─────────────────────────────────────────────────

    /**
     * Maximum valid scroll offset.
     * @returns {number}
     */
    _maxOffset() {
        return Math.max(0, this.content.length - this.viewportHeight);
    }
}
