# GPU-Native Cartridge Execution

## Why

The current "pixels move pixels" system executes opcodes in JavaScript, which contradicts the core philosophy: **the pixel color IS the logic**. We need the GPU itself to read opcodes from cartridge pixels, execute them, and write results back to state pixels—without CPU intermediaries.

This change implements true spatial computing where:
- Cartridges load directly into GPU memory
- WGSL shaders execute opcodes on every frame
- State changes propagate through the Hilbert manifold
- The screen IS the running program

## What Changes

- **SyntheticGlyphVM → WGSL shader**: Port the JS/Node.js emulator to a compute shader
- **CartridgeBridge**: Load .rts.png cartridges into GPU textures
- **StateTexture**: 320-slot state buffer as a GPU texture
- **ExecutionPipeline**: Frame-by-frame GPU dispatch
- **BenchmarkHarness**: AutoResearch loop for optimization

## Capabilities

### New Capabilities

- `gpu-cartridge-loader`: Load .rts.png into GPU textures (glyph grid, SIT, state buffer)
- `wgsl-glyph-vm`: Compute shader matching glyph_microcode.wgsl semantics
- `state-texture-sync`: Bidirectional sync between GPU state and JS viewer
- `benchmark-integration`: AutoResearch loop with keep-or-revert for shader optimization

### Modified Capabilities

- `geos-viewer`: Add GPU mode toggle that connects to WGSL execution
- `cartridge-store`: Support GPU upload via texture manager
- `server.js`: Expose GPU execution API endpoints

## Impact

- **New files**:
  - `sync/wgsl/cartridge_executor.wgsl` - Compute shader
  - `sync/gpu-texture-manager.js` - GPU texture management
  - `sync/autoresearch-loop.js` - Experiment loop
  - `openspec/changes/gpu-native-execution/` - This spec

- **Modified files**:
  - `apps/geos-ascii/viewer/geos-viewer.html` - GPU mode
  - `sync/server.js` - GPU endpoints
  - `sync/synthetic-glyph-vm.js` - Reference implementation

- **Dependencies**:
  - WebGPU API (browser)
  - wgpu (Node.js via optional native addon)

- **Testing**:
  - Unit tests for WGSL shader semantics (via SyntheticGlyphVM comparison)
  - Integration tests for cartridge→GPU→render pipeline
  - Benchmark suite with AutoResearch tracking

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Ops/sec (JS) | 2.7M | - |
| Ops/sec (GPU) | 0 | >10M |
| Latency p99 | 0.4μs | <0.1μs |
| State sync time | - | <1ms |

## Dependencies

- Geometry OS glyph_microcode.wgsl (reference implementation)
- OpenSpec+AutoResearch framework (experiment tracking)
- WebGPU support in target browsers

## Timeline

- **Phase 1**: WGSL shader port (matching SyntheticGlyphVM semantics)
- **Phase 2**: Cartridge→GPU texture bridge
- **Phase 3**: Browser WebGPU integration
- **Phase 4**: AutoResearch optimization loop
- **Phase 5**: Geometry OS native integration
