// tests/ascii-experiment-runtime.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ASCIIExperimentRuntime } from '../sync/ascii-experiment-runtime.js';
import fs from 'fs';

describe('ASCIIExperimentRuntime', () => {
  const testLogPath = '.autoresearch/test-runtime-results.tsv';

  beforeEach(() => {
    if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
  });

  afterEach(() => {
    if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
  });

  it('runs spec and returns result', async () => {
    const runtime = new ASCIIExperimentRuntime({
      resultsPath: testLogPath,
      projectPath: '.'
    });

    const spec = `H: Test hypothesis
T: sync/synthetic-glyph-vm.js
M: file exists
B: 1`;

    const result = await runtime.runSpec(spec);
    assert.strictEqual(result.hypothesis, 'Test hypothesis');
    assert.strictEqual(result.target, 'sync/synthetic-glyph-vm.js');
    assert.ok(result.status);
  });

  it('evaluates file exists metric', async () => {
    const runtime = new ASCIIExperimentRuntime({
      resultsPath: testLogPath,
      projectPath: '.'
    });

    const spec = `H: Check file
T: sync/ascii-spec-parser.js
M: file exists
B: 1`;

    const result = await runtime.runSpec(spec);
    assert.strictEqual(result.status, 'KEEP');
  });

  it('logs result to TSV', async () => {
    const runtime = new ASCIIExperimentRuntime({
      resultsPath: testLogPath,
      projectPath: '.'
    });

    await runtime.runSpec(`H: Test\nT: file.js\nM: file exists\nB: 1`);

    assert.ok(fs.existsSync(testLogPath));
    const content = fs.readFileSync(testLogPath, 'utf-8');
    assert.ok(content.includes('Test'));
  });
});
