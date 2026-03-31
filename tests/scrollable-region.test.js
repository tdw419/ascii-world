// tests/scrollable-region.test.js
// Tests for sync/scrollable-region.js — ScrollableRegion

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScrollableRegion } from '../sync/scrollable-region.js';

// Helper: generate N lines of content
function makeLines(n) {
    return Array.from({ length: n }, (_, i) => `Line ${i}`);
}

describe('ScrollableRegion', () => {
    describe('constructor', () => {
        it('sets width, viewportHeight, and default scrollOffset to 0', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(50) });
            assert.equal(sr.width, 40);
            assert.equal(sr.viewportHeight, 10);
            assert.equal(sr.scrollOffset, 0);
        });

        it('defaults content to empty array when omitted', () => {
            const sr = new ScrollableRegion({ width: 20, height: 5 });
            assert.deepStrictEqual(sr.content, []);
        });
    });

    describe('getVisibleLines()', () => {
        it('returns a slice from scrollOffset to scrollOffset + viewportHeight', () => {
            const sr = new ScrollableRegion({ width: 40, height: 3, content: makeLines(10) });
            assert.deepStrictEqual(sr.getVisibleLines(), ['Line 0', 'Line 1', 'Line 2']);

            sr.scrollDown(2);
            assert.deepStrictEqual(sr.getVisibleLines(), ['Line 2', 'Line 3', 'Line 4']);
        });

        it('returns fewer lines if near the end of content', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(3) });
            assert.deepStrictEqual(sr.getVisibleLines(), ['Line 0', 'Line 1', 'Line 2']);
        });

        it('returns empty array for empty content', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: [] });
            assert.deepStrictEqual(sr.getVisibleLines(), []);
        });
    });

    describe('scrollDown()', () => {
        it('increments scrollOffset by n (default 1)', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            sr.scrollDown();
            assert.equal(sr.scrollOffset, 1);
            sr.scrollDown(3);
            assert.equal(sr.scrollOffset, 4);
        });

        it('clamps to max offset (content.length - viewportHeight)', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(10) });
            sr.scrollDown(100);
            assert.equal(sr.scrollOffset, 5); // 10 - 5 = 5
        });

        it('emits "scroll" event with direction "down" when offset changes', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            const events = [];
            sr.on('scroll', (e) => events.push(e));
            sr.scrollDown();
            assert.equal(events.length, 1);
            assert.equal(events[0].direction, 'down');
            assert.equal(events[0].offset, 1);
        });

        it('does not emit when already at bottom', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(5) });
            const events = [];
            sr.on('scroll', (e) => events.push(e));
            sr.scrollDown();
            assert.equal(events.length, 0);
        });
    });

    describe('scrollUp()', () => {
        it('decrements scrollOffset by n (default 1)', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            sr.scrollDown(5);
            sr.scrollUp();
            assert.equal(sr.scrollOffset, 4);
            sr.scrollUp(2);
            assert.equal(sr.scrollOffset, 2);
        });

        it('clamps to 0', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            sr.scrollUp(10);
            assert.equal(sr.scrollOffset, 0);
        });

        it('emits "scroll" event with direction "up" when offset changes', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            sr.scrollDown(3);
            const events = [];
            sr.on('scroll', (e) => events.push(e));
            sr.scrollUp();
            assert.equal(events.length, 1);
            assert.equal(events[0].direction, 'up');
            assert.equal(events[0].offset, 2);
        });

        it('does not emit when already at top', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            const events = [];
            sr.on('scroll', (e) => events.push(e));
            sr.scrollUp();
            assert.equal(events.length, 0);
        });
    });

    describe('scrollTo()', () => {
        it('sets offset to the specified line', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(50) });
            sr.scrollTo(10);
            assert.equal(sr.scrollOffset, 10);
        });

        it('clamps to 0 for negative values', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(50) });
            sr.scrollTo(-5);
            assert.equal(sr.scrollOffset, 0);
        });

        it('clamps to max offset', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            sr.scrollTo(999);
            assert.equal(sr.scrollOffset, 15); // 20 - 5
        });

        it('emits "scroll" with direction "absolute"', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(50) });
            const events = [];
            sr.on('scroll', (e) => events.push(e));
            sr.scrollTo(7);
            assert.equal(events[0].direction, 'absolute');
        });
    });

    describe('getPageUp() / getPageDown()', () => {
        it('scrolls up by viewportHeight lines', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(100) });
            sr.scrollTo(30);
            sr.getPageUp();
            assert.equal(sr.scrollOffset, 20);
        });

        it('scrolls down by viewportHeight lines', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(100) });
            sr.scrollTo(0);
            sr.getPageDown();
            assert.equal(sr.scrollOffset, 10);
        });

        it('page up clamps to 0', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(100) });
            sr.scrollTo(5);
            sr.getPageUp();
            assert.equal(sr.scrollOffset, 0);
        });

        it('page down clamps to max offset', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(15) });
            sr.scrollTo(3);
            sr.getPageDown();
            assert.equal(sr.scrollOffset, 5); // 15 - 10
        });
    });

    describe('getTotalLines()', () => {
        it('returns content length', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(42) });
            assert.equal(sr.getTotalLines(), 42);
        });

        it('returns 0 for empty content', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: [] });
            assert.equal(sr.getTotalLines(), 0);
        });
    });

    describe('getScrollPercent()', () => {
        it('returns 0 when at the top', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            assert.equal(sr.getScrollPercent(), 0);
        });

        it('returns 100 when at the bottom', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            sr.scrollTo(15); // max = 20 - 5 = 15
            assert.equal(sr.getScrollPercent(), 100);
        });

        it('returns 50 at halfway', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(25) });
            sr.scrollTo(10); // max = 20, 10/20 = 50%
            assert.equal(sr.getScrollPercent(), 50);
        });

        it('returns 0 when content fits the viewport', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(5) });
            assert.equal(sr.getScrollPercent(), 0);
        });
    });

    describe('setContent()', () => {
        it('replaces content and resets offset to 0', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(50) });
            sr.scrollTo(20);
            assert.equal(sr.scrollOffset, 20);

            sr.setContent(makeLines(30));
            assert.equal(sr.scrollOffset, 0);
            assert.equal(sr.getTotalLines(), 30);
        });

        it('emits "scroll" with direction "reset"', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(50) });
            const events = [];
            sr.on('scroll', (e) => events.push(e));
            sr.setContent(makeLines(10));
            assert.equal(events.length, 1);
            assert.equal(events[0].direction, 'reset');
            assert.equal(events[0].offset, 0);
        });
    });

    describe('hasScroll()', () => {
        it('returns true when content exceeds viewport', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            assert.equal(sr.hasScroll(), true);
        });

        it('returns false when content fits exactly', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(10) });
            assert.equal(sr.hasScroll(), false);
        });

        it('returns false when content is shorter than viewport', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(3) });
            assert.equal(sr.hasScroll(), false);
        });

        it('returns false for empty content', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: [] });
            assert.equal(sr.hasScroll(), false);
        });
    });

    describe('getScrollBar()', () => {
        it('returns empty string when content fits viewport', () => {
            const sr = new ScrollableRegion({ width: 40, height: 10, content: makeLines(5) });
            assert.equal(sr.getScrollBar(), '');
        });

        it('returns a multi-line string with thumb indicator', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            const bar = sr.getScrollBar();
            const lines = bar.split('\n');
            assert.equal(lines.length, 5);
            // Exactly one thumb character
            const thumbs = lines.filter(l => l.includes('\u2588'));
            assert.equal(thumbs.length, 1);
        });

        it('places thumb at top when scrollPercent is 0', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            const bar = sr.getScrollBar();
            const lines = bar.split('\n');
            assert.equal(lines[0], '\u2588');
        });

        it('places thumb at bottom when scrollPercent is 100', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            sr.scrollTo(15); // max offset
            const bar = sr.getScrollBar();
            const lines = bar.split('\n');
            assert.equal(lines[4], '\u2588');
        });

        it('accepts a custom position override', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(20) });
            const bar = sr.getScrollBar(50);
            const lines = bar.split('\n');
            // At 50%, thumb should be at index 2 (middle of 5)
            assert.equal(lines[2], '\u2588');
        });
    });

    describe('edge cases', () => {
        it('handles zero-height viewport gracefully', () => {
            const sr = new ScrollableRegion({ width: 40, height: 0, content: makeLines(10) });
            assert.deepStrictEqual(sr.getVisibleLines(), []);
            assert.equal(sr.hasScroll(), false);
            assert.equal(sr.getScrollBar(), '');
        });

        it('scrollDown/scrollUp on empty content does nothing harmful', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: [] });
            sr.scrollDown();
            sr.scrollUp();
            assert.equal(sr.scrollOffset, 0);
            assert.deepStrictEqual(sr.getVisibleLines(), []);
        });

        it('getScrollPercent returns 0 for empty content', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: [] });
            assert.equal(sr.getScrollPercent(), 0);
        });

        it('setContent to empty array works', () => {
            const sr = new ScrollableRegion({ width: 40, height: 5, content: makeLines(50) });
            sr.setContent([]);
            assert.equal(sr.getTotalLines(), 0);
            assert.equal(sr.hasScroll(), false);
            assert.deepStrictEqual(sr.getVisibleLines(), []);
        });

        it('exact fit: content length equals viewport height', () => {
            const lines = makeLines(5);
            const sr = new ScrollableRegion({ width: 40, height: 5, content: lines });
            assert.equal(sr.hasScroll(), false);
            assert.deepStrictEqual(sr.getVisibleLines(), lines);
            sr.scrollDown(); // no-op
            assert.equal(sr.scrollOffset, 0);
        });
    });
});
