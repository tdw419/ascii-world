/**
 * Tests for sync/renderers/python.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToPython, renderToPythonMinimal } from '../sync/renderers/python.js';

describe('python-renderer', () => {
    it('renders ASCII to Python class', () => {
        const ascii = '┌───┐\n│ X │\n└───┘';
        const python = renderToPython(ascii, { className: 'MyGrid' });
        
        assert.ok(python.includes('class MyGrid:'), 'Contains class declaration');
        assert.ok(python.includes('        "┌───┐",'), 'Contains escaped ASCII line');
        assert.ok(python.includes('    def render(self) -> str:'), 'Contains render method');
    });

    it('renders minimal Python script', () => {
        const ascii = 'Line 1\nLine 2';
        const python = renderToPythonMinimal(ascii);
        
        assert.ok(python.includes('GRID = ['), 'Contains grid variable');
        assert.ok(python.includes('    "Line 1",'), 'Contains ASCII line');
        assert.ok(python.includes('print("\\n".join(GRID))'), 'Contains print statement');
    });

    it('escapes backslashes and quotes correctly', () => {
        const ascii = 'Backslash: \\, Quote: "';
        const python = renderToPythonMinimal(ascii);
        
        // Input: Backslash: \, Quote: "
        // Output row in Python: "Backslash: \\, Quote: \"",
        assert.ok(python.includes('"Backslash: \\\\, Quote: \\""'), 'Correctly escapes Python strings');
    });
});
