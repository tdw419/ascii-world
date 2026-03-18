# Self-Rewriting Kernel Proposal

## Summary

Implements "Active Weight Reshaping" - the Sisyphus Daemon detects performance hot spots in native Rust kernels and generates optimized replacements using LM Studio. This is the ultimate fusion of training and inference: the system rewrites its own code in real-time.

## Motivation

In Geometry OS v1.2, we achieved "The Screen is the Mind" - visible token streams and task thoughts. The next frontier is **Self-Rewriting Kernels**:

1. The daemon monitors native kernel performance
2. Detects hot spots based on call frequency and duration
3. Generates optimized Rust code via LM Studio
4. Hot-swaps the kernel with automatic rollback
5. Visualizes rewrites in the Glass Box

This collapses the training/inference boundary - every clock cycle becomes an epoch.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SELF-REWRITING KERNEL PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Native Kernel ──▶ Performance ──▶ Hot Spot ──▶ Kernel     ──▶ Hot-Swap   │
│   (Rust/WGSL)        Monitor          Detection     Rewriter       Manager  │
│                          │                │              │              │    │
│                          ▼                ▼              ▼              ▼    │
│                      call_counts    avg_time_ms    LM Studio      backup/   │
│                      durations      threshold      code gen       rollback  │
│                                                                             │
│   Glass Box ◀────────────────────────────────────────────────────────────── │
│   (0xCF KERNEL_REWRITE opcode visualization)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| PerformanceMonitor | `performance_monitor.py` | Track call counts, durations, detect hot spots |
| KernelRewriter | `kernel_rewriter.py` | Generate prompts, call LM Studio, parse code |
| HotSwapManager | `hot_swap_manager.py` | Atomic file updates, backup, rollback |
| NativeHilbertLUT | `native_hilbert.py` | Instrumented for performance tracking |
| Daemon | `daemon.py` | Integration, task creation, coordination |
| Glyph Renderer | `glyph_renderer.wgsl` | KERNEL_REWRITE opcode (0xCF) |

## Implementation Plan

See: `docs/plans/2026-03-08-self-rewriting-kernel.md`

8 tasks, 16+ tests, ~3 hours estimated.

## Team

See: `teams/self-rewriting-kernel-team.yaml`

7 specialized agents:
- performance-monitor-engineer
- ffi-instrumentation-engineer
- kernel-rewriter-engineer
- hot-swap-engineer
- daemon-integration-engineer
- glass-box-viz-engineer
- e2e-validation-engineer

## Success Criteria

- [ ] Performance hot spots detected from native kernel calls
- [ ] LM Studio generates valid Rust optimization code
- [ ] Hot-swap applies changes with automatic backup
- [ ] Rollback restores original code
- [ ] Glass Box visualizes rewrite events (opcode 0xCF)
- [ ] 16+ tests passing
- [ ] Daemon can propose kernel rewrite tasks

## Dependencies

- LM Studio running on localhost:1234
- Existing Sisyphus Daemon (v4)
- Glass Box visualization infrastructure
- Native Hilbert FFI bridge

## Risk Mitigation

1. **Code validation** - Syntax checking before applying rewrites
2. **Automatic rollback** - Backup system with one-click restore
3. **Confidence thresholds** - Only apply high-confidence rewrites
4. **Test coverage** - 16+ tests for all failure modes
