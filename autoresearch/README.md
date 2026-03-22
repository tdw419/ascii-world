# AutoResearch → pxOS Integration

Wire the AutoResearch experiment loop to pxOS development.

## What This Does

```
AI outputs ASCII spec → AutoResearch runs experiment → Keeps or reverts → Logs result
```

## Quick Start

```bash
# Run benchmark
python3 autoresearch/wire_autoresearch.py bench
# ops/sec=3909283

# Check status
python3 autoresearch/wire_autoresearch.py status

# Run an experiment
python3 autoresearch/wire_autoresearch.py run autoresearch/experiments/optimize-vm.ascii
```

## ASCII Spec Format

```
H: Cache OP_NAMES lookup for faster dispatch
T: sync/synthetic-glyph-vm.js
M: ops/sec > baseline
B: 2m
```

| Field | Meaning | Example |
|-------|---------|---------|
| H | Hypothesis | "Cache OP_NAMES lookup" |
| T | Target file | sync/synthetic-glyph-vm.js |
| M | Metric condition | ops/sec > baseline |
| B | Time budget | 2m |

## Files

```
autoresearch/
├── wire_autoresearch.py      # Main script
├── experiments/              # ASCII spec files
│   ├── optimize-vm.ascii     # Layer 2 (full box)
│   └── optimize-lookup.ascii # Layer 0 (minimal)
└── README.md

sync/
└── benchmark-vm.js           # Benchmark script

.autoresearch/
└── results.tsv               # Experiment log
```

## The Loop

1. **Baseline**: Run benchmark, record ops/sec
2. **Apply**: Apply code changes (if any)
3. **Test**: Run `npm test` - must pass
4. **Experiment**: Run benchmark again
5. **Decide**:
   - Improvement > 0% → KEEP + commit
   - No improvement → REVERT
6. **Log**: Append to `.autoresearch/results.tsv`

## Integration with OpenSpec+AutoResearch

This uses the ASCII spec format from:
```
~/zion/projects/openspec+autoresearch/openspec+autoresearch/src/openspec_autoresearch/ascii_spec.py
```

The same format works for:
- pxOS (JavaScript/Node)
- Python projects
- Any codebase with a benchmark

## Example Session

```
$ python3 autoresearch/wire_autoresearch.py run experiments/optimize.ascii

┌──────────────────────────────────────────────────┐
│ EXPERIMENT                                       │
├──────────────────────────────────────────────────┤
│ H: Inline float conversion                      │
│ T: sync/synthetic-glyph-vm.js                   │
│ M: ops/sec > baseline                           │
│ B: 2m                                           │
└──────────────────────────────────────────────────┘

▶ Running baseline benchmark...
  Baseline: 4041170 ops/sec

▶ Running test suite...
  Tests passed ✓

▶ Running experiment benchmark...
  Result: 4200000 ops/sec

▶ Improvement: +3.9%
  Decision: KEEP ✓

Result: {'status': 'KEEP', 'baseline': 4041170.0, 'metric': 4200000.0, 'improvement_pct': 3.9}
```

## Next Steps

1. **Real experiments**: AI modifies code, not just runs benchmark
2. **pxOS visualization**: Dashboard shows experiment results in real-time
3. **Multi-hypothesis**: Run multiple experiments in parallel
