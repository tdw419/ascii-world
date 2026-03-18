# The Great Map Restoration Specification

## Overview

This specification defines the requirements for using the fully evolved swarm
to perform a real-world restoration of the infinite map substrate.

## Requirements

### REST-001: Restoration Orchestrator

**Priority:** Critical
**Status:** Required**

Central coordinator for the restoration mission.

| Requirement | Description |
|-------------|-------------|
| REST-001.1 | Orchestrator sequences phases 1→2→3→4 |
| REST-001.2 | Each phase reports progress (0-100%) |
| REST-001.3 | Errors in one phase halt execution |
| REST-001.4 | Recovery allows resuming from last successful phase |
| REST-001.5 | Final report includes all metrics |

**Phase Sequence:**
```
SCAN (Phase 1) → ANALYZE (Phase 2) → EXECUTE (Phase 3) → VERIFY (Phase 4)
```

**Acceptance Criteria:**
- [ ] Phases execute in correct order
- [ ] Progress is visible in real-time
- [ ] Errors are handled gracefully
- [ ] Recovery works from any phase

### REST-002: Distributed Scanner Swarm

**Priority:** Critical
**Status:** Required**

Distributed scanning of the infinite map.

| Requirement | Description |
|-------------|-------------|
| REST-002.1 | Map divided into hexagonal scan regions |
| REST-002.2 | 3 nodes handle ~33% of regions each |
| REST-002.3 | 50 ScannerAgents traverse regions in parallel |
| REST-002.4 | Artifacts reported with SHA256, size, type, location |
| REST-002.5 | Orphans identified (no parent references) |
| REST-002.6 | Fragmented clusters identified |

**ScanRegion:**
```python
@dataclass
class ScanRegion:
    region_id: str
    center: tuple[float, float]  # (x, y)
    radius: float
    assigned_node: str
    artifacts: List[ArtifactInfo]
    scanned_at: datetime
```

**Acceptance Criteria:**
- [ ] 100% of map regions scanned
- [ ] No duplicate artifacts
- [ ] All orphans identified
- [ ] Fragmented clusters scored

### REST-003: Cognitive Clustering

**Priority:** Critical
**Status:** Required**

Use Collective Consciousness for artifact clustering.

| Requirement | Description |
|-------------|-------------|
| REST-003.1 | Generate embeddings for each artifact |
| REST-003.2 | Compute attention between related artifacts |
| REST-003.3 | Consensus determines category assignment |
| REST-003.4 | ClusterPlan maps artifacts to regions |
| REST-003.5 | Confidence threshold >0.8 for assignments |

**Clustering Consensus:**
```python
consensus = await consensus_engine.aggregate([
    agent_1_clustering,
    agent_2_clustering,
    ...
])
agreement = consensus_engine.detect_agreement(clustering_thoughts)
assert agreement == True  # Must have consensus
```

**Acceptance Criteria:**
- [ ] All artifacts have embeddings
- [ ] Consensus achieved (>80% agreement)
- [ ] ClusterPlan is complete
- [ ] Categories are semantically meaningful

### REST-004: Tectonic Execution

**Priority:** Critical
**Status:** Required**

Execute physical reorganization of the map.

| Requirement | Description |
|-------------|-------------|
| REST-004.1 | Generate TectonicPlan from ClusterPlan |
| REST-004.2 | Execute moves in atomic batches |
| REST-004.3 | Detect conflicts before execution |
| REST-004.4 | Rollback on batch failure |
| REST-004.5 | Progress reported to dashboard |

**Atomic Batch:**
```python
@dataclass
class MoveBatch:
    batch_id: str
    moves: List[MoveOperation]
    status: BatchStatus  # PENDING, EXECUTING, COMMITTED, ROLLED_BACK
    committed_at: Optional[datetime]
```

**Acceptance Criteria:**
- [ ] Moves are atomic at batch level
- [ ] Conflicts are detected and resolved
- [ ] Rollback restores previous state
- [ ] Success rate >99%

### REST-005: Dashboard Integration

**Priority:** High
**Status:** Required**

Real-time visual oversight of restoration.

| Requirement | Description |
|-------------|-------------|
| REST-005.1 | Scanner particles visible sweeping map |
| REST-005.2 | Thought stream shows cognitive analysis |
| REST-005.3 | Migration progress bar with counts |
| REST-005.4 | Heat map shows activity intensity |
| REST-005.5 | Before/after comparison available |

**Dashboard Panels:**
| Panel | Content |
|-------|---------|
| Scanner View | Particle swarm traversing regions |
| Thought Stream | Consciousness thoughts (embeddings, attention, consensus) |
| Migration Progress | Files moved / total, success rate |
| Heat Map | Reorganization activity by region |
| Comparison | Side-by-side before/after |

**Acceptance Criteria:**
- [ ] All panels update in real-time (<100ms)
- [ ] Scanner visualization shows progress
- [ ] Migration is visible
- [ ] Before/after comparison works

## Integration Points

### Swarm Stack Integration

```
RestorationOrchestrator
    │
    ├──► ScannerAgent (Production Hardening)
    │        └──► A2A Router (Distribution)
    │
    ├──► Collective Consciousness
    │        ├──► ThoughtEngine (Consciousness)
    │        └──► ConsensusEngine (Consciousness)
    │
    ├──► MigrationCoordinator (Tectonic)
    │        └──► VAT (Infinite Map)
    │
    └──► Swarm Dashboard (Visual UI)
```

### Security Layer Integration

```
All communication → AuthManager (authenticate)
All messages → TaskSigner (sign/verify)
All migrations → Sandbox (isolated execution)
All events → AuditLogger (audit trail)
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Scan 1000 artifacts | <10 seconds |
| Generate 1000 embeddings | <5 seconds |
| Form clustering consensus | <10 seconds |
| Execute 1000 migrations | <30 seconds |
| Total restoration time | <60 seconds |
| Dashboard latency | <100ms |

## Success Metrics

| Metric | Target |
|--------|--------|
| Artifacts scanned | 100% |
| Orphans identified | All |
| Clustering consensus | >80% |
| Migration success rate | >99% |
| Fragmentation reduction | >50% |
| Locality improvement | >30% |
