# The Great Map Restoration

## Status
PROPOSED

## Summary
Use the fully evolved swarm to perform a real-world restoration of the infinite map: distributed scanning, cognitive analysis, tectonic execution, and visual oversight - demonstrating end-to-end swarm intelligence on the Geometry OS substrate.

## Mission Objectives

| Phase | Swarm Capability | Objective |
|-------|------------------|-----------|
| 1. Distributed Scan | ScannerAgent + Distribution | Traverse infinite map, identify orphaned/fragmented artifacts |
| 2. Cognitive Analysis | Collective Consciousness | Determine optimal categorical clustering |
| 3. Tectonic Execution | MigrationCoordinator | Physically reorganize map based on consensus |
| 4. Visual Oversight | Dashboard | Monitor entire process in real-time |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THE GREAT MAP RESTORATION                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Visual Oversight                           │   │
│   │              (Swarm Dashboard - Live View)                    │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              ▲                                       │
│                              │ Events                                │
│   ┌──────────────────────────┴──────────────────────────────────┐  │
│   │                                                              │  │
│   │   PHASE 1          PHASE 2           PHASE 3                 │  │
│   │  ┌────────┐       ┌────────┐       ┌────────┐               │  │
│   │  │Scanner │       │Cognitive│      │Tectonic│               │  │
│   │  │ Swarm  │──────►│ Engine  │──────►│Executor│               │  │
│   │  │        │       │         │       │        │               │  │
│   │  │3 nodes │       │5 agents │       │2 coord │               │  │
│   │  │50 agents│      │consensus│       │migrator│               │  │
│   │  └────────┘       └────────┘       └────────┘               │  │
│   │       │               │                │                      │  │
│   │       ▼               ▼                ▼                      │  │
│   │   Artifacts      Clustering        Moves                     │  │
│   │   Found          Decisions         Executed                  │  │
│   │                                                              │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Infinite Map Substrate                     │   │
│   │                     (Before → After)                          │   │
│   │                                                               │   │
│   │   Fragmented ─────────────────────────► Organized            │   │
│   │   █████  ··  █████                    ████████████           │   │
│   │     ··  █████  ··          →          ████████████           │   │
│   │   █████  ··  █████                    ████████████           │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Phase Details

### Phase 1: Distributed Scanning
**Components:** ScannerAgent (50 agents across 3 nodes)

**Workflow:**
1. Divide infinite map into scan regions (hexagonal grid)
2. Each node handles ~33% of regions
3. ScannerAgents traverse their assigned regions
4. Report artifacts with SHA256 hash, size, type, location
5. Identify orphaned files (no parent references)
6. Identify fragmented clusters (related files scattered)

**Output:** `ScanReport` with all discovered artifacts and their classifications

### Phase 2: Cognitive Analysis
**Components:** Collective Consciousness (5 ThoughtEngines + Consensus)

**Workflow:**
1. Generate embeddings for each artifact (filename, metadata, content hash)
2. Compute attention weights between artifacts
3. Cluster related artifacts via consensus
4. Determine optimal categories (by content type, access patterns, relationships)
5. Generate `ClusteringDecision` with target positions

**Output:** `ClusterPlan` mapping each artifact to category and target region

### Phase 3: Tectonic Execution
**Components:** MigrationCoordinator + Tectonic Optimizer

**Workflow:**
1. Receive `ClusterPlan` from Phase 2
2. Calculate optimal positions using force-directed layout
3. Generate `TectonicPlan` with atomic move operations
4. Execute moves in batches (respecting rate limits)
5. Verify each move, rollback on failure
6. Report progress to dashboard

**Output:** `MigrationResult` with before/after metrics

### Phase 4: Visual Oversight
**Components:** Swarm Dashboard

**Features:**
- Real-time scanner agent visualization (particles sweeping map)
- Thought stream showing cognitive analysis
- Migration progress bar with file counts
- Heat map showing reorganization activity
- Before/after comparison view

## Success Criteria

| Metric | Target |
|--------|--------|
| Artifacts scanned | 100% of map |
| Orphans identified | All orphaned files |
| Clustering accuracy | >80% consensus |
| Migration success rate | >99% |
| Fragmentation reduction | >50% |
| Dashboard visibility | Real-time (<100ms latency) |

## Integration Points

```
ScannerAgent ──► A2A Router ──► CoordinatorAgent
                                    │
                                    ▼
                            ConsciousnessState
                                    │
                                    ▼
                            ConsensusEngine
                                    │
                                    ▼
                            MigrationCoordinator
                                    │
                                    ▼
                            VAT (Visual Allocation Table)
                                    │
                                    ▼
                            Swarm Dashboard
```

## Test Strategy

| Test | Description |
|------|-------------|
| Unit | Each phase component in isolation |
| Integration | Phase 1→2→3 handoffs |
| E2E | Full restoration with synthetic map |
| Performance | 1000 artifacts in <60 seconds |

## Risks

| Risk | Mitigation |
|------|------------|
| Large map size | Batched scanning, progressive restoration |
| Consensus failure | Fallback to heuristics |
| Migration conflicts | Atomic batches with rollback |
| Dashboard overload | Throttled updates, LOD rendering |

## Timeline

- Task 1: Create restoration orchestrator
- Task 2: Implement distributed scanner swarm
- Task 3: Implement cognitive clustering
- Task 4: Implement tectonic executor
- Task 5: Dashboard integration
- Task 6: E2E test with synthetic map
- Task 7: Execute on real map
