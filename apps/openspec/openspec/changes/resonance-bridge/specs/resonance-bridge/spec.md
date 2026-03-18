# Resonance Bridge Specification

## Overview

This specification defines the requirements for the Resonance Bridge - a natural language interface that converts user intent into Gravitational Vectors, enabling conversational control of the self-evolving swarm.

## Core Concept: Intent → Gravity

The bridge translates human intent into operations that affect the swarm's gravitational field:

```
"Focus on security" → boost_gravity("safety/", 2.5, "1h")
                     → Files accelerate toward (0,0)
                     → AxionCore reprioritizes targets
                     → Evolution daemon shifts focus
```

## Requirements

### RES-001: IntentParser

**Priority**: Critical
**Status**: Required

Parses natural language into structured intents.

| Requirement | Description |
|-------------|-------------|
| RES-001.1 | Recognize GRAVITY_FOCUS intent from focus/direct/concentrate phrases |
| RES-001.2 | Recognize GRAVITY_QUERY intent from why/what/how questions |
| RES-001.3 | Recognize GRAVITY_SUGGEST intent from add/improve/refactor phrases |
| RES-001.4 | Recognize GRAVITY_STATUS intent from status/state/current phrases |
| RES-001.5 | Recognize GRAVITY_PAUSE intent from pause/stop/halt phrases |
| RES-001.6 | Recognize GRAVITY_RESUME intent from resume/continue/start phrases |
| RES-001.7 | Extract target paths/directories from intent |
| RES-001.8 | Extract duration parameters (e.g., "for 1 hour") |
| RES-001.9 | Extract multiplier parameters (e.g., "2x gravity") |
| RES-001.10 | Handle ambiguous requests with clarification response |

**Intent Structure**:
```python
@dataclass
class Intent:
    type: IntentType  # FOCUS, QUERY, SUGGEST, STATUS, PAUSE, RESUME
    target: Optional[str]  # File path or directory
    duration: Optional[timedelta]  # For time-limited operations
    multiplier: Optional[float]  # For gravity boost
    question: Optional[str]  # For queries
    suggestion: Optional[str]  # For collaborative evolution
    confidence: float  # Parser confidence (0-1)
    clarification_needed: bool  # True if ambiguous
```

**Acceptance Criteria**:
- [ ] Recognizes intent type with >90% accuracy
- [ ] Extracts targets from relative and absolute paths
- [ ] Parses duration in multiple formats (1h, 30 min, 2 hours)
- [ ] Returns clarification request for ambiguous input

### RES-002: GravityVectorEngine

**Priority**: Critical
**Status**: Required

Converts intents into gravitational operations.

| Requirement | Description |
|-------------|-------------|
| RES-002.1 | boost_gravity(path, multiplier, duration) modifies ValueEvaluator |
| RES-002.2 | query_evolution(cycle_id, target) retrieves from EvolutionTracker |
| RES-002.3 | propose_change(description, priority) creates improvement proposal |
| RES-002.4 | get_status() returns current SwarmState |
| RES-002.5 | pause_evolution() signals daemon to pause |
| RES-002.6 | resume_evolution() signals daemon to resume |
| RES-002.7 | All operations logged for audit |
| RES-002.8 | Time-limited boosts auto-expire |
| RES-002.9 | Operations are idempotent where possible |

**Operation Result**:
```python
@dataclass
class OperationResult:
    success: bool
    intent_type: IntentType
    affected_files: List[str]
    message: str
    data: Optional[Dict]  # Additional response data
    timestamp: datetime
    expires_at: Optional[datetime]  # For time-limited operations
```

**Acceptance Criteria**:
- [ ] Gravity boost applies within 5 seconds
- [ ] Boost automatically expires at specified time
- [ ] Operations are logged with full context
- [ ] Failed operations return clear error messages

### RES-003: SwarmIntegrationLayer

**Priority**: Critical
**Status**: Required

Connects bridge to existing swarm components.

| Requirement | Description |
|-------------|-------------|
| RES-003.1 | Integration with ValueEvaluator for gravity weight modification |
| RES-003.2 | Integration with GravityPlacer for repositioning triggers |
| RES-003.3 | Integration with AxionCore for target reprioritization |
| RES-003.4 | Integration with EvolutionDaemon for control signals |
| RES-003.5 | Integration with EvolutionTracker for decision queries |
| RES-003.6 | Integration with ConsensusEngine for collaborative proposals |

**Integration Methods**:
```python
class SwarmIntegration:
    def modify_value_weights(self, path: str, multiplier: float) -> List[str]:
        """Apply gravity multiplier to files matching path."""

    def trigger_repositioning(self) -> None:
        """Signal GravityPlacer to recalculate positions."""

    def reprioritize_targets(self, boosted_files: List[str]) -> None:
        """Update AxionCore priority queue."""

    def get_evolution_status(self) -> SwarmState:
        """Get current daemon and orchestrator state."""

    def query_decision_history(self, cycle: int, target: str) -> Dict:
        """Retrieve explanation from EvolutionTracker."""
```

**Acceptance Criteria**:
- [ ] Value weights modified within 1 second
- [ ] Repositioning triggered on weight change
- [ ] Target priority updated in AxionCore
- [ ] Daemon responds to control signals

### RES-004: ResonanceAPI

