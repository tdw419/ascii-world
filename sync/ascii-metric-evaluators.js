// sync/ascii-metric-evaluators.js
// Metric evaluators for ASCII experiment runtime

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Base metric evaluator
 */
export class MetricEvaluator {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async evaluate(spec) {
    return { success: false, value: 0, message: 'Not implemented' };
  }
}

/**
 * File exists check
 */
export class FileExistsEvaluator extends MetricEvaluator {
  async evaluate(spec) {
    const targetPath = path.join(this.projectPath, spec.t);
    const exists = fs.existsSync(targetPath);
    return {
      success: exists,
      value: exists ? 1 : 0,
      message: exists ? 'File exists' : 'File not found'
    };
  }
}

/**
 * Tests pass check
 */
export class TestsPassEvaluator extends MetricEvaluator {
  async evaluate(spec) {
    try {
      const result = execSync('npm test 2>&1', {
        cwd: this.projectPath,
        encoding: 'utf-8',
        timeout: 60000
      });

      // Parse test output for pass/fail counts
      const passMatch = result.match(/(\d+)\s+pass/);
      const failMatch = result.match(/(\d+)\s+fail/);

      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      const total = passed + failed;

      const success = failed === 0 && passed > 0;
      const value = total > 0 ? Math.round((passed / total) * 100) : 0;

      return {
        success,
        value,
        message: `${passed}/${total} tests passed`
      };
    } catch (err) {
      // Check if output contains pass info even on error
      const output = err.stdout || err.stderr || '';
      if (output.includes('pass') && !output.includes('fail')) {
        return { success: true, value: 100, message: 'Tests passed' };
      }
      return { success: false, value: 0, message: err.message };
    }
  }
}

/**
 * Benchmark metric evaluator
 * Parses benchmark output for metrics like ops/sec, latency, etc.
 */
export class BenchmarkEvaluator extends MetricEvaluator {
  constructor(projectPath) {
    super(projectPath);
    this.patterns = {
      'ops/sec': /ops\/sec[=:\s]+([\d,]+)/i,
      'ops/s': /ops\/s[=:\s]+([\d,]+)/i,
      'latency': /latency[=:\s]+([\d.]+)\s*(ms|us|ns)?/i,
      'throughput': /throughput[=:\s]+([\d.]+)\s*(MB\/s|GB\/s)?/i,
      'time': /time[=:\s]+([\d.]+)\s*(ms|s)?/i,
      'duration': /duration[=:\s]+([\d.]+)\s*(ms|s)?/i,
      'fps': /fps[=:\s]+([\d.]+)/i,
      'score': /score[=:\s]+([\d.]+)/i
    };
  }

  async evaluate(spec) {
    const metric = spec.m.toLowerCase();
    const baseline = parseFloat(spec.b) || 0;

    // Run benchmark command
    let output;
    try {
      // Check if there's a benchmark script
      const pkgPath = path.join(this.projectPath, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      let cmd = 'node ' + spec.t;
      if (pkg.scripts?.benchmark) {
        cmd = 'npm run benchmark';
      } else if (pkg.scripts?.test) {
        cmd = 'npm test';
      }

      output = execSync(cmd, {
        cwd: this.projectPath,
        encoding: 'utf-8',
        timeout: 120000
      });
    } catch (err) {
      output = err.stdout || err.stderr || '';
    }

    // Parse metric from output
    for (const [name, pattern] of Object.entries(this.patterns)) {
      if (metric.includes(name)) {
        const match = output.match(pattern);
        if (match) {
          const value = parseFloat(match[1].replace(/,/g, ''));
          const unit = match[2] || '';

          // Compare to baseline if provided
          const success = baseline > 0 ? value >= baseline * 0.95 : true;

          return {
            success,
            value,
            message: `${name}=${value}${unit}`,
            rawOutput: output.slice(0, 500)
          };
        }
      }
    }

    // Generic number extraction
    const numMatch = metric.match(/([<>=]+)\s*([\d.]+)/);
    if (numMatch) {
      const op = numMatch[1];
      const target = parseFloat(numMatch[2]);

      // Find any number in output
      const numbers = output.match(/[\d,]+/g)?.map(n => parseFloat(n.replace(/,/g, ''))) || [];
      const value = numbers[0] || 0;

      let success = false;
      switch (op) {
        case '>': success = value > target; break;
        case '>=': success = value >= target; break;
        case '<': success = value < target; break;
        case '<=': success = value <= target; break;
        case '==': case '=': success = value === target; break;
      }

      return { success, value, message: `value=${value} (target ${op}${target})` };
    }

    return { success: false, value: 0, message: 'Could not parse benchmark output' };
  }
}

/**
 * Git integration evaluator
 * Handles commits, reverts, and status checks
 */
export class GitEvaluator extends MetricEvaluator {
  async evaluate(spec) {
    const metric = spec.m.toLowerCase();

    // Check for git-related metrics
    if (metric.includes('no regression') || metric.includes('no changes')) {
      return this.checkNoRegression(spec);
    }

    if (metric.includes('commit') || metric.includes('committed')) {
      return this.checkCommitted(spec);
    }

    if (metric.includes('branch')) {
      return this.checkBranch(spec);
    }

    // Default: check git status
    return this.checkStatus(spec);
  }

