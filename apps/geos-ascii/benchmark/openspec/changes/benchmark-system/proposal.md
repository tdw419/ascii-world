## Why

The "pixels move pixels" execution pipeline needs performance benchmarking to identify the optimal implementation approach. Currently we have a working browser-based viewer, but we don't know if it's the best approach compared to WebGPU or native GPU execution. We need data-driven decisions on latency, throughput, memory, and portability.

## What Changes

- **New**: Single-file benchmark harness (`geos-benchmark.html`)
- **New**: Test suite for measuring click → execute → render pipeline
- **New**: JSON export for results tracking
- **New**: Visual report for immediate feedback
- **No breaking changes** - this is a new standalone tool

## Capabilities

### New Capabilities

- `benchmark-harness`: Test harness for measuring execution pipeline performance with p50/p95/p99 latency, throughput (ops/sec), and memory tracking
- `benchmark-reporting`: JSON export and visual HTML report generation for benchmark results
- `benchmark-test-cases`: Standardized test cases (single opcode, rapid clicks, state buffer saturation)

### Modified Capabilities

None - this is a new standalone system.

## Impact

- **New files**: `benchmark/geos-benchmark.html`, `benchmark/results/*.json`
- **Uses existing**: `examples/toggle_demo.rts.png` as test cartridge
- **No changes to**: viewer, compiler, or existing examples
- **Dependencies**: None (vanilla JS, no build step)
