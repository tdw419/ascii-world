# GPU-Native Cartridge Execution — Requirements

## ADDED Requirements

### Requirement: WGSL Glyph VM Shader
The system SHALL provide a WGSL compute shader that executes Glyph VM opcodes.

#### Scenario: Execute TOGGLE opcode
- **WHEN** shader reads opcode=3 (TOGGLE) from SIT texture at coordinates (x, y)
- **THEN** the shader SHALL read state[target], negate it (0↔255), and write back

#### Scenario: Execute INC opcode
- **WHEN** shader reads opcode=8 (INC) from SIT texture
- **THEN** the shader SHALL increment state[target] by 1, clamping at 255

#### Scenario: Execute DEC opcode
- **WHEN** shader reads opcode=9 (DEC) from SIT texture
- **THEN** the shader SHALL decrement state[target] by 1, clamping at 0

#### Scenario: Execute LDI opcode
- **WHEN** shader reads opcode=204 (LDI) with flags byte
- **THEN** the shader SHALL write flags value directly to state[target]

### Requirement: Cartridge Texture Loading
The system SHALL load .rts.png cartridges into GPU textures.

#### Scenario: Load cartridge to GPU
- **WHEN** loadCartridgeToGPU(name) is called
- **THEN** the system SHALL:
  1. Read .rts.png file
  2. Decode PNG to RGBA pixels
  3. Create 3 GPU textures: glyphGrid (80x24), SIT (80x24), state (320x1)
  4. Upload pixel data to textures
  5. Return texture handles

#### Scenario: SIT texture format
- **WHEN** SIT texture is created
- **THEN** each pixel SHALL be: R=opcode, G=target_low, B=target_high, A=flags

#### Scenario: State texture format
- **WHEN** state texture is created
- **THEN** it SHALL be 320×1 RGBA where R channel = slot value, GBA = min/max/unused

### Requirement: GPU Execution Frame
The system SHALL execute one frame of GPU computation per request.

#### Scenario: Execute frame
- **WHEN** executeGPUFrame() is called
- **THEN** the system SHALL:
  1. Dispatch compute shader with (80, 24, 1) workgroups
  2. Each work item reads SIT at (x, y), executes opcode, writes state
  3. Return execution results (cycles, state changes)

#### Scenario: Click-triggered execution
- **WHEN** user clicks at (x, y) in viewer
- **THEN** the system SHALL execute only the opcode at that coordinate

### Requirement: State Synchronization
The system SHALL synchronize GPU state back to CPU for rendering.

#### Scenario: Read GPU state
- **WHEN** getGPUState() is called
- **THEN** the system SHALL copy state texture to CPU memory and return Uint8Array

#### Scenario: State sync latency
- **WHEN** state changes on GPU
- **THEN** the sync to CPU SHALL complete in <1ms for 320 slots

### Requirement: AutoResearch Experiment Loop
The system SHALL provide an experiment loop for autonomous optimization.

#### Scenario: Run optimization experiment
- **WHEN** runExperiment(hypothesis) is called
- **THEN** the system SHALL:
  1. Apply code change (shader modification)
  2. Run benchmark (ops/sec measurement)
  3. Compare to baseline
  4. Keep if improvement >5%, revert otherwise
  5. Log result to results.tsv

#### Scenario: Metric extraction
- **WHEN** benchmark completes
- **THEN** extract_metric() SHALL parse "ops/sec=1234567" from output

#### Scenario: Git integration
- **WHEN** change is kept
- **THEN** the system SHALL commit with message "perf(shader): +X% ops/sec"

### Requirement: Trust Boundary
The system SHALL verify integrity of evaluation code.

#### Scenario: Verify benchmark integrity
- **WHEN** experiment starts
- **THEN** the system SHALL compute SHA256 of benchmark files and compare to stored hash

#### Scenario: Tampering detection
- **WHEN** hash mismatch is detected
- **THEN** the system SHALL abort experiment and log error

## Interface Specifications

### JavaScript API

```javascript
class GPUCartridgeExecutor {
  constructor(device);
  async loadCartridge(name: string): Promise<CartridgeTextures>;
  async executeClick(x: number, y: number): Promise<ExecutionResult>;
  async executeFrame(): Promise<FrameResult>;
  async getState(): Promise<Uint8Array>;
  async setState(slot: number, value: number): Promise<void>;
}

class AutoResearchLoop {
  constructor(config: ExperimentConfig);
  async runHypothesis(change: CodeChange): Promise<ExperimentResult>;
  getResultsLog(): ResultsLog;
  isImprovement(newMetric: number, oldMetric: number): boolean;
}
```

### WGSL Shader Interface

```wgsl
@group(0) @binding(0) var sit_texture: texture_2d<u32>;
@group(0) @binding(1) var state_texture: texture_storage_2d<rgba8uint, read_write>;
@group(0) @binding(2) var<uniform> click_coord: vec2<u32>;
@group(0) @binding(3) var<uniform> exec_mode: u32; // 0=click, 1=frame

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // Read SIT at (x, y)
  // Execute opcode
  // Write state
}
```

## Quality Attributes

| Attribute | Requirement |
|-----------|-------------|
| Performance | >10M ops/sec on GPU |
| Latency | <0.1μs per opcode |
| Correctness | Bit-identical output to SyntheticGlyphVM |
| Reliability | Auto-revert on regression |
| Maintainability | WGSL code <500 lines |