**Priority**: High
**Status**: Required

REST and WebSocket API for bridge access.

| Requirement | Description |
|-------------|-------------|
| RES-004.1 | POST /intent - Submit natural language intent |
| RES-004.2 | GET /status - Current swarm state |
| RES-004.3 | GET /history - Recent intents and results |
| RES-004.4 | WebSocket /stream - Real-time updates |
| RES-004.5 | Authentication via API keys |
| RES-004.6 | Rate limiting (60 requests/minute) |
| RES-004.7 | Request validation |
| RES-004.8 | Error responses with guidance |

**API Endpoints**:
```
POST /api/resonance/intent
  Body: {"text": "Focus on security for 1 hour"}
  Response: {"result": OperationResult}

GET /api/resonance/status
  Response: {"state": SwarmState}

GET /api/resonance/history?limit=10
  Response: {"intents": List[IntentLog]}

WS /api/resonance/stream
  Events: {"type": "boost_applied", "data": {...}}
```

**Acceptance Criteria**:
- [ ] API responds within 500ms
- [ ] WebSocket streams events within 100ms
- [ ] Rate limiting enforced
- [ ] API key required for all endpoints

### RES-005: ResonanceCLI

**Priority**: High
**Status**: Required

Command-line interface for bridge access.

| Requirement | Description |
|-------------|-------------|
| RES-005.1 | `resonance focus <target> [--duration D] [--multiplier M]` |
| RES-005.2 | `resonance query <question>` |
| RES-005.3 | `resonance suggest <description>` |
| RES-005.4 | `resonance status` |
| RES-005.5 | `resonance history [--limit N]` |
| RES-005.6 | `resonance pause` |
| RES-005.7 | `resonance resume` |
| RES-005.8 | Colored output with status indicators |

**CLI Examples**:
```bash
# Focus evolution on security
resonance focus safety/ --duration 1h

# Ask about a decision
resonance query "Why did you refactor consensus_engine.py?"

# Suggest an improvement
resonance suggest "Add caching to gravity calculation"

# Check status
resonance status

# View history
resonance history --limit 5
```

**Acceptance Criteria**:
- [ ] Commands execute within 1 second
- [ ] Output is human-readable with colors
- [ ] Errors provide actionable guidance
- [ ] Help text available for all commands

## Intent Types

### GRAVITY_FOCUS
Direct evolution pressure to a specific area.

**Triggers**: "focus on", "direct to", "concentrate on", "prioritize"

**Example**:
```
Input:  "Focus on the security layer for 30 minutes"
Output: boost_gravity("safety/", 2.0, 30min)
```

### GRAVITY_QUERY
Ask about swarm decisions.

**Triggers**: "why", "what", "how", "explain", "tell me about"

**Example**:
```
Input:  "Why did you refactor the consensus engine in cycle 38?"
Output: query_evolution(38, "consensus_engine.py")
```

### GRAVITY_SUGGEST
Propose a collaborative improvement.

**Triggers**: "add", "improve", "refactor", "optimize", "suggest"

**Example**:
```
Input:  "Add caching to reduce repeated computations"
Output: propose_change("Add caching to reduce repeated computations", priority=NORMAL)
```

### GRAVITY_STATUS
Get current swarm state.

**Triggers**: "status", "state", "current", "how is", "what's the"

**Example**:
```
Input:  "What's the current status?"
Output: get_status()
```

### GRAVITY_PAUSE
Pause evolution daemon.

**Triggers**: "pause", "stop", "halt"

**Example**:
```
Input:  "Pause evolution"
Output: pause_evolution()
```

### GRAVITY_RESUME
Resume evolution daemon.

**Triggers**: "resume", "continue", "start"

**Example**:
```
Input:  "Resume evolution"
Output: resume_evolution()
```

## Safety Requirements

### SAFETY-001: Confirmation for Modifications

| Requirement | Description |
|-------------|-------------|
| SAFETY-001.1 | GRAVITY_FOCUS requires confirmation |
| SAFETY-001.2 | GRAVITY_SUGGEST requires confirmation |
| SAFETY-001.3 | GRAVITY_PAUSE requires confirmation |
| SAFETY-001.4 | Read-only operations don't require confirmation |

### SAFETY-002: Limits

| Requirement | Description |
|-------------|-------------|
| SAFETY-002.1 | Maximum boost duration: 24 hours |
| SAFETY-002.2 | Maximum boost multiplier: 5.0 |
| SAFETY-002.3 | Rate limit: 60 intents per minute |
| SAFETY-002.4 | Maximum concurrent boosts: 5 |

### SAFETY-003: Audit

| Requirement | Description |
|-------------|-------------|
| SAFETY-003.1 | All intents logged with timestamp |
| SAFETY-003.2 | All operations logged with result |
| SAFETY-003.3 | Boost expiration logged |
| SAFETY-003.4 | Audit log immutable |

## Performance Requirements

| Metric | Target |
|--------|--------|
| Intent parsing | <100ms |
| Operation execution | <1s |
| Gravity boost application | <5s |
| Query response | <1s |
| API response time | <500ms |

## Success Criteria

| Metric | Target |
|--------|--------|
| Intent recognition accuracy | >90% |
| First conversation success | Complete |
| User satisfaction | "Feels natural" |
| Zero unintended modifications | 100% |
