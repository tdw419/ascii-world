# Swarm Recursive Evolution Specification

## Overview

This specification defines the requirements for the Swarm Recursive Evolution
system - a self-improvement loop with Foveated Knowledge Gravity that enables
the swarm to autonomously analyze, improve, and evolve its own code.

## Core Concept: Foveated Knowledge Gravity

**Formula:** `Distance from (0,0) = 1 / (AI Value Score)`

The infinite map becomes a gravity well where:
- High-value code is pulled toward the center
- Low-value code drifts to the periphery
- The focal point (Axion) contains the current improvement target

## Requirements

### REC-001: ValueEvaluator

**Priority:** Critical
**Status:** Required**

Determines the AI value score for code artifacts.

| Requirement | Description |
|-------------|-------------|
| REC-001.1 | Compute access frequency from audit logs |
| REC-001.2 | Compute criticality from dependency analysis |
| REC-001.3 | Compute improvement potential from test coverage |
| REC-001.4 | Compute complexity score from AST analysis |
| REC-001.5 | Compute staleness from last modification time |
| REC-001.6 | Combine factors into composite value score |

**Value Score Formula:**
```
value_score = w_access * normalize(access_frequency)
            + w_critical * criticality
            + w_improve * (1 - test_coverage)
            + w_complex * normalize(complexity)
            + w_stale * normalize(days_since_modified)

where:
  w_access = 0.25
  w_critical = 0.25
  w_improve = 0.20
  w_complex = 0.15
  w_stale = 0.15
```

**Acceptance Criteria:**
- [ ] Value scores in range [0, 1]
- [ ] Critical files have high scores
- [ ] Well-tested files have lower improvement priority
- [ ] Scores update when code changes

### REC-002: GravityPlacer

**Priority:** Critical
**Status:** Required**

Positions code on map based on AI value score.

| Requirement | Description |
|-------------|-------------|
| REC-002.1 | Calculate distance from center inversely proportional to value |
| REC-002.2 | Assign (x, y) position based on distance and direction |
| REC-002.3 | Recenter when values change significantly |
| REC-002.4 | Compute centripetal force for Tectonic integration |
| REC-002.5 | Maintain visual clustering of related files |

**Position Formula:**
```
distance = k_gravity / (value_score + epsilon)  # Avoid division by zero
angle = hash(file_path) % (2 * PI)              # Deterministic direction
x = distance * cos(angle)
y = distance * sin(angle)
```

**Acceptance Criteria:**
- [ ] High-value files within inner 25% radius
- [ ] Low-value files beyond 75% radius
- [ ] Positions are deterministic
- [ ] Recentering preserves relative order

### REC-003: AxionCore

**Priority:** Critical
**Status:** Required**

The focal point at (0,0) containing current improvement target.

| Requirement | Description |
|-------------|-------------|
| REC-003.1 | Select highest-value code as improvement target |
| REC-003.2 | Update target when improvement completes |
| REC-003.3 | Handle protected files (require higher consensus) |
| REC-003.4 | Maintain priority queue of improvement candidates |
| REC-003.5 | Emit events on target change |

**Protected Files:**
- Files with `@protected` annotation
- Core infrastructure files
- Files that haven't been reviewed recently

**Acceptance Criteria:**
- [ ] Always has a target selected
- [ ] Target is highest-value unprotected file
- [ ] Protected files require 90% consensus
- [ ] Events emitted on changes

### REC-004: RecursiveOrchestrator

**Priority:** Critical
**Status:** Required**

Coordinates the self-improvement loop.

| Requirement | Description |
|-------------|-------------|
| REC-004.1 | Execute INTROSPECT phase with ResearcherAgents |
| REC-004.2 | Execute PROPOSE phase with ArchitectAgents |
| REC-004.3 | Execute VALIDATE phase with ValidatorAgents |
| REC-004.4 | Execute CONSENSUS phase via Collective Consciousness |
| REC-004.5 | Handle APPROVE/REJECT/ITERATE decisions |
| REC-004.6 | Apply approved changes to codebase |

