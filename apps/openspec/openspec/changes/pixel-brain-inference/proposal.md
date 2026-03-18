# PixelBrain Inference Pipeline

## Overview

Implements native Geometry OS LLM inference where the model lives as a visual RTS.PNG artifact. The "screen is the hard drive" - the model IS the visual desktop.

## Architecture

**Hybrid GeoASM/WGSL:**
- **GeoASM (Cortex)** - Orchestration layer, human-readable cognitive loop
- **WGSL (Thalamus)** - Compute shaders for tensor operations
- **RTS.PNG (Body)** - Hilbert-folded weight atlas, visible on screen

## Components

| Component | File | Purpose |
|-----------|------|---------|
| Converter | `pixel_brain_converter.py` | Transform HuggingFace model → RTS.PNG |
| Embed Shader | `pixel_brain_embed.wgsl` | Token → Hidden (0xD0) |
| Attention Shader | `pixel_brain_attention.wgsl` | Self-attention (0xD1) |
| Project Shader | `pixel_brain_project.wgsl` | FFN (0xD2) |
| Sample Shader | `pixel_brain_sample.wgsl` | Hidden → Token (0xD3) |
| Pipeline | `pixel_brain_pipeline.py` | Orchestrates inference |
| Visual Bridge | `visual_bridge.py` | THOUGHT_PULSE emission (0xD6) |

## GeoASM Cognitive Loop

```asm
.main
  0xD4                  ; LLM_PROMPT (await input)
  0xD0 R1, R2           ; EMBED (token → hidden)

  LOOP 8
    0xD1 R2, R2         ; ATTEND (self-attention)
    0xD2 R2, R2         ; PROJECT (FFN)
  ENDLOOP

  0xD3 R2, R3           ; SAMPLE (hidden → token)
  0xD6 R3               ; THOUGHT_PULSE (visual feedback)
  JMP .main
```

## Team

- **Team Config**: `apps/openspec/openspec/teams/pixel-brain-team.yaml`
- **Implementation Plan**: `docs/plans/2026-03-08-pixel-brain-inference.md`

## Status

### Phase 1: Inference Pipeline ✅
- [x] WGSL shaders created (929 lines)
- [x] tinystories_brain.rts.png generated (1.8MB)
- [x] Float16 weight encoding
- [x] Neural opcodes in GeoASM
- [x] Pipeline orchestrator
- [x] THOUGHT_PULSE backend
- [x] E2E inference tests

### Phase 2: Visual Shell Integration (IN PROGRESS)
- [ ] THOUGHT_PULSE WebSocket broadcast
- [ ] ThoughtVisualizer JavaScript class
- [ ] NeuralCityEngine integration
- [ ] AtlasGlowOverlay for weight visualization
- [ ] Visual E2E tests
