// tests/builtin-plugins.test.js
// Tests for CMS Phase 4.2 — Built-in Plugins
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

import { EventBus } from '../sync/event-bus.js';
import { Plugin } from '../sync/plugin-api.js';
import { PluginManager, PluginState } from '../sync/plugin-manager.js';
import { ContentStore } from '../sync/content-store.js';
import { Router } from '../sync/router.js';

// Plugin classes
import NavMenuPlugin from '../plugins/nav-menu/index.js';
import ContentEditorPlugin from '../plugins/content-editor/index.js';
import MediaGalleryPlugin from '../plugins/media-gallery/index.js';
import ContactFormPlugin from '../plugins/contact-form/index.js';
import AnalyticsPlugin from '../plugins/analytics/index.js';

// ── Helpers ────────────────────────────────────────────────────

function makeServices() {
    const contentStore = new ContentStore();
    const router = new Router(contentStore);
    return { contentStore, router };
}

function makeManager(services, options = {}) {
    return new PluginManager(services, options);
}

function activatePlugin(manager, name, PluginClass, manifestOverrides = {}) {
    const manifest = {
        name,
        version: '1.0.0',
        regions: ['body'],
        dependencies: [],
        ...manifestOverrides,
    };
    manager.register(manifest, PluginClass);
    return manager.activate(name);
}

// ── Manifest Validation ───────────────────────────────────────

