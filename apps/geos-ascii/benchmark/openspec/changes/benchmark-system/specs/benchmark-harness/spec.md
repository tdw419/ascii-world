## ADDED Requirements

### Requirement: Benchmark harness measures latency
The system SHALL measure execution latency with statistical distribution (p50, p95, p99) in milliseconds.

#### Scenario: Single operation latency measurement
- **WHEN** user runs single opcode benchmark with 100 iterations
- **THEN** system reports p50, p95, and p99 latency values in milliseconds

#### Scenario: Latency precision
- **WHEN** measuring operation timing
- **THEN** system uses sub-millisecond precision (performance.now())

### Requirement: Benchmark harness measures throughput
The system SHALL measure operations per second for sustained execution.

#### Scenario: Rapid click throughput
- **WHEN** user runs 100-click benchmark
- **THEN** system reports total operations per second

### Requirement: Benchmark harness tracks memory
The system SHALL track memory usage before and after test execution.

#### Scenario: Chrome memory measurement
- **WHEN** running in Chrome browser
- **THEN** system reports usedJSHeapSize before and after tests

#### Scenario: Non-Chrome fallback
- **WHEN** running in non-Chrome browser
- **THEN** system estimates memory based on allocation tracking

### Requirement: Benchmark harness supports warmup
The system SHALL support warmup iterations to stabilize JIT compilation.

#### Scenario: Warmup before measurement
- **WHEN** running benchmark
- **THEN** system executes 10 warmup iterations before recording results

### Requirement: Benchmark harness calculates percentiles
The system SHALL calculate p50, p95, p99 from sorted timing data.

#### Scenario: Percentile calculation
- **WHEN** timing data is collected
- **THEN** p50 is median, p95 is 95th percentile, p99 is 99th percentile
