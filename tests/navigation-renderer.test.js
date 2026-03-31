// tests/navigation-renderer.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ContentStore } from '../sync/content-store.js';
import { Router } from '../sync/router.js';
import { NavigationRenderer } from '../sync/navigation-renderer.js';

describe('NavigationRenderer', () => {
    let store, router, renderer;

    beforeEach(() => {
        store = new ContentStore();
        router = new Router(store);
    });

    // ── Horizontal Layout ───────────────────────────────────────

    describe('Horizontal Layout', () => {
        beforeEach(() => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
        });

        it('renders empty tree as empty string', () => {
            const ascii = renderer.toASCII();
            assert.strictEqual(ascii, '');
        });

        it('renders single item', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            const ascii = renderer.toASCII();
            assert.ok(ascii.includes('Home'));
        });

        it('renders multiple items separated by spaces', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            const ascii = renderer.toASCII();
            assert.ok(ascii.includes('Home'));
            assert.ok(ascii.includes('About'));
        });

        it('shows focus indicator on first item by default', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            const ascii = renderer.toASCII();
            // First item should have > indicators
            assert.ok(ascii.startsWith('>'));
        });

        it('marks active page with asterisk', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            renderer._currentSlug = 'about';
            const ascii = renderer.toASCII();
            // About should have * since focus is on first item and about is active
            assert.ok(ascii.includes('*About*'));
        });

        it('truncates to maxWidth', () => {
            store.createManifest({ title: 'Very Long Title Here', slug: 'a' });
            store.createManifest({ title: 'Another Long Title', slug: 'b' });
            const ascii = renderer.toASCII({ maxWidth: 20 });
            assert.ok(ascii.length <= 20);
        });
    });

    // ── Vertical Layout ─────────────────────────────────────────

    describe('Vertical Layout', () => {
        beforeEach(() => {
            renderer = new NavigationRenderer(router, { style: 'vertical' });
        });

        it('renders each item on its own line', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            store.createManifest({ title: 'Contact', slug: 'contact' });
            const ascii = renderer.toASCII();
            const lines = ascii.split('\n');
            assert.strictEqual(lines.length, 3);
        });

        it('shows focus indicator > on focused item', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            const ascii = renderer.toASCII();
            const lines = ascii.split('\n');
            assert.ok(lines[0].startsWith('>'));
            assert.ok(lines[1].startsWith(' '));
        });

        it('shows * for active non-focused items', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            renderer._currentSlug = 'about';
            const ascii = renderer.toASCII();
            const lines = ascii.split('\n');
            // First line: focused on home (>)
            assert.ok(lines[0].startsWith('>'));
            // Second line: active about (*)
            assert.ok(lines[1].startsWith('*'));
        });

        it('renders nested items at depth', () => {
            store.createManifest({ title: 'Blog', slug: 'blog' });
            store.createManifest({ title: 'Post', slug: 'blog/post' });
            const ascii = renderer.toASCII();
            const lines = ascii.split('\n');
            assert.strictEqual(lines.length, 2);
            assert.ok(lines[0].includes('Blog'));
            assert.ok(lines[1].includes('Post'));
        });

        it('custom indicator character', () => {
            const custom = new NavigationRenderer(router, {
                style: 'vertical',
                indicator: '->',
            });
            store.createManifest({ title: 'Home', slug: 'home' });
            const ascii = custom.toASCII();
            assert.ok(ascii.startsWith('->'));
        });
    });

    // ── Keyboard Navigation ─────────────────────────────────────

    describe('Keyboard Navigation', () => {
        beforeEach(() => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            store.createManifest({ title: 'Contact', slug: 'contact' });
            // Trigger flatten by calling toASCII
            renderer.toASCII();
        });

        it('right arrow moves focus right', () => {
            renderer.handleKey({ name: 'right' });
            assert.strictEqual(renderer.focusIndex, 1);
        });

        it('left arrow moves focus left', () => {
            renderer.handleKey({ name: 'right' });
            renderer.handleKey({ name: 'left' });
            assert.strictEqual(renderer.focusIndex, 0);
        });

        it('left arrow clamps at 0', () => {
            renderer.handleKey({ name: 'left' });
            assert.strictEqual(renderer.focusIndex, 0);
        });

        it('right arrow clamps at last item', () => {
            renderer.handleKey({ name: 'right' });
            renderer.handleKey({ name: 'right' });
            renderer.handleKey({ name: 'right' }); // beyond last
            assert.strictEqual(renderer.focusIndex, 2);
        });

        it('enter returns focused item', () => {
            renderer.handleKey({ name: 'right' });
            const result = renderer.handleKey({ name: 'enter' });
            assert.ok(result);
            assert.strictEqual(result.title, 'About');
        });

        it('enter on empty returns null', () => {
            const emptyRenderer = new NavigationRenderer(router, { style: 'horizontal' });
            const result = emptyRenderer.handleKey({ name: 'enter' });
            assert.strictEqual(result, null);
        });

        it('enter emits selected event', (t, done) => {
            renderer.on('selected', ({ index, item }) => {
                assert.strictEqual(index, 0);
                assert.strictEqual(item.title, 'Home');
                done();
            });
            renderer.handleKey({ name: 'enter' });
        });

        it('arrow keys emit focus-changed event', (t, done) => {
            renderer.on('focus-changed', ({ index, item }) => {
                assert.strictEqual(index, 1);
                assert.strictEqual(item.title, 'About');
                done();
            });
            renderer.handleKey({ name: 'right' });
        });
    });

    describe('Keyboard Navigation (Vertical)', () => {
        beforeEach(() => {
            renderer = new NavigationRenderer(router, { style: 'vertical' });
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            store.createManifest({ title: 'Contact', slug: 'contact' });
            renderer.toASCII();
        });

        it('down arrow moves focus down', () => {
            renderer.handleKey({ name: 'down' });
            assert.strictEqual(renderer.focusIndex, 1);
        });

        it('up arrow moves focus up', () => {
            renderer.handleKey({ name: 'down' });
            renderer.handleKey({ name: 'up' });
            assert.strictEqual(renderer.focusIndex, 0);
        });

        it('up arrow clamps at 0', () => {
            renderer.handleKey({ name: 'up' });
            assert.strictEqual(renderer.focusIndex, 0);
        });

        it('down arrow clamps at last item', () => {
            renderer.handleKey({ name: 'down' });
            renderer.handleKey({ name: 'down' });
            renderer.handleKey({ name: 'down' });
            assert.strictEqual(renderer.focusIndex, 2);
        });

        it('enter returns focused item', () => {
            renderer.handleKey({ name: 'down' });
            renderer.handleKey({ name: 'down' });
            const result = renderer.handleKey({ name: 'enter' });
            assert.strictEqual(result.title, 'Contact');
        });

        it('left/right do nothing in vertical mode', () => {
            const idx = renderer.focusIndex;
            renderer.handleKey({ name: 'left' });
            assert.strictEqual(renderer.focusIndex, idx);
            renderer.handleKey({ name: 'right' });
            assert.strictEqual(renderer.focusIndex, idx);
        });

        it('up/down do nothing in horizontal mode', () => {
            const horiz = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'X', slug: 'x' });
            horiz.toASCII();
            const idx = horiz.focusIndex;
            horiz.handleKey({ name: 'up' });
            assert.strictEqual(horiz.focusIndex, idx);
            horiz.handleKey({ name: 'down' });
            assert.strictEqual(horiz.focusIndex, idx);
        });
    });

    // ── Focus Management ────────────────────────────────────────

    describe('Focus Management', () => {
        it('getFocusedItem returns current focused', () => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            renderer.toASCII();

            const item = renderer.getFocusedItem();
            assert.strictEqual(item.title, 'Home');
        });

        it('setFocusIndex changes focus', () => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            store.createManifest({ title: 'Contact', slug: 'contact' });
            renderer.toASCII();

            renderer.setFocusIndex(2);
            assert.strictEqual(renderer.focusIndex, 2);
            assert.strictEqual(renderer.getFocusedItem().title, 'Contact');
        });

        it('setFocusIndex clamps to valid range', () => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });
            renderer.toASCII();

            renderer.setFocusIndex(100);
            assert.strictEqual(renderer.focusIndex, 0);
            renderer.setFocusIndex(-5);
            assert.strictEqual(renderer.focusIndex, 0);
        });

        it('focusIndex resets when items change and index is out of bounds', () => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            renderer.toASCII();
            renderer.setFocusIndex(1);

            // Remove one manifest, re-render
            const manifests = store.listManifests();
            store.deleteManifest(manifests[1].id);
            renderer.toASCII();
            assert.strictEqual(renderer.focusIndex, 0);
        });
    });

    // ── getItems ────────────────────────────────────────────────

    describe('getItems', () => {
        it('returns flattened items', () => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });
            renderer.toASCII();

            const items = renderer.getItems();
            assert.strictEqual(items.length, 2);
            assert.strictEqual(items[0].title, 'Home');
            assert.strictEqual(items[1].title, 'About');
        });

        it('returns copies (no mutation leak)', () => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });
            renderer.toASCII();

            const items = renderer.getItems();
            items.push({ title: 'Fake' });
            assert.strictEqual(renderer.getItems().length, 1);
        });
    });

    // ── Custom Colors ───────────────────────────────────────────

    describe('Custom Colors', () => {
        it('accepts custom color scheme', () => {
            const customColors = {
                fg: [255, 0, 0, 255],
                bg: [0, 0, 0, 255],
                activeFg: [0, 255, 0, 255],
                activeBg: [0, 0, 0, 255],
                focusFg: [0, 0, 255, 255],
                focusBg: [255, 255, 0, 255],
            };
            renderer = new NavigationRenderer(router, {
                style: 'horizontal',
                colors: customColors,
            });
            assert.deepStrictEqual(renderer.colors.fg, customColors.fg);
            assert.deepStrictEqual(renderer.colors.focusFg, customColors.focusFg);
        });

        it('merges partial custom colors with defaults', () => {
            renderer = new NavigationRenderer(router, {
                style: 'horizontal',
                colors: { fg: [100, 100, 100, 255] },
            });
            assert.deepStrictEqual(renderer.colors.fg, [100, 100, 100, 255]);
            // Others should still be defaults
            assert.ok(Array.isArray(renderer.colors.activeFg));
        });
    });

    // ── Router Integration ──────────────────────────────────────

    describe('Router Integration', () => {
        it('listens to page-change event from router', (t, done) => {
            renderer = new NavigationRenderer(router, { style: 'horizontal' });
            store.createManifest({ title: 'Home', slug: 'home' });

            // Navigate triggers page-change
            router.on('page-change', () => {
                // Give renderer a tick to process
                setImmediate(() => {
                    assert.strictEqual(renderer._currentSlug, 'home');
                    done();
                });
            });
            router.navigate('home');
        });
    });
});