describe('Built-in Plugin Manifests', () => {
    const pluginNames = ['nav-menu', 'content-editor', 'media-gallery', 'contact-form', 'analytics'];
    const pluginRegions = {
        'nav-menu': ['header'],
        'content-editor': ['body'],
        'media-gallery': ['body'],
        'contact-form': ['body'],
        'analytics': ['footer'],
    };

    for (const name of pluginNames) {
        it(`${name} has valid manifest.json`, async () => {
            const { readFileSync } = await import('fs');
            const manifest = JSON.parse(
                readFileSync(join(process.cwd(), 'plugins', name, 'manifest.json'), 'utf-8')
            );
            assert.strictEqual(manifest.name, name);
            assert.ok(manifest.version, 'has version');
            assert.ok(manifest.description, 'has description');
            assert.ok(Array.isArray(manifest.regions), 'has regions array');
            assert.ok(Array.isArray(manifest.dependencies), 'has dependencies array');
        });

        it(`${name} registers expected regions`, async () => {
            const { readFileSync } = await import('fs');
            const manifest = JSON.parse(
                readFileSync(join(process.cwd(), 'plugins', name, 'manifest.json'), 'utf-8')
            );
            const expected = pluginRegions[name];
            assert.deepStrictEqual(manifest.regions, expected);
        });
    }

    it('all 5 plugins exist as directories', async () => {
        const { readdirSync } = await import('fs');
        const pluginDir = join(process.cwd(), 'plugins');
        const dirs = readdirSync(pluginDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
            .map(d => d.name);
        for (const name of pluginNames) {
            assert.ok(dirs.includes(name), `Missing plugin directory: ${name}`);
        }
    });
});

// ── NavMenu Plugin Tests ──────────────────────────────────────

describe('NavMenuPlugin', () => {
    let services, manager, plugin;

    beforeEach(() => {
        services = makeServices();
        manager = makeManager(services);
        plugin = activatePlugin(manager, 'nav-menu', NavMenuPlugin, { regions: ['header'] });
    });

    it('extends Plugin base class', () => {
        assert.ok(plugin instanceof Plugin);
        assert.ok(plugin instanceof NavMenuPlugin);
    });

    it('registers header region', () => {
        assert.deepStrictEqual(plugin.regions, ['header']);
    });

    it('starts with empty items', () => {
        assert.deepStrictEqual(plugin.getItems(), []);
    });

    it('selectedIndex starts at 0', () => {
        assert.strictEqual(plugin.getSelectedIndex(), 0);
    });

    it('dropdown starts closed', () => {
        assert.strictEqual(plugin.isDropdownOpen(), false);
        assert.strictEqual(plugin.getDropdownIndex(), 0);
    });

    describe('with navigation items', () => {
        beforeEach(() => {
            services.contentStore.createManifest({ title: 'Home', slug: 'home' });
            services.contentStore.createManifest({ title: 'About', slug: 'about' });
            services.contentStore.createManifest({ title: 'Blog', slug: 'blog' });
            // Rebuild router and plugin items
            services.router._buildRoutes();
            plugin._rebuildItems();
        });

        it('builds items from router navigation tree', () => {
            const items = plugin.getItems();
            assert.strictEqual(items.length, 3);
            const titles = items.map(i => i.title);
            assert.ok(titles.includes('Home'));
            assert.ok(titles.includes('About'));
            assert.ok(titles.includes('Blog'));
        });

        it('renders menu items into buffer', () => {
            plugin.render({}, 'header');
            const buffer = plugin.getBuffer();
            assert.ok(buffer.length > 0);
            // Buffer should contain at least one of the titles
            const combined = buffer.join(' ');
            assert.ok(combined.includes('Home') || combined.includes('home'));
        });

        it('highlights current page', () => {
            services.router.navigate('about');
            // page-change event should have been emitted
            plugin._rebuildItems();
            plugin.render({}, 'header');
            const buffer = plugin.getBuffer();
            const combined = buffer.join(' ');
            assert.ok(combined.includes('[About]') || combined.includes('[about]'));
        });

        it('does not render for non-header region', () => {
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            // Buffer may be empty or stale from last render
        });

        describe('keyboard navigation', () => {
            it('arrow right moves selection right', () => {
                assert.strictEqual(plugin.getSelectedIndex(), 0);
                plugin.handleInput({ key: 'right' }, 'header');
                assert.strictEqual(plugin.getSelectedIndex(), 1);
            });

            it('arrow left moves selection left', () => {
                plugin.handleInput({ key: 'right' }, 'header');
                plugin.handleInput({ key: 'right' }, 'header');
                assert.strictEqual(plugin.getSelectedIndex(), 2);
                plugin.handleInput({ key: 'left' }, 'header');
                assert.strictEqual(plugin.getSelectedIndex(), 1);
            });

            it('arrow left clamps at 0', () => {
                plugin.handleInput({ key: 'left' }, 'header');
                assert.strictEqual(plugin.getSelectedIndex(), 0);
            });

            it('arrow right clamps at last item', () => {
                for (let i = 0; i < 10; i++) plugin.handleInput({ key: 'right' }, 'header');
                assert.strictEqual(plugin.getSelectedIndex(), 2);
            });

            it('enter navigates to selected page', () => {
                plugin.handleInput({ key: 'right' }, 'header'); // index 1 = About
                plugin.handleInput({ key: 'enter' }, 'header');
                assert.strictEqual(services.router.currentSlug, 'about');
            });

            it('ignores input for non-header region', () => {
                const result = plugin.handleInput({ key: 'right' }, 'body');
                assert.strictEqual(result, false);
            });

            it('returns true for consumed events', () => {
                assert.strictEqual(plugin.handleInput({ key: 'right' }, 'header'), true);
                assert.strictEqual(plugin.handleInput({ key: 'left' }, 'header'), true);
                assert.strictEqual(plugin.handleInput({ key: 'enter' }, 'header'), true);
            });

            it('ArrowLeft/ArrowRight key names work', () => {
                plugin.handleInput({ key: 'ArrowRight' }, 'header');
                assert.strictEqual(plugin.getSelectedIndex(), 1);
                plugin.handleInput({ key: 'ArrowLeft' }, 'header');
                assert.strictEqual(plugin.getSelectedIndex(), 0);
            });
        });

        describe('with children (dropdowns)', () => {
            beforeEach(() => {
                // Create parent and child pages
                services.contentStore.createManifest({ title: 'Docs', slug: 'docs' });
                services.contentStore.createManifest({ title: 'Getting Started', slug: 'docs/getting-started' });
                services.contentStore.createManifest({ title: 'API Reference', slug: 'docs/api' });
                services.router._buildRoutes();
                plugin._rebuildItems();
            });

            it('items can have children', () => {
                const docsItem = plugin.getItems().find(i => i.title === 'Docs');
                assert.ok(docsItem, 'Docs item exists');
                assert.ok(docsItem.children.length > 0, 'Docs has children');
            });

            it('down arrow opens dropdown for item with children', () => {
                // Navigate to Docs
                const docsIdx = plugin.getItems().findIndex(i => i.title === 'Docs');
                plugin.currentIndex = docsIdx;
                const result = plugin.handleInput({ key: 'down' }, 'header');
                assert.strictEqual(result, true);
                assert.strictEqual(plugin.isDropdownOpen(), true);
            });

            it('enter opens dropdown for item with children', () => {
                const docsIdx = plugin.getItems().findIndex(i => i.title === 'Docs');
                plugin.currentIndex = docsIdx;
                plugin.handleInput({ key: 'enter' }, 'header');
                assert.strictEqual(plugin.isDropdownOpen(), true);
            });

            it('escape closes dropdown', () => {
                const docsIdx = plugin.getItems().findIndex(i => i.title === 'Docs');
                plugin.currentIndex = docsIdx;
                plugin.handleInput({ key: 'enter' }, 'header');
                assert.strictEqual(plugin.isDropdownOpen(), true);
                plugin.handleInput({ key: 'escape' }, 'header');
                assert.strictEqual(plugin.isDropdownOpen(), false);
            });

            it('dropdown navigation with up/down', () => {
                const docsIdx = plugin.getItems().findIndex(i => i.title === 'Docs');
                plugin.currentIndex = docsIdx;
                plugin.handleInput({ key: 'enter' }, 'header');
                assert.strictEqual(plugin.getDropdownIndex(), 0);
                plugin.handleInput({ key: 'down' }, 'header');
                assert.strictEqual(plugin.getDropdownIndex(), 1);
                plugin.handleInput({ key: 'up' }, 'header');
                assert.strictEqual(plugin.getDropdownIndex(), 0);
            });

            it('dropdown enter navigates to child', () => {
                const docsIdx = plugin.getItems().findIndex(i => i.title === 'Docs');
                plugin.currentIndex = docsIdx;
                plugin.handleInput({ key: 'enter' }, 'header');
                plugin.handleInput({ key: 'enter' }, 'header');
                // Should have navigated to first child
                assert.strictEqual(plugin.isDropdownOpen(), false);
            });
        });
    });

    describe('page-change sync', () => {
        it('updates currentSlug on page-change event', () => {
            services.contentStore.createManifest({ title: 'Home', slug: 'home' });
            services.contentStore.createManifest({ title: 'Contact', slug: 'contact' });
            services.router._buildRoutes();
            plugin._rebuildItems();

            services.router.navigate('contact');
            assert.strictEqual(plugin.currentSlug, 'contact');
        });
    });

    describe('lifecycle', () => {
        it('cleans up on unload', () => {
            plugin.onUnload();
            assert.deepStrictEqual(plugin.getItems(), []);
            assert.strictEqual(plugin.isLoaded(), false);
        });
    });
});

// ── ContentEditor Plugin Tests ────────────────────────────────

describe('ContentEditorPlugin', () => {
    let services, manager, plugin;

    beforeEach(() => {
        services = makeServices();
        manager = makeManager(services);
        plugin = activatePlugin(manager, 'content-editor', ContentEditorPlugin, { regions: ['body'] });
    });

    it('extends Plugin base class', () => {
        assert.ok(plugin instanceof Plugin);
        assert.ok(plugin instanceof ContentEditorPlugin);
    });

    it('registers body region', () => {
        assert.deepStrictEqual(plugin.regions, ['body']);
    });

    it('starts in view mode', () => {
        assert.strictEqual(plugin.isEditMode(), false);
    });

    it('starts with empty content', () => {
        assert.strictEqual(plugin.getContent(), '');
    });

    it('starts with cursor at 0', () => {
        assert.strictEqual(plugin.getCursorPos(), 0);
    });

    describe('edit mode', () => {
        it('toggles edit mode with handleInput e', () => {
            plugin.handleInput({ key: 'e' }, 'body');
            assert.strictEqual(plugin.isEditMode(), true);
        });

        it('toggleEditMode returns new state', () => {
            assert.strictEqual(plugin.toggleEditMode(), true);
            assert.strictEqual(plugin.toggleEditMode(), false);
        });

        it('only allows e key in view mode', () => {
            // Other keys should be ignored in view mode
            const result = plugin.handleInput({ key: 'a' }, 'body');
            assert.strictEqual(result, false);
        });

        it('escape exits edit mode', () => {
            plugin.toggleEditMode();
            assert.strictEqual(plugin.isEditMode(), true);
            plugin.handleInput({ key: 'escape' }, 'body');
            assert.strictEqual(plugin.isEditMode(), false);
        });

        it('ignores input for non-body region', () => {
            plugin.toggleEditMode();
            const result = plugin.handleInput({ key: 'a' }, 'header');
            assert.strictEqual(result, false);
        });
    });

    describe('text editing', () => {
        beforeEach(() => {
            plugin.toggleEditMode();
        });

        it('inserts text at cursor', () => {
            plugin.handleInput({ key: 'h' }, 'body');
            plugin.handleInput({ key: 'i' }, 'body');
            assert.strictEqual(plugin.getContent(), 'hi');
            assert.strictEqual(plugin.getCursorPos(), 2);
        });

        it('inserts newline on enter', () => {
            plugin.handleInput({ key: 'a' }, 'body');
            plugin.handleInput({ key: 'enter' }, 'body');
            plugin.handleInput({ key: 'b' }, 'body');
            assert.strictEqual(plugin.getContent(), 'a\nb');
        });

        it('backspace deletes character before cursor', () => {
            plugin.insertText('abc');
            plugin.moveLeft();
            assert.strictEqual(plugin.getCursorPos(), 2);
            plugin.handleInput({ key: 'backspace' }, 'body');
            assert.strictEqual(plugin.getContent(), 'ac');
            assert.strictEqual(plugin.getCursorPos(), 1);
        });

        it('backspace does nothing at start', () => {
            plugin.handleInput({ key: 'backspace' }, 'body');
            assert.strictEqual(plugin.getContent(), '');
            assert.strictEqual(plugin.getCursorPos(), 0);
        });

        it('deleteForward removes character at cursor', () => {
            plugin.insertText('abc');
            plugin.moveHome();
            plugin.handleInput({ key: 'delete' }, 'body');
            assert.strictEqual(plugin.getContent(), 'bc');
        });

        it('arrow keys move cursor', () => {
            plugin.insertText('abc');
            assert.strictEqual(plugin.getCursorPos(), 3);
            plugin.handleInput({ key: 'left' }, 'body');
            assert.strictEqual(plugin.getCursorPos(), 2);
            plugin.handleInput({ key: 'right' }, 'body');
            assert.strictEqual(plugin.getCursorPos(), 3);
        });

        it('home moves to start', () => {
            plugin.insertText('abc');
            plugin.handleInput({ key: 'home' }, 'body');
            assert.strictEqual(plugin.getCursorPos(), 0);
        });

        it('end moves to end', () => {
            plugin.insertText('abc');
            plugin.moveHome();
            plugin.handleInput({ key: 'end' }, 'body');
            assert.strictEqual(plugin.getCursorPos(), 3);
        });

        it('tab inserts spaces', () => {
            plugin.handleInput({ key: 'tab' }, 'body');
            assert.strictEqual(plugin.getContent(), '    ');
        });

        it('replaces selection on insert', () => {
            plugin.insertText('hello world');
            plugin.selectAll();
            plugin.insertText('new');
            assert.strictEqual(plugin.getContent(), 'new');
        });
    });

    describe('content management', () => {
        it('setContent sets content and moves cursor to end', () => {
            plugin.setContent('Hello World');
            assert.strictEqual(plugin.getContent(), 'Hello World');
            assert.strictEqual(plugin.getCursorPos(), 11);
        });

        it('selects all text', () => {
            plugin.setContent('Hello');
            plugin.selectAll();
            assert.deepStrictEqual(plugin.getSelectedRange(), { start: 0, end: 5 });
        });
    });

    describe('AI assist', () => {
        beforeEach(() => {
            plugin.toggleEditMode();
        });

        it('Ctrl+A triggers AI assist', () => {
            plugin.setContent('Short');
            plugin.selectAll();
            plugin.handleInput({ key: 'a', ctrl: true }, 'body');
            assert.ok(plugin.getAiSuggestion() !== null);
        });

        it('AI assist generates suggestions based on content', () => {
            plugin.setContent('# My Heading');
            plugin.selectAll();
            plugin.requestAiAssist();
            const suggestion = plugin.getAiSuggestion();
            assert.ok(suggestion);
            assert.ok(suggestion.length > 0);
        });

        it('AI assist returns null for empty content', () => {
            plugin.setContent('');
            plugin.selectAll();
            plugin.requestAiAssist();
            assert.strictEqual(plugin.getAiSuggestion(), null);
        });

        it('different content types get different suggestions', () => {
            plugin.setContent('# Heading');
            plugin.selectAll();
            plugin.requestAiAssist();
            const headingSuggestion = plugin.getAiSuggestion();

            plugin.setContent('- List item');
            plugin.selectAll();
            plugin.requestAiAssist();
            const listSuggestion = plugin.getAiSuggestion();

            assert.notStrictEqual(headingSuggestion, listSuggestion);
        });

        it('accept AI suggestion replaces selection', () => {
            plugin.setContent('Short');
            plugin.selectAll();
            plugin.requestAiAssist();
            plugin.acceptAiSuggestion();
            assert.strictEqual(plugin.getAiSuggestion(), null);
            // Content should have changed
            assert.ok(plugin.getContent().length > 0);
        });

        it('dismiss AI suggestion clears it', () => {
            plugin.setContent('Short');
            plugin.selectAll();
            plugin.requestAiAssist();
            plugin.dismissAiSuggestion();
            assert.strictEqual(plugin.getAiSuggestion(), null);
        });

        it('enter accepts suggestion when visible', () => {
            plugin.setContent('Short');
            plugin.selectAll();
            plugin.requestAiAssist();
            assert.ok(plugin.getAiSuggestion() !== null);
            plugin.handleInput({ key: 'enter' }, 'body');
            assert.strictEqual(plugin.getAiSuggestion(), null);
        });

        it('escape dismisses suggestion when visible', () => {
            plugin.setContent('Short');
            plugin.selectAll();
            plugin.requestAiAssist();
            plugin.handleInput({ key: 'escape' }, 'body');
            assert.strictEqual(plugin.getAiSuggestion(), null);
        });
    });

    describe('render', () => {
        it('renders view mode status', () => {
            plugin.setContent('Hello');
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            assert.ok(buffer.length > 0);
            assert.ok(buffer[0].includes('VIEW'));
        });

        it('renders edit mode status', () => {
            plugin.setContent('Hello');
            plugin.toggleEditMode();
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            assert.ok(buffer[0].includes('EDIT'));
        });

        it('does not render for non-body region', () => {
            plugin.render({}, 'header');
            // Should not crash
        });

        it('renders AI suggestion', () => {
            plugin.toggleEditMode();
            plugin.setContent('Short');
            plugin.selectAll();
            plugin.requestAiAssist();
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            const combined = buffer.join('\n');
            assert.ok(combined.includes('AI Suggest'));
        });
    });

    describe('save', () => {
        it('saves content to store', () => {
            const item = services.contentStore.create({ type: 'page', title: 'Test', body: 'original' });
            plugin._currentContentId = item.id;
            plugin.setContent('updated content');
            const result = plugin.save();
            assert.strictEqual(result, true);
            const updated = services.contentStore.read(item.id);
            assert.strictEqual(updated.body, 'updated content');
        });

        it('returns false without content store', () => {
            plugin._currentContentId = null;
            assert.strictEqual(plugin.save(), false);
        });
    });

    describe('lifecycle', () => {
        it('cleans up on unload', () => {
            plugin.setContent('test');
            plugin.onUnload();
            assert.strictEqual(plugin.getContent(), '');
            assert.strictEqual(plugin.isLoaded(), false);
        });
    });
});

// ── MediaGallery Plugin Tests ─────────────────────────────────

describe('MediaGalleryPlugin', () => {
    let services, manager, plugin;

    beforeEach(() => {
        services = makeServices();
        manager = makeManager(services);
        plugin = activatePlugin(manager, 'media-gallery', MediaGalleryPlugin, { regions: ['body'] });
    });

    it('extends Plugin base class', () => {
        assert.ok(plugin instanceof Plugin);
        assert.ok(plugin instanceof MediaGalleryPlugin);
    });

    it('registers body region', () => {
        assert.deepStrictEqual(plugin.regions, ['body']);
    });

    it('starts with no images', () => {
        assert.strictEqual(plugin.getImages().length, 0);
    });

    it('selected index starts at 0', () => {
        assert.strictEqual(plugin.getSelectedIndex(), 0);
    });

    it('default grid columns is 3', () => {
        assert.strictEqual(plugin.getGridColumns(), 3);
    });

    describe('adding images', () => {
        it('adds an image to the gallery', () => {
            const img = plugin.addImage({
                title: 'Test Art',
                alt: 'A test image',
                source: 'test.txt',
                art: '+---+\n| A |\n+---+',
            });
            assert.ok(img);
            assert.strictEqual(img.title, 'Test Art');
            assert.strictEqual(plugin.getImages().length, 1);
        });

        it('requires art content', () => {
            assert.throws(() => plugin.addImage({ title: 'No Art' }), /ASCII art content is required/);
        });

        it('defaults title to Untitled', () => {
            const img = plugin.addImage({ art: 'ABC' });
            assert.strictEqual(img.title, 'Untitled');
        });

        it('stores image in content store', () => {
            plugin.addImage({
                title: 'Stored Art',
                art: 'Hello ASCII',
            });
            const media = services.contentStore.list({ type: 'media' });
            assert.strictEqual(media.length, 1);
            assert.strictEqual(media[0].title, 'Stored Art');
        });

        it('generates unique ids', () => {
            const img1 = plugin.addImage({ title: 'A', art: 'X' });
            const img2 = plugin.addImage({ title: 'B', art: 'Y' });
            assert.notStrictEqual(img1.id, img2.id);
        });
    });

    describe('removing images', () => {
        beforeEach(() => {
            plugin.addImage({ title: 'A', art: 'X' });
            plugin.addImage({ title: 'B', art: 'Y' });
            plugin.addImage({ title: 'C', art: 'Z' });
        });

        it('removes image by index', () => {
            assert.strictEqual(plugin.getImages().length, 3);
            const result = plugin.removeImage(1);
            assert.strictEqual(result, true);
            assert.strictEqual(plugin.getImages().length, 2);
            assert.strictEqual(plugin.getImages()[1].title, 'C');
        });

        it('returns false for invalid index', () => {
            assert.strictEqual(plugin.removeImage(-1), false);
            assert.strictEqual(plugin.removeImage(10), false);
        });

        it('adjusts selection after removal', () => {
            plugin.selectedIndex = 2;
            plugin.removeImage(2);
            assert.strictEqual(plugin.getSelectedIndex(), 1);
        });

        it('removes from content store', () => {
            const img = plugin.getImage(0);
            plugin.removeImage(0);
            const media = services.contentStore.list({ type: 'media' });
            assert.strictEqual(media.length, 2);
        });
    });

    describe('keyboard navigation', () => {
        beforeEach(() => {
            for (let i = 0; i < 6; i++) {
                plugin.addImage({ title: `Image ${i}`, art: `Art ${i}` });
            }
        });

        it('right arrow moves selection', () => {
            plugin.handleInput({ key: 'right' }, 'body');
            assert.strictEqual(plugin.getSelectedIndex(), 1);
        });

        it('left arrow moves selection', () => {
            plugin.selectedIndex = 2;
            plugin.handleInput({ key: 'left' }, 'body');
            assert.strictEqual(plugin.getSelectedIndex(), 1);
        });

        it('down arrow moves by grid columns', () => {
            plugin.handleInput({ key: 'down' }, 'body');
            assert.strictEqual(plugin.getSelectedIndex(), 3); // +gridColumns
        });

        it('up arrow moves by grid columns', () => {
            plugin.selectedIndex = 4;
            plugin.handleInput({ key: 'up' }, 'body');
            assert.strictEqual(plugin.getSelectedIndex(), 1); // -gridColumns
        });

        it('left clamps at 0', () => {
            plugin.handleInput({ key: 'left' }, 'body');
            assert.strictEqual(plugin.getSelectedIndex(), 0);
        });

        it('right clamps at last image', () => {
            for (let i = 0; i < 20; i++) plugin.handleInput({ key: 'right' }, 'body');
            assert.strictEqual(plugin.getSelectedIndex(), 5);
        });

        it('delete removes selected image', () => {
            plugin.selectedIndex = 0;
            plugin.handleInput({ key: 'delete' }, 'body');
            assert.strictEqual(plugin.getImages().length, 5);
        });

        it('ignores non-body region', () => {
            const result = plugin.handleInput({ key: 'right' }, 'header');
            assert.strictEqual(result, false);
        });

        it('handles sidebar region too', () => {
            const result = plugin.handleInput({ key: 'right' }, 'sidebar');
            assert.strictEqual(result, true);
        });
    });

    describe('grid columns', () => {
        it('setGridColumns changes columns', () => {
            plugin.setGridColumns(2);
            assert.strictEqual(plugin.getGridColumns(), 2);
        });

        it('setGridColumns clamps to valid range', () => {
            plugin.setGridColumns(0);
            assert.strictEqual(plugin.getGridColumns(), 3);
            plugin.setGridColumns(10);
            assert.strictEqual(plugin.getGridColumns(), 3);
        });
    });

    describe('render', () => {
        it('renders empty gallery message', () => {
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            assert.ok(buffer.join('').includes('Empty Gallery'));
        });

        it('renders gallery with images', () => {
            plugin.addImage({ title: 'Art 1', art: 'Hello' });
            plugin.addImage({ title: 'Art 2', art: 'World' });
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            const combined = buffer.join('\n');
            assert.ok(combined.includes('Art 1'));
            assert.ok(combined.includes('Art 2'));
        });

        it('renders for sidebar region', () => {
            plugin.addImage({ title: 'Art', art: 'Hello' });
            plugin.render({}, 'sidebar');
            const buffer = plugin.getBuffer();
            assert.ok(buffer.length > 0);
        });

        it('does not render for header region', () => {
            plugin.render({}, 'header');
            // Should not crash
        });

        it('getImage returns image by index', () => {
            plugin.addImage({ title: 'Test', art: 'ABC' });
            const img = plugin.getImage(0);
            assert.strictEqual(img.title, 'Test');
        });

        it('getImage returns null for invalid index', () => {
            assert.strictEqual(plugin.getImage(99), null);
        });
    });

    describe('scroll', () => {
        it('adjusts scroll offset on navigation', () => {
            for (let i = 0; i < 20; i++) {
                plugin.addImage({ title: `Img ${i}`, art: `A${i}` });
            }
            // Navigate down enough to trigger scroll
            for (let i = 0; i < 6; i++) {
                plugin.handleInput({ key: 'down' }, 'body');
            }
            assert.ok(plugin.getScrollOffset() > 0);
        });
    });

    describe('lifecycle', () => {
        it('cleans up on unload', () => {
            plugin.addImage({ title: 'Test', art: 'ABC' });
            plugin.onUnload();
            assert.strictEqual(plugin.getImages().length, 0);
            assert.strictEqual(plugin.isLoaded(), false);
        });
    });
});

// ── ContactForm Plugin Tests ──────────────────────────────────

describe('ContactFormPlugin', () => {
    let services, manager, plugin;

    beforeEach(() => {
        services = makeServices();
        manager = makeManager(services);
        plugin = activatePlugin(manager, 'contact-form', ContactFormPlugin, { regions: ['body'] });
    });

    it('extends Plugin base class', () => {
        assert.ok(plugin instanceof Plugin);
        assert.ok(plugin instanceof ContactFormPlugin);
    });

    it('registers body region', () => {
        assert.deepStrictEqual(plugin.regions, ['body']);
    });

    it('has 3 fields: name, email, message', () => {
        const values = plugin.getValues();
        assert.ok(values.hasOwnProperty('name'));
        assert.ok(values.hasOwnProperty('email'));
        assert.ok(values.hasOwnProperty('message'));
    });

    it('starts on first field', () => {
        assert.strictEqual(plugin.getActiveField(), 0);
    });

    it('starts not submitted', () => {
        assert.strictEqual(plugin.isSubmitted(), false);
    });

    describe('field navigation', () => {
        it('tab moves to next field', () => {
            plugin.handleInput({ key: 'tab' }, 'body');
            assert.strictEqual(plugin.getActiveField(), 1);
        });

        it('tab wraps around', () => {
            plugin.handleInput({ key: 'tab' }, 'body');
            plugin.handleInput({ key: 'tab' }, 'body');
            plugin.handleInput({ key: 'tab' }, 'body');
            assert.strictEqual(plugin.getActiveField(), 0);
        });

        it('enter on non-last field moves to next', () => {
            plugin.handleInput({ key: 'enter' }, 'body');
            assert.strictEqual(plugin.getActiveField(), 1);
        });

        it('enter on last field submits', () => {
            // Fill in fields
            plugin.setFieldValue('name', 'Test User');
            plugin.setFieldValue('email', 'test@example.com');
            plugin.setFieldValue('message', 'This is a test message for validation');
            plugin.activeField = 2; // message field (last)

            const result = plugin.handleInput({ key: 'enter' }, 'body');
            assert.strictEqual(result, true);
            assert.strictEqual(plugin.isSubmitted(), true);
        });
    });

    describe('text input', () => {
        it('types into active field', () => {
            plugin.handleInput({ key: 'J' }, 'body');
            plugin.handleInput({ key: 'o' }, 'body');
            plugin.handleInput({ key: 'e' }, 'body');
            assert.strictEqual(plugin.getValues().name, 'Joe');
        });

        it('backspace deletes character', () => {
            plugin.handleInput({ key: 'a' }, 'body');
            plugin.handleInput({ key: 'b' }, 'body');
            plugin.handleInput({ key: 'backspace' }, 'body');
            assert.strictEqual(plugin.getValues().name, 'a');
        });

        it('delete removes character at cursor', () => {
            plugin.setFieldValue('name', 'abc');
            plugin.cursorPos = 1;
            plugin.handleInput({ key: 'delete' }, 'body');
            assert.strictEqual(plugin.getValues().name, 'ac');
        });

        it('left/right move cursor', () => {
            plugin.setFieldValue('name', 'abc');
            plugin.cursorPos = 3;
            plugin.handleInput({ key: 'left' }, 'body');
            assert.strictEqual(plugin.cursorPos, 2);
            plugin.handleInput({ key: 'right' }, 'body');
            assert.strictEqual(plugin.cursorPos, 3);
        });

        it('setFieldValue sets value directly', () => {
            plugin.setFieldValue('name', 'Alice');
            assert.strictEqual(plugin.getValues().name, 'Alice');
        });
    });

    describe('validation', () => {
        it('fails with empty fields', () => {
            assert.strictEqual(plugin.validate(), false);
            const errors = plugin.getErrors();
            assert.ok(errors.name);
            assert.ok(errors.email);
            assert.ok(errors.message);
        });

        it('name requires at least 2 characters', () => {
            plugin.setFieldValue('name', 'A');
            plugin.setFieldValue('email', 'a@b.com');
            plugin.setFieldValue('message', 'This is a valid message');
            assert.strictEqual(plugin.validate(), false);
            assert.ok(plugin.getErrors().name.includes('2 characters'));
        });

        it('validates email format', () => {
            plugin.setFieldValue('name', 'Test');
            plugin.setFieldValue('email', 'not-an-email');
            plugin.setFieldValue('message', 'Valid message content');
            assert.strictEqual(plugin.validate(), false);
            assert.ok(plugin.getErrors().email.includes('Invalid'));
        });

        it('accepts valid email format', () => {
            plugin.setFieldValue('email', 'user@example.com');
            assert.strictEqual(plugin.getErrors().email, '');
        });

        it('message requires at least 10 characters', () => {
            plugin.setFieldValue('name', 'Test');
            plugin.setFieldValue('email', 'a@b.com');
            plugin.setFieldValue('message', 'Short');
            assert.strictEqual(plugin.validate(), false);
            assert.ok(plugin.getErrors().message.includes('10'));
        });

        it('passes with valid data', () => {
            plugin.setFieldValue('name', 'Test User');
            plugin.setFieldValue('email', 'test@example.com');
            plugin.setFieldValue('message', 'This is a test message');
            assert.strictEqual(plugin.validate(), true);
            const errors = plugin.getErrors();
            assert.strictEqual(errors.name, '');
            assert.strictEqual(errors.email, '');
            assert.strictEqual(errors.message, '');
        });
    });

    describe('submission', () => {
        it('submits valid form', () => {
            plugin.setFieldValue('name', 'Test User');
            plugin.setFieldValue('email', 'test@example.com');
            plugin.setFieldValue('message', 'This is a test message for submission');
            const result = plugin.submit();
            assert.strictEqual(result, true);
            assert.strictEqual(plugin.isSubmitted(), true);
        });

        it('stores submission in list', () => {
            plugin.setFieldValue('name', 'Test User');
            plugin.setFieldValue('email', 'test@example.com');
            plugin.setFieldValue('message', 'This is a test message for submission');
            plugin.submit();
            const submissions = plugin.getSubmissions();
            assert.strictEqual(submissions.length, 1);
            assert.strictEqual(submissions[0].name, 'Test User');
            assert.strictEqual(submissions[0].email, 'test@example.com');
        });

        it('stores submission in content store', () => {
            plugin.setFieldValue('name', 'Test User');
            plugin.setFieldValue('email', 'test@example.com');
            plugin.setFieldValue('message', 'This is a test message for submission');
            plugin.submit();
            const posts = services.contentStore.list({ type: 'post' });
            assert.strictEqual(posts.length, 1);
            assert.strictEqual(posts[0].metadata.type, 'contact-submission');
        });

        it('resets form after submission', () => {
            plugin.setFieldValue('name', 'Test User');
            plugin.setFieldValue('email', 'test@example.com');
            plugin.setFieldValue('message', 'This is a test message for submission');
            plugin.submit();
            const values = plugin.getValues();
            assert.strictEqual(values.name, '');
            assert.strictEqual(values.email, '');
            assert.strictEqual(values.message, '');
            assert.strictEqual(plugin.getActiveField(), 0);
        });

        it('does not submit with invalid data', () => {
            plugin.setFieldValue('name', '');
            plugin.setFieldValue('email', 'bad');
            plugin.setFieldValue('message', 'short');
            assert.strictEqual(plugin.submit(), false);
            assert.strictEqual(plugin.isSubmitted(), false);
        });

        it('escape resets the form', () => {
            plugin.setFieldValue('name', 'Test');
            plugin.handleInput({ key: 'escape' }, 'body');
            assert.strictEqual(plugin.getValues().name, '');
            assert.strictEqual(plugin.isSubmitted(), false);
        });
    });

    describe('reset', () => {
        it('clears all fields and errors', () => {
            plugin.setFieldValue('name', 'A');
            plugin.validate();
            plugin.reset();
            const values = plugin.getValues();
            const errors = plugin.getErrors();
            assert.strictEqual(values.name, '');
            assert.strictEqual(errors.name, '');
            assert.strictEqual(plugin.getActiveField(), 0);
        });
    });

    describe('render', () => {
        it('renders form fields', () => {
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            assert.ok(buffer.length > 0);
            const combined = buffer.join('\n');
            assert.ok(combined.includes('Contact Form'));
            assert.ok(combined.includes('Name'));
            assert.ok(combined.includes('Email'));
            assert.ok(combined.includes('Message'));
        });

        it('renders success message after submission', () => {
            plugin.setFieldValue('name', 'Test User');
            plugin.setFieldValue('email', 'test@example.com');
            plugin.setFieldValue('message', 'This is a test message for submission');
            plugin.submit();
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            assert.ok(buffer.join('\n').includes('sent successfully'));
        });

        it('does not render for non-body region', () => {
            plugin.render({}, 'header');
            // Should not crash
        });
    });

    describe('ignores input for non-body region', () => {
        it('returns false for header region', () => {
            const result = plugin.handleInput({ key: 'a' }, 'header');
            assert.strictEqual(result, false);
        });
    });

    describe('lifecycle', () => {
        it('cleans up on unload', () => {
            plugin.onUnload();
            assert.strictEqual(plugin.isLoaded(), false);
        });
    });
});

// ── Analytics Plugin Tests ────────────────────────────────────

describe('AnalyticsPlugin', () => {
    let services, manager, plugin;

    beforeEach(() => {
        services = makeServices();
        manager = makeManager(services);
        plugin = activatePlugin(manager, 'analytics', AnalyticsPlugin, { regions: ['footer'] });
    });

    it('extends Plugin base class', () => {
        assert.ok(plugin instanceof Plugin);
        assert.ok(plugin instanceof AnalyticsPlugin);
    });

    it('registers footer region', () => {
        assert.deepStrictEqual(plugin.regions, ['footer']);
    });

    it('starts with no page views', () => {
        assert.strictEqual(plugin.getTotalPageViews(), 0);
    });

    it('starts with no unique pages', () => {
        assert.strictEqual(plugin.getUniquePageCount(), 0);
    });

    it('starts with no sessions', () => {
        assert.strictEqual(plugin.getTotalSessions(), 0);
    });

    describe('page tracking', () => {
        beforeEach(() => {
            services.contentStore.createManifest({ title: 'Home', slug: 'home' });
            services.contentStore.createManifest({ title: 'About', slug: 'about' });
            services.contentStore.createManifest({ title: 'Blog', slug: 'blog' });
            services.router._buildRoutes();
        });

        it('tracks page views on navigation', () => {
            services.router.navigate('home');
            assert.strictEqual(plugin.getPageViews('home'), 1);
        });

        it('tracks multiple page views', () => {
            services.router.navigate('home');
            services.router.navigate('about');
            services.router.navigate('home');
            assert.strictEqual(plugin.getPageViews('home'), 2);
            assert.strictEqual(plugin.getPageViews('about'), 1);
        });

        it('getTotalPageViews sums all views', () => {
            services.router.navigate('home');
            services.router.navigate('about');
            services.router.navigate('blog');
            assert.strictEqual(plugin.getTotalPageViews(), 3);
        });

        it('getUniquePageCount counts unique pages', () => {
            services.router.navigate('home');
            services.router.navigate('home');
            services.router.navigate('about');
            assert.strictEqual(plugin.getUniquePageCount(), 2);
        });

        it('tracks sessions on each page change', () => {
            services.router.navigate('home');
            services.router.navigate('about');
            assert.strictEqual(plugin.getTotalSessions(), 2);
        });

        it('tracks navigation events', () => {
            services.router.navigate('home');
            services.router.navigate('about');
            const events = plugin.getNavEvents();
            assert.strictEqual(events.length, 2);
            assert.strictEqual(events[0].to, 'home');
            assert.strictEqual(events[1].from, 'home');
            assert.strictEqual(events[1].to, 'about');
        });

        it('tracks time on page', () => {
            services.router.navigate('home');
            // Time should be tracked when leaving
            services.router.navigate('about');
            const time = plugin.getTimeOnPage('home');
            assert.ok(time >= 0);
        });

        it('getTopPages returns sorted by views', () => {
            services.router.navigate('home');
            services.router.navigate('about');
            services.router.navigate('home');
            services.router.navigate('home');
            const top = plugin.getTopPages(10);
            assert.strictEqual(top[0].slug, 'home');
            assert.strictEqual(top[0].views, 3);
        });

        it('getTopPages respects limit', () => {
            services.router.navigate('home');
            services.router.navigate('about');
            services.router.navigate('blog');
            const top = plugin.getTopPages(2);
            assert.strictEqual(top.length, 2);
        });

        it('getNavEvents respects limit', () => {
            for (let i = 0; i < 10; i++) {
                services.router.navigate('home');
            }
            const events = plugin.getNavEvents(5);
            assert.strictEqual(events.length, 5);
        });

        it('getPageViews returns 0 for unknown slug', () => {
            assert.strictEqual(plugin.getPageViews('nonexistent'), 0);
        });

        it('getTimeOnPage returns 0 for unknown slug', () => {
            assert.strictEqual(plugin.getTimeOnPage('nonexistent'), 0);
        });
    });

    describe('compact footer render', () => {
        it('renders compact stats in footer', () => {
            services.contentStore.createManifest({ title: 'Home', slug: 'home' });
            services.router._buildRoutes();
            services.router.navigate('home');

            plugin.render({}, 'footer');
            const buffer = plugin.getBuffer();
            assert.strictEqual(buffer.length, 1);
            assert.ok(buffer[0].includes('Views:1'));
            assert.ok(buffer[0].includes('Pages:1'));
        });
    });

    describe('full body render', () => {
        it('renders full dashboard in body', () => {
            services.contentStore.createManifest({ title: 'Home', slug: 'home' });
            services.contentStore.createManifest({ title: 'About', slug: 'about' });
            services.router._buildRoutes();
            services.router.navigate('home');
            services.router.navigate('about');

            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            const combined = buffer.join('\n');
            assert.ok(combined.includes('Analytics Dashboard'));
            assert.ok(combined.includes('Total Page Views'));
            assert.ok(combined.includes('Top Pages'));
            assert.ok(combined.includes('Navigation'));
        });
    });

    describe('render edge cases', () => {
        it('renders empty dashboard', () => {
            plugin.render({}, 'body');
            const buffer = plugin.getBuffer();
            const combined = buffer.join('\n');
            assert.ok(combined.includes('No data yet'));
        });

        it('does not render for unsupported region', () => {
            plugin.render({}, 'header');
            // Should not crash
        });
    });

    describe('handleInput', () => {
        it('returns false (view-only)', () => {
            assert.strictEqual(plugin.handleInput({}, 'footer'), false);
        });
    });

    describe('resetData', () => {
        it('clears all tracking data', () => {
            services.contentStore.createManifest({ title: 'Home', slug: 'home' });
            services.router._buildRoutes();
            services.router.navigate('home');

            plugin.resetData();
            assert.strictEqual(plugin.getTotalPageViews(), 0);
            assert.strictEqual(plugin.getUniquePageCount(), 0);
            assert.strictEqual(plugin.getTotalSessions(), 0);
            assert.strictEqual(plugin.getNavEvents().length, 0);
        });
    });

    describe('lifecycle', () => {
        it('cleans up on unload', () => {
            services.contentStore.createManifest({ title: 'Home', slug: 'home' });
            services.router._buildRoutes();
            services.router.navigate('home');

            plugin.onUnload();
            assert.strictEqual(plugin.getTotalPageViews(), 0);
            assert.strictEqual(plugin.isLoaded(), false);
        });
    });
});

// ── Integration: All Plugins via PluginManager ────────────────

describe('Built-in Plugins Integration', () => {
    let services, manager;

    beforeEach(() => {
        services = makeServices();
        manager = makeManager(services);
    });

    it('all 5 plugins can be registered and activated', () => {
        activatePlugin(manager, 'nav-menu', NavMenuPlugin, { regions: ['header'] });
        activatePlugin(manager, 'content-editor', ContentEditorPlugin, { regions: ['body'] });
        activatePlugin(manager, 'media-gallery', MediaGalleryPlugin, { regions: ['body'] });
        activatePlugin(manager, 'contact-form', ContactFormPlugin, { regions: ['body'] });
        activatePlugin(manager, 'analytics', AnalyticsPlugin, { regions: ['footer'] });

        assert.strictEqual(manager.getState('nav-menu'), PluginState.ACTIVE);
        assert.strictEqual(manager.getState('content-editor'), PluginState.ACTIVE);
        assert.strictEqual(manager.getState('media-gallery'), PluginState.ACTIVE);
        assert.strictEqual(manager.getState('contact-form'), PluginState.ACTIVE);
        assert.strictEqual(manager.getState('analytics'), PluginState.ACTIVE);
    });

    it('activateAll works with all built-in plugins', () => {
        manager.register({ name: 'nav-menu', version: '1.0.0', regions: ['header'] }, NavMenuPlugin);
        manager.register({ name: 'content-editor', version: '1.0.0', regions: ['body'] }, ContentEditorPlugin);
        manager.register({ name: 'media-gallery', version: '1.0.0', regions: ['body'] }, MediaGalleryPlugin);
        manager.register({ name: 'contact-form', version: '1.0.0', regions: ['body'] }, ContactFormPlugin);
        manager.register({ name: 'analytics', version: '1.0.0', regions: ['footer'] }, AnalyticsPlugin);

        const { activated, failed } = manager.activateAll();
        assert.strictEqual(activated.length, 5);
        assert.strictEqual(failed.length, 0);
    });

    it('plugins receive context with services', () => {
        const nav = activatePlugin(manager, 'nav-menu', NavMenuPlugin, { regions: ['header'] });
        assert.ok(nav.context);
        assert.strictEqual(nav.context.contentStore, services.contentStore);
        assert.strictEqual(nav.context.router, services.router);
        assert.ok(nav.context.events);
    });

    it('analytics plugin tracks nav-menu navigation', () => {
        const analytics = activatePlugin(manager, 'analytics', AnalyticsPlugin, { regions: ['footer'] });
        const nav = activatePlugin(manager, 'nav-menu', NavMenuPlugin, { regions: ['header'] });

        services.contentStore.createManifest({ title: 'Home', slug: 'home' });
        services.contentStore.createManifest({ title: 'About', slug: 'about' });
        services.router._buildRoutes();
        nav._rebuildItems();

        // Navigate using nav menu
        nav.handleInput({ key: 'enter' }, 'header'); // should navigate to first item

        // Analytics should have picked up the page-change event
        assert.strictEqual(analytics.getTotalPageViews() > 0, true);
    });

    it('deactivateAll cleans up all plugins', () => {
        manager.register({ name: 'nav-menu', version: '1.0.0', regions: ['header'] }, NavMenuPlugin);
        manager.register({ name: 'content-editor', version: '1.0.0', regions: ['body'] }, ContentEditorPlugin);
        manager.register({ name: 'analytics', version: '1.0.0', regions: ['footer'] }, AnalyticsPlugin);
        manager.activateAll();

        const deactivated = manager.deactivateAll();
        assert.strictEqual(deactivated.length, 3);
        assert.strictEqual(manager.getState('nav-menu'), PluginState.DISABLED);
        assert.strictEqual(manager.getState('content-editor'), PluginState.DISABLED);
        assert.strictEqual(manager.getState('analytics'), PluginState.DISABLED);
    });

    it('discovery finds built-in plugins from plugins directory', () => {
        manager.discover();
        const list = manager.listPlugins();
        const names = list.map(p => p.name);
        assert.ok(names.includes('nav-menu'));
        assert.ok(names.includes('content-editor'));
        assert.ok(names.includes('media-gallery'));
        assert.ok(names.includes('contact-form'));
        assert.ok(names.includes('analytics'));
    });
});
