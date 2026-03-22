## 1. Project Setup

- [ ] 1.1 Create benchmark directory structure (`benchmark/`, `benchmark/results/`)
- [ ] 1.2 Create `geos-benchmark.html` with basic HTML5 structure
- [ ] 1.3 Add CSS styles for UI layout (test selector, results panel)

## 2. Core Infrastructure

- [ ] 2.1 Implement `BenchmarkHarness` class with constructor and state
- [ ] 2.2 Implement `measureLatency(fn, iterations)` method
- [ ] 2.3 Implement `measureThroughput(fn, duration)` method
- [ ] 2.4 Implement `measureMemory()` method
- [ ] 2.5 Implement `calculatePercentile(arr, p)` utility function
- [ ] 2.6 Implement `formatDuration(ms)` and `formatBytes(bytes)` utilities
- [ ] 2.7 Implement warmup iteration support (10 iterations before measurement)

## 3. GeosViewer Integration

- [ ] 3.1 Copy minimal `GeosViewer` class from geos-viewer.html
- [ ] 3.2 Implement cartridge loading from ArrayBuffer
- [ ] 3.3 Implement `executeOpcode(x, y)` method
- [ ] 3.4 Implement `render()` canvas update
- [ ] 3.5 Add state buffer access methods (`getState`, `setState`)

## 4. Test Cases

- [ ] 4.1 Implement single opcode test (100 iterations, TOGGLE)
- [ ] 4.2 Implement 10 rapid clicks test
- [ ] 4.3 Implement 100 rapid clicks test
- [ ] 4.4 Implement full state buffer update test (320 slots)
- [ ] 4.5 Add state reset between tests

## 5. Reporting

- [ ] 5.1 Implement JSON export with timestamp, browser info, results
- [ ] 5.2 Implement visual results table
- [ ] 5.3 Implement portability score calculation
- [ ] 5.4 Add "Export JSON" button functionality

## 6. UI

- [ ] 6.1 Create test selector (dropdown or buttons)
- [ ] 6.2 Create "Run All Tests" button
- [ ] 6.3 Create results display panel
- [ ] 6.4 Add log/output panel for real-time feedback

## 7. Verification

- [ ] 7.1 Test with toggle_demo.rts.png cartridge
- [ ] 7.2 Verify latency measurements are reasonable (<10ms p99)
- [ ] 7.3 Verify throughput measurements are accurate
- [ ] 7.4 Verify JSON export contains all required fields
- [ ] 7.5 Test in Chrome for memory API availability
- [ ] 7.6 Test in Firefox for fallback behavior
