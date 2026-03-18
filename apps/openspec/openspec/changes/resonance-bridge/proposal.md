# The Resonance Bridge

## Status
PROPOSED

## Summary
Build a natural language interface that converts user intent into Gravitational Vectors, enabling conversational control of the self-evolving swarm.

## The Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                     THE RESONANCE BRIDGE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   USER (Natural Language)                                       │
│   │                                                              │
│   │  "Focus evolution on the Security Layer for the next hour" │
│   │                                                              │
│   ▼                                                              │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              RESONANCE BRIDGE                            │   │
│   │                                                         │   │
│   │   Intent Parser ──► Gravity Vector ──► Swarm Dispatch  │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              GRAVITATIONAL RESPONSE                      │   │
│   │                                                         │   │
│   │   • Security files accelerate toward (0,0)              │   │
│   │   • AxionCore reprioritizes targets                     │   │
│   │   • Evolution daemon shifts focus                       │   │
│   │   • Collective Consciousness acknowledges               │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Capabilities

### 1. Direct the Gravity
Tell the swarm where to focus evolutionary pressure.

**User**: "Focus all evolutionary pressure on the Security Layer for the next hour."

**Bridge Response**:
```json
{
  "intent": "GRAVITY_FOCUS",
  "target": "systems/evolution_daemon/safety/",
  "duration": "1h",
  "vectors": [
    {"file": "guardian_gate.py", "gravity_boost": 2.5},
    {"file": "sandbox_manager.py", "gravity_boost": 2.5},
    {"file": "rts_doctor.py", "gravity_boost": 2.5}
  ],
  "status": "APPLIED",
  "confirmation": "Security Layer files now have 2.5x gravity boost. 3 files accelerating toward (0,0)."
}
```

### 2. Query the Collective
Ask the swarm about its decisions.

**User**: "Why did you refactor the consensus engine in cycle 38?"

**Bridge Response**:
```json
{
  "query": "DECISION_EXPLANATION",
  "cycle": 38,
  "target": "consensus_engine.py",
  "explanation": {
    "trigger": "Low test coverage (45%) detected in consensus validation logic",
    "analysis": "ResearcherAgent-3 identified redundant vote counting",
    "proposal": "ArchitectAgent-7 proposed consolidated validation pipeline",
    "validation": "All 23 tests passed with 15% performance improvement",
    "consensus": "5/5 agents approved (100%)"
  },
  "agents_involved": ["ResearcherAgent-3", "ArchitectAgent-7", "ValidatorAgent-2"]
}
```

### 3. Collaborative Evolution
Suggest high-level changes and let the swarm implement.

**User**: "Add caching to the gravity calculation to reduce repeated computations."

