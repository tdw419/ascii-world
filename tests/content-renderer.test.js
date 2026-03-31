// tests/content-renderer.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ContentRenderer } from '../sync/content-renderer.js';

// ── Mock ScreenManager ────────────────────────────────────────

function createMockScreen(cols = 80, rows = 24) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        grid.push([]);
        for (let c = 0; c < cols; c++) {
            grid[r].push({ char: ' ', fg: null, bg: null });
        }
    }

    return {
        cols,
        rows,
        grid,
        setCell(col, row, char, fg, bg) {
            if (col < 0 || col >= cols || row < 0 || row >= rows) return;
            grid[row][col] = { char, fg, bg };
        },
        fillRect(col, row, w, h, char, fg, bg) {
            for (let y = row; y < row + h; y++) {
                for (let x = col; x < col + w; x++) {
                    this.setCell(x, y, char, fg, bg);
                }
            }
        },
        drawBox(col, row, w, h, style, fg, bg) {
            this.setCell(col, row, '┌', fg, bg);
            this.setCell(col + w - 1, row, '┐', fg, bg);
            this.setCell(col, row + h - 1, '└', fg, bg);
            this.setCell(col + w - 1, row + h - 1, '┘', fg, bg);
            for (let x = col + 1; x < col + w - 1; x++) {
                this.setCell(x, row, '─', fg, bg);
                this.setCell(x, row + h - 1, '─', fg, bg);
            }
            for (let y = row + 1; y < row + h - 1; y++) {
                this.setCell(col, y, '│', fg, bg);
                this.setCell(col + w - 1, y, '│', fg, bg);
            }
        },
        // Helper: read text from a row range
        getRowText(row, startCol = 0, endCol = cols) {
            let s = '';
            for (let c = startCol; c < endCol; c++) {
                s += grid[row][c].char;
            }
            return s;
        },
        // Helper: get cell at position
        getCellAt(col, row) {
            if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
            return grid[row][col];
        },
    };
}

// ── Mock ContentStore ─────────────────────────────────────────

function createMockStore(items = []) {
    const map = new Map(items.map(i => [i.id, i]));
    return {
        getById(id) { return map.get(id) || null; },
        read(id) { return map.get(id) || null; },
    };
}

// ── Mock LayoutEngine ─────────────────────────────────────────

function createMockLayoutEngine(regions = {}) {
    return {
        getRegion(name) { return regions[name] || null; },
    };
}

// ══════════════════════════════════════════════════════════════

