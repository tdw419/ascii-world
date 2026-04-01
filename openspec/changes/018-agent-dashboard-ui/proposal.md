# Proposal: Agent Dashboard UI

## Summary
Build agent-specific dashboard components that surface agent identity, status, and metrics within the ascii-world rendering engine.

## Problem
- No way to see which agents are connected from the dashboard
- Agents are invisible -- only their cell data is visible
- No agent-centric formula functions for dashboard builders
- Dashboard templates cannot reference agent state

## Solution
Add React-style components and formula functions for agent visualization:

- **Agent Card component**: shows agent name, status badge (green/yellow/red), last activity timestamp, capability tags
- **Agent Grid view**: renders all registered agents as a card grid at a glance
- **Agent Detail view**: deep-dive page for a single agent showing metrics sparklines, recent logs, task history
- **Formula functions**:
  - `AGENT_STATUS(agentId)` -- returns "online"|"offline"|"error"
  - `AGENT_LIST()` -- returns comma-separated list of registered agent IDs
  - `AGENT_METRIC(agentId, metricName)` -- returns latest metric value

## Dependencies
- 017-agent-registry (needs Agent model and API)

## Timeline
- Task 1: Agent formula functions (~15 min)
- Task 2: Agent Card component (~15 min)
- Task 3: Agent Grid view (~10 min)
- Task 4: Agent Detail view (~15 min)
- Task 5: Integration tests (~10 min)
- Task 6: Documentation (~5 min)

**Total: ~70 minutes**
