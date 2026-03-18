# Cognitive IDE Specification

## Overview

This specification defines the requirements for the Cognitive IDE - the first
Neural Application running on the Geometry OS swarm substrate.

## Requirements

### IDE-001: ResearcherAgent

**Priority:** Critical
**Status:** Required**

Agent that scans and understands existing codebase patterns.

| Requirement | Description |
|-------------|-------------|
| IDE-001.1 | Scan infinite map for relevant code files |
| IDE-001.2 | Extract function signatures and type hints |
| IDE-001.3 | Identify existing patterns (auth, API, etc.) |
| IDE-001.4 | Generate embeddings for code regions |
| IDE-001.5 | Produce ResearchReport with findings |

**ResearchReport Structure:**
```python
@dataclass
class ResearchReport:
    request_id: str
    relevant_files: List[FileInfo]
    patterns_found: List[CodePattern]
    dependencies: List[Dependency]
    context_embeddings: Dict[str, np.ndarray]
    confidence: float
```

**Acceptance Criteria:**
- [ ] Scans correct file types (.py, .js, .ts, etc.)
- [ ] Extracts accurate signatures
- [ ] Identifies at least 80% of relevant patterns
- [ ] Embeddings capture semantic meaning

### IDE-002: ArchitectAgent

**Priority:** Critical
**Status:** Required**

Agent that designs code structure and interfaces.

| Requirement | Description |
|-------------|-------------|
| IDE-002.1 | Generate attention map over dependencies |
| IDE-002.2 | Design module interfaces |
| IDE-002.3 | Plan file structure for implementation |
| IDE-002.4 | Create implementation specification |
| IDE-002.5 | Submit design to consensus |

**DesignSpec Structure:**
```python
@dataclass
class DesignSpec:
    request_id: str
    files_to_create: List[FileSpec]
    files_to_modify: List[FileSpec]
    interfaces: List[Interface]
    dependencies: List[Dependency]
    design_rationale: str
```

**Acceptance Criteria:**
- [ ] Design follows existing patterns
- [ ] Interfaces are well-defined
- [ ] File structure is logical
- [ ] Consensus achieved on design

### IDE-003: ImplementerAgent

**Priority:** Critical
**Status:** Required**

Agent that writes actual code from specifications.

| Requirement | Description |
|-------------|-------------|
| IDE-003.1 | Generate code from DesignSpec |
| IDE-003.2 | Follow existing code style patterns |
| IDE-003.3 | Implement across multiple files |
| IDE-003.4 | Coordinate via Collective Consciousness |
| IDE-003.5 | Handle merge conflicts gracefully |

**CodeArtifact Structure:**
```python
@dataclass
class CodeArtifact:
    artifact_id: str
    file_path: str
    content: str
    language: str
    imports: List[str]
    exports: List[str]
    tests_included: bool
```

**Acceptance Criteria:**
- [ ] Code compiles/runs without errors
- [ ] Style matches project conventions
- [ ] Handles edge cases
- [ ] Includes type hints where applicable

### IDE-004: ValidatorAgent

**Priority:** Critical
**Status:** Required**

Agent that verifies code correctness and quality.

| Requirement | Description |
|-------------|-------------|
| IDE-004.1 | Generate tests for new code |
| IDE-004.2 | Execute tests and capture results |
| IDE-004.3 | Scan for security vulnerabilities |
| IDE-004.4 | Verify type signatures |
| IDE-004.5 | Measure code coverage |

**ValidationReport Structure:**
```python
@dataclass
class ValidationReport:
    request_id: str
    tests_passed: int
    tests_failed: int
    coverage_percent: float
    security_issues: List[SecurityIssue]
    style_violations: List[StyleViolation]
    overall_score: float
```

**Acceptance Criteria:**
- [ ] All generated tests pass
- [ ] Coverage >80% for new code
- [ ] No critical security issues
- [ ] Style violations <5

### IDE-005: Cognitive IDE Orchestrator

**Priority:** Critical
**Status:** Required**

Central coordinator for IDE workflow.

| Requirement | Description |
|-------------|-------------|
| IDE-005.1 | Decompose user requests into tasks |
| IDE-005.2 | Sequence phases (Research→Design→Implement→Validate) |
| IDE-005.3 | Check consensus at each phase |
| IDE-005.4 | Handle iteration when validation fails |
| IDE-005.5 | Produce final PR-ready output |

**Workflow State Machine:**
```
IDLE → RESEARCHING → DESIGNING → IMPLEMENTING → VALIDATING → COMPLETE
                      ↓              ↓              ↓
                   (consensus)    (consensus)    (pass/fail)
                      ↓              ↓              ↓
                    FAILED        FAILED      FAILED (iterate)
```

**Acceptance Criteria:**
- [ ] Correct phase sequencing
- [ ] Consensus checkpoints work
- [ ] Iteration improves code
- [ ] Final output is PR-ready

### IDE-006: Dashboard Integration

**Priority:** High
**Status:** Required**

Visual oversight of IDE activity.

| Requirement | Description |
|-------------|-------------|
| IDE-006.1 | IDE status panel with phase indicator |
| IDE-006.2 | Agent activity visualization |
| IDE-006.3 | Code diff preview |
| IDE-006.4 | Consensus progress bar |
| IDE-006.5 | Validation results display |

**Acceptance Criteria:**
- [ ] Real-time updates (<100ms)
- [ ] Clear phase indication
- [ ] Readable diffs
- [ ] Progress visible

## Integration Points

### Swarm Stack Integration

```
CognitiveIDE
    │
    ├──► ResearcherAgent
    │        └──► ScannerAgent (existing)
    │        └──► ThoughtEngine (existing)
    │
    ├──► ArchitectAgent
    │        └──► ConsensusEngine (existing)
    │
    ├──► ImplementerAgent
    │        └──► Sandbox (existing)
    │        └──► MigrationCoordinator (existing)
    │
    ├──► ValidatorAgent
    │        └──► Sandbox (existing)
    │
    └──► Dashboard (existing)
```

### Security Integration

```
All code execution → Sandbox (isolated)
All file writes → AuditLogger (audit trail)
All consensus → TaskSigner (signed decisions)
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Research phase | <30 seconds |
| Design phase | <20 seconds |
| Implementation | <60 seconds |
| Validation | <30 seconds |
| Total (simple task) | <3 minutes |
| Total (complex task) | <5 minutes |

## Quality Requirements

| Metric | Target |
|--------|--------|
| Test pass rate | 100% |
| Code coverage | >80% |
| Security issues | 0 critical |
| Style compliance | >95% |
| Consensus rate | >80% |

## Example Workflows

### Simple: Add Health Endpoint

```
Request: "Add a /health endpoint that returns status"

Research (10s): Find existing endpoints, patterns
Design (5s): Single file, simple route
Implement (10s): Write route, basic test
Validate (5s): Run test, check style
Output: api/routes/health.py, tests/test_health.py
```

### Complex: Add OAuth2

```
Request: "Add OAuth2 authentication to the API"

Research (30s): Find auth patterns, dependencies
Design (20s): Multiple files, interfaces, config
Consensus: 4/5 agents agree
Implement (60s): Auth module, middleware, tests
Validate (30s): Security scan, coverage, integration tests
Output: auth/oauth2.py, middleware/auth.py, tests/, config/
```
