/**
 * Tests for sync/renderers/json.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToJSON } from '../sync/renderers/json.js';

describe('json-renderer', () => {
    it('renders ASCII to structured JSON object', () => {
        const ascii = '● Active\n○ Idle';
        const json = renderToJSON(ascii);
        
        assert.strictEqual(json.metadata.format, 'ascii-world-substrate');
        assert.strictEqual(json.metadata.dimensions.height, 2);
        assert.deepStrictEqual(json.grid, ['● Active', '○ Idle']);
    });

    it('extracts semantic status markers', () => {
        const ascii = '● Active\n○ Idle';
        const json = renderToJSON(ascii);
        
        assert.strictEqual(json.semantics.markers.length, 2);
        assert.strictEqual(json.semantics.markers[0].state, 'active');
        assert.strictEqual(json.semantics.markers[0].x, 0);
        assert.strictEqual(json.semantics.markers[0].y, 0);
        
        assert.strictEqual(json.semantics.markers[1].state, 'idle');
        assert.strictEqual(json.semantics.markers[1].x, 0);
        assert.strictEqual(json.semantics.markers[1].y, 1);
    });

    it('includes options in metadata', () => {
        const ascii = '...';
        const options = { appId: 'dashboard', user: 'jericho' };
        const json = renderToJSON(ascii, options);
        
        assert.strictEqual(json.metadata.appId, 'dashboard');
        assert.strictEqual(json.metadata.user, 'jericho');
    });
});
