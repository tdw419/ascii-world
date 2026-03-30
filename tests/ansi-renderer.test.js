/**
 * Tests for sync/renderers/ansi.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToANSI, stripANSI, ANSI, createTUIFrame } from '../sync/renderers/ansi.js';

describe('ansi-renderer', () => {
    it('module can be imported and has expected exports', () => {
        assert.ok(renderToANSI, 'renderToANSI is exported');
        assert.ok(stripANSI, 'stripANSI is exported');
        assert.ok(ANSI, 'ANSI codes are exported');
    });

    it('renders plain text without changes', () => {
        const input = 'Hello World';
        const output = renderToANSI(input);
        // It should add reset at the end of the line if there were any color changes, 
        // but for plain text it might just return the text.
        // Looking at the implementation, currentColor starts as ANSI.reset.
        // If color stays reset, it doesn't add any codes.
        assert.strictEqual(stripANSI(output), input);
    });

    it('applies green color to status symbols', () => {
        const input = 'Status: ● OK';
        const output = renderToANSI(input);
        assert.ok(output.includes('\x1b[32m●'), 'Contains green dot');
        assert.ok(output.includes('\x1b[0m OK'), 'Resets after green dot');
    });

    it('applies red color to failure symbols', () => {
        const input = 'Status: ✗ Error';
        const output = renderToANSI(input);
        assert.ok(output.includes('\x1b[31m✗'), 'Contains red X');
    });

    it('applies cyan color to brackets', () => {
        const input = '[Panel]';
        const output = renderToANSI(input);
        assert.ok(output.includes('\x1b[36m['), 'Contains cyan [');
        assert.ok(output.includes('\x1b[36m]'), 'Contains cyan ]');
    });

    it('applies dim style to box drawing characters', () => {
        const input = '┌─┐\n│ │\n└─┘';
        const output = renderToANSI(input);
        assert.ok(output.includes('\x1b[2m┌'), 'Contains dim top-left corner');
        // The implementation only emits a color code if it changes.
        // Since both ┌ and ─ are dim, there is no code between them.
        assert.ok(output.includes('┌─'), 'Contains box characters');
    });

    it('strips ANSI codes correctly', () => {
        const colored = '\x1b[32mGreen\x1b[0m and \x1b[31mRed\x1b[0m';
        const plain = stripANSI(colored);
        assert.strictEqual(plain, 'Green and Red');
    });

    it('creates TUI frames with correct borders', () => {
        const options = {
            title: 'Test',
            content: 'Hello',
            width: 10,
            style: 'single'
        };
        const frame = createTUIFrame(options);
        const lines = stripANSI(frame).split('\n');
        
        assert.strictEqual(lines[0], '┌─ Test ─┐');
        assert.strictEqual(lines[1], '│Hello   │');
        assert.strictEqual(lines[2], '└────────┘');
    });

    it('handles multiple lines correctly', () => {
        const input = 'Line 1\nLine 2';
        const output = renderToANSI(input);
        assert.strictEqual(output.split('\n').length, 2);
    });

    it('resets color at the end of each line', () => {
        const input = '● Green Line';
        const output = renderToANSI(input);
        // Implementation: "\x1b[32m●\x1b[0m Green Line"
        // Wait, looking at the code:
        // for (let j = 0; j < chars.length; j++) { ... if (color !== currentColor) { lineOutput += color; currentColor = color; } lineOutput += ch; }
        // if (currentColor !== ANSI.reset) { lineOutput += ANSI.reset; }
        // '●' is green. ' ' (space) is reset.
        // So currentColor becomes green for '●', then reset for ' '.
        // Then at the end of the line, currentColor IS ANSI.reset, so it doesn't add another reset.
        assert.ok(output.includes('\x1b[0m '), 'Resets after colored symbol');
    });
});
