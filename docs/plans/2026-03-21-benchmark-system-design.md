# Benchmark System Design

**Date:** 2026-03-21
**Goal:** Benchmark full pipeline (click → execute → render) to find optimal implementation approach

## Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Latency | p50/p95/p99 in ms | <5ms p99 |
| Throughput | Operations/sec | >1000 ops/sec |
| Memory | Heap usage | <50MB |
| Portability | Browser compatibility score | 0-100 |

## Architecture

```
apps/geos-ascii/benchmark/
├── geos-benchmark.html    # Single-file harness
└── results/               # JSON output
```

## Test Cases

1. **Single opcode** - Baseline latency
2. **10 rapid clicks** - Stress test
3. **100 rapid clicks** - Throughput test
4. **Full state buffer** - 320 slot update

## Implementation Phases

### Phase 1: Core Infrastructure
- BenchmarkHarness class
- Percentile calculations
- Memory tracking

### Phase 2: Test Cases
- Single opcode test
- Rapid click tests (10/100)
- State buffer saturation

### Phase 3: Reporting
- JSON export
- Visual report
- Portability scoring

### Phase 4: Validation
- Load real cartridge
- Verify accuracy
- Document results

## Success Criteria

- [ ] Single opcode latency measured with p50/p95/p99
- [ ] Throughput reported in ops/sec
- [ ] Memory tracked before/after
- [ ] JSON export works
- [ ] Visual report displays results
- [ ] All tests run in <5 seconds

## Estimated Effort

8-12 hours total
