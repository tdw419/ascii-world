/**
 * Tests for sync/renderers/markdown.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToMarkdown } from '../sync/renderers/markdown.js';

describe('markdown-renderer', () => {
    it('renders ASCII inside a code block', () => {
        const ascii = '┌───┐\n│ X │\n└───┘';
        const md = renderToMarkdown(ascii);
        
        assert.ok(md.includes('```text\n' + ascii), 'Contains ASCII in text code block');
        assert.ok(md.endsWith('```\n'), 'Ends with closing backticks');
    });

    it('includes a title if provided', () => {
        const ascii = '...';
        const title = 'System Dashboard';
        const md = renderToMarkdown(ascii, { title });
        
        assert.ok(md.startsWith('# System Dashboard\n\n'), 'Starts with H1 title');
    });

    it('includes metadata if requested', () => {
        const ascii = '...';
        const md = renderToMarkdown(ascii, { includeMetadata: true });
        
        assert.ok(md.includes('## Metadata'), 'Contains metadata section');
        assert.ok(md.includes('**Generated**'), 'Contains generated timestamp');
    });
});
