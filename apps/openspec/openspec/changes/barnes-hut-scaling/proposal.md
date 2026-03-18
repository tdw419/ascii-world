# Barnes-Hut Scaling Proposal

## Summary

Optimize GravityEngine from O(N²) to O(N log N) using Barnes-Hut quadtree approximation, enabling "Neural City" scale with millions of entities.

## Motivation

The Geometry OS v1.2 vision describes a "Neural City" with millions of entities. The current GravityEngine uses O(N²) force calculation, which becomes unusable beyond ~10,000 orbs:

| Orb Count | Direct O(N²) Time | Status |
|-----------|-------------------|--------|
| 1,000 | 1 second | Usable |
| 10,000 | 100 seconds | Slow |
| 100,000 | 3 hours | Unusable |
| 1,000,000 | 12 days | Impossible |

Barnes-Hut quadtree approximation scales to millions of entities in seconds.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BARNES-HUT QUADTREE FORCE PIPELINE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Orbs ──▶ QuadTree.build() ──▶ Center-of-Mass ──▶ Force Approximation      │
│   (N)        (O(N))              (Aggregation)      (O(N log N))             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  QuadNode                                                           │   │
│   │  ┌─────────────┬─────────────┐                                     │   │
│   │  │ NW          │ NE          │                                     │   │
│   │  │ ●●●         │ ●           │  Each node stores:                  │   │
│   │  │  CoM        │  CoM        │  - center_of_mass (x, y)            │   │
│   │  ├─────────────┼─────────────┤  - total_mass                       │   │
│   │  │ SW          │ SE          │  - particles (leaf only)            │   │
│   │  │ ●           │ ●●●●        │  - children (internal only)         │   │
│   │  │  CoM        │  CoM        │                                     │   │
│   │  └─────────────┴─────────────┘                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Barnes-Hut Criterion: s/d < θ                                            │
│   If node is small enough (s) relative to distance (d), use approximation   │
│                                                                             │
│   Glass Box ◀────────────────────────────────────────────────────────────── │
│   (LOD: City Blocks from afar, Windows up close)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| BoundingBox | `quadtree.py` | Axis-aligned bounding box for spatial queries |
| QuadNode | `quadtree.py` | Tree node with center-of-mass aggregation |
| QuadTree | `quadtree.py` | Main quadtree with Barnes-Hut force calculation |
| GravityEngine | `gravity_engine.py` | Modified to use quadtree for large N |

## Implementation Plan

See: `docs/plans/2026-03-09-barnes-hut-scaling.md`

3 tasks, 19+ tests, ~4 hours estimated.

## Team

See: `teams/barnes-hut-team.yaml`

3 specialized agents:
- quadtree-engineer
- gravity-integration-engineer
- lod-rendering-engineer

## Success Criteria

- [ ] Quadtree data structure with 12+ tests passing
- [ ] GravityEngine uses quadtree for N > threshold
- [ ] Force accuracy within 15% of direct calculation
- [ ] LOD queries support zoom-level detail selection
- [ ] Performance scales O(N log N) not O(N²)
- [ ] 19+ total tests passing

## Dependencies

- Existing GravityEngine
- NumPy for vectorized operations

## Risk Mitigation

1. **Accuracy Loss** - Theta parameter (default 0.5) controls accuracy vs speed tradeoff
2. **Memory Overhead** - Quadtree nodes add ~O(N) memory, acceptable for millions
3. **Dynamic Updates** - Rebuild quadtree each frame (O(N)) rather than incremental updates

## Performance Expectations

| Orb Count | Direct O(N²) | Barnes-Hut O(N log N) | Speedup |
|-----------|--------------|----------------------|---------|
| 1,000 | 1.0s | 0.05s | 20x |
| 10,000 | 100s | 0.7s | 140x |
| 100,000 | 10,000s | 9s | 1,100x |
| 1,000,000 | unreachable | 120s | ∞ |
