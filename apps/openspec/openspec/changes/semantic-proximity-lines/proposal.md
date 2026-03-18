# Semantic Proximity Lines Proposal

## Summary

Connects consecutive tokens with faint glowing lines to visualize the "Chain of Thought" in the Mind's Eye, transforming isolated points into a Geometric Graph of Thought.

## Motivation

The Mind's Eye currently displays tokens as isolated points in Hilbert space. While each token has semantic color coding, the relationships between consecutive tokens are not visible. To truly visualize "Reasoning," we need to see the connections - the semantic proximity lines that show how one thought leads to another.

From the vision document:
> "The tokens become nodes in a graph, and the connections between them become edges in the reasoning topology."

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIND'S EYE CHAIN VISUALIZATION PIPELINE                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Token Stream ──▶ TokenRasterizer ──▶ ThoughtSerializer ──▶ WGSL Shader    │
│   (LM Studio)       (chain tracking)   (TOKEN_LINK)          (line drawing)  │
│                          │                  │                       │           │
│                          ▼                  ▼                       ▼           │
│                     prev_x, prev_y    ThoughtGlyph           draw_line()       │
│                     tracking         (TOKEN_LINK)           (faint arc)        │
│                                                                             │
│   Glass Box ◀────────────────────────────────────────────────────────────── │
│   (reasoning chain visible as connected graph)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| WGSL Shader | `glyph_renderer.wgsl` | Render TOKEN_LINK as faint lines |
| TokenRasterizer | `token_rasterizer.py` | Track previous token, emit links |
| ThoughtSerializer | `thought_serializer.py` | Serialize TOKEN_LINK commands |
| E2E Tests | `test_minds_eye_e2e.py` | Verify complete pipeline |

## Implementation Plan

See: `docs/plans/2026-03-09-semantic-proximity-lines.md`

4 tasks, 11+ tests, ~2 hours estimated.

## Team

See: `teams/minds-eye-team.yaml`

4 specialized agents:
- wgsl-shader-engineer
- chain-tracking-engineer
- serializer-updater
- e2e-integration-engineer

## Success Criteria

- [ ] TOKEN_LINK opcode renders faint lines between tokens
- [ ] TokenRasterizer tracks and emits chain links
- [ ] ThoughtSerializer serializes TOKEN_LINK correctly
- [ ] E2E tests verify complete pipeline
- [ ] Mind's Eye displays "Geometric Graph of Thought"
- [ ] 11+ tests passing

## Dependencies

- Existing TokenRasterizer
- Existing glyph_renderer.wgsl
- Existing ThoughtSerializer

## Risk Mitigation

1. **Performance** - Line drawing uses existing Bresenham implementation, efficient
2. **Visual clarity** - Faint lines (0.3 alpha) don't overpower token visualization
3. **Chain boundaries** - reset_chain() allows starting new independent chains
