# Agent Task Queue

A task abstraction that bridges operator intent with agent execution. Operators create tasks, agents claim and complete them.

## Task Model

Each task has the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique task identifier |
| `agentId` | string or null | ID of the agent that claimed the task |
| `status` | string | One of: `pending`, `running`, `completed`, `failed` |
| `payload` | object | JSON-serializable task description |
| `result` | any or null | Result data set on completion |
| `error` | string or null | Error message set on failure |
| `priority` | number | 0=low, 1=normal (default), 2=high |
| `createdAt` | string (ISO 8601) | Creation timestamp |
| `startedAt` | string or null | When the task was claimed |
| `completedAt` | string or null | When the task was completed or failed |

Tasks are sorted by priority descending, then `createdAt` ascending. High-priority tasks are claimed first; ties broken by age (oldest first).

---

## REST API

### POST /api/v1/tasks

Create a new task.

```bash
curl -X POST http://localhost:3839/api/v1/tasks \
  -H 'Content-Type: application/json' \
  -d '{"payload": {"action": "analyze", "target": "server-01"}, "priority": 2}'
```

Response (201):
```json
{
  "id": "a1b2c3d4-...",
  "agentId": null,
  "status": "pending",
  "payload": {"action": "analyze", "target": "server-01"},
  "result": null,
  "error": null,
  "priority": 2,
  "createdAt": "2026-04-01T12:00:00.000Z",
  "startedAt": null,
  "completedAt": null
}
```

### GET /api/v1/tasks

List tasks with optional filters.

```bash
# All tasks
curl http://localhost:3839/api/v1/tasks

# Filter by status
curl 'http://localhost:3839/api/v1/tasks?status=pending'

# Filter by agent
curl 'http://localhost:3839/api/v1/tasks?agentId=agent-007'

# Both filters
curl 'http://localhost:3839/api/v1/tasks?status=running&agentId=agent-007'
```

Response (200): array of task objects, sorted by priority desc, createdAt asc.

### GET /api/v1/tasks/:id

Get a single task by ID.

```bash
curl http://localhost:3839/api/v1/tasks/a1b2c3d4-...
```

Response (200): task object, or 404 if not found.

### PUT /api/v1/tasks/:id/claim

An agent claims a pending task.

```bash
curl -X PUT http://localhost:3839/api/v1/tasks/a1b2c3d4-.../claim \
  -H 'Content-Type: application/json' \
  -d '{"agentId": "agent-007"}'
```

Response (200): task with `status: "running"`, `agentId` and `startedAt` set.
Returns 404 if task not found, 409 if task is not pending.

### PUT /api/v1/tasks/:id/complete

Mark a task as completed with a result.

```bash
curl -X PUT http://localhost:3839/api/v1/tasks/a1b2c3d4-.../complete \
  -H 'Content-Type: application/json' \
  -d '{"result": {"score": 0.95, "anomalies": 3}}'
```

Response (200): task with `status: "completed"`, `result` and `completedAt` set.

### PUT /api/v1/tasks/:id/fail

Mark a task as failed with an error message.

```bash
curl -X PUT http://localhost:3839/api/v1/tasks/a1b2c3d4-.../fail \
  -H 'Content-Type: application/json' \
  -d '{"error": "Connection refused: server-01 unreachable"}'
```

Response (200): task with `status: "failed"`, `error` and `completedAt` set.

### GET /api/v1/tasks/stats

Get queue statistics.

```bash
curl http://localhost:3839/api/v1/tasks/stats
```

Response (200):
```json
{
  "pending": 5,
  "running": 2,
  "completed": 10,
  "failed": 1
}
```

---

## Queue Visualization Formulas

The formula engine provides three functions for rendering task queue state in dashboards.

### TASK_QUEUE_STATUS()

Returns a formatted string with counts for all statuses.

```
TASK_QUEUE_STATUS()
// "pending:5 running:2 completed:10 failed:1"
```

Use in a template:
```json
{"fn": "TEXT", "args": [0, 2, "task_queue_status"]}
```

### TASK_COUNT(status?)

