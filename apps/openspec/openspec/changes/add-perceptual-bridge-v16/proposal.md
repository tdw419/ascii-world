# Proposal: Add Perceptual Bridge V16

## Summary

The Perceptual Bridge V16 is the "Retina" for Geometry OS, enabling the system to "read" its own visual state from the Silicon District. This closes the cognitive feedback loop required for autonomous binary generation (Hex-Painter).

## Motivation

When the system generates RISC-V binary textures directly (bypassing symbolic compilers), it needs immediate feedback on execution results. Without the Perceptual Bridge, the Hex-Painter is creating blind. With it, the AI can paint fearlessly.

### Problem Statement

1. **Blind Binary Generation**: Current system can paint binary but cannot see the result
2. **No Autonomous Safety**: No automatic detection of kernel panics or critical errors
3. **Missing Feedback Loop**: AI cannot self-correct based on execution results

## Proposed Solution

Implement a 3-layer system:

1. **AnomalyDetector** - Pattern matching for CRITICAL (panic, segfault) and WARNING (error, fail) text
2. **PerceptualBridge** - Background daemon that monitors framebuffer and broadcasts DIAGNOSTIC_PULSE
3. **HUD Integration** - Browser visualization with automatic QUARANTINE_DISTRICT trigger on CRITICAL

## Architecture

```
RISC-V GPU VM ──► Framebuffer ──► PerceptualBridge ──► HUD
                      │
                      ▼
               AnomalyDetector
                      │
                      ▼
              DIAGNOSTIC_PULSE
                      │
               ┌──────┴──────┐
               ▼             ▼
          HEALTHY        CRITICAL
                           │
                           ▼
                    QUARANTINE_DISTRICT
```

## Success Criteria

- [ ] AnomalyDetector detects all test patterns (100% accuracy)
- [ ] DIAGNOSTIC_PULSE broadcast latency <100ms
- [ ] CRITICAL triggers QUARANTINE_DISTRICT within 3 seconds
- [ ] HUD displays Perceptual Bridge section
- [ ] All 12+ tests passing

## Dependencies

- ExtractionPipeline (for OCR) - Already exists at `conductor/tracks/shotcut-on-the-map/extraction_pipeline.py`
- VisualBridge (for WebSocket) - Already exists at `systems/visual_shell/api/visual_bridge.py`

## Team

- **perceptual-bridge-team** - 4 agents with 8 tasks

## Timeline

- Task 1.1-1.2: AnomalyDetector + PerceptualBridge daemon (Core)
- Task 2.1-2.2: VisualBridge integration
- Task 3.1-3.2: HUD frontend
- Task 4.1-4.2: E2E testing and verification

## References

- Design Doc: `docs/plans/2026-02-19-perceptual-bridge-v16-design.md`
- Implementation Plan: `docs/plans/2026-02-19-perceptual-bridge-v16-implementation.md`
- Team Definition: `apps/openspec/openspec/teams/perceptual-bridge-team.yaml`
