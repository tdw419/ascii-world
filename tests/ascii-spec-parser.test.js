// tests/ascii-spec-parser.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ASCIIExperimentSpec } from '../sync/ascii-spec-parser.js';

describe('ASCIIExperimentSpec', () => {
  it('parses Layer 0 minimal format', () => {
    const spec = `H: Use AdamW optimizer
T: train.py
M: val_bpb < 0.7
B: 5m`;

    const parsed = ASCIIExperimentSpec.parse(spec);
    assert.strictEqual(parsed.h, 'Use AdamW optimizer');
    assert.strictEqual(parsed.t, 'train.py');
    assert.strictEqual(parsed.m, 'val_bpb < 0.7');
    assert.strictEqual(parsed.b, '5m');
  });

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
    assert.strictEqual(parsed.h, 'Add a reset method to VMState class');
    assert.strictEqual(parsed.t, 'sync/synthetic-glyph-vm.js');
    assert.strictEqual(parsed.m, 'tests pass');
    assert.strictEqual(parsed.b, '100 iterations');
  });

  it('generates boxed output', () => {
    const spec = new ASCIIExperimentSpec(
      'Test hypothesis',
      'file.js',
      'tests pass',
      '10'
    );
    const boxed = spec.toBoxed();
    assert.ok(boxed.includes('H: Test hypothesis'));
    assert.ok(boxed.includes('T: file.js'));
  });
});
