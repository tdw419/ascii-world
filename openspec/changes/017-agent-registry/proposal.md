# Proposal: Agent Registry

## Summary
Introduce a formal Agent data model and registry so autonomous agents are first-class citizens in ascii-world-core rather than anonymous data sources posting to cells.

## Problem
- Agents currently post to cells via REST API with no identity
- No way to list, track, or manage connected agents
- No heartbeat or liveness detection
- No capability discovery (what can an agent do?)
- The Python agent SDK is a thin HTTP wrapper with no registration flow

## Solution
Create an Agent class and AgentRegistry that gives every agent a persistent identity:

- **Agent model**: id, name, status (online/offline/error), capabilities[], lastHeartbeat, config, createdAt
- **AgentRegistry**: in-memory map backed by persistent JSON file (data/agents.json)
- **REST API**:
  - `POST /api/v1/agents` -- register a new agent
  - `GET /api/v1/agents` -- list all registered agents
  - `GET /api/v1/agents/:id` -- get single agent details
  - `PUT /api/v1/agents/:id/heartbeat` -- heartbeat ping
- **Agent SDK updates** (Python + JS): `register(name, capabilities)`, `heartbeat()`, `reportMetric(key, value)`

## Dependencies
- None (foundational -- other agent changes depend on this)

## Timeline
- Task 1: Agent data model and registry (~15 min)
- Task 2: REST API endpoints (~15 min)
- Task 3: Heartbeat and liveness tracking (~10 min)
- Task 4: Python SDK updates (~10 min)
- Task 5: JS SDK additions (~10 min)
- Task 6: Tests (~15 min)
- Task 7: Documentation (~5 min)

**Total: ~80 minutes**
