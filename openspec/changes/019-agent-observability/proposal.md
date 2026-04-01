# Proposal: Agent Observability

## Summary
Add per-agent monitoring with metric time-series, log aggregation, alert rules, and an audit trail so operators can understand what each agent is doing and detect problems.

## Problem
- No per-agent metrics (CPU, memory, task count, error rate)
- No agent log streaming -- agents are silent until they break
- Alert rules are cell-level only, not agent-level
- No audit trail of agent registration, heartbeat loss, or actions

## Solution
Layer observability on top of the agent registry:

- **Per-agent metric time-series**: extend TimeSeriesStore with agent-scoped keys (agent:{id}:cpu, agent:{id}:memory, agent:{id}:tasks, agent:{id}:errors)
- **Agent log aggregation**: agents POST to `POST /api/v1/agents/:id/logs`, server stores last N entries per agent, WebSocket streams new log entries to subscribers
- **Agent alert rules**: built-in rules for agent-down (no heartbeat in N seconds), error-spike (error rate exceeds threshold), timeout (task running too long)
- **Audit trail**: log all agent registration, heartbeat loss, status transitions to data/audit.jsonl

## Dependencies
- 017-agent-registry (agent model, registry, heartbeat)
- Existing time-series and alerting infrastructure

## Timeline
- Task 1: Agent metric ingestion and storage (~15 min)
- Task 2: Agent log endpoints and streaming (~15 min)
- Task 3: Agent-specific alert rules (~10 min)
- Task 4: Audit trail logging (~10 min)
- Task 5: API endpoints (~10 min)
- Task 6: Tests (~15 min)
- Task 7: Documentation (~5 min)

**Total: ~80 minutes**