**State Machine:**
```
IDLE → INTROSPECTING → PROPOSING → VALIDATING → CONSENSUS
                                                         │
                                          ┌──────────────┴──────────────┐
                                          │              │              │
                                       APPROVE        REJECT        ITERATE
                                          │              │              │
                                          ▼              ▼              ▼
                                       APPLY         ABORT      INTROSPECT
                                          │
                                          ▼
                                       COMPLETE
```

**Acceptance Criteria:**
- [ ] Correct phase sequencing
- [ ] Consensus achieved before apply
- [ ] Rollback on validation failure
- [ ] Events emitted at each phase

### REC-005: EvolutionTracker

**Priority:** High
**Status:** Required**

Tracks evolution history and metrics.

| Requirement | Description |
|-------------|-------------|
| REC-005.1 | Log all improvement attempts |
| REC-005.2 | Track value score trends |
| REC-005.3 | Calculate evolution velocity |
| REC-005.4 | Maintain rollback history |
| REC-005.5 | Generate evolution reports |

**Tracked Metrics:**
| Metric | Description |
|--------|-------------|
| improvements_applied | Total successful improvements |
| improvements_rejected | Total rejected proposals |
| avg_value_change | Average change in value score |
| evolution_velocity | Improvements per hour |
| rollback_count | Total rollbacks |

**Acceptance Criteria:**
- [ ] All attempts logged
- [ ] Metrics calculated correctly
- [ ] Rollback history preserved
- [ ] Reports generated on demand

### REC-006: Dashboard Integration

**Priority:** High
**Status:** Required**

Visual representation of recursive evolution.

| Requirement | Description |
|-------------|-------------|
| REC-006.1 | Gravity map showing value distribution |
| REC-006.2 | Axion target indicator (pulsing) |
| REC-006.3 | Evolution timeline |
| REC-006.4 | Value metrics panel |
| REC-006.5 | Consensus status display |

**Acceptance Criteria:**
- [ ] Real-time updates (<100ms)
- [ ] Clear visual hierarchy
- [ ] Interactive exploration
- [ ] Historical playback

## Safety Requirements

### SAFETY-001: Protected Core

| Requirement | Description |
|-------------|-------------|
| SAFETY-001.1 | Core files require 90% consensus |
| SAFETY-001.2 | Some files marked as immutable |
| SAFETY-001.3 | Changes to security code require audit |

### SAFETY-002: Rate Limiting

| Requirement | Description |
|-------------|-------------|
| SAFETY-002.1 | Max 10 improvements per hour |
| SAFETY-002.2 | Cooldown period between improvements |
| SAFETY-002.3 | Manual override available |

### SAFETY-003: Rollback

| Requirement | Description |
|-------------|-------------|
| SAFETY-003.1 | Automatic rollback on test failure |
| SAFETY-003.2 | Manual rollback available |
| SAFETY-003.3 | Rollback history preserved |

## Integration Points

### Cognitive IDE Integration
```
RecursiveOrchestrator → CognitiveIDE.analyze(target)
RecursiveOrchestrator → CognitiveIDE.propose(analysis)
RecursiveOrchestrator → CognitiveIDE.validate(proposal)
```

### Tectonic Integration
```
GravityPlacer → TectonicOptimizer.add_centripetal_force(file, force)
EvolutionTracker → TectonicOptimizer.get_current_positions()
```

### Consciousness Integration
```
RecursiveOrchestrator → ConsensusEngine.vote(proposal)
RecursiveOrchestrator → ConsciousnessState.update(axion_target)
```

### Audit Integration
```
All improvements → AuditLogger.log(ITERATION_EVENT)
All rollbacks → AuditLogger.log(ROLLBACK_EVENT)
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Value calculation | <1 second per file |
| Gravity update | <5 seconds for full map |
| Improvement cycle | <5 minutes |
| Dashboard latency | <100ms |

## Success Criteria

| Metric | Target |
|--------|--------|
| First self-improvement | Completed |
| Tests after improvement | 100% pass |
| Value score improvement | >10% |
| Gravity correlation | >0.9 |
| Consensus rate | >80% |
