# Tasks: Agent Task Queue

## 1. Task Data Model
- [x] 1.1 Create sync/task-model.js with Task class: id (uuid), agentId (nullable), status (pending|running|completed|failed), payload (JSON object), result (JSON, nullable), error (string, nullable), createdAt, startedAt, completedAt, priority (0=low, 1=normal, 2=high)
- [x] 1.2 Add Task.validate(data) static method: ensure payload exists and is valid JSON
- [x] 1.3 Add Task.toJSON() and Task.fromJSON() serialization methods
- [x] 1.4 Add Task.isExpired(timeoutMs) method for timeout detection

## 2. Task Store
- [x] 2.1 Create sync/task-store.js with TaskStore class using Map for in-memory storage
- [x] 2.2 Add create(payload, priority) method: creates pending task, returns Task
- [x] 2.3 Add get(id) method: returns task or null
- [x] 2.4 Add list(filters) method: filter by status, agentId; return array sorted by priority desc, createdAt asc
- [x] 2.5 Add claim(agentId) method: atomically picks highest-priority pending task, sets status=running, agentId, startedAt
- [x] 2.6 Add complete(id, result) method: sets status=completed, result, completedAt
- [x] 2.7 Add fail(id, error) method: sets status=failed, error, completedAt
- [x] 2.8 Add persist() and load() methods for data/tasks.json
- [x] 2.9 Add getStats() method: returns {pending: N, running: N, completed: N, failed: N}

## 3. REST API Endpoints
- [x] 3.1 Add POST /api/v1/tasks to server.js: body {payload, priority?}, calls store.create(), returns 201 with task
- [x] 3.2 Add GET /api/v1/tasks to server.js: query params ?status=&agentId=, calls store.list(filters)
- [x] 3.3 Add GET /api/v1/tasks/:id to server.js: returns task or 404
- [x] 3.4 Add PUT /api/v1/tasks/:id/claim to server.js: body {agentId}, calls store.claim(agentId), returns task or 404
- [x] 3.5 Add PUT /api/v1/tasks/:id/complete to server.js: body {result}, calls store.complete(id, result)
- [x] 3.6 Add PUT /api/v1/tasks/:id/fail to server.js: body {error}, calls store.fail(id, error)
- [x] 3.7 Add GET /api/v1/tasks/stats to server.js: returns store.getStats()

## 4. Queue Visualization
- [x] 4.1 Add TASK_QUEUE_STATUS() formula function: returns {pending, running, completed, failed} counts as formatted string
- [x] 4.2 Add TASK_COUNT(status?) formula function: returns count for given status or total
- [x] 4.3 Add TASK_LIST(status?) formula function: returns comma-separated task IDs for given status
- [x] 4.4 Create templates/task-queue.json: dashboard template showing queue stats as pixel blocks

## 5. Agent SDK Task Methods
- [x] 5.1 Add claimTask() to Python agent SDK: GET pending tasks, PUT claim, returns Task or None
- [x] 5.2 Add completeTask(taskId, result) to Python SDK: PUT complete
- [x] 5.3 Add failTask(taskId, error) to Python SDK: PUT fail
- [x] 5.4 Add createTask(payload, priority) to Python SDK: POST create
- [x] 5.5 Add JS agent SDK equivalent methods in agents/sdk.js

## 6. Tests
- [x] 6.1 Add tests/task-model.test.js: validate, serialize, isExpired
- [x] 6.2 Add tests/task-store.test.js: create, get, list, claim, complete, fail, stats, persist
- [x] 6.3 Add tests/task-api.test.js: all REST endpoints via supertest
- [x] 6.4 Add tests/task-formulas.test.js: TASK_QUEUE_STATUS, TASK_COUNT, TASK_LIST

## 7. Documentation
- [x] 7.1 Update README with Task Queue API reference
- [x] 7.2 Update README with queue visualization formulas
- [x] 7.3 Update README with SDK task methods usage
- [ ] 7.4 Commit and push
