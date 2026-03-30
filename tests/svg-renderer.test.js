/**
 * Tests for sync/renderers/svg.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToSVG, renderToSVGDataURL } from '../sync/renderers/svg.js';

describe('svg-renderer', () => {
    it('renders ASCII to SVG string with standalone declaration', () => {
        const ascii = '┌───┐\n│ X │\n└───┘';
        const svg = renderToSVG(ascii);
        
        assert.ok(svg.startsWith('<?xml'), 'Starts with XML declaration');
        assert.ok(svg.includes('<svg'), 'Contains <svg> element');
        assert.ok(svg.includes('fill="#0a0a0f"'), 'Contains background color');
        assert.ok(svg.includes('X'), 'Contains ASCII content');
    });

    it('handles custom scale factors', () => {
        const ascii = '...';
        const svg = renderToSVG(ascii, { scale: 2 });
        
        assert.ok(svg.includes('width="1280"'), 'Width is scaled (80 * 8 * 2)');
        assert.ok(svg.includes('height="672"'), 'Height is scaled (24 * 14 * 2)');
    });

    it('generates a valid data URL', () => {
        const ascii = '...';
        const dataUrl = renderToSVGDataURL(ascii);
        
        assert.ok(dataUrl.startsWith('data:image/svg+xml,'), 'Starts with correct data URI scheme');
        assert.ok(dataUrl.includes('%3Csvg'), 'Contains URL-encoded <svg>');
    });

    it('groups characters by color for efficiency', () => {
        const ascii = '● Active';
        const svg = renderToSVG(ascii, { standalone: false });
        
        // Should have one group for green (●) and one for default ( Active)
        assert.ok(svg.includes('fill="#3fb950"'), 'Contains green color for ●');
        assert.ok(svg.includes('fill="#c9d1d9"'), 'Contains default color for " Active"');
    });

    it('escapes XML special characters', () => {
        const ascii = '<Tag> & "Quote"';
        const svg = renderToSVG(ascii, { standalone: false });
        
        assert.ok(svg.includes('&lt;Tag&gt;'), 'Escapes < and >');
        assert.ok(svg.includes('&amp;'), 'Escapes &');
        assert.ok(svg.includes('&quot;'), 'Escapes "');
    });
});
