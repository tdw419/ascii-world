# Proposal: Agent Task Queue

## Summary
Introduce a task model and queue so agents can receive assignments, report results, and operators can visualize task progress.

## Problem
- No way to assign work to agents
- No task tracking -- agents do things opaquely
- No queue visualization showing pending/running/completed tasks
- No result reporting from agents back to the dashboard

## Solution
Add a task abstraction that bridges operator intent with agent execution:

- **Task model**: id, agentId, status (pending/running/completed/failed), payload (JSON), result (JSON), createdAt, startedAt, completedAt, error
- **REST API**:
  - `POST /api/v1/tasks` -- create a task (optionally assign to agent)
  - `GET /api/v1/tasks` -- list tasks (filter by status, agentId)
  - `GET /api/v1/tasks/:id` -- get task details
  - `PUT /api/v1/tasks/:id/claim` -- agent claims a pending task
  - `PUT /api/v1/tasks/:id/complete` -- agent reports result
- **Queue visualization**: formula functions `TASK_QUEUE_STATUS()` returns pending/running/complete counts, rendered in dashboard
- **Agent SDK**: `claimTask()`, `completeTask(taskId, result)`

## Dependencies
- 017-agent-registry (agent identity)

## Timeline
- Task 1: Task data model and store (~15 min)
- Task 2: Task REST API endpoints (~15 min)
- Task 3: Task claim and completion flow (~10 min)
- Task 4: Queue visualization formulas (~10 min)
- Task 5: Agent SDK task methods (~10 min)
- Task 6: Tests (~15 min)
- Task 7: Documentation (~5 min)

**Total: ~80 minutes**
