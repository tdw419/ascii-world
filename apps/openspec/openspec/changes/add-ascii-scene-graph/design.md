# ASCII Scene Graph Expansion - Technical Design

## Context

Geometry OS consists of multiple subsystems (RISC-V GPU VM, Neural City, Visual Shell, Evolution Pipeline) that operate as opaque buffers. AI agents currently need VLM screenshot processing to understand the system state, which is expensive and slow.

This design establishes a Universal ASCII Scene Graph that transforms the system into a Morphological Scene Graph where AI can perceive, reason, and act in real-time.

## Goals / Non-Goals

### Goals
- Zero-cost AI perception via `.ascii` files
- Bidirectional actuation via VASM compiler
- Self-healing via PAS-triggered pipelines
- Instrumentation hooks for all major subsystems

### Non-Goals
- Replacing existing WebSocket streaming (complementary)
- Full bidirectional sync (live sync is sufficient)
- VLM integration (eliminating VLM is the goal)

## Decisions

### Decision 1: Instrumentation Hooks Pattern

**Chosen:** Event-driven hooks that broadcast to multiple listeners

**Rationale:**
- Clean separation between subsystem logic and observation
- Multiple consumers (ASCII renderer, WebSocket, HUD) can subscribe
- Non-blocking async dispatch for performance
- Established pattern from RISC-V implementation

**Alternatives Considered:**
1. Polling - Simple but wasteful, high latency
2. Bidirectional Bridge - Over-engineered for read-heavy workload

### Decision 2: Camera-Follow Viewport for Neural City

**Chosen:** 80x24 fixed grid that tracks compositor view

**Rationale:**
- Neural City is infinite, can't render entire map
- AI focus aligned with visual presentation
- Bounded output size for efficient parsing
- "Semantic Radar" - what AI sees matches what user sees

### Decision 3: Tree-Based Topology for Visual Shell

**Chosen:** YAML-like tree structure for active fragments

**Rationale:**
- Natural fit for window hierarchy
- Easy to parse for AI
- Spatial queries via string parsing
- Compact representation

### Decision 4: PAS Threshold for Self-Healing

**Chosen:** 0.80 threshold triggers Ouroboros loop

**Rationale:**
- Empirically validated from Evolution Daemon V11
- Prevents thrashing on minor fluctuations
- Allows proactive healing before critical failure

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ASCII SCENE GRAPH EXPANSION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   SUBSYSTEMS                    HOOKS                    ASCII OUTPUTS      │
│   ──────────                    ─────                    ────────────      │
│                                                                              │
│   RISC-V GPU VM ──────────► RiscvHook ──────────► riscv_core.ascii          │
│                              - on_batch            riscv_uart.ascii          │
│                              - on_uart             riscv_halt.ascii          │
│                              - on_halt                                      │
│                                                                              │
│   Neural City ────────────► NeuralCityHook ─────► neural_city_map.ascii     │
│                              - on_district         district_focus.ascii      │
│                              - on_camera_move      city_health.ascii         │
│                              - on_relocation                               │
│                                                                              │
│   Visual Shell ───────────► VisualShellHook ────► shell_fragments.ascii     │
│                              - on_window           shell_focus.ascii         │
│                              - on_focus            shell_state.ascii         │
│                              - on_fragment                                 │
│                                                                              │
│   Evolution Pipeline ─────► EvolutionHook ──────► evolution_pas.ascii        │
│                              - on_pas_change       evolution_pipeline.ascii  │
│                              - on_pipeline_stage   evolution_log.ascii       │
│                              - on_self_correction                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Ouroboros Transmutation Loop

```
1. PERCEIVE: Read .ascii files (zero-cost, no VLM)
2. REASON: Agent analyzes morphology, decides action
3. ACT: Write .vasm (Visual Assembly)
4. MATERIALIZE: vasm.py compiles to .rts.png
5. EXECUTE: GPU runs new pixels
6. OBSERVE: Hooks emit updated .ascii
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| ASCII files become stale | Live sync on every event |
| Performance overhead from hooks | Async dispatch, bounded output |
| VASM compilation failures | Validation in compiler, fallback paths |
| PAS threshold too sensitive | Configurable threshold with hysteresis |

## Migration Plan

1. **Phase 1:** Neural City hooks (extends existing NeuralCityRenderer)
2. **Phase 2:** Visual Shell hooks (new module in ascii_scene/)
3. **Phase 3:** Evolution Pipeline hooks (extends evolution_daemon/)
4. **Phase 4:** Integration testing and HUD display

**Rollback:** Hooks are optional listeners, disabling them has no effect on subsystem functionality.

## Open Questions

1. Should ASCII files be versioned for debugging?
2. What's the optimal viewport size for Neural City?
3. Should VASM support macro definitions?

## File Locations

| Component | Location |
|-----------|----------|
| RISC-V Hooks | `systems/infinite_map_rs/src/riscv/hooks.rs` |
| Neural City Hooks | `systems/visual_shell/swarm/consciousness/hooks.py` |
| Visual Shell Hooks | `systems/visual_shell/ascii_scene/hooks.py` |
| Evolution Hooks | `systems/evolution_daemon/hooks.py` |
| VASM Compiler | `systems/pixel_compiler/vasm.py` |
| Software Scanner | `systems/pixel_compiler/scanner.py` |
| ASCII Scene Graph | `systems/visual_shell/ascii_scene/scene_graph.py` |
