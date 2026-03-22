## ADDED Requirements

### Requirement: Single opcode test case
The system SHALL provide a single opcode execution benchmark.

#### Scenario: Single opcode execution
- **WHEN** user runs single opcode test
- **THEN** system executes TOGGLE opcode 100 times and reports latency distribution

### Requirement: Rapid click test cases
The system SHALL provide 10-click and 100-click burst benchmarks.

#### Scenario: 10 rapid clicks
- **WHEN** user runs 10-click test
- **THEN** system executes 10 consecutive operations and reports throughput

#### Scenario: 100 rapid clicks
- **WHEN** user runs 100-click test
- **THEN** system executes 100 consecutive operations and reports throughput and p99 latency

### Requirement: State buffer saturation test
The system SHALL provide a full state buffer update benchmark.

#### Scenario: Full state update
- **WHEN** user runs state buffer test
- **THEN** system updates all 320 state slots and reports total time and per-slot average

#### Scenario: State buffer verification
- **WHEN** state buffer test completes
- **THEN** all 320 slots contain non-zero values

### Requirement: Test cartridge loading
The system SHALL load existing test cartridges for benchmarking.

#### Scenario: Load toggle_demo cartridge
- **WHEN** benchmark harness initializes
- **THEN** system can load toggle_demo.rts.png for testing

### Requirement: Test isolation
Each test SHALL run in isolation with fresh state.

#### Scenario: State reset between tests
- **WHEN** new test begins
- **THEN** state buffer is reset to initial values
