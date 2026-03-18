# Swarm Visual Dashboard Specification

## Overview

This specification defines the requirements for the real-time visual dashboard
that renders the distributed swarm as spatial elements on the infinite map.

## Requirements

### VIZ-001: Canvas Infrastructure

**Priority:** Critical
**Status:** Required

A high-performance canvas for rendering swarm visualization.

| Requirement | Description |
|-------------|-------------|
| VIZ-001.1 | Canvas initializes with configurable dimensions |
| VIZ-001.2 | Particle system supports 1000+ particles |
| VIZ-001.3 | Render loop uses requestAnimationFrame |
| VIZ-001.4 | Camera supports pan and zoom |
| VIZ-001.5 | Frame rate maintained at 60fps |

**Acceptance Criteria:**
- [ ] Canvas renders without flickering
- [ ] 1000 particles render at 60fps
- [ ] Pan/zoom is smooth and responsive
- [ ] Memory usage is stable over time

### VIZ-002: Agent Visualization

**Priority:** Critical
**Status:** Required

Agents are rendered as particles with state-based visual encoding.

| Requirement | Description |
|-------------|-------------|
| VIZ-002.1 | Agents rendered as circle glyphs |
| VIZ-002.2 | Color encodes state (idle/working/error) |
| VIZ-002.3 | Size proportional to task count |
| VIZ-002.4 | Pulse animation for active tasks |
| VIZ-002.5 | Hover shows agent details |

**Color Mapping:**
| State | Color | Hex |
|-------|-------|-----|
| Idle | Cyan | #00FFFF |
| Working | Green | #00FF00 |
| Warning | Amber | #FFAA00 |
| Error | Red | #FF0000 |
| Offline | Gray | #808080 |

**Acceptance Criteria:**
- [ ] Agent states are visually distinct
- [ ] Active agents have visible pulse
- [ ] Size scaling reflects workload
- [ ] Hover interaction works

### VIZ-003: Node Visualization

**Priority:** Critical
**Status:** Required

Nodes are rendered as regions containing agent clusters.

| Requirement | Description |
|-------------|-------------|
| VIZ-003.1 | Nodes rendered as boundaries around agents |
| VIZ-003.2 | Color encodes health status |
| VIZ-003.3 | Capacity bar shows load percentage |
| VIZ-003.4 | Click selects node for details |
| VIZ-003.5 | Leader node has special indicator |

**Acceptance Criteria:**
- [ ] Node boundaries clearly visible
- [ ] Health status is immediately apparent
- [ ] Load percentage is accurate
- [ ] Leader is visually distinguished

### VIZ-004: Task Flow Visualization

**Priority:** High
**Status:** Required

Task routing is visualized as animated arrows.

| Requirement | Description |
|-------------|-------------|
| VIZ-004.1 | Arrows connect source and target agents |
| VIZ-004.2 | Animation shows flow direction |
| VIZ-004.3 | Thickness scales with message rate |
| VIZ-004.4 | Color encodes task type |
| VIZ-004.5 | Fade trail shows recent history |

**Task Type Colors:**
| Type | Color | Hex |
|------|-------|-----|
| Scan | Blue | #0088FF |
| Compute | Purple | #8800FF |
| Migrate | Orange | #FF8800 |

**Acceptance Criteria:**
- [ ] Flow direction is clear
- [ ] Busy routes are visually thicker
- [ ] Task types are distinguishable
- [ ] History trail is visible

### VIZ-005: Health Panel

**Priority:** High
**Status:** Required

Real-time metrics displayed in a sidebar panel.

| Requirement | Description |
|-------------|-------------|
| VIZ-005.1 | Display node count and health |
| VIZ-005.2 | Display agent count and status distribution |
| VIZ-005.3 | Display task queue depth |
| VIZ-005.4 | Error rate graph over time |
| VIZ-005.5 | Alert notifications with timestamps |

**Acceptance Criteria:**
- [ ] Metrics update in real-time
- [ ] Graphs are readable and accurate
- [ ] Alerts are prominent
- [ ] Panel is collapsible

### VIZ-006: Event Log

**Priority:** Medium
**Status:** Required

Scrollable log of security and cluster events.

| Requirement | Description |
|-------------|-------------|
| VIZ-006.1 | Events displayed with timestamp |
| VIZ-006.2 | Color coding by severity |
| VIZ-006.3 | Click highlights related agents |
| VIZ-006.4 | Filter by event type |
| VIZ-006.5 | Auto-scroll to latest events |

**Event Severity Colors:**
| Severity | Color | Hex |
|----------|-------|-----|
| Info | White | #FFFFFF |
| Warning | Amber | #FFAA00 |
| Error | Red | #FF0000 |
| Critical | Magenta | #FF00FF |

**Acceptance Criteria:**
- [ ] Events are readable and timestamped
- [ ] Severity is visually distinct
- [ ] Click interaction highlights agents
- [ ] Filters work correctly

### VIZ-007: WebSocket Integration

**Priority:** Critical
**Status:** Required

Real-time updates via WebSocket connection.

| Requirement | Description |
|-------------|-------------|
| VIZ-007.1 | Connect to swarm WebSocket endpoint |
| VIZ-007.2 | Full state sync on connect |
| VIZ-007.3 | Incremental updates during operation |
| VIZ-007.4 | Automatic reconnection on disconnect |
| VIZ-007.5 | Authenticated connection via session token |

**Acceptance Criteria:**
- [ ] Dashboard reflects swarm state within 100ms
- [ ] Reconnection is transparent
- [ ] Updates are throttled to prevent overload
- [ ] Connection status is visible

## Integration Points

### Health Dashboard Integration

```
Dashboard API → HealthDashboard.get_cluster_state()
Dashboard API → HealthDashboard.get_node_health(node_id)
Dashboard API → HealthDashboard.get_agent_status(agent_id)
```

### Audit Logger Integration

```
Event Log → AuditLogger.query_events(filters)
Event Log → AuditLogger.subscribe_realtime()
```

### Node Registry Integration

```
Canvas State → NodeRegistry.get_all_nodes()
Canvas State → NodeRegistry.get_leader()
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Initial load time | < 2s |
| Frame rate | 60fps |
| Update latency | < 100ms |
| Memory usage | < 500MB |
| Max particles | 1000+ |

## Test Requirements

| Component | Unit Tests | Integration Tests | Coverage Target |
|-----------|------------|-------------------|-----------------|
| SwarmCanvas | 5+ | 2+ | 80%+ |
| AgentParticle | 5+ | 1+ | 80%+ |
| NodeRegion | 5+ | 1+ | 80%+ |
| TaskFlow | 5+ | 1+ | 80%+ |
| HealthPanel | 5+ | 1+ | 80%+ |
| EventLog | 5+ | 1+ | 80%+ |
| WebSocket | 5+ | 2+ | 80%+ |

## Accessibility

| Requirement | Description |
|-------------|-------------|
| Keyboard nav | All panels keyboard accessible |
| Screen reader | ARIA labels for particles |
| Color blind | Patterns supplement colors |
| Reduced motion | Disable animations option |
