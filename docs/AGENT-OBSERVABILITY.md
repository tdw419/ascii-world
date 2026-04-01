# Agent Observability API Reference

Monitoring, logging, alerting, and audit trail for registered agents.

## Overview

The agent observability stack consists of four subsystems:

1. **Agent Logs** -- Per-agent ring buffer for structured log aggregation
2. **Agent Metrics** -- Time-series metric recording and retrieval per agent
3. **Alert Engine** -- Configurable threshold-based alerting with cooldowns and webhooks
4. **Audit Trail** -- Append-only JSONL event log for compliance and forensics

All endpoints are served by the PxOS HTTP server (default port 3839).

---

## Agent Registry API

### POST /api/v1/agents

Register a new agent.

**Request body:**
```json
{
  "name": "System Monitor",
  "status": "online",
  "capabilities": ["cpu", "mem"],
  "config": { "interval": 5000 }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name (non-empty) |
| `status` | string | no | One of: `online`, `offline`, `error` (default: `offline`) |
| `capabilities` | string[] | no | Capability tags |
| `config` | object | no | Arbitrary configuration object |

**Response:** `201 Created`
```json
{
  "id": "a1b2c3d4-...",
  "name": "System Monitor",
  "status": "online",
  "capabilities": ["cpu", "mem"],
  "lastHeartbeat": null,
  "config": { "interval": 5000 },
  "createdAt": "2026-04-01T12:00:00.000Z"
}
```

**Errors:** `400` if validation fails (missing name, invalid status, etc.)

### GET /api/v1/agents

List all registered agents.

**Response:** `200 OK` -- Array of agent objects.

### GET /api/v1/agents/:id

Get a single agent by ID.

**Response:** `200 OK` -- Agent object.  
**Errors:** `404` if agent not found.

### DELETE /api/v1/agents/:id

Remove an agent from the registry.

**Response:** `204 No Content`  
**Errors:** `404` if agent not found.

### PUT /api/v1/agents/:id/heartbeat

Record a heartbeat for an agent. Sets status to `online` and updates `lastHeartbeat`.

**Response:** `200 OK` -- `{ "ok": true }`  
**Errors:** `404` if agent not found.

**Side effects:**
- If the agent was previously offline/error, an `agent.status-change` audit entry is recorded.
- On status transition, an `agent:log` WebSocket broadcast is emitted.

---

## Agent Logs API

### POST /api/v1/agents/:id/logs

Append a log entry for an agent.

**Request body:**
```json
{
  "level": "info",
  "message": "Scan completed successfully"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | yes | Log message |
| `level` | string | no | One of: `error`, `warn`, `info` (default: `info`) |

**Response:** `201 Created`
```json
{
  "timestamp": 1743504000000,
  "level": "info",
  "message": "Scan completed successfully"
}
```

**Errors:** `400` if message is missing/invalid or level is invalid. `404` if agent not found.

**Side effects:** Broadcasts `{ type: "agent:log", agentId, entry }` via WebSocket.

**Storage:** In-memory ring buffer, 1000 entries per agent (configurable). Oldest entries are evicted when the buffer is full.

### GET /api/v1/agents/:id/logs

Retrieve recent log entries for an agent.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 50 | Max entries to return |
| `level` | string | (all) | Filter by level: `error`, `warn`, `info` |

**Response:** `200 OK`
```json
{
  "agentId": "a1b2c3d4-...",
  "logs": [
    { "timestamp": 1743504000000, "level": "info", "message": "Scan completed" }
  ]
}
```

**Errors:** `404` if agent not found.

---

## Agent Metrics API

### POST /api/v1/agents/:id/metrics

Record a metric data point for an agent. Metrics are stored in the time-series store under the key `agent:{id}:{key}`.

**Request body:**
```json
{
  "key": "cpu",
  "value": 0.72
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | yes | Metric name |
| `value` | any | yes | Numeric or other value |

**Response:** `201 Created` -- `{ "ok": true, "key": "cpu" }`  
**Errors:** `400` if key or value is missing. `404` if agent not found.

### GET /api/v1/agents/:id/metrics

Get the latest value of all metrics for an agent.

**Response:** `200 OK`
```json
{
  "agentId": "a1b2c3d4-...",
  "metrics": {
    "cpu": 0.72,
    "mem": 0.45
  }
}
```

**Errors:** `404` if agent not found.

### GET /api/v1/agents/:id/metrics/:key/history

Get time-series history for a specific metric.

**Response:** `200 OK`
```json
{
  "agentId": "a1b2c3d4-...",
  "key": "cpu",
  "history": [
    { "t": 1743504000000, "v": 0.65 },
    { "t": 1743504010000, "v": 0.72 }
  ]
}
```

**Errors:** `404` if agent not found.

---

## Agent Task Assignment API

### POST /api/v1/agents/:id/tasks

Assign a task to an agent. Records an audit trail entry.

**Request body:**
```json
{
  "taskId": "task-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | string | yes | Task identifier |

**Response:** `201 Created` -- `{ "ok": true, "agentId": "...", "taskId": "task-001" }`  
**Errors:** `400` if taskId is missing. `404` if agent not found.

**Side effects:** Appends `agent.task-assigned` event to the audit trail.

---

## Alert Engine API

### GET /api/v1/alerts

Retrieve all configured alert rules.

**Response:** `200 OK` -- Array of rule objects (see rule schema below).

### POST /api/v1/alerts

Replace all alert rules with a new set.

**Request body:** Array of rule objects.

**Response:** `200 OK` -- `{ "ok": true, "ruleCount": 4 }`

### GET /api/v1/alerts/history

Retrieve recent triggered alerts.

**Response:** `200 OK` -- Array of alert objects (most recent last, max 100).

---

## Built-in Agent Alert Rules

The system provides four built-in agent alert rules, activated via `builtinAgentRules(config)`:

### agent-down

| Property | Value |
|----------|-------|
| Severity | `critical` |
| Scope | `agent` |
| Cooldown | 120s |
| Message | Agent status transitioned to offline or error |

**Triggers when:** `agent.status === 'offline' || agent.status === 'error'`

### agent-heartbeat-miss

| Property | Value |
|----------|-------|
| Severity | `warning` |
| Scope | `agent` |
| Cooldown | 60s |
| Threshold | 60s (configurable) |
| Message | Agent heartbeat missing for > 60s |

**Triggers when:** The time since `agent.lastHeartbeat` exceeds `heartbeatThresholdMs`.

**Config:** `{ heartbeatThresholdMs: 60000 }`

### agent-error-spike

| Property | Value |
|----------|-------|
| Severity | `critical` |
| Scope | `agent` |
| Cooldown | 300s |
| Threshold | 10 errors in 5 min (configurable) |
| Message | Agent error count exceeded 10 in last 300s |

**Triggers when:** The number of error-level log entries in the last `errorSpikeWindowMs` exceeds `errorSpikeThreshold`.

**Config:** `{ errorSpikeWindowMs: 300000, errorSpikeThreshold: 10 }`

**Requires:** An `AgentLogStore` instance passed as the second argument to `checkAgents()`.

### agent-timeout

| Property | Value |
|----------|-------|
| Severity | `critical` |
| Scope | `agent` |
| Cooldown | 600s |
| Threshold | 1 hour (configurable) |
| Message | Agent task exceeded 3600s |

**Triggers when:** Agent is `online` with a `taskStartedAt` timestamp older than `taskTimeoutMs`.

**Config:** `{ taskTimeoutMs: 3600000 }`

### Custom Rules

You can add custom rules by POSTing to `/api/v1/alerts`. Rule schema:

**Cell-scope rule:**
```json
{
  "name": "high-cpu",
  "cell": "agent:agent-1:cpu",
  "operator": ">",
  "threshold": 0.9,
  "severity": "warning",
  "message": "CPU usage above 90%",
  "cooldown": 60,
  "webhook": "https://hooks.example.com/alert",
  "enabled": true
}
```

**Agent-scope rule:**
```json
{
  "name": "custom-check",
  "scope": "agent",
  "severity": "warning",
  "message": "Custom check triggered",
  "cooldown": 120,
  "enabled": true,
  "evaluate": "function(agent) { return agent.config?.flagged === true; }"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Rule identifier |
| `scope` | string | `"agent"` or omitted (cell-scope) |
| `cell` | string | Cell key to evaluate (cell-scope only) |
| `operator` | string | Comparison: `>`, `>=`, `<`, `<=`, `==`, `!=` (cell-scope only) |
| `threshold` | number | Threshold value (cell-scope only) |
| `severity` | string | `warning` or `critical` |
| `message` | string | Alert message template |
| `cooldown` | number | Seconds between repeated alerts for the same rule+target |
| `webhook` | string | Optional URL to POST alert payload to |
| `enabled` | boolean | Whether the rule is active |

---

## Audit Trail API

### GET /api/v1/audit

Query audit trail entries. Returns the most recent entries, optionally filtered by agent.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `agentId` | string | (all) | Filter entries where `data.agentId` matches |
| `limit` | integer | 200 | Max entries to return |

**Response:** `200 OK`
```json
[
  {
    "timestamp": "2026-04-01T12:00:00.000Z",
    "event": "agent.registered",
    "data": {
      "agentId": "a1b2c3d4-...",
      "name": "System Monitor",
      "capabilities": ["cpu", "mem"]
    }
  }
]
```

### Audit Event Types

| Event | Trigger | Data fields |
|-------|---------|-------------|
| `agent.registered` | Agent created via POST /api/v1/agents | `agentId`, `name`, `capabilities` |
| `agent.status-change` | Agent status transitions (heartbeat recovery, liveness check) | `agentId`, `from`, `to` |
| `agent.heartbeat-lost` | Liveness check detects stale heartbeat | `agentId`, `from` |
| `agent.task-assigned` | Task assigned via POST /api/v1/agents/:id/tasks | `agentId`, `taskId` |

### Audit Trail Storage Format

The audit trail is stored as JSONL (JSON Lines) at `data/audit.jsonl`. Each line is a self-contained JSON object:

```jsonl
{"timestamp":"2026-04-01T12:00:00.000Z","event":"agent.registered","data":{"agentId":"a1b2c3d4","name":"Monitor","capabilities":["cpu"]}}
{"timestamp":"2026-04-01T12:00:05.000Z","event":"agent.status-change","data":{"agentId":"a1b2c3d4","from":"offline","to":"online"}}
{"timestamp":"2026-04-01T12:30:00.000Z","event":"agent.heartbeat-lost","data":{"agentId":"a1b2c3d4","from":"online"}}
{"timestamp":"2026-04-01T13:00:00.000Z","event":"agent.task-assigned","data":{"agentId":"a1b2c3d4","taskId":"task-001"}}
```

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 datetime |
| `event` | string | Event type identifier (dotted notation) |
| `data` | object | Event-specific payload |

**Properties:**
- Append-only: entries are never modified or deleted
- Default max read: 200 entries (configurable via constructor `maxReadEntries`)
- Write failures are non-fatal (entry is still returned for in-memory use)

---

## Programmatic Usage

### AgentLogStore

```javascript
import { AgentLogStore } from './sync/agent-log-store.js';

const store = new AgentLogStore({ maxEntries: 1000 });

// Append a log entry
const entry = store.append('agent-1', { level: 'error', message: 'Connection lost' });
// => { timestamp: 1743504000000, level: 'error', message: 'Connection lost' }

// Retrieve logs
const logs = store.getLogs('agent-1', { limit: 20, level: 'error' });

// Clear
store.clear('agent-1');
store.clearAll();
```

### AlertEngine

```javascript
import { AlertEngine, builtinAgentRules } from './sync/alert-engine.js';

const engine = new AlertEngine();

// Load built-in agent rules with custom thresholds
const rules = builtinAgentRules({
  heartbeatThresholdMs: 30_000,  // 30s instead of 60s
  errorSpikeThreshold: 5,        // 5 errors instead of 10
});
engine.setRules(rules);

// Add a custom notifier (e.g., send to Slack)
engine.addNotifier((alert, rule) => {
  console.log(`[${alert.severity}] ${alert.message}`);
});

// Evaluate agent rules
const alerts = engine.checkAgents(agents, logStore);

// Evaluate cell-scope rules
const cellAlerts = engine.check(cells);

// Inspect history
engine.getHistory(50);
```

### AuditTrail

```javascript
import { AuditTrail } from './sync/audit-trail.js';

const trail = new AuditTrail({ filePath: 'data/audit.jsonl', maxReadEntries: 200 });

// Record an event
const entry = trail.append('agent.registered', { agentId: 'a1', name: 'Bot' });

// Query events
const recent = trail.query({ agentId: 'a1', limit: 50 });
```

### AgentRegistry

```javascript
import { AgentRegistry } from './sync/agent-registry.js';

const registry = new AgentRegistry({ filePath: 'data/agents.json' });
registry.load();
registry.startLivenessCheck(30_000); // Check every 30s

// Register
const { agent, errors } = registry.register({ name: 'Bot', capabilities: ['scan'] });

// Heartbeat
registry.heartbeat(agent.id);

// Listen for status changes
registry.addEventListener('agent:offline', (e) => {
  console.log('Agent went offline:', e.detail.agent.id);
});
```

---

## Liveness Checking

The `AgentRegistry` runs periodic liveness checks (default: every 30s). An agent's status is determined by `lastHeartbeat` age:

| Heartbeat Age | Status Transition |
|---------------|-------------------|
| Fresh (< 60s) | Remains `online` |
| Stale (60-120s) | `online` → `offline` |
| Very stale (> 120s) | → `error` |

Status transitions emit `agent:offline` and `agent:error` events on the registry, which the server hooks into to record audit trail entries.

---

## File Reference

| File | Purpose |
|------|---------|
| `sync/agent-registry.js` | Agent CRUD, persistence, liveness checking |
| `sync/agent-model.js` | Agent data model with validation and serialization |
| `sync/agent-log-store.js` | Per-agent ring buffer log store |
| `sync/alert-engine.js` | Threshold alerting engine with rules, cooldowns, webhooks |
| `sync/audit-trail.js` | Append-only JSONL audit trail |
| `sync/time-series-store.js` | Time-series metric storage |
| `sync/server.js` | HTTP server with all REST endpoints |
| `ui/agent-card.js` | Pixel-rendered agent status card |
| `ui/agent-grid.js` | Grid layout for multiple agent cards |
| `ui/agent-detail.js` | Full agent detail view with metrics and logs |
| `docs/AGENT-DASHBOARD.md` | Dashboard UI and formula function reference |