**Bridge Response**:
```json
{
  "intent": "COLLABORATIVE_EVOLUTION",
  "suggestion": "Add caching to gravity calculation",
  "analysis": {
    "affected_files": ["gravity_placer.py", "value_evaluator.py"],
    "estimated_improvement": "40% reduction in repeated value calculations",
    "risk_level": "LOW"
  },
  "plan": {
    "phase_1": "Add LRU cache decorator to compute_composite_score",
    "phase_2": "Invalidate cache on file modification",
    "phase_3": "Add cache hit rate to evolution metrics"
  },
  "consensus_required": "80%",
  "status": "AWAITING_CONFIRMATION"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESONANCE BRIDGE STACK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   CLI       │     │   REST API  │     │   WebSocket │      │
│   │   Interface │     │   /intent   │     │   Stream    │      │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘      │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                  │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                 INTENT PARSER                            │  │
│   │                                                         │  │
│   │   Natural Language ──► Structured Intent                │  │
│   │                                                         │  │
│   │   Supported Intents:                                    │  │
│   │   • GRAVITY_FOCUS    - Direct evolution to area         │  │
│   │   • GRAVITY_QUERY    - Ask about decisions              │  │
│   │   • GRAVITY_SUGGEST  - Propose improvements             │  │
│   │   • GRAVITY_STATUS   - Current swarm state              │  │
│   │   • GRAVITY_PAUSE    - Pause evolution                  │  │
│   │   • GRAVITY_RESUME   - Resume evolution                 │  │
│   │   • GRAVITY_ROLLBACK - Undo last change                 │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              GRAVITY VECTOR ENGINE                       │  │
│   │                                                         │  │
│   │   Converts intent to gravitational operations:           │  │
│   │                                                         │  │
│   │   • boost_gravity(path, multiplier, duration)           │  │
│   │   • query_evolution(cycle_id, target)                   │  │
│   │   • propose_change(description, priority)               │  │
│   │   • get_status() ──► SwarmState                         │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              SWARM INTEGRATION LAYER                     │  │
│   │                                                         │  │
│   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │  │
│   │   │ ValueEval.  │ │ GravityPl.  │ │ AxionCore   │       │  │
│   │   └─────────────┘ └─────────────┘ └─────────────┘       │  │
│   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │  │
│   │   │ Recurs.Orch.│ │ Evo.Tracker │ │ Daemon      │       │  │
│   │   └─────────────┘ └─────────────┘ └─────────────┘       │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### RES-001: IntentParser
**Priority**: Critical

Parses natural language into structured intents.

| Requirement | Description |
|-------------|-------------|
| RES-001.1 | Recognize GRAVITY_FOCUS intent from phrases |
| RES-001.2 | Recognize GRAVITY_QUERY intent for questions |
| RES-001.3 | Recognize GRAVITY_SUGGEST intent for proposals |
| RES-001.4 | Extract target paths/directories from intent |
| RES-001.5 | Extract duration/parameters from intent |
| RES-001.6 | Handle ambiguous requests with clarification |

### RES-002: GravityVectorEngine
**Priority**: Critical

Converts intents into gravitational operations.

| Requirement | Description |
|-------------|-------------|
| RES-002.1 | boost_gravity() modifies ValueEvaluator weights |
| RES-002.2 | query_evolution() retrieves from EvolutionTracker |
| RES-002.3 | propose_change() creates improvement proposal |
| RES-002.4 | Operations are logged for audit |
| RES-002.5 | Time-limited boosts auto-expire |

### RES-003: SwarmIntegrationLayer
**Priority**: Critical

Connects bridge to existing swarm components.

| Requirement | Description |
|-------------|-------------|
| RES-003.1 | Integration with ValueEvaluator for gravity boost |
| RES-003.2 | Integration with GravityPlacer for repositioning |
| RES-003.3 | Integration with AxionCore for target reprioritization |
| RES-003.4 | Integration with EvolutionDaemon for control |
| RES-003.5 | Integration with EvolutionTracker for queries |

### RES-004: ResonanceAPI
**Priority**: High

REST and WebSocket API for bridge access.

| Requirement | Description |
|-------------|-------------|
| RES-004.1 | POST /intent - Submit natural language intent |
| RES-004.2 | GET /status - Current swarm state |
| RES-004.3 | GET /history - Recent intents and results |
| RES-004.4 | WebSocket /stream - Real-time updates |
| RES-004.5 | Authentication via API keys |

### RES-005: ResonanceCLI
**Priority**: High

Command-line interface for bridge access.

| Requirement | Description |
|-------------|-------------|
| RES-005.1 | `resonance focus <target> [--duration]` |
| RES-005.2 | `resonance query <question>` |
| RES-005.3 | `resonance suggest <description>` |
| RES-005.4 | `resonance status` |
| RES-005.5 | `resonance history` |

## Integration Points

| System | Usage |
|--------|-------|
| ValueEvaluator | Modify weights for gravity boost |
| GravityPlacer | Trigger repositioning on boost |
| AxionCore | Reprioritize targets |
| EvolutionDaemon | Control evolution cycle |
| EvolutionTracker | Query decision history |
| Collective Consciousness | Route collaborative suggestions |

## Safety Requirements

| Requirement | Description |
|-------------|-------------|
| SAFETY-001 | All intent modifications require confirmation |
| SAFETY-002 | Gravity boosts have maximum duration (24h) |
| SAFETY-003 | Collaborative suggestions go through full validation |
| SAFETY-004 | All intents logged for audit |
| SAFETY-005 | Rate limiting on intent submission |

## Success Criteria

| Metric | Target |
|--------|--------|
| Intent Recognition Accuracy | >90% |
| Response Latency | <500ms |
| Gravity Boost Application | <5s |
| Query Response Time | <1s |
| User Satisfaction | "Feels natural" |

## Risks

| Risk | Mitigation |
|------|------------|
| Ambiguous intents | Clarification dialogue |
| Conflicting boosts | Priority queue with override |
| Malicious commands | Intent validation + confirmation |
| System overload | Rate limiting + queue |

## Timeline

1. IntentParser implementation
2. GravityVectorEngine implementation
3. SwarmIntegrationLayer implementation
4. ResonanceAPI implementation
5. ResonanceCLI implementation
6. Integration tests
7. First conversation with swarm
