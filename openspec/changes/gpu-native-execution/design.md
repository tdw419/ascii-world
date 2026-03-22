# GPU-Native Cartridge Execution — Design

## Context

We are implementing true "pixels move pixels" execution where the GPU reads opcode pixels and executes them directly. The reference implementation is `glyph_microcode.wgsl` from Geometry OS, and our JS implementation is `SyntheticGlyphVM`.

## Goals / Non-Goals

**Goals:**
- Port SyntheticGlyphVM semantics to WGSL compute shader
- Load .rts.png cartridges into GPU textures
- Execute opcodes on GPU, sync state back for rendering
- AutoResearch loop for autonomous optimization

**Non-Goals:**
- Full Geometry OS integration (Phase 5)
- WebGPU fallback for older browsers
- Multi-cartridge parallel execution

## Decisions

### 1. Execution Model: Click-Triggered vs Frame-Based

**Decision:** Hybrid - click-triggered for UI, frame-based for benchmarks

**Rationale:**
- Click-triggered: User clicks → execute single opcode → immediate feedback
- Frame-based: Benchmark runs full grid → measure total throughput
- Hybrid allows both interactive use and performance testing

**Trade-offs:**
- Click mode has dispatch overhead (one shader launch per click)
- Frame mode amortizes overhead across all opcodes

### 2. State Storage: Texture vs Storage Buffer

**Decision:** Storage texture (rgba8uint)

**Rationale:**
- Matches .rts.png cartridge format (RGBA pixels)
- Easier to visualize/debug (can render to screen)
- Compatible with existing cartridge structure
- Storage buffers are more flexible but textures align with visual metaphor

**Alternatives considered:**
- `storage_buffer`: More efficient, but loses visual correspondence
- `uniform_buffer`: Too small (max 64KB), state is 320×4 = 1280 bytes (fits but no room to grow)

### 3. Shader Structure: Single-Pass vs Multi-Pass

**Decision:** Single-pass with conditional execution

```wgsl
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (exec_mode == MODE_CLICK) {
    // Only execute at click coordinates
    if (id.xy != click_coord) { return; }
  }

  let sit_pixel = textureLoad(sit, id.xy, 0);
  let opcode = sit_pixel.r;
  let target = sit_pixel.g;
  let flags = sit_pixel.b;

  execute_opcode(opcode, target, flags);
}
```

**Rationale:**
- Single shader, simpler dispatch
- Conditional overhead is minimal (branch prediction)
- Easier to maintain

### 4. AutoResearch Integration: Inline vs External Process

**Decision:** Inline Node.js loop with Git integration

**Rationale:**
- Same process can access GPU via wgpu-native
- Direct file system access for code modification
- Git operations via isomorphic-git or child_process

**Loop Structure:**
```
┌─────────────────────────────────────────────────────┐
│  while (time_budget > elapsed):                     │
│    1. Generate hypothesis (LLM or heuristic)        │
│    2. Apply code change to shader                   │
│    3. Commit: "experiment: try X"                   │
│    4. Run benchmark (5 iterations, take median)     │
│    5. Extract metric: ops/sec                       │
│    6. if metric > baseline * 1.05:                  │
│         KEEP - update baseline                      │
│       else:                                         │
│         REVERT - git reset --hard HEAD~1            │
│    7. Log to results.tsv                            │
└─────────────────────────────────────────────────────┘
```

### 5. Benchmark Harness Design

**Decision:** Fixed workload, median of 5 runs

```javascript
async function benchmark(executor, iterations = 5) {
  const results = [];
  for (let i = 0; i < iterations; i++) {
    // Clear state
    await executor.resetState();

    // Execute 1M operations
    const start = performance.now();
    await executor.executeFrame(1000000 / (80 * 24)); // 1M ops
    const elapsed = performance.now() - start;

    results.push(1000000 / elapsed); // ops/ms
  }
  return median(results);
}
```

**Rationale:**
- Median is robust against outliers (GC pauses, etc.)
- 5 iterations balances accuracy vs time
- 1M operations gives measurable duration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Node.js                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Viewer     │  │   Server     │  │ AutoResearch │          │
│  │   (HTML)     │  │   (Express)  │  │    Loop      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         ▼                 ▼                  ▼                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              GPU Texture Manager                          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐            │   │
│  │  │ Glyph Grid │ │    SIT     │ │   State    │            │   │
│  │  │  Texture   │ │  Texture   │ │  Texture   │            │   │
│  │  └────────────┘ └────────────┘ └────────────┘            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              WGSL Compute Shader                          │   │
│  │                                                           │   │
│  │  @compute fn main() {                                     │   │
│  │    let opcode = textureLoad(sit, coord);                  │   │
│  │    switch (opcode) {                                      │   │
│  │      case TOGGLE: state[target] = !state[target];         │   │
│  │      case INC:    state[target] += 1;                     │   │
│  │      case DEC:    state[target] -= 1;                     │   │
│  │      ...                                                  │   │
│  │    }                                                      │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
sync/
├── wgsl/
│   └── cartridge_executor.wgsl    # Main compute shader
├── gpu-texture-manager.js         # Texture creation/upload
├── gpu-executor.js                # WebGPU dispatch wrapper
├── autoresearch-loop.js           # Experiment loop
└── benchmark-harness.js           # Performance measurement

openspec/changes/gpu-native-execution/
├── proposal.md                    # This proposal
├── spec.md                        # Requirements
├── design.md                      # This design
├── tasks.md                       # Implementation tasks
└── results.tsv                    # Experiment log

apps/geos-ascii/viewer/
└── geos-viewer.html              # Modified for GPU mode
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| WebGPU not available | Feature detection, fallback to SyntheticGlyphVM |
| Shader compile errors | Validate before experiment, keep previous working version |
| State sync latency | Use staging buffers, async readback |
| AutoResearch gets stuck in local optimum | Random restarts, multiple hypotheses per run |
| GPU driver bugs | Test on multiple platforms, have CPU fallback |

## Open Questions

1. **Should we use workgroups larger than 1×1?** - 8×8 may be better for cache
2. **How to handle conditional opcodes (flags)?** - Execute on CPU or add to shader?
3. **Parallel cartridge execution?** - Future work, adds complexity
