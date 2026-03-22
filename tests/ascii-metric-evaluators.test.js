// tests/ascii-metric-evaluators.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  FileExistsEvaluator,
  TestsPassEvaluator,
  BenchmarkEvaluator,
  GitEvaluator,
  MetricEvaluatorRegistry
} from '../sync/ascii-metric-evaluators.js';

describe('MetricEvaluators', () => {
  const projectPath = '.';

  describe('FileExistsEvaluator', () => {
    it('returns success when file exists', async () => {
      const evaluator = new FileExistsEvaluator(projectPath);
      const result = await evaluator.evaluate({ t: 'sync/ascii-spec-parser.js' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.value, 1);
    });

    it('returns failure when file does not exist', async () => {
      const evaluator = new FileExistsEvaluator(projectPath);
      const result = await evaluator.evaluate({ t: 'nonexistent-file.js' });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.value, 0);
    });
  });

  describe('BenchmarkEvaluator', () => {
    it('has patterns for common metrics', () => {
      const evaluator = new BenchmarkEvaluator(projectPath);
      assert.ok(evaluator.patterns['ops/sec']);
      assert.ok(evaluator.patterns['latency']);
      assert.ok(evaluator.patterns['throughput']);
    });

    it('parses ops/sec from output', () => {
      const evaluator = new BenchmarkEvaluator(projectPath);
      const output = 'ops/sec=1,234,567';
      const match = output.match(evaluator.patterns['ops/sec']);
      assert.ok(match);
      assert.strictEqual(match[1], '1,234,567');
    });
  });

  describe('GitEvaluator', () => {
    it('checks branch status', async () => {
      const evaluator = new GitEvaluator(projectPath);
      const result = await evaluator.checkBranch({});
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('branch'));
    });

    it('has commit and revert methods', () => {
      const evaluator = new GitEvaluator(projectPath);
      assert.ok(typeof evaluator.commit === 'function');
      assert.ok(typeof evaluator.revert === 'function');
    });
  });

  describe('MetricEvaluatorRegistry', () => {
    it('registers default evaluators', () => {
      const registry = new MetricEvaluatorRegistry(projectPath);
      assert.ok(registry.getEvaluator('file exists'));
      assert.ok(registry.getEvaluator('tests pass'));
      assert.ok(registry.getEvaluator('ops/sec'));
      assert.ok(registry.getEvaluator('no regression'));
    });

    it('returns file exists evaluator for unknown metrics', () => {
      const registry = new MetricEvaluatorRegistry(projectPath);
      const evaluator = registry.getEvaluator('unknown metric');
      assert.ok(evaluator instanceof FileExistsEvaluator);
    });

    it('allows custom evaluator registration', () => {
      const registry = new MetricEvaluatorRegistry(projectPath);

      class CustomEvaluator {
        async evaluate() {
          return { success: true, value: 42 };
        }
      }

      registry.register('custom', CustomEvaluator);
      const evaluator = registry.getEvaluator('custom metric');
      assert.ok(evaluator instanceof CustomEvaluator);
    });
  });
});
