## ADDED Requirements

### Requirement: Task Orchestration

The swarm system SHALL provide a CoordinatorAgent that manages task lifecycle from submission through completion or failure.

#### Scenario: Task submission
- **WHEN** a task is submitted with type and parameters
- **THEN** a unique task ID is generated and the task is queued

#### Scenario: Task assignment
- **WHEN** an agent is available and a task is pending
- **THEN** the task is assigned to the agent and status changes to "assigned"

#### Scenario: Task completion
- **WHEN** an agent completes an assigned task
- **THEN** the task status changes to "completed" and is moved to history

#### Scenario: Task failure with retry
- **WHEN** a task fails and retry count is below maximum
- **THEN** the task is requeued for automatic retry

### Requirement: Health Monitoring

The swarm system SHALL provide a HealthDashboard that tracks agent health status and generates alerts.

#### Scenario: Agent registration
- **WHEN** an agent registers with the dashboard
- **THEN** its health is tracked with initial status "healthy"

#### Scenario: Stale agent detection
- **WHEN** an agent has not sent heartbeat within threshold
- **THEN** its status changes to "stale" and an alert is generated

#### Scenario: Agent offline
- **WHEN** an agent is marked offline
- **THEN** a critical alert is generated

### Requirement: Error Recovery

The swarm system SHALL automatically recover from agent failures by reassigning tasks.

#### Scenario: Agent disconnect during task
- **WHEN** an agent disconnects while working on a task
- **THEN** the task is reassigned to the pending queue

#### Scenario: Max retries exceeded
- **WHEN** a task fails more than the maximum retry count
- **THEN** the task is marked as permanently failed

### Requirement: Catalog Scanning

The swarm system SHALL provide ScannerAgent workers that discover and hash artifacts in assigned regions.

#### Scenario: Region scanning
- **WHEN** a scanner scans its assigned region
- **THEN** all .rts.png artifacts are discovered and reported

#### Scenario: SHA256 verification
- **WHEN** an artifact is scanned
- **THEN** its SHA256 hash is computed and included in results
