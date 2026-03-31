// tests/ai-content-generator.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AiContentGenerator, CONTENT_TEMPLATES } from '../sync/ai-content-generator.js';
import { ContentStore } from '../sync/content-store.js';

// ── Helpers ──────────────────────────────────────────────────

function createStore() {
    return new ContentStore(); // in-memory, no file path
}

function createGenerator(store = createStore()) {
    return new AiContentGenerator({ contentStore: store });
}

// ── AiContentGenerator ───────────────────────────────────────

describe('AiContentGenerator', () => {

    // ── Constructor ──────────────────────────────────────────

    describe('constructor', () => {
        it('should require contentStore', () => {
            assert.throws(() => new AiContentGenerator(), /contentStore is required/);
            assert.throws(() => new AiContentGenerator({}), /contentStore is required/);
        });

        it('should accept optional aiEndpoint and model', () => {
            const store = createStore();
            const gen = new AiContentGenerator({
                contentStore: store,
                aiEndpoint: 'http://example.com/v1',
                model: 'gpt-4',
            });
            assert.equal(gen.aiEndpoint, 'http://example.com/v1');
            assert.equal(gen.model, 'gpt-4');
        });

        it('should default model to template-v1', () => {
            const gen = createGenerator();
            assert.equal(gen.model, 'template-v1');
        });

        it('should default aiEndpoint to null', () => {
            const gen = createGenerator();
            assert.equal(gen.aiEndpoint, null);
        });
    });

    // ── generateFromDescription ──────────────────────────────

    describe('generateFromDescription()', () => {
        it('should throw on empty description', () => {
            const gen = createGenerator();
            assert.throws(() => gen.generateFromDescription(''), /non-empty string/);
            assert.throws(() => gen.generateFromDescription(null), /non-empty string/);
            assert.throws(() => gen.generateFromDescription(undefined), /non-empty string/);
        });

        it('should return structured content object', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A blog post about JavaScript tips and tricks.');

            assert.ok(result.title);
            assert.ok(result.body);
            assert.ok(result.type);
            assert.ok(result.metadata);
            assert.ok(result.metadata.template);
            assert.ok(result.metadata.renderAs);
            assert.ok(Array.isArray(result.metadata.tags));
        });

        it('should detect blog template from keywords', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('Write a blog article about web development.');
            assert.equal(result.metadata.template, 'blog');
            assert.equal(result.type, 'post');
        });

        it('should detect portfolio template from keywords', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A portfolio showcasing my best project work.');
            assert.equal(result.metadata.template, 'portfolio');
            assert.equal(result.type, 'page');
        });

        it('should detect landing template from keywords', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A landing page for a new product launch.');
            assert.equal(result.metadata.template, 'landing');
            assert.equal(result.type, 'page');
        });

        it('should detect docs template from keywords', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('API documentation and reference guide for developers.');
            assert.equal(result.metadata.template, 'docs');
            assert.equal(result.type, 'page');
        });

        it('should detect gallery template from keywords', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A photo gallery with creative visual art pieces.');
            assert.equal(result.metadata.template, 'gallery');
            assert.equal(result.type, 'page');
        });

        it('should default to blog template when no keywords match', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('Something completely random without any matches.');
            assert.equal(result.metadata.template, 'blog');
        });

        it('should allow forcing a template via options', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('Some random text', { template: 'portfolio' });
            assert.equal(result.metadata.template, 'portfolio');
        });

        it('should throw on unknown template', () => {
            const gen = createGenerator();
            assert.throws(
                () => gen.generateFromDescription('test', { template: 'nonexistent' }),
                /Unknown template: nonexistent/,
            );
        });

        it('should allow overriding type via options', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A blog post', { type: 'page' });
            assert.equal(result.type, 'page');
        });

        it('should merge extra tags from options', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A blog post', { tags: ['custom-tag'] });
            assert.ok(result.metadata.tags.includes('custom-tag'));
        });

        it('should extract tags from description keywords', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A JavaScript tutorial about web API design.');
            const tags = result.metadata.tags;
            assert.ok(tags.includes('javascript'));
            assert.ok(tags.includes('tutorial'));
            assert.ok(tags.includes('web'));
            assert.ok(tags.includes('api'));
        });

        it('should add "general" tag when no keyword tags are found', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('xyzzy plugh nothing here');
            assert.ok(result.metadata.tags.includes('general'));
        });

        it('should generate a title from the description', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('This is my first sentence. This is the second one.');
            assert.ok(result.title.length > 0);
            assert.equal(result.title, 'This is my first sentence');
        });

        it('should truncate long descriptions for title', () => {
            const gen = createGenerator();
            const longDesc = 'a'.repeat(100);
            const result = gen.generateFromDescription(longDesc);
            assert.ok(result.title.length <= 60);
        });

        it('should generate non-empty body for all templates', () => {
            const gen = createGenerator();
            const templates = Object.keys(CONTENT_TEMPLATES);
            for (const tpl of templates) {
                const result = gen.generateFromDescription(`A ${tpl} page with content`, { template: tpl });
                assert.ok(result.body.length > 0, `Body empty for template ${tpl}`);
            }
        });
    });

    // ── generatePage ─────────────────────────────────────────

    describe('generatePage()', () => {
        it('should throw on empty title', () => {
            const gen = createGenerator();
            assert.throws(() => gen.generatePage('', 'some description'), /title/);
        });

        it('should throw on empty description', () => {
            const gen = createGenerator();
            assert.throws(() => gen.generatePage('My Page', ''), /description/);
        });

        it('should create and save a page to contentStore', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePage('My Portfolio', 'A portfolio site showcasing projects.');

            assert.ok(item.id);
            assert.equal(item.type, 'page');
            assert.equal(item.title, 'My Portfolio');
            assert.ok(item.body.length > 0);
            assert.ok(item.metadata.template);
            assert.ok(item.created_at);
            assert.ok(item.updated_at);
        });

        it('should store the item in contentStore', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePage('Test Page', 'A landing page for a product.');
            const retrieved = store.read(item.id);

            assert.ok(retrieved);
            assert.equal(retrieved.title, 'My Page' ? 'Test Page' : retrieved.title);
            assert.equal(retrieved.id, item.id);
        });

        it('should use default template detection when template is "default"', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePage('Docs Page', 'Documentation guide for the API.');
            assert.equal(item.metadata.template, 'docs');
        });

        it('should use explicit template when specified', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePage('Landing', 'Some content', 'landing');
            assert.equal(item.metadata.template, 'landing');
        });

        it('should use the provided title, not generated one', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePage('Custom Title', 'A blog about coding.');
            assert.equal(item.title, 'Custom Title');
        });
    });

    // ── generatePost ─────────────────────────────────────────

    describe('generatePost()', () => {
        it('should throw on empty title', () => {
            const gen = createGenerator();
            assert.throws(() => gen.generatePost('', 'description'), /title/);
        });

        it('should throw on empty description', () => {
            const gen = createGenerator();
            assert.throws(() => gen.generatePost('Title', ''), /description/);
        });

        it('should create and save a post to contentStore', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePost('My Blog Post', 'A blog article about AI in web development.', ['ai', 'web']);

            assert.ok(item.id);
            assert.equal(item.type, 'post');
            assert.equal(item.title, 'My Blog Post');
            assert.ok(item.body.length > 0);
            assert.equal(item.metadata.template, 'blog');
            assert.ok(item.metadata.tags.includes('ai'));
            assert.ok(item.metadata.tags.includes('web'));
        });

        it('should store the post in contentStore', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePost('Test Post', 'A blog entry.');
            const retrieved = store.read(item.id);

            assert.ok(retrieved);
            assert.equal(retrieved.id, item.id);
            assert.equal(retrieved.type, 'post');
        });

        it('should default tags to empty array', () => {
            const store = createStore();
            const gen = createGenerator(store);

            const item = gen.generatePost('Post', 'A blog about something');
            // Should have at least the 'general' auto-detected tag or keyword-based tags
            assert.ok(Array.isArray(item.metadata.tags));
            assert.ok(item.metadata.tags.length > 0);
        });

        it('should include date in blog body', () => {
            const gen = createGenerator();
            const item = gen.generatePost('My Post', 'This is a blog post about testing.');
            assert.match(item.body, /Published on/);
        });

        it('should always use blog template', () => {
            const store = createStore();
            const gen = createGenerator(store);

            // Even with portfolio-related description, generatePost uses blog template
            const item = gen.generatePost('Portfolio Update', 'New portfolio projects added.');
            assert.equal(item.metadata.template, 'blog');
        });
    });

    // ── Template body content ────────────────────────────────

    describe('template body content', () => {
        it('portfolio template should include hero, projects, and contact sections', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A portfolio of projects', { template: 'portfolio' });
            assert.match(result.body, /Welcome to My Portfolio/);
            assert.match(result.body, /Projects/);
            assert.match(result.body, /Get In Touch/);
        });

        it('landing template should include headline, features, and CTA', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A landing page for a great product. It is fast. It is reliable. It is cheap.', { template: 'landing' });
            assert.match(result.body, /Features/);
            assert.match(result.body, /Get Started/);
        });

        it('docs template should include code example', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('Documentation for the API', { template: 'docs' });
            assert.match(result.body, /Example/);
            assert.match(result.body, /```/);
        });

        it('gallery template should include image placeholders', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A photo gallery', { template: 'gallery' });
            assert.match(result.body, /Gallery/);
            assert.match(result.body, /\[Image/);
        });

        it('blog template should include date', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A blog post about coding.');
            assert.match(result.body, /Published on/);
        });
    });

    // ── Template keyword preference ──────────────────────────

    describe('template keyword detection', () => {
        it('should prefer longer keyword matches', () => {
            const gen = createGenerator();
            // "portfolio" (9 chars) should beat "blog" (4 chars) when both appear
            const result = gen.generateFromDescription('A portfolio blog about my projects.');
            assert.equal(result.metadata.template, 'portfolio');
        });

        it('should work with multi-word keywords', () => {
            const gen = createGenerator();
            const result = gen.generateFromDescription('A how-to guide for beginners.');
            assert.equal(result.metadata.template, 'docs');
        });
    });
});

// ── CONTENT_TEMPLATES export ─────────────────────────────────

describe('CONTENT_TEMPLATES', () => {
    it('should export all 5 templates', () => {
        const names = Object.keys(CONTENT_TEMPLATES);
        assert.deepEqual(names.sort(), ['blog', 'docs', 'gallery', 'landing', 'portfolio']);
    });

    it('each template should have structure, defaultRenderAs, and tone', () => {
        for (const [name, tpl] of Object.entries(CONTENT_TEMPLATES)) {
            assert.ok(Array.isArray(tpl.structure), `${name}: structure should be array`);
            assert.ok(tpl.defaultRenderAs, `${name}: should have defaultRenderAs`);
            assert.ok(tpl.tone, `${name}: should have tone`);
        }
    });

    it('each template section should have a section name', () => {
        for (const [name, tpl] of Object.entries(CONTENT_TEMPLATES)) {
            for (const section of tpl.structure) {
                assert.ok(section.section, `${name}: section missing name`);
            }
        }
    });

    it('portfolio should have hero, projects, and contact sections', () => {
        const sections = CONTENT_TEMPLATES.portfolio.structure.map(s => s.section);
        assert.ok(sections.includes('hero'));
        assert.ok(sections.includes('projects'));
        assert.ok(sections.includes('contact'));
    });

    it('blog should have title, date, body, and tags sections', () => {
        const sections = CONTENT_TEMPLATES.blog.structure.map(s => s.section);
        assert.ok(sections.includes('title'));
        assert.ok(sections.includes('date'));
        assert.ok(sections.includes('body'));
        assert.ok(sections.includes('tags'));
    });

    it('landing should have headline, features, and cta sections', () => {
        const sections = CONTENT_TEMPLATES.landing.structure.map(s => s.section);
        assert.ok(sections.includes('headline'));
        assert.ok(sections.includes('features'));
        assert.ok(sections.includes('cta'));
    });

    it('docs should have heading, body, and code sections', () => {
        const sections = CONTENT_TEMPLATES.docs.structure.map(s => s.section);
        assert.ok(sections.includes('heading'));
        assert.ok(sections.includes('body'));
        assert.ok(sections.includes('code'));
    });

    it('gallery should have grid and images sections', () => {
        const sections = CONTENT_TEMPLATES.gallery.structure.map(s => s.section);
        assert.ok(sections.includes('grid'));
        assert.ok(sections.includes('images'));
    });

    it('renderAs should be a known value', () => {
        const validRender = new Set(['text', 'heading', 'list', 'code']);
        for (const [name, tpl] of Object.entries(CONTENT_TEMPLATES)) {
            assert.ok(validRender.has(tpl.defaultRenderAs),
                `${name}: invalid defaultRenderAs "${tpl.defaultRenderAs}"`);
        }
    });
});
