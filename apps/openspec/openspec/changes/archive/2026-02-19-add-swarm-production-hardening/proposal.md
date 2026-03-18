## Why

The Multi-Agent Swarm has been successfully verified with scalability, autonomy, and correctness tests. However, it lacks production-ready infrastructure for task orchestration, health monitoring, and error recovery. This prevents real-world workloads like distributed catalog scanning.

## What Changes

- Add CoordinatorAgent for centralized task queue management with retry logic
- Add HealthDashboard for real-time agent health monitoring and alerting
- Add ScannerAgent as specialized catalog scanning worker
- Add error recovery with automatic task reassignment on agent failure
- Add integration tests for the full production pipeline

## Impact

- Affected specs: swarm-production (NEW)
- Affected code:
  - `systems/visual_shell/swarm/coordinator_agent.py` (NEW)
  - `systems/visual_shell/swarm/health_dashboard.py` (NEW)
  - `systems/visual_shell/swarm/scanner_agent.py` (NEW)
  - `tests/system/test_swarm_capabilities.py` (MODIFIED)
