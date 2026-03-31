// tests/router.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ContentStore } from '../sync/content-store.js';
import { Router } from '../sync/router.js';

describe('Router', () => {
    let store, router;

    beforeEach(() => {
        store = new ContentStore();
        router = new Router(store);
    });

    // ── Route Registration ──────────────────────────────────────

    describe('Route Registration', () => {
        it('registers a static route', () => {
            router.addRoute('home');
            assert.ok(router.routes.has('home'));
        });

        it('registers a route with leading slash (normalized)', () => {
            router.addRoute('/about');
            assert.ok(router.routes.has('about'));
        });

        it('registers a route with trailing slash (normalized)', () => {
            router.addRoute('contact/');
            assert.ok(router.routes.has('contact'));
        });

        it('registers a dynamic route with :param', () => {
            router.addRoute('blog/:slug');
            assert.ok(router.dynamicRoutes.has('blog/:slug'));
        });

        it('registers a nested dynamic route', () => {
            router.addRoute('blog/:category/:slug');
            assert.ok(router.dynamicRoutes.has('blog/:category/:slug'));
        });

        it('emits route-added event', (t, done) => {
            router.on('route-added', ({ slug }) => {
                assert.strictEqual(slug, 'test-page');
                done();
            });
            router.addRoute('test-page');
        });

        it('removes a static route', () => {
            router.addRoute('removeme');
            assert.ok(router.removeRoute('removeme'));
            assert.ok(!router.routes.has('removeme'));
        });

        it('removes a dynamic route', () => {
            router.addRoute('blog/:slug');
            assert.ok(router.removeRoute('blog/:slug'));
            assert.ok(!router.dynamicRoutes.has('blog/:slug'));
        });

        it('removeRoute returns false for unknown', () => {
            assert.strictEqual(router.removeRoute('nope'), false);
        });

        it('emits route-removed event', (t, done) => {
            router.addRoute('goner');
            router.on('route-removed', ({ slug }) => {
                assert.strictEqual(slug, 'goner');
                done();
            });
            router.removeRoute('goner');
        });
    });

    // ── Route Resolution ────────────────────────────────────────

    describe('Route Resolution', () => {
        it('resolves a static route with manifest from content store', () => {
            const m = store.createManifest({ title: 'Home', slug: 'home' });
            const result = router.resolve('home');
            assert.strictEqual(result.slug, 'home');
            assert.strictEqual(result.is404, false);
            assert.strictEqual(result.manifest.id, m.id);
        });

        it('resolves with leading slash', () => {
            store.createManifest({ title: 'About', slug: 'about' });
            const result = router.resolve('/about');
            assert.strictEqual(result.slug, 'about');
            assert.strictEqual(result.is404, false);
        });

        it('returns 404 for unknown slug', () => {
            const result = router.resolve('nonexistent');
            assert.strictEqual(result.is404, true);
            assert.strictEqual(result.manifest, null);
        });

        it('resolves dynamic route with params', () => {
            router.addRoute('blog/:slug');
            const post = store.createManifest({ title: 'Hello World', slug: 'hello-world' });
            const result = router.resolve('blog/hello-world');
            assert.strictEqual(result.slug, 'blog/hello-world');
            assert.strictEqual(result.params.slug, 'hello-world');
            assert.strictEqual(result.manifest.id, post.id);
            assert.strictEqual(result.is404, false);
        });

        it('resolves dynamic route without matching manifest (404)', () => {
            router.addRoute('blog/:slug');
            const result = router.resolve('blog/no-such-post');
            assert.strictEqual(result.params.slug, 'no-such-post');
            assert.strictEqual(result.is404, true);
        });

        it('resolves nested dynamic route with multiple params', () => {
            router.addRoute('blog/:category/:slug');
            store.createManifest({ title: 'Post', slug: 'tech-post' });
            const result = router.resolve('blog/tech/tech-post');
            assert.strictEqual(result.params.category, 'tech');
            assert.strictEqual(result.params.slug, 'tech-post');
        });

        it('resolves route added manually with manifest', () => {
            const m = store.createManifest({ title: 'Custom', slug: 'custom' });
            router.addRoute('custom', m);
            const result = router.resolve('custom');
            assert.strictEqual(result.manifest.id, m.id);
        });

        it('prefers static route over dynamic', () => {
            router.addRoute('blog');
            router.addRoute('blog/:slug');
            store.createManifest({ title: 'Blog Index', slug: 'blog' });
            const result = router.resolve('blog');
            assert.strictEqual(result.manifest.title, 'Blog Index');
            assert.deepStrictEqual(result.params, {});
        });
    });

    // ── Navigation & History ────────────────────────────────────

    describe('Navigation & History', () => {
        it('navigate pushes to history', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            router.navigate('home');
            const h = router.getHistory();
            assert.strictEqual(h.history.length, 1);
            assert.strictEqual(h.index, 0);
            assert.strictEqual(h.current, 'home');
        });

        it('navigate does not push duplicate consecutive entries', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            router.navigate('home');
            router.navigate('home');
            const h = router.getHistory();
            assert.strictEqual(h.history.length, 1);
        });

        it('navigate builds a history stack', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });
            store.createManifest({ title: 'C', slug: 'c' });

            router.navigate('a');
            router.navigate('b');
            router.navigate('c');

            const h = router.getHistory();
            assert.deepStrictEqual(h.history, ['a', 'b', 'c']);
            assert.strictEqual(h.index, 2);
            assert.strictEqual(h.current, 'c');
        });

        it('navigate truncates forward history when navigating from middle', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });
            store.createManifest({ title: 'C', slug: 'c' });
            store.createManifest({ title: 'D', slug: 'd' });

            router.navigate('a');
            router.navigate('b');
            router.navigate('c');
            router.back(); // now at b
            router.navigate('d'); // should truncate c

            const h = router.getHistory();
            assert.deepStrictEqual(h.history, ['a', 'b', 'd']);
        });

        it('emits page-change event on navigate', (t, done) => {
            store.createManifest({ title: 'Home', slug: 'home' });
            router.on('page-change', ({ slug, manifest }) => {
                assert.strictEqual(slug, 'home');
                assert.ok(manifest);
                done();
            });
            router.navigate('home');
        });

        it('back goes to previous page', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });

            router.navigate('a');
            router.navigate('b');

            const result = router.back();
            assert.strictEqual(result.slug, 'a');
            assert.strictEqual(router.currentSlug, 'a');
            assert.strictEqual(router.historyIndex, 0);
        });

        it('back returns null at beginning', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            router.navigate('home');
            assert.strictEqual(router.back(), null);
        });

        it('forward goes to next page', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });

            router.navigate('a');
            router.navigate('b');
            router.back(); // at a

            const result = router.forward();
            assert.strictEqual(result.slug, 'b');
            assert.strictEqual(router.currentSlug, 'b');
        });

        it('forward returns null at end', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            router.navigate('home');
            assert.strictEqual(router.forward(), null);
        });

        it('canGoBack returns correct state', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });

            assert.strictEqual(router.canGoBack(), false);
            router.navigate('a');
            assert.strictEqual(router.canGoBack(), false);
            router.navigate('b');
            assert.strictEqual(router.canGoBack(), true);
        });

        it('canGoForward returns correct state', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });

            router.navigate('a');
            router.navigate('b');
            assert.strictEqual(router.canGoForward(), false);
            router.back();
            assert.strictEqual(router.canGoForward(), true);
        });

        it('clearHistory resets everything', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            router.navigate('a');
            router.clearHistory();
            const h = router.getHistory();
            assert.strictEqual(h.history.length, 0);
            assert.strictEqual(h.index, -1);
            assert.strictEqual(h.current, null);
        });

        it('emits back event', (t, done) => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });

            router.navigate('a');
            router.navigate('b');
            router.on('back', ({ slug }) => {
                assert.strictEqual(slug, 'a');
                done();
            });
            router.back();
        });

        it('emits forward event', (t, done) => {
            store.createManifest({ title: 'A', slug: 'a' });
            store.createManifest({ title: 'B', slug: 'b' });

            router.navigate('a');
            router.navigate('b');
            router.back();
            router.on('forward', ({ slug }) => {
                assert.strictEqual(slug, 'b');
                done();
            });
            router.forward();
        });

        it('enforces max history limit', () => {
            const limitedRouter = new Router(store, { maxHistory: 3 });
            for (let i = 0; i < 5; i++) {
                store.createManifest({ title: `Page ${i}`, slug: `page-${i}` });
                limitedRouter.navigate(`page-${i}`);
            }
            const h = limitedRouter.getHistory();
            assert.strictEqual(h.history.length, 3);
            assert.strictEqual(h.history[0], 'page-2');
        });
    });

    // ── Navigation Tree ─────────────────────────────────────────

    describe('Navigation Tree', () => {
        it('generates empty tree when no manifests', () => {
            const tree = router.getNavigationTree();
            assert.deepStrictEqual(tree, []);
        });

        it('generates flat tree from manifests', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'About', slug: 'about' });

            const tree = router.getNavigationTree();
            assert.strictEqual(tree.length, 2);
            assert.strictEqual(tree[0].title, 'Home');
            assert.strictEqual(tree[0].path, '/home');
            assert.strictEqual(tree[1].title, 'About');
        });

        it('generates nested tree from nested slugs', () => {
            store.createManifest({ title: 'Blog', slug: 'blog' });
            store.createManifest({ title: 'First Post', slug: 'blog/first-post' });
            store.createManifest({ title: 'Second Post', slug: 'blog/second-post' });

            const tree = router.getNavigationTree();
            assert.strictEqual(tree.length, 1);
            assert.strictEqual(tree[0].title, 'Blog');
            assert.strictEqual(tree[0].children.length, 2);
            assert.strictEqual(tree[0].children[0].title, 'First Post');
            assert.strictEqual(tree[0].children[0].parent, 'blog');
            assert.strictEqual(tree[0].children[1].title, 'Second Post');
        });

        it('generates deeply nested tree', () => {
            store.createManifest({ title: 'Docs', slug: 'docs' });
            store.createManifest({ title: 'API', slug: 'docs/api' });
            store.createManifest({ title: 'Auth', slug: 'docs/api/auth' });

            const tree = router.getNavigationTree();
            assert.strictEqual(tree.length, 1);
            assert.strictEqual(tree[0].title, 'Docs');
            assert.strictEqual(tree[0].children[0].title, 'API');
            assert.strictEqual(tree[0].children[0].children[0].title, 'Auth');
        });

        it('tree items have correct paths', () => {
            store.createManifest({ title: 'Blog', slug: 'blog' });
            store.createManifest({ title: 'Post', slug: 'blog/post' });

            const tree = router.getNavigationTree();
            assert.strictEqual(tree[0].path, '/blog');
            assert.strictEqual(tree[0].children[0].path, '/blog/post');
        });

        it('tree items reference their manifests', () => {
            const m = store.createManifest({ title: 'Test', slug: 'test' });
            const tree = router.getNavigationTree();
            assert.strictEqual(tree[0].manifest.id, m.id);
        });

        it('mixed flat and nested items', () => {
            store.createManifest({ title: 'Home', slug: 'home' });
            store.createManifest({ title: 'Blog', slug: 'blog' });
            store.createManifest({ title: 'Post', slug: 'blog/post' });
            store.createManifest({ title: 'Contact', slug: 'contact' });

            const tree = router.getNavigationTree();
            // home, blog, contact are top-level; blog has child
            assert.strictEqual(tree.length, 3);
            const blogItem = tree.find(n => n.slug === 'blog');
            assert.strictEqual(blogItem.children.length, 1);
        });
    });

    // ── Auto-build from ContentStore ────────────────────────────

    describe('Auto-build from ContentStore', () => {
        it('builds routes from existing manifests on construction', () => {
            store.createManifest({ title: 'Existing', slug: 'existing' });
            const r = new Router(store);
            assert.ok(r.routes.has('existing'));
            const result = r.resolve('existing');
            assert.strictEqual(result.is404, false);
        });
    });

    // ── Edge Cases ──────────────────────────────────────────────

    describe('Edge Cases', () => {
        it('resolves empty slug', () => {
            const result = router.resolve('');
            assert.strictEqual(result.is404, true);
        });

        it('resolves slug with extra slashes', () => {
            store.createManifest({ title: 'Test', slug: 'test' });
            const result = router.resolve('///test///');
            assert.strictEqual(result.slug, 'test');
            assert.strictEqual(result.is404, false);
        });

        it('dynamic route with multiple dynamic segments', () => {
            router.addRoute(':year/:month/:slug');
            store.createManifest({ title: 'Post', slug: 'my-post' });
            const result = router.resolve('2026/03/my-post');
            assert.strictEqual(result.params.year, '2026');
            assert.strictEqual(result.params.month, '03');
            assert.strictEqual(result.params.slug, 'my-post');
        });

        it('back/forward with no history returns null', () => {
            assert.strictEqual(router.back(), null);
            assert.strictEqual(router.forward(), null);
        });

        it('getHistory returns copies', () => {
            store.createManifest({ title: 'A', slug: 'a' });
            router.navigate('a');
            const h1 = router.getHistory();
            h1.history.push('hacked');
            const h2 = router.getHistory();
            assert.strictEqual(h2.history.length, 1);
        });

        it('navigate to 404 still tracks history', () => {
            router.navigate('nonexistent');
            const h = router.getHistory();
            assert.strictEqual(h.history.length, 1);
            assert.strictEqual(h.current, 'nonexistent');
        });
    });
});
