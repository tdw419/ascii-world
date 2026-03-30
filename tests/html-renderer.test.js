/**
 * Tests for sync/renderers/html.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToHTML } from '../sync/renderers/html.js';

describe('html-renderer', () => {
    it('renders ASCII inside a pre tag', () => {
        const ascii = '┌───┐\n│ X │\n└───┘';
        const html = renderToHTML(ascii);
        
        assert.ok(html.startsWith('<pre class="ascii-world classic">'), 'Starts with pre tag');
        assert.ok(html.includes('X'), 'Contains ASCII content');
        assert.ok(html.endsWith('</pre>'), 'Ends with closing pre tag');
    });

    it('wraps semantic characters in spans', () => {
        const ascii = '● Active';
        const html = renderToHTML(ascii);
        
        assert.ok(html.includes('<span class="status-active">●</span>'), 'Wraps status symbol in span');
    });

    it('handles standalone mode with full document', () => {
        const ascii = '...';
        const html = renderToHTML(ascii, { standalone: true });
        
        assert.ok(html.startsWith('<!DOCTYPE html>'), 'Starts with doctype');
        assert.ok(html.includes('<style>'), 'Contains style tag');
        assert.ok(html.includes('<title>ASCII World</title>'), 'Contains title');
    });

    it('escapes HTML special characters', () => {
        const ascii = '<Tag> & "Quote"';
        const html = renderToHTML(ascii);
        
        assert.ok(html.includes('&lt;Tag&gt;'), 'Escapes < and >');
        assert.ok(html.includes('&amp;'), 'Escapes &');
        assert.ok(html.includes('&quot;'), 'Escapes "');
    });

    it('supports multiple themes', () => {
        const ascii = '...';
        const html = renderToHTML(ascii, { theme: 'matrix' });
        
        assert.ok(html.includes('class="ascii-world matrix"'), 'Uses matrix theme class');
    });
});
