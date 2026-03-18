# ASCII Scene Graph Specification

## ADDED Requirements

### Requirement: Instrumentation Hook Trait

The system SHALL provide a trait-based instrumentation pattern for emitting ASCII representations of subsystem state.

#### Scenario: Define hook trait with callback methods

- **GIVEN** a subsystem that needs ASCII observability
- **WHEN** defining a hook trait
- **THEN** the trait SHALL specify callback methods for state changes
- **AND** each callback SHALL receive typed parameters for the event

#### Scenario: Hook broadcaster dispatches to multiple listeners

- **GIVEN** multiple hook implementations registered
- **WHEN** a subsystem event occurs
- **THEN** the broadcaster SHALL dispatch to all registered hooks
- **AND** dispatch SHALL be non-blocking

### Requirement: Neural City ASCII Renderer

The system SHALL provide an ASCII renderer for Neural City with camera-follow viewport.

#### Scenario: Render district layout to ASCII

- **GIVEN** Neural City district metadata
- **WHEN** the camera moves
- **THEN** render an 80x24 ASCII grid of visible districts
- **AND** include district names, load percentages, and agent counts

#### Scenario: Track active district focus

- **GIVEN** user interaction with a district
- **WHEN** a district is selected
- **THEN** render district_focus.ascii with detailed metrics
- **AND** include PAS score and entropy for the district

#### Scenario: Report city-wide health

- **GIVEN** global Neural City metrics
- **WHEN** metrics change
- **THEN** render city_health.ascii with PAS score and entropy
- **AND** include trend indicators

### Requirement: Visual Shell ASCII Renderer

The system SHALL provide an ASCII renderer for Visual Shell with tree-based topology.

#### Scenario: Render window tree to ASCII

- **GIVEN** active shell fragments and windows
- **WHEN** the fragment tree changes
- **THEN** render shell_fragments.ascii with YAML-like tree structure
- **AND** include positions, sizes, and z-indices

#### Scenario: Track input focus

- **GIVEN** keyboard and mouse input state
- **WHEN** focus changes
- **THEN** render shell_focus.ascii with active window and input state
- **AND** include keyboard modifiers and mouse position

#### Scenario: Support spatial queries

- **GIVEN** a coordinate query from AI
- **WHEN** parsing "What is at (x, y)?"
- **THEN** return the window or fragment at that location
- **AND** include clickable region metadata

### Requirement: Evolution Pipeline ASCII Renderer

The system SHALL provide an ASCII renderer for Evolution Pipeline with PAS monitoring.

#### Scenario: Render PAS meter

- **GIVEN** Phase Alignment Stability score
- **WHEN** PAS score changes
- **THEN** render evolution_pas.ascii with visual meter
- **AND** trigger alert when PAS drops below 0.80

#### Scenario: Track pipeline stages

- **GIVEN** evolution pipeline execution
- **WHEN** stages progress (Scan → Reason → Patch → Build)
- **THEN** render evolution_pipeline.ascii with stage status
- **AND** include timing information

#### Scenario: Log self-correction events

- **GIVEN** self-correction triggers
- **WHEN** a correction occurs
- **THEN** append to evolution_log.ascii with trigger, action, and result
- **AND** maintain last 100 entries

### Requirement: VASM Compiler

The system SHALL provide a Visual Assembly compiler for bidirectional actuation.

#### Scenario: Compile VASM to PixelRTS

- **GIVEN** a .vasm file with Visual Assembly code
- **WHEN** running `vasm.py build input.vasm output.rts.png`
- **THEN** assemble with riscv64-linux-gnu-as
- **AND** Hilbert-map to 2D grid and save as PNG

#### Scenario: Preprocess VASM directives

- **GIVEN** VASM with @ENTRY and macro directives
- **WHEN** preprocessing
- **THEN** expand macros and set entry point
- **AND** validate syntax before assembly

### Requirement: Software Morphology Scanner

The system SHALL provide a scanner for extracting ASCII morphology from ELF binaries.

#### Scenario: Extract code morphology from ELF

- **GIVEN** an ELF binary
- **WHEN** running `scanner.py scan program.elf morphology.ascii`
- **THEN** extract section layout and function boundaries
- **AND** include control flow and memory access patterns

### Requirement: Ouroboros Transmutation Loop

The system SHALL support closed-loop self-healing via ASCII perception and VASM actuation.

#### Scenario: PAS drop triggers self-healing

- **GIVEN** PAS score drops below 0.80
- **WHEN** evolution_pas.ascii is updated
- **THEN** AI agent reads the alert
- **AND** AI analyzes shell_fragments.ascii to find failing component

#### Scenario: AI generates fix via VASM

- **GIVEN** AI has identified the failing component
- **WHEN** AI writes fix.vasm
- **THEN** vasm.py compiles to fix.rts.png
- **AND** compositor hot-swaps the new pixels

#### Scenario: Recovery verification

- **GIVEN** fix has been applied
- **WHEN** hooks emit updated .ascii files
- **THEN** PAS score recovers above 0.80
- **AND** system logs successful self-healing

## Performance Requirements

| Metric | Target |
|--------|--------|
| ASCII file read latency | <1ms |
| Hook dispatch latency | <10ms |
| VASM compilation time | <5s for 1KB |
| Scanner extraction time | <10s for 1MB ELF |
