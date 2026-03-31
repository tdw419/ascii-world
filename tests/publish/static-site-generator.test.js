// tests/publish/static-site-generator.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, rmSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ContentStore } from '../../sync/content-store.js';
import { Router } from '../../sync/router.js';
import { generateStaticSite } from '../../sync/publish/static-site-generator.js';

describe('Static Site Generator', () => {
    let store, router;
    const testOutputDir = '/tmp/pxos-ssg-test-' + Date.now();

    beforeEach(() => {
        store = new ContentStore();
        router = new Router(store);
    });

    afterEach(() => {
        if (existsSync(testOutputDir)) {
            rmSync(testOutputDir, { recursive: true });
        }
    });

    it('generates output directory with pages', () => {
        store.createManifest({
            title: 'Home',
            slug: 'home',
            layout: [
                { region: 'body', contentId: null, inline: 'Welcome home' },
            ],
        });
        store.createManifest({
            title: 'About',
            slug: 'about',
            layout: [
                { region: 'body', contentId: null, inline: 'About us' },
            ],
        });
        router = new Router(store);

        const result = generateStaticSite(store, router, {
            outputDir: testOutputDir,
            siteName: 'Test Site',
        });

        assert.strictEqual(result.pages, 3, 'Should have 2 pages + index'); // 2 pages + index
        assert.ok(existsSync(testOutputDir), 'Output dir should exist');
        assert.ok(existsSync(join(testOutputDir, 'index.html')), 'index.html should exist');
        assert.ok(existsSync(join(testOutputDir, '404.html')), '404.html should exist');
        assert.ok(existsSync(join(testOutputDir, 'home', 'index.html')), 'home/index.html should exist');
        assert.ok(existsSync(join(testOutputDir, 'about', 'index.html')), 'about/index.html should exist');
    });

    it('index.html contains site name and navigation', () => {
        store.createManifest({ title: 'Page A', slug: 'page-a', layout: [] });
        store.createManifest({ title: 'Page B', slug: 'page-b', layout: [] });
        router = new Router(store);

        generateStaticSite(store, router, {
            outputDir: testOutputDir,
            siteName: 'My ASCII Site',
        });

        const indexHTML = readFileSync(join(testOutputDir, 'index.html'), 'utf-8');
        assert.ok(indexHTML.includes('My ASCII Site'), 'Should contain site name');
        assert.ok(indexHTML.includes('page-a'), 'Should link to page-a');
        assert.ok(indexHTML.includes('page-b'), 'Should link to page-b');
    });

    it('generated pages are valid standalone HTML', () => {
        store.createManifest({
            title: 'Standalone Page',
            slug: 'standalone',
            layout: [
                { region: 'header', contentId: null, inline: 'Page Header' },
                { region: 'body', contentId: null, inline: 'Page body content' },
            ],
        });
        router = new Router(store);

        generateStaticSite(store, router, { outputDir: testOutputDir });

        const pageHTML = readFileSync(join(testOutputDir, 'standalone', 'index.html'), 'utf-8');
        assert.ok(pageHTML.includes('<!DOCTYPE html>'), 'Should be valid HTML');
        assert.ok(pageHTML.includes('<style>'), 'Should have embedded CSS');
        assert.ok(pageHTML.includes('Standalone Page'), 'Should include title');
        assert.ok(pageHTML.includes('Page body content'), 'Should include body');
        // No external dependencies
        assert.ok(!pageHTML.includes('rel="stylesheet"'), 'Should not have external CSS');
    });

    it('404 page has navigation links', () => {
        store.createManifest({ title: 'Help', slug: 'help', layout: [] });
        router = new Router(store);

        generateStaticSite(store, router, { outputDir: testOutputDir });

        const notFoundHTML = readFileSync(join(testOutputDir, '404.html'), 'utf-8');
        assert.ok(notFoundHTML.includes('404'), 'Should say 404');
        assert.ok(notFoundHTML.includes('help'), 'Should link to existing pages');
    });

    it('throws if outputDir is missing', () => {
        assert.throws(
            () => generateStaticSite(store, router, {}),
            /outputDir is required/
        );
    });

    it('handles empty content store', () => {
        router = new Router(store);

        const result = generateStaticSite(store, router, {
            outputDir: testOutputDir,
        });

        // Should still produce index (pages = compiled + index, 404 not counted)
        assert.ok(result.pages >= 1, 'Should have at least index page');
        assert.ok(existsSync(join(testOutputDir, 'index.html')), 'index.html should exist');
    });

    it('creates assets directory', () => {
        store.createManifest({ title: 'Test', slug: 'test', layout: [] });
        router = new Router(store);

        generateStaticSite(store, router, { outputDir: testOutputDir });

        assert.ok(existsSync(join(testOutputDir, 'assets')), 'assets dir should exist');
    });

    it('applies custom theme to generated pages', () => {
        store.createManifest({
            title: 'Themed Page',
            slug: 'themed',
            layout: [
                { region: 'body', contentId: null, inline: 'Content' },
            ],
        });
        router = new Router(store);

        const customTheme = {
            name: 'custom',
            fg: [255, 0, 0, 255],
            bg: [0, 0, 0, 255],
            border: [100, 100, 100, 255],
            borderHighlight: [200, 200, 200, 255],
            activeFg: [0, 255, 0, 255],
            activeBg: [0, 0, 0, 255],
            focusFg: [0, 0, 0, 255],
            focusBg: [255, 255, 0, 255],
            titleFg: [255, 255, 0, 255],
            titleBg: [0, 0, 0, 255],
            linkFg: [0, 200, 200, 255],
            headingFg: [255, 100, 0, 255],
        };

        generateStaticSite(store, router, {
            outputDir: testOutputDir,
            theme: customTheme,
        });

        const pageHTML = readFileSync(join(testOutputDir, 'themed', 'index.html'), 'utf-8');
        assert.ok(pageHTML.includes('rgba(255,0,0'), 'Should use custom fg color');
    });

    it('handles nested slug paths', () => {
        store.createManifest({
            title: 'Nested Page',
            slug: 'blog/my-first-post',
            layout: [
                { region: 'body', contentId: null, inline: 'Blog post content' },
            ],
        });
        router = new Router(store);

        const result = generateStaticSite(store, router, { outputDir: testOutputDir });

        assert.ok(
            existsSync(join(testOutputDir, 'blog', 'my-first-post', 'index.html')),
            'Should create nested directory structure'
        );
    });
});
