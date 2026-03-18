# ASCII Scene Graph Expansion

## Why

Geometry OS needs a universal observability layer that allows AI agents to perceive, navigate, and mutate the system without expensive VLM screenshot processing. This transforms the system from opaque buffers into a Morphological Scene Graph where AI can reason in real-time.

## What Changes

- **ADDED** Instrumentation hooks for RISC-V GPU VM (✅ complete), Neural City, Visual Shell, and Evolution Pipeline
- **ADDED** ASCII renderers that emit `.ascii` files for zero-cost AI perception
- **ADDED** Ouroboros transmutation loop enabling bidirectional read-write capability
- **ADDED** VASM compiler for Visual Assembly → PixelRTS compilation
- **ADDED** Software morphology scanner for extracting ASCII from ELF binaries

### Subsystems Covered

| Subsystem | Hook Trait | ASCII Output | Status |
|-----------|-----------|--------------|--------|
| RISC-V GPU VM | RiscvHook | riscv_core.ascii, riscv_uart.ascii, riscv_halt.ascii | ✅ Complete |
| Neural City | NeuralCityHook | neural_city_map.ascii, district_focus.ascii, city_health.ascii | 📋 Planned |
| Visual Shell | VisualShellHook | shell_fragments.ascii, shell_focus.ascii, shell_state.ascii | 📋 Planned |
| Evolution Pipeline | EvolutionHook | evolution_pas.ascii, evolution_pipeline.ascii, evolution_log.ascii | 📋 Planned |

## Impact

- Affected specs: `neural-city-p1`, `collective-consciousness`, NEW `ascii-scene-graph`
- Affected code:
  - `systems/infinite_map_rs/src/riscv/hooks.rs` (✅ complete)
  - `systems/visual_shell/web/NeuralCityRenderer.js` (needs hooks)
  - `systems/visual_shell/ascii_scene/scene_graph.py` (extend)
  - `systems/evolution_daemon/hooks.py` (new)
  - `systems/pixel_compiler/vasm.py` (✅ complete)
  - `systems/pixel_compiler/scanner.py` (✅ complete)

## Success Criteria

| Criterion | Metric | Target |
|-----------|--------|--------|
| AI Navigation | VLM calls eliminated | 100% |
| Perception Latency | ASCII read time | <1ms |
| Self-Healing | PAS recovery rate | >95% |
| Code Generation | VASM → .rts.png success | 100% |

## References

- Design Document: `docs/plans/2026-02-19-ascii-scene-graph-expansion-design.md`
- Implementation Plan: `docs/plans/2026-02-19-ascii-scene-graph-expansion-impl.md`