Returns the count for a given status, or total if omitted.

```
TASK_COUNT('pending')    // 5
TASK_COUNT('running')    // 2
TASK_COUNT('completed')  // 10
TASK_COUNT('failed')     // 1
TASK_COUNT()             // 18 (total)
```

Use in a template with NUMBER:
```json
{"fn": "NUMBER", "args": [10, 3, "task_count_pending", "0"]}
```

The `status` argument can be a cell reference. If the cell `task_status` holds `"pending"`, then `TASK_COUNT('task_status')` resolves to the pending count.

### TASK_LIST(status?)

Returns a comma-separated string of task IDs for a given status (or all if omitted).

```
TASK_LIST('pending')    // "uuid1,uuid2,uuid3"
TASK_LIST()             // "uuid1,uuid2,...,uuid18"
```

Like `TASK_COUNT`, the status argument accepts cell references.

### Dashboard Template

A pre-built template is available at `templates/task-queue.json`:

```bash
curl -X POST http://localhost:3839/api/v1/template \
  -H 'Content-Type: application/json' \
  -d @templates/task-queue.json
```

It renders a queue overview with status labels, counts, and a completion rate bar.

---

## Agent SDK

### JavaScript SDK (`agents/sdk.js`)

```javascript
import { AgentSDK } from './agents/sdk.js';

const sdk = new AgentSDK({ baseUrl: 'http://localhost:3839' });

// Register the agent first
const agent = await sdk.register('my-agent', {
  capabilities: ['analysis', 'monitoring']
});

// Create a task
const task = await sdk.createTask(
  { action: 'analyze', target: 'server-01' },
  2  // priority: 0=low, 1=normal, 2=high
);

// Claim the highest-priority pending task
const claimed = await sdk.claimTask();
if (claimed) {
  // Do work...
  await sdk.completeTask(claimed.id, { score: 0.95 });
  // Or on error:
  // await sdk.failTask(claimed.id, 'Something went wrong');
}
```

Methods:
- `createTask(payload, priority?)` -- create a task in the queue
- `claimTask()` -- claim the highest-priority pending task (requires registration)
- `completeTask(taskId, result?)` -- mark a task as completed
- `failTask(taskId, error)` -- mark a task as failed

### Python SDK (`agents/sdk.py`)

```python
from agents.sdk import AgentSDK

sdk = AgentSDK(base_url="http://localhost:3839")

# Register the agent first
agent = sdk.register("my-agent", capabilities=["analysis", "monitoring"])

# Create a task
task = sdk.create_task(
    {"action": "analyze", "target": "server-01"},
    priority=2  # 0=low, 1=normal, 2=high
)

# Claim the highest-priority pending task
claimed = sdk.claim_task()
if claimed:
    # Do work...
    sdk.complete_task(claimed["id"], {"score": 0.95})
    # Or on error:
    # sdk.fail_task(claimed["id"], "Something went wrong")
```

Methods:
- `create_task(payload, priority=None)` -- create a task in the queue
- `claim_task()` -- claim the highest-priority pending task (requires registration)
- `complete_task(task_id, result=None)` -- mark a task as completed
- `fail_task(task_id, error)` -- mark a task as failed

---

## Task Lifecycle

```
                  claim(agentId)
   ┌──────────┐ ──────────────► ┌──────────┐
   │ pending  │                 │ running  │
   └──────────┘                 └──────────┘
                                     │
                          ┌──────────┴──────────┐
                     complete(result)      fail(error)
                          │                     │
                     ┌────▼────┐          ┌─────▼────┐
                     │completed│          │  failed  │
                     └─────────┘          └──────────┘
```

1. An operator (or agent) creates a task via `POST /api/v1/tasks`
2. An agent claims the task via `PUT /api/v1/tasks/:id/claim`
3. The agent does the work, then either:
   - Completes: `PUT /api/v1/tasks/:id/complete`
   - Fails: `PUT /api/v1/tasks/:id/fail`

## Persistence

Tasks are persisted to `data/tasks.json` and reloaded on server restart. The store uses an in-memory Map for fast access during runtime.