  async checkNoRegression(spec) {
    try {
      // Run tests first
      execSync('npm test', { cwd: this.projectPath, stdio: 'pipe' });

      // Check if there are uncommitted changes
      const status = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf-8'
      });

      const hasChanges = status.trim().length > 0;

      return {
        success: true,
        value: hasChanges ? 1 : 0,
        message: hasChanges ? 'Has uncommitted changes' : 'No changes'
      };
    } catch (err) {
      return { success: false, value: 0, message: err.message };
    }
  }

  async checkCommitted(spec) {
    try {
      const status = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf-8'
      });

      const clean = status.trim().length === 0;

      return {
        success: clean,
        value: clean ? 1 : 0,
        message: clean ? 'All changes committed' : 'Uncommitted changes exist'
      };
    } catch (err) {
      return { success: false, value: 0, message: err.message };
    }
  }

  async checkBranch(spec) {
    try {
      const branch = execSync('git branch --show-current', {
        cwd: this.projectPath,
        encoding: 'utf-8'
      }).trim();

      return {
        success: true,
        value: 1,
        message: `On branch: ${branch}`
      };
    } catch (err) {
      return { success: false, value: 0, message: err.message };
    }
  }

  async checkStatus(spec) {
    try {
      const status = execSync('git status --short', {
        cwd: this.projectPath,
        encoding: 'utf-8'
      });

      const lines = status.trim().split('\n').filter(l => l);

      return {
        success: true,
        value: lines.length,
        message: `${lines.length} files changed`
      };
    } catch (err) {
      return { success: false, value: 0, message: err.message };
    }
  }

  // Utility: commit changes
  async commit(message) {
    try {
      execSync('git add -A', { cwd: this.projectPath });
      execSync(`git commit -m "${message}"`, { cwd: this.projectPath, encoding: 'utf-8' });
      return { success: true, message: 'Committed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // Utility: revert last commit
  async revert() {
    try {
      execSync('git reset --hard HEAD~1', { cwd: this.projectPath });
      return { success: true, message: 'Reverted' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

/**
 * Metric evaluator registry
 */
export class MetricEvaluatorRegistry {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.evaluators = new Map();

    // Register default evaluators
    this.register('exists', FileExistsEvaluator);
    this.register('file exists', FileExistsEvaluator);
    this.register('tests pass', TestsPassEvaluator);
    this.register('tests', TestsPassEvaluator);
    this.register('ops/sec', BenchmarkEvaluator);
    this.register('ops/s', BenchmarkEvaluator);
    this.register('latency', BenchmarkEvaluator);
    this.register('throughput', BenchmarkEvaluator);
    this.register('benchmark', BenchmarkEvaluator);
    this.register('no regression', GitEvaluator);
    this.register('git', GitEvaluator);
    this.register('commit', GitEvaluator);
  }

  register(keyword, EvaluatorClass) {
    this.evaluators.set(keyword.toLowerCase(), new EvaluatorClass(this.projectPath));
  }

  getEvaluator(metric) {
    const metricLower = metric.toLowerCase();

    for (const [keyword, evaluator] of this.evaluators) {
      if (metricLower.includes(keyword)) {
        return evaluator;
      }
    }

    // Default to file exists
    return this.evaluators.get('exists');
  }
}
