// tests/content-store.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { ContentStore } from '../sync/content-store.js';

describe('ContentStore', () => {
    let store;
    const testDir = '/tmp/pxos-test-content';
    const testFile = `${testDir}/content.json`;

    beforeEach(() => {
        store = new ContentStore();
        if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    });

    // ── Create ─────────────────────────────────────────────

    it('creates a content item with all fields', () => {
        const item = store.create({ type: 'page', title: 'Hello', body: 'World', metadata: { author: 'j' } });
        assert.ok(item.id);
        assert.strictEqual(item.type, 'page');
        assert.strictEqual(item.title, 'Hello');
        assert.strictEqual(item.body, 'World');
        assert.strictEqual(item.metadata.author, 'j');
        assert.ok(item.created_at > 0);
        assert.strictEqual(item.created_at, item.updated_at);
    });

    it('creates with defaults', () => {
        const item = store.create({ type: 'post', title: 'Test' });
        assert.strictEqual(item.body, '');
        assert.deepStrictEqual(item.metadata, {});
    });

    it('rejects invalid type', () => {
        assert.throws(() => store.create({ type: 'bad', title: 'x' }), /Invalid content type/);
    });

    it('rejects missing title', () => {
        assert.throws(() => store.create({ type: 'page', title: '' }), /Title is required/);
        assert.throws(() => store.create({ type: 'page' }), /Title is required/);
    });

    it('generates unique IDs', () => {
        const a = store.create({ type: 'page', title: 'A' });
        const b = store.create({ type: 'page', title: 'B' });
        assert.notStrictEqual(a.id, b.id);
    });

    // ── Read ───────────────────────────────────────────────

    it('reads an item by id', () => {
        const created = store.create({ type: 'page', title: 'Hello' });
        const read = store.read(created.id);
        assert.deepStrictEqual(read, created);
    });

    it('returns null for unknown id', () => {
        assert.strictEqual(store.read('nope'), null);
    });

    it('read returns a copy', () => {
        const created = store.create({ type: 'page', title: 'Hello', metadata: { tag: 'a' } });
        const copy = store.read(created.id);
        copy.title = 'Changed';
        copy.metadata.tag = 'b';
        assert.strictEqual(store.read(created.id).title, 'Hello');
        assert.strictEqual(store.read(created.id).metadata.tag, 'a');
    });

    // ── Update ─────────────────────────────────────────────

    it('updates fields', () => {
        const item = store.create({ type: 'page', title: 'Old' });
        const updated = store.update(item.id, { title: 'New', body: 'Updated' });
        assert.strictEqual(updated.title, 'New');
        assert.strictEqual(updated.body, 'Updated');
        assert.ok(updated.updated_at >= item.created_at);
    });

    it('update returns null for unknown id', () => {
        assert.strictEqual(store.update('nope', { title: 'x' }), null);
    });

    it('update rejects invalid type', () => {
        const item = store.create({ type: 'page', title: 'T' });
        assert.throws(() => store.update(item.id, { type: 'bad' }), /Invalid content type/);
    });

    it('update only touches provided fields', () => {
        const item = store.create({ type: 'post', title: 'Keep', body: 'Me' });
        const updated = store.update(item.id, { title: 'Changed' });
        assert.strictEqual(updated.title, 'Changed');
        assert.strictEqual(updated.body, 'Me');
        assert.strictEqual(updated.type, 'post');
    });

    // ── Delete ─────────────────────────────────────────────

    it('deletes an item', () => {
        const item = store.create({ type: 'page', title: 'Bye' });
        assert.strictEqual(store.delete(item.id), true);
        assert.strictEqual(store.read(item.id), null);
    });

    it('delete returns false for unknown id', () => {
        assert.strictEqual(store.delete('nope'), false);
    });

    // ── List ───────────────────────────────────────────────

    it('lists all items', () => {
        store.create({ type: 'page', title: 'A' });
        store.create({ type: 'post', title: 'B' });
        store.create({ type: 'media', title: 'C' });
        assert.strictEqual(store.list().length, 3);
    });

    it('filters by type', () => {
        store.create({ type: 'page', title: 'A' });
        store.create({ type: 'post', title: 'B' });
        store.create({ type: 'page', title: 'C' });
        const pages = store.list({ type: 'page' });
        assert.strictEqual(pages.length, 2);
        assert.ok(pages.every(p => p.type === 'page'));
    });

    it('filters by tag', () => {
        store.create({ type: 'post', title: 'A', metadata: { tags: ['tech', 'ai'] } });
        store.create({ type: 'post', title: 'B', metadata: { tags: ['life'] } });
        store.create({ type: 'post', title: 'C', metadata: {} });
        const tagged = store.list({ tag: 'tech' });
        assert.strictEqual(tagged.length, 1);
        assert.strictEqual(tagged[0].title, 'A');
    });

    it('combined type + tag filter', () => {
        store.create({ type: 'page', title: 'A', metadata: { tags: ['tech'] } });
        store.create({ type: 'post', title: 'B', metadata: { tags: ['tech'] } });
        const result = store.list({ type: 'page', tag: 'tech' });
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].title, 'A');
    });

    it('list returns copies', () => {
        store.create({ type: 'page', title: 'Original' });
        store.list()[0].title = 'Mutated';
        assert.strictEqual(store.list()[0].title, 'Original');
    });

    // ── Search ─────────────────────────────────────────────

    it('searches title', () => {
        store.create({ type: 'page', title: 'Getting Started Guide' });
        store.create({ type: 'page', title: 'API Reference' });
        const results = store.search('guide');
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].title, 'Getting Started Guide');
    });

    it('searches body', () => {
        store.create({ type: 'post', title: 'A', body: 'The quick brown fox' });
        store.create({ type: 'post', title: 'B', body: 'Lazy dog' });
        assert.strictEqual(store.search('brown fox').length, 1);
    });

    it('search is case-insensitive', () => {
        store.create({ type: 'page', title: 'UPPER CASE' });
        assert.strictEqual(store.search('upper case').length, 1);
        assert.strictEqual(store.search('UPPER CASE').length, 1);
    });

    it('search returns empty for empty query', () => {
        store.create({ type: 'page', title: 'Exists' });
        assert.strictEqual(store.search('').length, 0);
        assert.strictEqual(store.search(null).length, 0);
    });

    it('search returns copies', () => {
        store.create({ type: 'page', title: 'Search Me' });
        store.search('search')[0].title = 'Hacked';
        assert.strictEqual(store.search('search')[0].title, 'Search Me');
    });

    // ── Page Manifest ──────────────────────────────────────

    describe('Page Manifest', () => {
        it('creates a manifest', () => {
            const m = store.createManifest({
                title: 'Home Page',
                slug: 'home',
                layout: [
                    { region: 'header', contentId: 'c_abc', formula: null },
                    { region: 'body', contentId: null, inline: 'Welcome', formula: null },
                ],
                theme: 'dark',
                metadata: { nav: true },
            });
            assert.ok(m.id);
            assert.strictEqual(m.title, 'Home Page');
            assert.strictEqual(m.slug, 'home');
            assert.strictEqual(m.layout.length, 2);
            assert.strictEqual(m.theme, 'dark');
            assert.strictEqual(m.metadata.nav, true);
        });

        it('auto-generates slug from title', () => {
            const m = store.createManifest({ title: 'My Cool Page!' });
            assert.strictEqual(m.slug, 'my-cool-page');
        });

        it('rejects missing title', () => {
            assert.throws(() => store.createManifest({ title: '' }), /Title is required/);
        });

        it('rejects invalid region', () => {
            assert.throws(() => store.createManifest({
                title: 'Bad',
                layout: [{ region: 'nonsense', contentId: null }],
            }), /Invalid region/);
        });

        it('rejects non-string contentId', () => {
            assert.throws(() => store.createManifest({
                title: 'Bad',
                layout: [{ region: 'body', contentId: 123 }],
            }), /contentId must be a string or null/);
        });

        it('accepts null contentId', () => {
            const m = store.createManifest({
                title: 'OK',
                layout: [{ region: 'footer', contentId: null, inline: 'Footer text' }],
            });
            assert.strictEqual(m.layout[0].contentId, null);
        });

        it('reads a manifest', () => {
            const created = store.createManifest({ title: 'About' });
            const read = store.readManifest(created.id);
            assert.deepStrictEqual(read, created);
        });

        it('returns null for unknown manifest id', () => {
            assert.strictEqual(store.readManifest('nope'), null);
        });

        it('updates a manifest', () => {
            const m = store.createManifest({ title: 'Old' });
            const updated = store.updateManifest(m.id, { title: 'New', theme: 'light' });
            assert.strictEqual(updated.title, 'New');
            assert.strictEqual(updated.theme, 'light');
            assert.ok(updated.updated_at >= m.created_at);
        });

        it('update validates layout', () => {
            const m = store.createManifest({ title: 'Test' });
            assert.throws(() => store.updateManifest(m.id, {
                layout: [{ region: 'bad', contentId: null }],
            }), /Invalid region/);
        });

        it('update returns null for unknown', () => {
            assert.strictEqual(store.updateManifest('nope', { title: 'x' }), null);
        });

        it('deletes a manifest', () => {
            const m = store.createManifest({ title: 'Delete Me' });
            assert.strictEqual(store.deleteManifest(m.id), true);
            assert.strictEqual(store.readManifest(m.id), null);
        });

        it('delete returns false for unknown', () => {
            assert.strictEqual(store.deleteManifest('nope'), false);
        });

        it('lists manifests', () => {
            store.createManifest({ title: 'A' });
            store.createManifest({ title: 'B' });
            assert.strictEqual(store.listManifests().length, 2);
        });

        it('list returns copies', () => {
            store.createManifest({ title: 'Original' });
            store.listManifests()[0].title = 'Mutated';
            assert.strictEqual(store.listManifests()[0].title, 'Original');
        });

        it('read returns deep copy of layout', () => {
            const m = store.createManifest({
                title: 'Test',
                layout: [{ region: 'body', contentId: 'abc', formula: null }],
            });
            const copy = store.readManifest(m.id);
            copy.layout[0].contentId = 'hacked';
            assert.strictEqual(store.readManifest(m.id).layout[0].contentId, 'abc');
        });
    });

    // ── File Persistence ───────────────────────────────────

    describe('File Persistence', () => {
        it('persists items to file', (t, done) => {
            const s = new ContentStore({ filePath: testFile, saveDelay: 10 });
            s.create({ type: 'page', title: 'Persisted' });
            setTimeout(() => {
                assert.ok(existsSync(testFile));
                const s2 = new ContentStore({ filePath: testFile });
                assert.strictEqual(s2.list().length, 1);
                assert.strictEqual(s2.list()[0].title, 'Persisted');
                done();
            }, 50);
        });

        it('persists manifests to file', (t, done) => {
            const s = new ContentStore({ filePath: testFile, saveDelay: 10 });
            s.createManifest({ title: 'Page One', slug: 'page-one' });
            setTimeout(() => {
                const s2 = new ContentStore({ filePath: testFile });
                assert.strictEqual(s2.listManifests().length, 1);
                assert.strictEqual(s2.listManifests()[0].slug, 'page-one');
                done();
            }, 50);
        });

        it('loads from existing file', () => {
            mkdirSync(testDir, { recursive: true });
            const now = Date.now();
            writeFileSync(testFile, JSON.stringify({
                version: 1,
                items: {
                    c_test: { id: 'c_test', type: 'page', title: 'Loaded', body: '', metadata: {}, created_at: now, updated_at: now },
                },
                manifests: {
                    pm_test: { id: 'pm_test', title: 'M', slug: 'm', layout: [], theme: null, metadata: {}, created_at: now, updated_at: now },
                },
            }));
            const s = new ContentStore({ filePath: testFile });
            assert.strictEqual(s.list().length, 1);
            assert.strictEqual(s.listManifests().length, 1);
        });

        it('saveNow flushes immediately', () => {
            const s = new ContentStore({ filePath: testFile, saveDelay: 99999 });
            s.create({ type: 'page', title: 'Now' });
            s.saveNow();
            assert.ok(existsSync(testFile));
            const s2 = new ContentStore({ filePath: testFile });
            assert.strictEqual(s2.list()[0].title, 'Now');
        });

        it('handles missing file gracefully', () => {
            const s = new ContentStore({ filePath: '/tmp/nope/noexist.json' });
            assert.strictEqual(s.list().length, 0);
        });
    });

    // ── Edge Cases & Extended Coverage ──────────────────────

    describe('Edge Cases', () => {
        // Content type coverage
        it('creates all three content types', () => {
            const page = store.create({ type: 'page', title: 'P' });
            const post = store.create({ type: 'post', title: 'Q' });
            const media = store.create({ type: 'media', title: 'R' });
            assert.strictEqual(page.type, 'page');
            assert.strictEqual(post.type, 'post');
            assert.strictEqual(media.type, 'media');
        });

        // Type change via update
        it('allows type change via update', () => {
            const item = store.create({ type: 'page', title: 'T' });
            const updated = store.update(item.id, { type: 'post' });
            assert.strictEqual(updated.type, 'post');
        });

        // Metadata shallow copy on create (top-level keys are independent)
        it('create copies metadata top-level keys', () => {
            const meta = { author: 'j', count: 5 };
            const item = store.create({ type: 'page', title: 'M', metadata: meta });
            meta.author = 'changed';
            assert.strictEqual(item.metadata.author, 'j');
        });

        // Update metadata replaces entirely
        it('update replaces metadata entirely', () => {
            const item = store.create({ type: 'page', title: 'T', metadata: { a: 1, b: 2 } });
            const updated = store.update(item.id, { metadata: { c: 3 } });
            assert.strictEqual(updated.metadata.a, undefined);
            assert.strictEqual(updated.metadata.c, 3);
        });

        // Update metadata deep copy
        it('update copies metadata (no reference leak)', () => {
            const item = store.create({ type: 'page', title: 'T' });
            const meta = { deep: true };
            store.update(item.id, { metadata: meta });
            meta.deep = false;
            assert.strictEqual(store.read(item.id).metadata.deep, true);
        });

        // Delete doesn't affect other items
        it('deleting one item does not affect others', () => {
            const a = store.create({ type: 'page', title: 'A' });
            const b = store.create({ type: 'page', title: 'B' });
            store.delete(a.id);
            assert.strictEqual(store.read(b.id).title, 'B');
            assert.strictEqual(store.list().length, 1);
        });

        // List with empty filter
        it('list with empty filter returns all', () => {
            store.create({ type: 'page', title: 'A' });
            store.create({ type: 'post', title: 'B' });
            assert.strictEqual(store.list({}).length, 2);
        });

        // List filter by tag returns nothing when no tags match
        it('list with non-existent tag returns empty', () => {
            store.create({ type: 'page', title: 'A', metadata: { tags: ['x'] } });
            assert.strictEqual(store.list({ tag: 'y' }).length, 0);
        });

        // List with non-array tags metadata
        it('list tag filter handles non-array tags gracefully', () => {
            store.create({ type: 'page', title: 'A', metadata: { tags: 'not-array' } });
            assert.strictEqual(store.list({ tag: 'not-array' }).length, 0);
        });

        // Search with special regex-like characters
        it('search handles regex special characters safely', () => {
            store.create({ type: 'page', title: 'Price: $10.00' });
            assert.strictEqual(store.search('$10.00').length, 1);
            assert.strictEqual(store.search('Price.*').length, 0);
        });

        // Search with partial match
        it('search matches partial words', () => {
            store.create({ type: 'post', title: 'JavaScript', body: 'TypeScript is nice too' });
            assert.strictEqual(store.search('script').length, 1);
            assert.strictEqual(store.search('type').length, 1);
        });

        // Search with no results
        it('search returns empty when nothing matches', () => {
            store.create({ type: 'page', title: 'Hello World' });
            assert.strictEqual(store.search('xyz').length, 0);
        });

        // Slug generation edge cases
        it('slugify handles multiple special chars', () => {
            const m = store.createManifest({ title: 'Hello!!! World??? 123...' });
            assert.strictEqual(m.slug, 'hello-world-123');
        });

        it('slugify handles leading/trailing hyphens from special chars', () => {
            const m = store.createManifest({ title: '---Hello World---' });
            assert.strictEqual(m.slug, 'hello-world');
        });

        it('slugify handles all special characters', () => {
            const m = store.createManifest({ title: '!@#$%^&*()' });
            assert.strictEqual(m.slug, '');
        });

        // Manifest with all 4 regions
        it('manifest can have all four regions', () => {
            const m = store.createManifest({
                title: 'Full Page',
                layout: [
                    { region: 'header', contentId: 'h1', formula: 'f1' },
                    { region: 'body', contentId: 'b1', formula: null },
                    { region: 'sidebar', contentId: null, inline: 'Side' },
                    { region: 'footer', contentId: 'f1', formula: 'f2' },
                ],
            });
            assert.strictEqual(m.layout.length, 4);
            assert.strictEqual(m.layout[2].inline, 'Side');
            assert.strictEqual(m.layout[3].formula, 'f2');
        });

        // Manifest with no layout
        it('manifest with empty layout is valid', () => {
            const m = store.createManifest({ title: 'Empty' });
            assert.deepStrictEqual(m.layout, []);
        });

        // Manifest update slug
        it('update changes slug', () => {
            const m = store.createManifest({ title: 'Original' });
            const updated = store.updateManifest(m.id, { slug: 'custom-slug' });
            assert.strictEqual(updated.slug, 'custom-slug');
        });

        // Manifest update layout deep copy
        it('update manifest copies layout deeply', () => {
            const m = store.createManifest({ title: 'T', layout: [{ region: 'body', contentId: 'a' }] });
            const layout = [{ region: 'header', contentId: 'b' }];
            store.updateManifest(m.id, { layout });
            layout[0].contentId = 'hacked';
            assert.strictEqual(store.readManifest(m.id).layout[0].contentId, 'b');
        });

        // Manifest update preserves unmodified fields
        it('update manifest preserves theme and metadata', () => {
            const m = store.createManifest({ title: 'T', theme: 'dark', metadata: { key: 'val' } });
            const updated = store.updateManifest(m.id, { title: 'New Title' });
            assert.strictEqual(updated.theme, 'dark');
            assert.strictEqual(updated.metadata.key, 'val');
            assert.strictEqual(updated.title, 'New Title');
        });

        // Layout must be array
        it('rejects non-array layout', () => {
            assert.throws(() => store.createManifest({
                title: 'Bad',
                layout: 'not-array',
            }), /Layout must be an array/);
        });

        // Validate contentId undefined treated as null
        it('accepts undefined contentId in layout', () => {
            const m = store.createManifest({
                title: 'OK',
                layout: [{ region: 'body' }],
            });
            assert.strictEqual(m.layout[0].contentId, undefined);
        });

        // File persistence round-trip with metadata
        it('persists and restores metadata correctly', (t, done) => {
            const s = new ContentStore({ filePath: testFile, saveDelay: 10 });
            s.create({ type: 'page', title: 'Meta', metadata: { tags: ['a', 'b'], priority: 5 } });
            setTimeout(() => {
                const s2 = new ContentStore({ filePath: testFile });
                const item = s2.list()[0];
                assert.deepStrictEqual(item.metadata.tags, ['a', 'b']);
                assert.strictEqual(item.metadata.priority, 5);
                done();
            }, 50);
        });

        // File persistence with bad version
        it('ignores file with wrong version', () => {
            mkdirSync(testDir, { recursive: true });
            writeFileSync(testFile, JSON.stringify({ version: 99, items: {} }));
            const s = new ContentStore({ filePath: testFile });
            assert.strictEqual(s.list().length, 0);
        });

        // File persistence with corrupt JSON
        it('handles corrupt JSON file gracefully', () => {
            mkdirSync(testDir, { recursive: true });
            writeFileSync(testFile, '{not valid json}');
            const s = new ContentStore({ filePath: testFile });
            assert.strictEqual(s.list().length, 0);
        });

        // Debounced save coalesces multiple writes
        it('debounced save coalesces multiple creates', (t, done) => {
            const s = new ContentStore({ filePath: testFile, saveDelay: 50 });
            s.create({ type: 'page', title: 'A' });
            s.create({ type: 'page', title: 'B' });
            s.create({ type: 'page', title: 'C' });
            setTimeout(() => {
                const s2 = new ContentStore({ filePath: testFile });
                assert.strictEqual(s2.list().length, 3);
                done();
            }, 150);
        });

        // Store without filePath works fine (in-memory only)
        it('works without filePath (in-memory)', () => {
            const s = new ContentStore();
            s.create({ type: 'page', title: 'InMem' });
            assert.strictEqual(s.list().length, 1);
            s.saveNow(); // should be a no-op
        });

        // Cross-operation: create then search then update then search
        it('search reflects updates', () => {
            const item = store.create({ type: 'page', title: 'Alpha', body: 'Original' });
            store.update(item.id, { body: 'Updated content here' });
            const results = store.search('Updated');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].body, 'Updated content here');
        });

        // Cross-operation: create manifest with contentId, verify contentId survives round-trip
        it('manifest contentId survives read round-trip', () => {
            const item = store.create({ type: 'page', title: 'Bound' });
            const m = store.createManifest({
                title: 'Bound Page',
                layout: [{ region: 'body', contentId: item.id, formula: null }],
            });
            const read = store.readManifest(m.id);
            assert.strictEqual(read.layout[0].contentId, item.id);
        });

        // Manifest update with new metadata
        it('update manifest replaces metadata', () => {
            const m = store.createManifest({ title: 'T', metadata: { old: true } });
            const updated = store.updateManifest(m.id, { metadata: { new: true } });
            assert.strictEqual(updated.metadata.old, undefined);
            assert.strictEqual(updated.metadata.new, true);
        });

        // Default theme is null
        it('manifest defaults theme to null', () => {
            const m = store.createManifest({ title: 'No Theme' });
            assert.strictEqual(m.theme, null);
        });

        // Default metadata is empty object
        it('manifest defaults metadata to empty object', () => {
            const m = store.createManifest({ title: 'No Meta' });
            assert.deepStrictEqual(m.metadata, {});
        });

        // Content body can be long
        it('handles long body content', () => {
            const longBody = 'x'.repeat(100000);
            const item = store.create({ type: 'post', title: 'Long', body: longBody });
            assert.strictEqual(store.read(item.id).body.length, 100000);
        });

        // Search matches both title and body
        it('search returns item matching either title or body', () => {
            store.create({ type: 'page', title: 'Alpha', body: 'no match' });
            store.create({ type: 'page', title: 'no match', body: 'Alpha' });
            const results = store.search('alpha');
            assert.strictEqual(results.length, 2);
        });

        // Validate layout with formula field
        it('layout region preserves formula', () => {
            const m = store.createManifest({
                title: 'Formula',
                layout: [{ region: 'body', contentId: 'x', formula: '=SUM(A1:A10)' }],
            });
            assert.strictEqual(m.layout[0].formula, '=SUM(A1:A10)');
        });

        // contentId with undefined is allowed
        it('layout with undefined contentId passes validation', () => {
            assert.doesNotThrow(() => store.createManifest({
                title: 'OK',
                layout: [{ region: 'header' }],
            }));
        });
    });
});
