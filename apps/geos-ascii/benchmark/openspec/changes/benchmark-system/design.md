## Context

The GeosASCII viewer currently executes opcodes in a browser JavaScript environment. We need to measure the full pipeline performance (click → execute → render) to make informed decisions about optimization and potential migration to WebGPU or native GPU execution.

**Current state:**
- Single HTML viewer with embedded JS
- Canvas rendering at 80×24 character grid
- State buffer of 320 slots
- Opcodes execute synchronously on click

## Goals / Non-Goals

**Goals:**
- Measure latency distribution (p50/p95/p99) for single operations
- Measure throughput for rapid consecutive operations
- Track memory usage before/after test suites
- Generate portable JSON reports
- Provide immediate visual feedback

**Non-Goals:**
- WebGPU implementation (benchmark JS first, then compare)
- Cross-browser testing automation
- CI/CD integration
- Performance optimization (only measurement)

## Decisions

### 1. Single-File Architecture
**Decision:** All benchmark code in one HTML file with embedded JS/CSS.

**Rationale:**
- Zero build step for maximum portability
- Easy to share/run anywhere
- No dependency management
- Can be opened directly in browser

**Alternatives considered:**
- Separate JS files → rejected for portability
- Build toolchain → rejected for complexity

### 2. performance.now() for Timing
**Decision:** Use `performance.now()` for microsecond-precision timing.

**Rationale:**
- Native browser API, no dependencies
- Sub-millisecond precision
- Monotonic clock (not affected by system time changes)

**Alternatives considered:**
- `Date.now()` → rejected for low precision (~15ms)
- `console.time()` → rejected for no programmatic access

### 3. Statistical Percentile Calculation
**Decision:** Sort results array and index at percentile position.

**Rationale:**
- Simple, deterministic algorithm
- O(n log n) for sorting, acceptable for n ≤ 10,000 samples
- No external libraries needed

### 4. Memory Measurement
**Decision:** Use `performance.memory.usedJSHeapSize` in Chrome, estimate elsewhere.

**Rationale:**
- Only reliable API available
- Chrome has ~70% browser market share
- Fallback to allocation tracking for other browsers

**Alternatives considered:**
- `process.memoryUsage()` → Node.js only
- Third-party libraries → rejected for dependency-free goal

### 5. Test Case Selection
**Decision:** Four test cases covering different load scenarios.

| Test | Iterations | Purpose |
|------|------------|---------|
| Single opcode | 100 | Baseline latency |
| 10 rapid clicks | 10 | Burst performance |
| 100 rapid clicks | 100 | Sustained throughput |
| Full state buffer | 1 | Maximum mutation |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| JIT compilation affects first runs | 10-iteration warmup before measurement |
| Browser throttling affects rapid tests | Use requestAnimationFrame pacing |
| Memory API not universal | Document browser support, estimate fallback |
| Garbage collection during measurement | Force GC before critical tests (if available) |
| Results vary between runs | Run multiple iterations, report percentiles |

## Architecture

```
┌─────────────────────────────────────────┐
│          geos-benchmark.html            │
├─────────────────────────────────────────┤
│  UI Layer                               │
│  ├── Test selector (dropdown/buttons)   │
│  ├── Run button                         │
│  └── Results panel (table + chart)      │
├─────────────────────────────────────────┤
│  BenchmarkHarness                       │
│  ├── measureLatency(fn, n)              │
│  ├── measureThroughput(fn, duration)    │
│  ├── measureMemory()                    │
│  └── calculatePercentile(arr, p)        │
├─────────────────────────────────────────┤
│  GeosViewer (minimal copy)              │
│  ├── loadCartridge(arrayBuffer)         │
│  ├── executeOpcode(x, y)                │
│  └── render()                           │
├─────────────────────────────────────────┤
│  Output                                 │
│  ├── JSON export                        │
│  └── Visual report                      │
└─────────────────────────────────────────┘
```

## Open Questions

None - design is straightforward for a single-file benchmark tool.