describe('ContentRenderer', () => {
    let screen;
    let store;
    let renderer;

    beforeEach(() => {
        screen = createMockScreen(40, 12);
        store = createMockStore();
        renderer = new ContentRenderer({ screenManager: screen, contentStore: store });
    });

    // ── Constructor ────────────────────────────────────────

    describe('constructor', () => {
        it('stores screenManager and contentStore', () => {
            assert.strictEqual(renderer.screen, screen);
            assert.strictEqual(renderer.store, store);
        });
    });

    // ── renderContent — text ───────────────────────────────

    describe('renderContent — text', () => {
        it('renders simple text', () => {
            const content = {
                id: 't1',
                type: 'page',
                title: '',
                body: 'Hello world',
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 0, 0, 40, 3);
            const text = screen.getRowText(0, 0, 11);
            assert.strictEqual(text, 'Hello world');
        });

        it('word-wraps long text', () => {
            const content = {
                id: 't2',
                type: 'page',
                title: '',
                body: 'The quick brown fox jumps over the lazy dog today',
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 0, 0, 20, 5);
            const line0 = screen.getRowText(0, 0, 20).trimEnd();
            const line1 = screen.getRowText(1, 0, 20).trimEnd();
            assert.ok(line0.length > 0);
            assert.ok(line1.length > 0, 'text should wrap to second line');
        });

        it('clips with ... when exceeding region height', () => {
            const content = {
                id: 't3',
                type: 'page',
                title: '',
                body: 'Line one\nLine two\nLine three\nLine four',
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 0, 0, 40, 2);
            const lastLine = screen.getRowText(1, 0, 40);
            assert.ok(lastLine.includes('...'), 'last line should have clip indicator');
        });

        it('renders title when body is empty', () => {
            const content = {
                id: 't4',
                type: 'page',
                title: 'Title Only',
                body: '',
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 0, 0, 40, 3);
            const text = screen.getRowText(0, 0, 10);
            assert.strictEqual(text, 'Title Only');
        });

        it('handles empty content gracefully', () => {
            const content = {
                id: 't5',
                type: 'page',
                title: '',
                body: '',
                metadata: { renderAs: 'text' },
            };
            // Should not throw
            renderer.renderContent(content, 0, 0, 40, 3);
        });
    });

    // ── renderContent — heading ────────────────────────────

    describe('renderContent — heading', () => {
        it('centers heading text', () => {
            const content = {
                id: 'h1',
                type: 'page',
                title: 'My Page',
                body: '',
                metadata: { renderAs: 'heading' },
            };
            renderer.renderContent(content, 0, 0, 20, 3);
            const line0 = screen.getRowText(0, 0, 20);
            // Should contain the heading somewhere centered
            assert.ok(line0.includes('My Page'), `line should contain heading, got: "${line0}"`);
            // Should have leading spaces (centered)
            assert.strictEqual(line0[0], ' ', 'heading should be centered with leading space');
        });

        it('renders body below heading', () => {
            const content = {
                id: 'h2',
                type: 'page',
                title: 'Title',
                body: 'Body text here',
                metadata: { renderAs: 'heading' },
            };
            renderer.renderContent(content, 0, 0, 40, 5);
            const bodyLine = screen.getRowText(1, 0, 14);
            assert.strictEqual(bodyLine, 'Body text here');
        });

        it('uses bright white for heading', () => {
            const content = {
                id: 'h3',
                type: 'page',
                title: 'Head',
                body: '',
                metadata: { renderAs: 'heading' },
            };
            renderer.renderContent(content, 0, 0, 20, 2);
            const cell = screen.getCellAt(8, 0); // H in "Head" centered
            assert.ok(cell, 'cell should exist');
            assert.strictEqual(cell.char, 'H');
            // Bright white heading FG
            assert.deepStrictEqual(cell.fg, [0xff, 0xff, 0xff, 255]);
        });
    });

    // ── renderContent — list ───────────────────────────────

    describe('renderContent — list', () => {
        it('renders bullet list from body', () => {
            const content = {
                id: 'l1',
                type: 'page',
                title: '',
                body: 'Item one\nItem two\nItem three',
                metadata: { renderAs: 'list' },
            };
            renderer.renderContent(content, 0, 0, 40, 5);
            const line0 = screen.getRowText(0, 0, 40).trimEnd();
            assert.ok(line0.startsWith('\u2022'), 'line should start with bullet');
            assert.ok(line0.includes('Item one'));
        });

        it('renders list from metadata.items array', () => {
            const content = {
                id: 'l2',
                type: 'page',
                title: '',
                body: '',
                metadata: {
                    renderAs: 'list',
                    items: ['First', 'Second', 'Third'],
                },
            };
            renderer.renderContent(content, 0, 0, 40, 5);
            assert.ok(screen.getRowText(0, 0, 40).includes('First'));
            assert.ok(screen.getRowText(1, 0, 40).includes('Second'));
            assert.ok(screen.getRowText(2, 0, 40).includes('Third'));
        });

        it('wraps long list items', () => {
            const content = {
                id: 'l3',
                type: 'page',
                title: '',
                body: 'This is a very long list item that should wrap',
                metadata: { renderAs: 'list' },
            };
            renderer.renderContent(content, 0, 0, 20, 5);
            // Line 0 should have bullet
            const cell0 = screen.getCellAt(0, 0);
            assert.strictEqual(cell0.char, '\u2022');
            // Line 1 should have continuation (no bullet)
            const cell1 = screen.getCellAt(0, 1);
            assert.strictEqual(cell1.char, ' ', 'continuation line should be indented, not bulleted');
        });
    });

    // ── renderContent — code ───────────────────────────────

    describe('renderContent — code', () => {
        it('renders code with border', () => {
            const content = {
                id: 'c1',
                type: 'page',
                title: '',
                body: 'console.log("hi");',
                metadata: { renderAs: 'code' },
            };
            renderer.renderContent(content, 0, 0, 30, 5);
            // Top-left corner
            assert.strictEqual(screen.getCellAt(0, 0).char, '┌');
            assert.strictEqual(screen.getCellAt(29, 0).char, '┐');
            assert.strictEqual(screen.getCellAt(0, 4).char, '└');
            assert.strictEqual(screen.getCellAt(29, 4).char, '┘');
        });

        it('renders code text inside border', () => {
            const content = {
                id: 'c2',
                type: 'page',
                title: '',
                body: 'let x = 1;',
                metadata: { renderAs: 'code' },
            };
            renderer.renderContent(content, 0, 0, 30, 5);
            const innerText = screen.getRowText(1, 1, 11);
            assert.strictEqual(innerText, 'let x = 1;');
        });

        it('clips code lines with ... when exceeding height', () => {
            const lines = [];
            for (let i = 0; i < 20; i++) lines.push(`line ${i}`);
            const content = {
                id: 'c3',
                type: 'page',
                title: '',
                body: lines.join('\n'),
                metadata: { renderAs: 'code' },
            };
            // Height 6 means inner height = 4 (6 - 2 for borders)
            renderer.renderContent(content, 0, 0, 30, 6);
            const lastInnerRow = screen.getRowText(4, 1, 30);
            assert.ok(lastInnerRow.includes('...'), 'should clip with ...');
        });

        it('falls back to text for tiny regions', () => {
            const content = {
                id: 'c4',
                type: 'page',
                title: '',
                body: 'hi',
                metadata: { renderAs: 'code' },
            };
            // 2x2 is too small for borders
            renderer.renderContent(content, 0, 0, 2, 2);
            // Should still render the text (falls back to text render)
            assert.strictEqual(screen.getCellAt(0, 0).char, 'h');
            assert.strictEqual(screen.getCellAt(1, 0).char, 'i');
        });
    });

    // ── renderContent — image ──────────────────────────────

    describe('renderContent — image', () => {
        it('renders image placeholder with alt text', () => {
            const content = {
                id: 'i1',
                type: 'media',
                title: 'photo.jpg',
                body: '',
                metadata: { renderAs: 'image', alt: 'a sunset' },
            };
            renderer.renderContent(content, 0, 0, 30, 4);
            const line0 = screen.getRowText(0, 0, 30);
            assert.ok(line0.includes('[IMAGE: a sunset]'), `should contain placeholder, got: "${line0}"`);
        });

        it('uses title as default alt text', () => {
            const content = {
                id: 'i2',
                type: 'media',
                title: 'logo.png',
                body: '',
                metadata: { renderAs: 'image' },
            };
            renderer.renderContent(content, 0, 0, 30, 3);
            const line0 = screen.getRowText(0, 0, 30);
            assert.ok(line0.includes('logo.png'), 'should use title as alt');
        });

        it('renders dot pattern in body area', () => {
            const content = {
                id: 'i3',
                type: 'media',
                title: 'img',
                body: '',
                metadata: { renderAs: 'image' },
            };
            renderer.renderContent(content, 0, 0, 10, 3);
            // Row 1 should have alternating dots
            const row1 = screen.getRowText(1, 0, 10);
            assert.ok(row1.includes('.'), 'image body should have dot pattern');
        });
    });

    // ── renderContent — link ───────────────────────────────

    describe('renderContent — link', () => {
        it('renders link text', () => {
            const content = {
                id: 'k1',
                type: 'page',
                title: 'Click here',
                body: 'https://example.com',
                metadata: { renderAs: 'link', label: 'Click here' },
            };
            renderer.renderContent(content, 0, 0, 40, 2);
            const line0 = screen.getRowText(0, 0, 10);
            assert.strictEqual(line0, 'Click here');
        });

        it('uses body as fallback label', () => {
            const content = {
                id: 'k2',
                type: 'page',
                title: '',
                body: 'https://example.com',
                metadata: { renderAs: 'link' },
            };
            renderer.renderContent(content, 0, 0, 40, 2);
            const line0 = screen.getRowText(0, 0, 19);
            assert.strictEqual(line0, 'https://example.com');
        });

        it('uses blue foreground for links', () => {
            const content = {
                id: 'k3',
                type: 'page',
                title: 'Link',
                body: '',
                metadata: { renderAs: 'link', label: 'Link' },
            };
            renderer.renderContent(content, 0, 0, 10, 1);
            const cell = screen.getCellAt(0, 0);
            assert.deepStrictEqual(cell.fg, [0x58, 0xa6, 0xff, 255]);
        });
    });

    // ── renderPage ─────────────────────────────────────────

    describe('renderPage', () => {
        it('renders a full page with multiple regions', () => {
            const store = createMockStore([
                {
                    id: 'header1',
                    type: 'page',
                    title: 'Welcome',
                    body: '',
                    metadata: { renderAs: 'heading' },
                },
                {
                    id: 'body1',
                    type: 'page',
                    title: '',
                    body: 'This is the main content.',
                    metadata: { renderAs: 'text' },
                },
            ]);
            const r = new ContentRenderer({ screenManager: screen, contentStore: store });

            const layoutEngine = createMockLayoutEngine({
                header: { x: 0, y: 0, w: 40, h: 2 },
                body: { x: 0, y: 2, w: 40, h: 8 },
            });

            const manifest = {
                id: 'page1',
                title: 'Test Page',
                layout: [
                    { region: 'header', contentId: 'header1' },
                    { region: 'body', contentId: 'body1' },
                ],
            };

            r.renderPage(manifest, layoutEngine);

            // Header should contain "Welcome" centered
            const headerText = screen.getRowText(0, 0, 40);
            assert.ok(headerText.includes('Welcome'));

            // Body should contain content text
            const bodyText = screen.getRowText(2, 0, 40);
            assert.ok(bodyText.includes('This is the main content.'));
        });

        it('skips regions not found in layout engine', () => {
            const layoutEngine = createMockLayoutEngine({});
            const manifest = {
                id: 'p2',
                title: 'Empty',
                layout: [
                    { region: 'nonexistent', contentId: 'x1' },
                ],
            };
            // Should not throw
            renderer.renderPage(manifest, layoutEngine);
        });

        it('skips entries with missing content', () => {
            const layoutEngine = createMockLayoutEngine({
                body: { x: 0, y: 0, w: 40, h: 5 },
            });
            const manifest = {
                id: 'p3',
                title: 'Missing',
                layout: [
                    { region: 'body', contentId: 'nonexistent-id' },
                ],
            };
            // Should not throw
            renderer.renderPage(manifest, layoutEngine);
        });

        it('renders inline content when contentId is null', () => {
            const layoutEngine = createMockLayoutEngine({
                footer: { x: 0, y: 10, w: 40, h: 2 },
            });
            const manifest = {
                id: 'p4',
                title: 'Inline',
                layout: [
                    { region: 'footer', contentId: null, inline: 'Copyright 2026' },
                ],
            };
            renderer.renderPage(manifest, layoutEngine);
            const text = screen.getRowText(10, 0, 14);
            assert.strictEqual(text, 'Copyright 2026');
        });

        it('handles null manifest gracefully', () => {
            renderer.renderPage(null, createMockLayoutEngine());
            renderer.renderPage({}, createMockLayoutEngine());
            renderer.renderPage({ layout: null }, createMockLayoutEngine());
        });

        it('handles zero-size regions', () => {
            const layoutEngine = createMockLayoutEngine({
                tiny: { x: 0, y: 0, w: 0, h: 0 },
            });
            const manifest = {
                id: 'p5',
                title: 'Tiny',
                layout: [{ region: 'tiny', contentId: null, inline: 'hi' }],
            };
            renderer.renderPage(manifest, layoutEngine);
            // Should not throw, nothing rendered
        });
    });

    // ── Word wrap edge cases ───────────────────────────────

    describe('word wrapping', () => {
        it('handles very long words by truncating to width', () => {
            const content = {
                id: 'w1',
                type: 'page',
                title: '',
                body: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 0, 0, 10, 5);
            const line0 = screen.getRowText(0, 0, 10);
            assert.strictEqual(line0, 'ABCDEFGHIJ');
        });

        it('preserves explicit newlines', () => {
            const content = {
                id: 'w2',
                type: 'page',
                title: '',
                body: 'Line1\nLine2\nLine3',
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 0, 0, 40, 5);
            assert.strictEqual(screen.getRowText(0, 0, 5), 'Line1');
            assert.strictEqual(screen.getRowText(1, 0, 5), 'Line2');
            assert.strictEqual(screen.getRowText(2, 0, 5), 'Line3');
        });

        it('handles single character width', () => {
            const content = {
                id: 'w3',
                type: 'page',
                title: '',
                body: 'Hi',
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 0, 0, 1, 5);
            assert.strictEqual(screen.getCellAt(0, 0).char, 'H');
            assert.strictEqual(screen.getCellAt(0, 1).char, 'i');
        });
    });

    // ── Store compatibility ────────────────────────────────

    describe('store method compatibility', () => {
        it('works with read() method (ContentStore default)', () => {
            const storeWithRead = {
                read(id) {
                    if (id === 'r1') return { id: 'r1', type: 'page', title: '', body: 'from read', metadata: {} };
                    return null;
                },
            };
            const r = new ContentRenderer({ screenManager: screen, contentStore: storeWithRead });
            const layoutEngine = createMockLayoutEngine({
                body: { x: 0, y: 0, w: 40, h: 3 },
            });
            r.renderPage(
                { id: 'p', title: '', layout: [{ region: 'body', contentId: 'r1' }] },
                layoutEngine,
            );
            const text = screen.getRowText(0, 0, 9);
            assert.strictEqual(text, 'from read');
        });

        it('works with getById() method', () => {
            const storeWithGetById = {
                getById(id) {
                    if (id === 'g1') return { id: 'g1', type: 'page', title: '', body: 'from getById', metadata: {} };
                    return null;
                },
            };
            const r = new ContentRenderer({ screenManager: screen, contentStore: storeWithGetById });
            const layoutEngine = createMockLayoutEngine({
                body: { x: 0, y: 0, w: 40, h: 3 },
            });
            r.renderPage(
                { id: 'p', title: '', layout: [{ region: 'body', contentId: 'g1' }] },
                layoutEngine,
            );
            const text = screen.getRowText(0, 0, 12);
            assert.strictEqual(text, 'from getById');
        });
    });

    // ── Bounds ─────────────────────────────────────────────

    describe('bounds safety', () => {
        it('does not write outside region bounds', () => {
            const content = {
                id: 'b1',
                type: 'page',
                title: '',
                body: 'X'.repeat(100),
                metadata: { renderAs: 'text' },
            };
            renderer.renderContent(content, 5, 3, 10, 2);
            // Check that nothing was written outside x=[5,15), y=[3,5)
            for (let row = 0; row < screen.rows; row++) {
                for (let col = 0; col < screen.cols; col++) {
                    if (row < 3 || row >= 5 || col < 5 || col >= 15) {
                        const cell = screen.getCellAt(col, row);
                        // Outside region should remain default (space from initial fill)
                        // Since we didn't clear, initial cells have char=' ' and fg=null
                        assert.ok(
                            cell.char === ' ' || cell.fg === null,
                            `cell at (${col},${row}) should be empty but has "${cell.char}"`
                        );
                    }
                }
            }
        });
    });
});
