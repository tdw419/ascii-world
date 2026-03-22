// tests/ascii-result-formatter.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ASCIIResultFormatter } from '../sync/ascii-result-formatter.js';

describe('ASCIIResultFormatter', () => {
  it('formats result as Layer 3 full box', () => {
    const result = {
      hypothesis: 'Cache opcode names',
      target: 'sync/synthetic-glyph-vm.js',
      metric: 'tests pass',
      baseline: '100 iterations',
      status: 'KEEP',
      metricValue: 95,
      elapsed: 1234
    };

    const formatted = ASCIIResultFormatter.format(result);
    assert.ok(formatted.includes('RESULT:'));
    assert.ok(formatted.includes('KEEP'));
    assert.ok(formatted.includes('95'));
    assert.ok(formatted.includes('1.2s'));
  });

  it('formats history table', () => {
    const results = [
      { hypothesis: 'Test 1', metricValue: 90, status: 'KEEP' },
      { hypothesis: 'Test 2', metricValue: 85, status: 'REVERT' }
    ];

    const formatted = ASCIIResultFormatter.formatHistory(results);
    assert.ok(formatted.includes('RUN'));
    assert.ok(formatted.includes('HYPOTHESIS'));
    assert.ok(formatted.includes('Test 1'));
    assert.ok(formatted.includes('REVERT'));
  });
});
