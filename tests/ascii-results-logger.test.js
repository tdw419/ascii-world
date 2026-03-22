// tests/ascii-results-logger.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ASCIIResultsLogger } from '../sync/ascii-results-logger.js';
import fs from 'fs';

describe('ASCIIResultsLogger', () => {
  const testLogPath = '.autoresearch/test-results.tsv';

  beforeEach(() => {
    if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
  });

  afterEach(() => {
    if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
  });

  it('logs experiment result to TSV', () => {
    const logger = new ASCIIResultsLogger(testLogPath);
    logger.log({
      hypothesis: 'Cache OP_NAMES lookup',
      baseline: 100,
      metric: 95,
      status: 'KEEP'
    });

    const content = fs.readFileSync(testLogPath, 'utf-8');
    assert.ok(content.includes('Cache OP_NAMES lookup'));
    assert.ok(content.includes('100'));
    assert.ok(content.includes('95'));
    assert.ok(content.includes('KEEP'));
  });

  it('reads recent results', () => {
    const logger = new ASCIIResultsLogger(testLogPath);
    logger.log({ hypothesis: 'Test 1', baseline: 100, metric: 90, status: 'KEEP' });
    logger.log({ hypothesis: 'Test 2', baseline: 100, metric: 85, status: 'REVERT' });

    const recent = logger.readRecent(10);
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].hypothesis, 'Test 1');
    assert.strictEqual(recent[1].status, 'REVERT');
  });

  it('creates directory if missing', () => {
    const newPath = '.autoresearch/subdir/test.tsv';
    if (fs.existsSync('.autoresearch/subdir')) fs.rmSync('.autoresearch/subdir', { recursive: true });

    const logger = new ASCIIResultsLogger(newPath);
    assert.ok(fs.existsSync('.autoresearch/subdir'));

    // Cleanup
    fs.rmSync('.autoresearch/subdir', { recursive: true });
  });
});
