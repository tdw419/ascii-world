# Tectonic Optimization Specification

## Overview

This specification defines the requirements for using the distributed swarm
to optimize the infinite map's spatial layout through access pattern analysis,
fragmentation detection, and coordinated file migration.

## Requirements

### TECT-001: Access Pattern Analysis

**Priority:** Critical
**Status:** Required

Track and analyze file access patterns to understand usage relationships.

| Requirement | Description |
|-------------|-------------|
| TECT-001.1 | Monitor file access events via FUSE hooks |
| TECT-001.2 | Build co-occurrence graph (files accessed together) |
| TECT-001.3 | Compute access frequency score per file |
| TECT-001.4 | Store patterns in shared swarm memory |
| TECT-001.5 | Update patterns incrementally (not full rebuild) |

**Co-occurrence Metric:**
```
co_occurrence(a, b) = count(access(a) within T seconds of access(b))
                    / total_accesses(a) + total_accesses(b)
```

**Acceptance Criteria:**
- [ ] Access events are captured within 100ms
- [ ] Co-occurrence graph reflects actual usage patterns
- [ ] Memory usage scales linearly with file count
- [ ] Incremental updates work correctly

### TECT-002: Heat Map Generation

**Priority:** Critical
**Status:** Required

Generate spatial heat maps showing access intensity across the map.

| Requirement | Description |
|-------------|-------------|
| TECT-002.1 | Create grid-based heat representation |
| TECT-002.2 | Compute heat diffusion (spread to neighbors) |
| TECT-002.3 | Identify hot zones (high access) and cold zones |
| TECT-002.4 | Normalize heat values to [0, 1] range |
| TECT-002.5 | Cache heat map for efficient queries |

**Heat Diffusion:**
```
heat(x, y) = Σ [file_access_frequency(f) * exp(-distance(f, (x,y)) / σ)]
```

**Acceptance Criteria:**
- [ ] Hot zones correspond to frequently accessed files
- [ ] Cold zones are identified correctly
- [ ] Diffusion creates smooth heat gradients
- [ ] Heat map updates within 5 seconds of access changes

### TECT-003: Fragmentation Detection

**Priority:** High
**Status:** Required

Detect related files that are spatially scattered.

| Requirement | Description |
|-------------|-------------|
| TECT-003.1 | Analyze co-occurrence graph for file groups |
| TECT-003.2 | Measure spatial distance between related files |
| TECT-003.3 | Compute fragmentation score per group |
| TECT-003.4 | Prioritize groups by reorganization value |
| TECT-003.5 | Output fragmentation report |

**Fragmentation Score:**
```
fragmentation(group) = std_dev(distance(f_i, centroid(group))) * avg_distance
```

**Acceptance Criteria:**
- [ ] Related files are correctly grouped
- [ ] Fragmentation scores reflect actual scatter
- [ ] High-value targets are prioritized
- [ ] Detection completes within 30 seconds for 1000 files

### TECT-004: Optimal Placement Calculation

**Priority:** Critical
**Status:** Required

Calculate optimal positions for fragmented files using force-directed layout.

| Requirement | Description |
|-------------|-------------|
| TECT-004.1 | Implement force-directed layout algorithm |
| TECT-004.2 | Compute attractive forces between related files |
| TECT-004.3 | Compute repulsive forces between all files |
| TECT-004.4 | Apply boundary constraints |
| TECT-004.5 | Generate TectonicPlan with move operations |

**Force Equations:**
```
F_attract(f, g) = k_attract * co_occurrence(f, g) / distance(f, g)
F_repel(f, g) = k_repel / distance(f, g)²
F_boundary(f) = k_boundary * min(0, distance_to_edge(f))
```

**Acceptance Criteria:**
- [ ] Related files are placed closer together
- [ ] No files placed outside boundaries
- [ ] No overlapping file positions
- [ ] Plan converges within 1000 iterations

### TECT-005: Migration Coordination

**Priority:** Critical
**Status:** Required

Coordinate atomic migration of files to new positions.

| Requirement | Description |
|-------------|-------------|
| TECT-005.1 | Execute TectonicPlan via distributed agents |
| TECT-005.2 | Ensure atomic multi-file moves |
| TECT-005.3 | Detect and resolve conflicts |
| TECT-005.4 | Report progress to HealthDashboard |
| TECT-005.5 | Support rollback on failure |

**Atomicity Guarantee:**
- All files in a move batch complete or none do
- Partial moves are rolled back automatically

**Acceptance Criteria:**
- [ ] Moves are atomic at the batch level
- [ ] Conflicts are detected before move
- [ ] Progress is visible in dashboard
- [ ] Failed batches are rolled back

### TECT-006: Verification & Reporting

**Priority:** High
**Status:** Required

Verify optimization results and generate reports.

| Requirement | Description |
|-------------|-------------|
| TECT-006.1 | Validate optimization results |
| TECT-006.2 | Measure before/after metrics |
| TECT-006.3 | Detect performance regressions |
| TECT-006.4 | Generate optimization report |
| TECT-006.5 | Publish report to AuditLogger |

**Metrics:**
| Metric | Description |
|--------|-------------|
| Heat Score | Correlation of heat to center distance |
| Locality Score | Average distance between related files |
| Fragmentation Score | Standard deviation of group distances |
| Access Latency | Time to access related files |

**Acceptance Criteria:**
- [ ] Metrics are computed correctly
- [ ] Improvements are measurable
- [ ] Regressions trigger alerts
- [ ] Reports are logged immutably

## Integration Points

### FUSE Integration
```
AccessAnalyzer → FUSE.read_hook(file_path) → AccessEvent
AccessAnalyzer → FUSE.write_hook(file_path) → AccessEvent
```

### VAT Integration
```
MigrationCoordinator → VAT.get_position(file_id) → (x, y)
MigrationCoordinator → VAT.set_position(file_id, x, y) → success
```

### Health Dashboard Integration
```
MigrationCoordinator → HealthDashboard.report_progress(percent)
VerificationAgent → HealthDashboard.report_metrics(metrics)
```

### Visual Dashboard Integration
```
HeatMapGenerator → Dashboard.render_heat_map(grid)
MigrationCoordinator → Dashboard.highlight_moving_files(file_ids)
VerificationAgent → Dashboard.show_optimization_result(report)
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Access analysis latency | < 100ms per event |
| Heat map generation | < 5 seconds for 1000 files |
| Fragmentation detection | < 30 seconds for 1000 files |
| Placement calculation | < 60 seconds for 1000 files |
| Migration throughput | 100+ files/second |

## Test Requirements

| Component | Unit Tests | Integration Tests | Coverage Target |
|-----------|------------|-------------------|-----------------|
| AccessAnalyzer | 5+ | 2+ | 80%+ |
| HeatMapGenerator | 5+ | 2+ | 80%+ |
| FragmentationDetector | 5+ | 2+ | 80%+ |
| PlacementCalculator | 5+ | 2+ | 80%+ |
| MigrationCoordinator | 5+ | 2+ | 80%+ |
| VerificationAgent | 5+ | 2+ | 80%+ |
| Integration | - | 4+ | E2E coverage |

## Scheduling

| Mode | Description |
|------|-------------|
| Continuous | Run optimization continuously |
| Scheduled | Run at configured intervals (default: 1 hour) |
| Manual | Trigger via API endpoint |
| Adaptive | Run when fragmentation exceeds threshold |
