/**
 * Tests for sync/renderers/index.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render, detectFormat, renderers, getRendererInfo } from '../sync/renderers/index.js';

describe('renderer-index', () => {
    describe('detectFormat', () => {
        it('maps extensions to canonical format names', () => {
            assert.strictEqual(detectFormat('.html'), 'html');
            assert.strictEqual(detectFormat('.py'), 'python');
            assert.strictEqual(detectFormat('.md'), 'markdown');
        });

        it('handles format names directly', () => {
            assert.strictEqual(detectFormat('ANSI'), 'ansi');
            assert.strictEqual(detectFormat('SVG'), 'svg');
        });
    });

    describe('render', () => {
        const ascii = '● Active';

        it('renders to HTML', () => {
            const html = render(ascii, 'html');
            assert.ok(html.includes('<pre'), 'Renders HTML');
        });

        it('renders to JSON', () => {
            const json = render(ascii, 'json');
            assert.strictEqual(typeof json, 'object', 'Renders JSON object');
            assert.strictEqual(json.semantics.markers[0].state, 'active');
        });

        it('throws error for unknown format', () => {
            assert.throws(() => render(ascii, 'unknown-format'), /Unknown renderer format/);
        });
    });

    describe('getRendererInfo', () => {
        it('returns an array of renderer metadata', () => {
            const info = getRendererInfo();
            assert.ok(Array.isArray(info), 'Returns array');
            assert.ok(info.some(r => r.name === 'html'), 'Includes HTML renderer');
            assert.ok(info.some(r => r.name === 'ansi'), 'Includes ANSI renderer');
        });
    });
});
