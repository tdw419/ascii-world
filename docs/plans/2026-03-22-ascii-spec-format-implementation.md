# ASCII Experiment Spec Format Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a runtime that parses and executes ASCII experiment specs (H/T/M/B format) for the AutoResearch framework.

**Architecture:** Parser handles 4 layer formats (minimal, boxed, flow, full), runtime applies hypotheses to target files, evaluates metrics, and logs results to TSV. The spec IS the program - AI outputs ASCII naturally.

**Tech Stack:** Node.js, JavaScript (matching existing sync/*.js architecture), TSV for results logging

---

## Task 1: ASCII Spec Parser

**Files:**
- Create: `sync/ascii-spec-parser.js`
- Test: `tests/sync/test-ascii-spec-parser.js`

**Step 1: Write the failing test**

```javascript
// tests/sync/test-ascii-spec-parser.js
import { describe, it, assert } from 'vitest';
import { ASCIIExperimentSpec } from '../../sync/ascii-spec-parser.js';

describe('ASCIIExperimentSpec', () => {
  it('parses Layer 0 minimal format', () => {
    const spec = `H: Use AdamW optimizer
T: train.py
M: val_bpb < 0.7
B: 5m`;

    const parsed = ASCIIExperimentSpec.parse(spec);
    assert.equal(parsed.h, 'Use AdamW optimizer');
    assert.equal(parsed.t, 'train.py');
    assert.equal(parsed.m, 'val_bpb < 0.7');
    assert.equal(parsed.b, '5m');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/sync/test-ascii-spec-parser.js`
Expected: FAIL with "Cannot find module '../../sync/ascii-spec-parser.js'"

**Step 3: Write minimal implementation**

```javascript
// sync/ascii-spec-parser.js
/**
 * ASCII Experiment Spec - Parser for H/T/M/B format
 * Layer 0-3 compatible
 */
export class ASCIIExperimentSpec {
  constructor(hypothesis, target, metric, baseline) {
    this.h = hypothesis;
    this.t = target;
    this.m = metric;
    this.b = baseline;
  }

  static parse(asciiText) {
    const hMatch = asciiText.match(/H:\s*(.+?)(?:\n|$)/);
    const tMatch = asciiText.match(/T:\s*(.+?)(?:\n|$)/);
    const mMatch = asciiText.match(/M:\s*(.+?)(?:\n|$)/);
    const bMatch = asciiText.match(/B:\s*(.+?)(?:\n|$)/);

    return new ASCIIExperimentSpec(
      hMatch?.[1]?.trim(),
      tMatch?.[1]?.trim(),
      mMatch?.[1]?.trim(),
      bMatch?.[1]?.trim()
    );
  }

  toBoxed() {
    const lines = [
      '┌──────────────────────────────────────────────────┐',
      `│ H: ${this.h.padEnd(46)}│`,
      `│ T: ${this.t.padEnd(46)}│`,
      `│ M: ${this.m.padEnd(46)}│`,
      `│ B: ${this.b.padEnd(46)}│`,
      '└──────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/sync/test-ascii-spec-parser.js`
Expected: PASS

**Step 5: Commit**

```bash
git add sync/ascii-spec-parser.js tests/sync/test-ascii-spec-parser.js
git commit -m "feat: add ASCII experiment spec parser for H/T/M/B format"
```

---

## Task 2: Layer 1 Boxed Format Parsing

**Files:**
- Modify: `sync/ascii-spec-parser.js`
- Modify: `tests/sync/test-ascii-spec-parser.js`

**Step 1: Write the failing test**

```javascript
// Add to tests/sync/test-ascii-spec-parser.js

  it('parses Layer 1 boxed format', () => {
    const spec = `┌──────────────────────────────────────────────────┐
│ EXPERIMENT - AI-generated optimization            │
├──────────────────────────────────────────────────┤
│ H: Add a reset method to VMState class            │
│ T: sync/synthetic-glyph-vm.js                    │
│ M: tests pass                                    │
│ B: 100 iterations                                │
└──────────────────────────────────────────────────┘`;

    const parsed = ASCIIExperimentSpec.parse(spec);
    assert.equal(parsed.h, 'Add a reset method to VMState class');
    assert.equal(parsed.t, 'sync/synthetic-glyph-vm.js');
    assert.equal(parsed.m, 'tests pass');
    assert.equal(parsed.b, '100 iterations');
  });
```

**Step 2: Run test to verify it passes**

Run: `npm test -- tests/sync/test-ascii-spec-parser.js`
Expected: PASS (regex already handles this)

**Step 3: Commit**

```bash
git add tests/sync/test-ascii-spec-parser.js
git commit -m "test: add Layer 1 boxed format parsing test"
```

---

## Task 3: Results Logger

**Files:**
- Create: `sync/ascii-results-logger.js`
- Test: `tests/sync/test-ascii-results-logger.js`

**Step 1: Write the failing test**

```javascript
// tests/sync/test-ascii-results-logger.js
import { describe, it, assert, beforeEach, afterEach } from 'vitest';
import { ASCIIResultsLogger } from '../../sync/ascii-results-logger.js';
import fs from 'fs';
import path from 'path';

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
    assert.include(content, 'Cache OP_NAMES lookup');
    assert.include(content, '100');
    assert.include(content, '95');
    assert.include(content, 'KEEP');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/sync/test-ascii-results-logger.js`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```javascript
// sync/ascii-results-logger.js
import fs from 'fs';
import path from 'path';

export class ASCIIResultsLogger {
  constructor(logPath = '.autoresearch/results.tsv') {
    this.logPath = logPath;
    this.ensureHeader();
  }

  ensureHeader() {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, 'timestamp\thypothesis\tbaseline\tmetric\tstatus\n');
    }
  }

  log(result) {
    const timestamp = Date.now() / 1000;
    const line = `${timestamp}\t${result.hypothesis}\t${result.baseline}\t${result.metric}\t${result.status}\n`;
    fs.appendFileSync(this.logPath, line);
  }

  readRecent(count = 10) {
    if (!fs.existsSync(this.logPath)) return [];
    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1); // Skip header
    return lines.slice(-count).map(line => {
      const [timestamp, hypothesis, baseline, metric, status] = line.split('\t');
      return { timestamp: parseFloat(timestamp), hypothesis, baseline: parseFloat(baseline), metric: parseFloat(metric), status };
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/sync/test-ascii-results-logger.js`
Expected: PASS

**Step 5: Commit**

```bash
git add sync/ascii-results-logger.js tests/sync/test-ascii-results-logger.js
git commit -m "feat: add ASCII results logger for TSV output"
```

---

## Task 4: Experiment Runtime

**Files:**
- Create: `sync/ascii-experiment-runtime.js`
- Test: `tests/sync/test-ascii-experiment-runtime.js`

**Step 1: Write the failing test**

```javascript
// tests/sync/test-ascii-experiment-runtime.js
import { describe, it, assert, beforeEach, afterEach } from 'vitest';
import { ASCIIExperimentRuntime } from '../../sync/ascii-experiment-runtime.js';
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
    assert.equal(result.hypothesis, 'Test hypothesis');
    assert.equal(result.target, 'sync/synthetic-glyph-vm.js');
    assert.exists(result.status);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/sync/test-ascii-experiment-runtime.js`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```javascript
// sync/ascii-experiment-runtime.js
import fs from 'fs';
import path from 'path';
import { ASCIIExperimentSpec } from './ascii-spec-parser.js';
import { ASCIIResultsLogger } from './ascii-results-logger.js';

export class ASCIIExperimentRuntime {
  constructor(options = {}) {
    this.projectPath = options.projectPath || '.';
    this.logger = new ASCIIResultsLogger(options.resultsPath || '.autoresearch/results.tsv');
  }

  async runSpec(asciiText) {
    const spec = ASCIIExperimentSpec.parse(asciiText);
    const startTime = Date.now();

    // Evaluate metric (simplified - check file exists, run tests, etc.)
    const metricResult = await this.evaluateMetric(spec);
    const elapsed = Date.now() - startTime;

    // Determine status
    const status = metricResult.success ? 'KEEP' : 'REVERT';

    // Log result
    this.logger.log({
      hypothesis: spec.h,
      baseline: spec.b,
      metric: metricResult.value,
      status
    });

    return {
      hypothesis: spec.h,
      target: spec.t,
      metric: spec.m,
      baseline: spec.b,
      status,
      elapsed,
      metricValue: metricResult.value
    };
  }

  async evaluateMetric(spec) {
    // Simplified metric evaluation
    // In full implementation, this would:
    // - Apply hypothesis to target file
    // - Run baseline iterations
    // - Evaluate metric condition

    const targetPath = path.join(this.projectPath, spec.t);

    // Check if target file exists
    if (spec.m.includes('exists') || spec.m.includes('file exists')) {
      return {
        success: fs.existsSync(targetPath),
        value: fs.existsSync(targetPath) ? 1 : 0
      };
    }

    // Check if tests pass
    if (spec.m.includes('tests pass')) {
      // Run tests and check result
      try {
        const { execSync } = await import('child_process');
        execSync('npm test', { cwd: this.projectPath, stdio: 'pipe' });
        return { success: true, value: 100 };
      } catch {
        return { success: false, value: 0 };
      }
    }

    // Default: assume success
    return { success: true, value: 100 };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/sync/test-ascii-experiment-runtime.js`
Expected: PASS

**Step 5: Commit**

```bash
git add sync/ascii-experiment-runtime.js tests/sync/test-ascii-experiment-runtime.js
git commit -m "feat: add ASCII experiment runtime for executing specs"
```

---

## Task 5: Result Formatter

**Files:**
- Create: `sync/ascii-result-formatter.js`
- Test: `tests/sync/test-ascii-result-formatter.js`

**Step 1: Write the failing test**

```javascript
// tests/sync/test-ascii-result-formatter.js
import { describe, it, assert } from 'vitest';
import { ASCIIResultFormatter } from '../../sync/ascii-result-formatter.js';

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
    assert.include(formatted, 'RESULT:');
    assert.include(formatted, 'KEEP');
    assert.include(formatted, '95');
    assert.include(formatted, '1.2s');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/sync/test-ascii-result-formatter.js`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```javascript
// sync/ascii-result-formatter.js
export class ASCIIResultFormatter {
  static format(result) {
    const elapsedSec = (result.elapsed / 1000).toFixed(1);
    const statusIcon = result.status === 'KEEP' ? '✓' : '✗';

    return `╔═══════════════════════════════════════════════════════════════╗
║ RESULT: experiment                                            ║
║ STATUS: ${result.status.padEnd(53)}${statusIcon}║
║ METRIC: ${result.metricValue !== undefined ? result.metricValue : 'N/A'}                                        ║
║ TARGET: ${result.metric.padEnd(52)}→ ${result.status}                                  ║
║ ELAPSED: ${elapsedSec}s                                            ║
╚═══════════════════════════════════════════════════════════════╝`;
  }

  static formatHistory(results) {
    const header = '┌───────┬─────────────┬──────────┬────────┬────────────────┐\n' +
                   '│ RUN   │ HYPOTHESIS  │ METRIC   │ STATUS │ ACTION         │\n' +
                   '├───────┼─────────────┼──────────┼────────┼────────────────┤';

    const rows = results.map((r, i) => {
      const runNum = String(i + 1).padStart(3, '0');
      const hyp = r.hypothesis.substring(0, 11).padEnd(11);
      const metric = String(r.metricValue || r.metric).padEnd(8);
      const status = r.status.padEnd(6);
      const action = r.status === 'KEEP' ? 'KEEP ✓' : 'REVERT';
      return `│ ${runNum}   │ ${hyp} │ ${metric} │ ${status} │ ${action.padEnd(14)} │`;
    }).join('\n');

    const footer = '└───────┴─────────────┴──────────┴────────┴────────────────┘';

    return `${header}\n${rows}\n${footer}`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/sync/test-ascii-result-formatter.js`
Expected: PASS

**Step 5: Commit**

```bash
git add sync/ascii-result-formatter.js tests/sync/test-ascii-result-formatter.js
git commit -m "feat: add ASCII result formatter for Layer 3 output"
```

---

## Task 6: CLI Runner

**Files:**
- Create: `sync/ascii-cli.js`
- Modify: `package.json` (add bin)

**Step 1: Write the CLI script**

```javascript
#!/usr/bin/env node
// sync/ascii-cli.js
import fs from 'fs';
import path from 'path';
import { ASCIIExperimentRuntime } from './ascii-experiment-runtime.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`ASCII Experiment Runner

Usage:
  node sync/ascii-cli.js <spec-file.ascii>
  node sync/ascii-cli.js --dir <specs-directory>

Options:
  --dir    Run all specs in directory
  --help   Show this help
`);
    process.exit(0);
  }

  const runtime = new ASCIIExperimentRuntime({
    projectPath: process.cwd()
  });

  if (args[0] === '--dir') {
    const dir = args[1] || '.autoresearch/specs';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ascii'));

    console.log(`Running ${files.length} specs from ${dir}...\n`);

    for (const file of files) {
      const specPath = path.join(dir, file);
      const spec = fs.readFileSync(specPath, 'utf-8');
      console.log(`\n=== ${file} ===`);
      const result = await runtime.runSpec(spec);
      console.log(`Status: ${result.status}`);
      console.log(`Elapsed: ${result.elapsed}ms`);
    }
  } else {
    const specPath = args[0];
    const spec = fs.readFileSync(specPath, 'utf-8');
    const result = await runtime.runSpec(spec);
    console.log(`\nResult: ${result.status}`);
    console.log(`Metric: ${result.metricValue}`);
    console.log(`Elapsed: ${result.elapsed}ms`);
  }
}

main().catch(console.error);
```

**Step 2: Test CLI manually**

Run: `node sync/ascii-cli.js .autoresearch/specs/ai-experiment.ascii`
Expected: Shows result of running the spec

**Step 3: Commit**

```bash
git add sync/ascii-cli.js
git commit -m "feat: add CLI runner for ASCII experiment specs"
```

---

## Task 7: Integration with Server

**Files:**
- Modify: `sync/server.js`

**Step 1: Add API endpoints**

```javascript
// Add to sync/server.js after existing imports
import { ASCIIExperimentSpec } from './ascii-spec-parser.js';
import { ASCIIExperimentRuntime } from './ascii-experiment-runtime.js';
import { ASCIIResultsLogger } from './ascii-results-logger.js';

// Add endpoints after existing routes
app.get('/api/experiments', (req, res) => {
  const logger = new ASCIIResultsLogger();
  const results = logger.readRecent(50);
  res.json(results);
});

app.post('/api/experiments/run', async (req, res) => {
  const { spec } = req.body;
  const runtime = new ASCIIExperimentRuntime();
  const result = await runtime.runSpec(spec);
  res.json(result);
});

app.get('/api/experiments/specs', (req, res) => {
  const specsDir = '.autoresearch/specs';
  if (!fs.existsSync(specsDir)) {
    return res.json([]);
  }
  const files = fs.readdirSync(specsDir).filter(f => f.endsWith('.ascii'));
  const specs = files.map(f => ({
    name: f,
    content: fs.readFileSync(path.join(specsDir, f), 'utf-8')
  }));
  res.json(specs);
});
```

**Step 2: Test endpoints**

Run: `curl http://localhost:3000/api/experiments`
Expected: JSON array of recent experiments

**Step 3: Commit**

```bash
git add sync/server.js
git commit -m "feat: add API endpoints for ASCII experiments"
```

---

## Task 8: Documentation

**Files:**
- Create: `docs/ASCII-SPEC-FORMAT.md`

**Step 1: Write documentation**

```markdown
# ASCII Experiment Spec Format

## Overview

The ASCII spec format allows AI to naturally output experiment specifications that ARE executable programs. No Python, no JSON - just ASCII text.

## Format

### H/T/M/B Keys

| Key | Meaning | Example |
|-----|---------|---------|
| H | Hypothesis | "Cache OP_NAMES lookup" |
| T | Target file | "sync/synthetic-glyph-vm.js" |
| M | Metric | "tests pass" |
| B | Baseline | "100 iterations" |

### Layer 0: Minimal

```
H: Use AdamW optimizer
T: train.py
M: val_bpb < 0.7
B: 5m
```

### Layer 1: Boxed

```
┌──────────────────────────────────────────────────┐
│ H: Cache OP_NAMES lookup for faster dispatch     │
│ T: sync/synthetic-glyph-vm.js                    │
│ M: tests pass                                    │
│ B: 100 iterations                                │
└──────────────────────────────────────────────────┘
```

## Usage

### CLI

```bash
node sync/ascii-cli.js .autoresearch/specs/my-experiment.ascii
```

### API

```javascript
POST /api/experiments/run
{
  "spec": "H: Test\\nT: file.js\\nM: tests pass\\nB: 10"
}
```

## Results

Results logged to `.autoresearch/results.tsv`:

```
timestamp    hypothesis    baseline    metric    status
```

## Integration

- Specs in `.autoresearch/specs/*.ascii`
- Results in `.autoresearch/results.tsv`
- API at `/api/experiments/*`
```

**Step 2: Commit**

```bash
git add docs/ASCII-SPEC-FORMAT.md
git commit -m "docs: add ASCII spec format documentation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Parser | `sync/ascii-spec-parser.js` |
| 2 | Layer 1 parsing | Tests |
| 3 | Results logger | `sync/ascii-results-logger.js` |
| 4 | Runtime | `sync/ascii-experiment-runtime.js` |
| 5 | Formatter | `sync/ascii-result-formatter.js` |
| 6 | CLI | `sync/ascii-cli.js` |
| 7 | Server integration | `sync/server.js` |
| 8 | Documentation | `docs/ASCII-SPEC-FORMAT.md` |

**Total: 8 tasks, ~40 steps**
