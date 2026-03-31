// tests/publish/html-compiler.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ContentStore } from '../../sync/content-store.js';
import { Router } from '../../sync/router.js';
import { compileHTML, compileAllHTML } from '../../sync/publish/html-compiler.js';
import { DEFAULT_THEME } from '../../sync/theme-editor.js';

describe('HTML Compiler', () => {
    let store, router;

    beforeEach(() => {
        store = new ContentStore();
        router = new Router(store);
    });

    it('compiles a manifest with inline layout to valid HTML', () => {
        const manifest = store.createManifest({
            title: 'Test Page',
            slug: 'test-page',
            layout: [
                { region: 'header', contentId: null, inline: 'Welcome' },
                { region: 'body', contentId: null, inline: 'Hello World\nLine 2' },
            ],
        });

        const html = compileHTML(manifest, store);

        assert.ok(html.includes('<!DOCTYPE html>'), 'Should have DOCTYPE');
        assert.ok(html.includes('<html'), 'Should have html tag');
        assert.ok(html.includes('</html>'), 'Should close html tag');
        assert.ok(html.includes('<style>'), 'Should have embedded CSS');
        assert.ok(html.includes('Test Page'), 'Should include page title');
        assert.ok(html.includes('Hello World'), 'Should include body content');
    });

    it('includes CSS custom properties from theme', () => {
        const manifest = store.createManifest({
            title: 'Themed',
            slug: 'themed',
            layout: [],
        });

        const html = compileHTML(manifest, store, { theme: DEFAULT_THEME });

        assert.ok(html.includes('--bg:'), 'Should have --bg CSS var');
        assert.ok(html.includes('--fg:'), 'Should have --fg CSS var');
        assert.ok(html.includes('--border:'), 'Should have --border CSS var');
        assert.ok(html.includes('--link-fg:'), 'Should have --link-fg CSS var');
    });

    it('renders navigation as clickable links', () => {
        store.createManifest({ title: 'Home', slug: 'home', layout: [] });
        store.createManifest({ title: 'About', slug: 'about', layout: [] });
        store.createManifest({ title: 'Blog', slug: 'blog', layout: [] });

        // Rebuild router after adding manifests
        router = new Router(store);
        const navTree = router.getNavigationTree();

        const manifest = store.listManifests()[0];
        const html = compileHTML(manifest, store, { navigationTree: navTree, currentSlug: 'home' });

        assert.ok(html.includes('<nav>'), 'Should have nav element');
        assert.ok(html.includes('href="/home.html"'), 'Should link to home');
        assert.ok(html.includes('href="/about.html"'), 'Should link to about');
        assert.ok(html.includes('href="/blog.html"'), 'Should link to blog');
    });

    it('resolves contentId references in layout', () => {
        const item = store.create({
            type: 'page',
            title: 'Content Block',
            body: 'This is the resolved content body.',
        });

        const manifest = store.createManifest({
            title: 'Page with Ref',
            slug: 'ref-page',
            layout: [
                { region: 'body', contentId: item.id },
            ],
        });

        const html = compileHTML(manifest, store);
        assert.ok(html.includes('This is the resolved content body.'), 'Should resolve content');
    });

    it('handles missing contentId gracefully', () => {
        const manifest = store.createManifest({
            title: 'Missing Ref',
            slug: 'missing-ref',
            layout: [
                { region: 'body', contentId: 'nonexistent_id' },
            ],
        });

        const html = compileHTML(manifest, store);
        assert.ok(html.includes('Missing content'), 'Should show missing content message');
    });

    it('escapes HTML in content', () => {
        const manifest = store.createManifest({
            title: '<script>alert("xss")</script>',
            slug: 'xss-test',
            layout: [
                { region: 'body', contentId: null, inline: '<b>bold</b> & "quotes"' },
            ],
        });

        const html = compileHTML(manifest, store);
        assert.ok(!html.includes('<script>alert'), 'Should not have unescaped script tag');
        assert.ok(html.includes('&lt;script&gt;'), 'Should escape < and >');
        assert.ok(html.includes('&amp;'), 'Should escape ampersand');
    });

    it('creates standalone HTML with no external dependencies', () => {
        const manifest = store.createManifest({
            title: 'Standalone',
            slug: 'standalone',
            layout: [
                { region: 'body', contentId: null, inline: 'Content here' },
            ],
        });

        const html = compileHTML(manifest, store);

        // Should not reference external files
        assert.ok(!html.includes('<link'), 'Should not have external link tags');
        assert.ok(!html.includes('src='), 'Should not have external script/image sources');
        assert.ok(!html.includes('rel="stylesheet"'), 'Should not have external stylesheet');
    });

    it('compileAllHTML compiles all manifests', () => {
        store.createManifest({ title: 'Page A', slug: 'page-a', layout: [] });
        store.createManifest({ title: 'Page B', slug: 'page-b', layout: [] });
        store.createManifest({ title: 'Page C', slug: 'page-c', layout: [] });

        router = new Router(store);
        const pages = compileAllHTML(store, router);

        assert.strictEqual(pages.size, 3, 'Should compile all 3 pages');
        assert.ok(pages.has('page-a'), 'Should have page-a');
        assert.ok(pages.has('page-b'), 'Should have page-b');
        assert.ok(pages.has('page-c'), 'Should have page-c');

        for (const [slug, html] of pages) {
            assert.ok(html.includes('<!DOCTYPE html>'), `${slug} should be valid HTML`);
        }
    });

    it('handles empty manifest gracefully', () => {
        const manifest = store.createManifest({
            title: 'Empty',
            slug: 'empty',
            layout: [],
        });

        const html = compileHTML(manifest, store);
        assert.ok(html.includes('<!DOCTYPE html>'), 'Should still produce valid HTML');
        assert.ok(html.includes('Empty'), 'Should include title');
    });

    it('sidebar regions get CSS class', () => {
        const manifest = store.createManifest({
            title: 'With Sidebar',
            slug: 'sidebar-test',
            layout: [
                { region: 'body', contentId: null, inline: 'Main content' },
                { region: 'sidebar', contentId: null, inline: 'Sidebar content' },
            ],
        });

        const html = compileHTML(manifest, store);
        assert.ok(html.includes('region-sidebar'), 'Should have sidebar region');
        assert.ok(html.includes('Sidebar content'), 'Should include sidebar content');
    });
});
