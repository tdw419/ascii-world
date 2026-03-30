/**
 * Tests for VisualScorer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VisualScorer } from '../sync/visual-scorer.js';

describe('VisualScorer', () => {
    it('module can be imported', () => {
        assert.ok(VisualScorer, 'VisualScorer class should exist');
    });

    it('constructor sets default endpoint and model', () => {
        const scorer = new VisualScorer();
        assert.strictEqual(scorer.endpoint, 'http://localhost:1234/v1/chat/completions');
        assert.strictEqual(scorer.model, 'qwen/qwen3-vl-8b');
    });

    it('constructor accepts custom options', () => {
        const scorer = new VisualScorer({ 
            endpoint: 'http://test:1234/v1', 
            model: 'test-model' 
        });
        assert.strictEqual(scorer.endpoint, 'http://test:1234/v1');
        assert.strictEqual(scorer.model, 'test-model');
    });

    it('returns failure scores if fetch fails', async () => {
        const scorer = new VisualScorer({ endpoint: 'http://invalid-endpoint' });
        const result = await scorer.score(Buffer.from('fake-png'));
        
        assert.strictEqual(result.total, 4);
        assert.ok(result.reason.startsWith('Error:'), 'Should contain error message');
    });
});
