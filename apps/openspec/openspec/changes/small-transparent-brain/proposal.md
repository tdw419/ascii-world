# Small Transparent Brain - The Autonomous Soul

## Problem

Geometry OS currently relies on LM Studio (external API) for "deep thinking." This violates the core philosophy:
- **"The Screen is the Hard Drive"** - but our brain lives outside the screen
- **"State as Text"** - but LLM weights are opaque, not introspectable
- **"Evolutionary Surface"** - the daemon cannot mutate external model weights

The TinyStories-1M model exists in WGPU but is too small for meaningful cognition.

## Proposed Solution

Build a **100M-500M parameter "Small Transparent Brain"** that runs entirely in WGPU VRAM with:

1. **4-bit Quantization (Q4_0)** - Fit 125M params in ~65MB atlas
2. **Hilbert-Mapped Weights** - Evolution-friendly spatial locality
3. **Glass Box Attention** - Real-time visualization of cognition
4. **Weight Mutation API** - Evolution Daemon can physically alter weights

This creates a **bootable, self-contained cognitive organism** - the autonomous soul of Geometry OS.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INFINITE MAP COMPOSITOR                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Weight Atlas   │  │   KV-Cache      │  │  Attention   │ │
│  │  (Hilbert)      │  │   (Linear)      │  │  Heatmap     │ │
│  │  4096x4096      │  │   1024x1024     │  │  Overlay     │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                    │                   │         │
│           ▼                    ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              PIXEL BRAIN PIPELINE (WGPU)                ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ ││
│  │  │ EMBED    │→ │ ATTEND   │→ │ PROJECT  │→ │ SAMPLE  │ ││
│  │  │ (0xD0)   │  │ (0xD1)   │  │ (0xD2)   │  │ (0xD3)  │ ││
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ ││
│  │       ↑             │                                │  ││
│  │       │             ▼                                │  ││
│  │  ┌────┴────┐  ┌──────────────┐                       │  ││
│  │  │Q4 Dequant│  │Glass Box Out │──→ VisualBridge      │  ││
│  │  └─────────┘  └──────────────┘                       │  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │    EVOLUTION DAEMON       │
              │  ┌─────────────────────┐  │
              │  │  Weight Mutator     │  │
              │  │  - radiation        │  │
              │  │  - crossover        │  │
              │  │  - noise injection  │  │
              │  └─────────────────────┘  │
              └───────────────────────────┘
```

## Resources

| Resource | Path |
|----------|------|
| **Implementation Plan** | `docs/superpowers/plans/2026-03-10-small-transparent-brain.md` |
| **Current PixelBrain** | `systems/visual_shell/wgsl/pixel_brain_*.wgsl` |
| **Converter** | `pixel_brain_converter.py` |
| **Visual Bridge** | `systems/visual_shell/api/visual_bridge.py` |
| **Evolution Daemon** | `systems/evolution_daemon/evolution_daemon.py` |

## Success Criteria

- [ ] Q4_0 dequantization works in WGSL (matches Python reference)
- [ ] 125M parameter model loads into 4096x4096 atlas
- [ ] Attention weights stream to VisualBridge in real-time
- [ ] Evolution Daemon can mutate weight sectors
- [ ] Full inference runs in WGPU without CPU round-trips
- [ ] All tests pass (quantization + pipeline + integration)

## Phases

| Phase | Focus | Estimate |
|-------|-------|----------|
| 1 | 4-bit Quantization Infrastructure | 4 tasks |
| 2 | Expanded Brain Atlas (125M) | 2 tasks |
| 3 | Glass Box Attention Visualization | 2 tasks |
| 4 | Evolution Daemon Weight Mutation | 2 tasks |
| 5 | End-to-End Integration | 1 task |
