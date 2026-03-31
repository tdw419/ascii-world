// tests/ai-architect.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { AiArchitect, detectSiteType, SITE_TEMPLATES, CONTENT_TEMPLATES } from '../sync/ai-architect.js';
import { AiRefiner, REFINE_PATTERNS, COLOR_MAP } from '../sync/ai-refiner.js';
import { ContentStore } from '../sync/content-store.js';
import { Router } from '../sync/router.js';

function makeServices() {
    const store = new ContentStore({ filePath: `/tmp/test-architect-${Date.now()}.json` });
    const router = new Router(store);
    return { contentStore: store, router };
}

describe('AiArchitect', () => {
    let architect;

    beforeEach(() => {
        architect = new AiArchitect(makeServices());
    });

    it('should detect portfolio site type from description', () => {
        const type = detectSiteType('I want a portfolio site to showcase my work');
        assert.equal(type, 'portfolio');
    });

    it('should detect blog site type from description', () => {
        const type = detectSiteType('create a blog about programming');
        assert.equal(type, 'blog');
    });

    it('should detect corporate site type from description', () => {
        const type = detectSiteType('company website for our business');
        assert.equal(type, 'corporate');
    });

    it('should default to portfolio for unknown descriptions', () => {
        const type = detectSiteType('something random');
        assert.equal(type, 'portfolio');
    });

    it('should generate a complete site manifest', () => {
        const site = architect.generate('I want a portfolio site for my art');
        assert.ok(site.pages);
        assert.ok(site.pages.length > 0);
        assert.ok(site.theme);
        assert.ok(site.navigation || site.nav);
    });

    it('should include pages with slugs', () => {
        const site = architect.generate('portfolio site');
        for (const page of site.pages) {
            assert.ok(page.slug, `page "${page.title}" missing slug`);
            assert.ok(page.title, `page missing title`);
        }
    });

    it('should set up navigation from pages', () => {
        const site = architect.generate('blog about cooking');
        const nav = site.navigation || site.nav;
        assert.ok(nav);
        assert.ok(Array.isArray(nav));
        assert.ok(nav.length > 0);
    });

    it('should select appropriate theme for site type', () => {
        const site = architect.generate('blog');
        assert.ok(site.theme);
    });

    it('should include plugin list', () => {
        const site = architect.generate('portfolio');
        assert.ok(site.plugins);
        assert.ok(Array.isArray(site.plugins));
    });

    it('should have SITE_TEMPLATES with expected types', () => {
        assert.ok(SITE_TEMPLATES.portfolio);
        assert.ok(SITE_TEMPLATES.blog);
    });

    it('should have CONTENT_TEMPLATES', () => {
        assert.ok(CONTENT_TEMPLATES);
    });
});

describe('AiRefiner', () => {
    let refiner;

    beforeEach(() => {
        const { contentStore, router } = makeServices();
        refiner = new AiRefiner({ contentStore, router });
    });

    it('should export REFINE_PATTERNS', () => {
        assert.ok(REFINE_PATTERNS);
    });

    it('should export COLOR_MAP', () => {
        assert.ok(COLOR_MAP);
    });

    it('should apply a theme change instruction', () => {
        const result = refiner.refine('make the header blue');
        assert.ok(result);
    });

    it('should throw on empty instruction', () => {
        assert.throws(() => refiner.refine(''), /instruction is required/);
    });

    it('should throw on non-string instruction', () => {
        assert.throws(() => refiner.refine(42), /instruction is required/);
    });
});
