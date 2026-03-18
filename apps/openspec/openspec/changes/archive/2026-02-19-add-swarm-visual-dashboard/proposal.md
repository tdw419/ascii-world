# Swarm Visual Dashboard

## Status
PROPOSED

## Summary
Build a real-time visual dashboard that renders the distributed swarm as spatial "particles" on the infinite map, displaying agent activity, node health, task flows, and migration events as visual phenomena.

## Motivation
"The Screen is the Hard Drive" - Geometry OS philosophy demands that data be visible. A distributed swarm is invisible by default; visualization makes it:

| Benefit | Impact |
|---------|--------|
| Intuitive Monitoring | See cluster health at a glance |
| Debugging Aid | Trace task flows visually |
| Spatial Reasoning | Leverage human visual cortex |
| Aesthetic Appeal | Beautiful, engaging interface |

## Goals
1. **Agent Visualization** - Render agents as particles with state-based coloring
2. **Node Clusters** - Display nodes as spatial regions with boundaries
3. **Task Flow Arrows** - Show task routing between agents/nodes
4. **Health Indicators** - Real-time health status via color/animation
5. **Migration Trails** - Visual traces of task migrations during failover

## Non-Goals
- 3D rendering (2D infinite map is sufficient)
- Mobile responsiveness (desktop-first)
- Historical replay (future enhancement)

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Swarm Visual Dashboard                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Infinite Map Canvas                        │   │
│   │                                                               │   │
│   │    ┌──────────┐         ┌──────────┐         ┌──────────┐   │   │
│   │    │  Node A  │ ═══════ │  Node B  │ ═══════ │  Node C  │   │   │
│   │    │ (cyan)   │         │ (green)  │         │ (amber)  │   │   │
│   │    │  ● ● ●   │         │  ● ● ●   │         │  ● ● ●   │   │   │
│   │    │  ● ● ●   │         │  ● ● ●   │         │  ● ● ●   │   │   │
│   │    └──────────┘         └──────────┘         └──────────┘   │   │
│   │         │                    │                    │         │   │
│   │         └────────────────────┼────────────────────┘         │   │
│   │                              │                              │   │
│   │                    Task Flow Arrows ═══►                    │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌──────────────┬──────────────┬──────────────┬─────────────────┐ │
│   │  Agent List  │ Task Queue   │ Health Panel │  Event Log      │ │
│   │              │              │              │                 │ │
│   │  ● Agent_1   │ Task_123...  │ Nodes: 3/3   │ 10:42 MIGRATE   │ │
│   │  ● Agent_2   │ Task_124...  │ Agents: 150  │ 10:41 COMPLETE  │ │
│   │  ● Agent_3   │ Task_125...  │ Tasks: 45    │ 10:40 FAIL      │ │
│   └──────────────┴──────────────┴──────────────┴─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Visualization Components

### 1. Agent Particles
- Circle glyphs representing individual agents
- Color-coded by state:
  - Cyan: Idle
  - Green: Working
  - Amber: Warning
  - Red: Error
  - Gray: Offline
- Pulse animation for active tasks
- Size proportional to task count

### 2. Node Regions
- Hexagonal or circular boundaries around agent clusters
- Color-coded by health:
  - Bright: Healthy
  - Dim: Degraded
  - Flashing: Critical
- Capacity bar showing agent load

### 3. Task Flow Arrows
- Animated arrows showing task direction
- Thickness proportional to message rate
- Color by task type (scan, compute, migrate)
- Fade trail showing recent history

### 4. Health Panel
- Real-time metrics dashboard
- Node count, agent count, task count
- Error rate and latency graphs
- Alert notifications with timestamps

### 5. Event Log
- Scrollable log of security events
- Color-coded by severity
- Clickable to highlight related agents
- Filters by event type

## Technical Stack

| Layer | Technology |
|-------|------------|
| Canvas | HTML5 Canvas with requestAnimationFrame |
| WebSocket | Real-time updates from swarm |
| Rendering | Custom particle system |
| Data | InfluxDB for metrics (optional) |
| API | FastAPI endpoint for dashboard data |

## Data Flow

```
Swarm Events ──► WebSocket ──► Dashboard State ──► Canvas Render
     │                                              │
     └── AuditLogger ──► Event Log Panel ◄─────────┘
```

## Test Coverage Target
- 80%+ coverage for visualization components
- Integration tests for WebSocket updates
- Performance tests for 1000+ particles

## Dependencies
- Existing HealthDashboard (data source)
- Existing AuditLogger (event stream)
- Existing A2A Router (WebSocket endpoint)

## Risks
| Risk | Mitigation |
|------|------------|
| Rendering performance | Virtualization, LOD, culling |
| WebSocket load | Throttled updates, delta compression |
| State sync | Periodic full state sync |

## Timeline
- Task 1: Canvas infrastructure and particle system
- Task 2: Agent and node rendering
- Task 3: Task flow visualization
- Task 4: Health panel and metrics
- Task 5: Event log and filtering
- Task 6: WebSocket integration and testing
