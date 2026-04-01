# pxOS Integration Guide

## OpenClaw Integration

### Quick Start

1. Start pxOS server:
```bash
cd pxos
npm start
```

2. In your OpenClaw Gateway, import the publisher:

```javascript
import { OpenClawPublisher } from './pxos/integrations/openclaw/publisher.js';

const pxos = new OpenClawPublisher('http://localhost:3839');

// Set template on startup
await pxos.setTemplate();

// Publish state periodically
setInterval(async () => {
    await pxos.publish({
        agents: getActiveAgents(),
        messageQueue: getMessageQueue(),
        toolCalls: getToolCalls(),
        memoryUsage: process.memoryUsage().heapUsed,
        uptime: process.uptime(),
    });
}, 1000);
```

3. Open viewer:
```bash
open pxos/viewer/viewer.html
```

### Configuration

Add to `openclaw.json`:

```json
{
  "pxos": {
    "enabled": true,
    "url": "http://localhost:3839",
    "publishInterval": 1000
  }
}
```

### Displayed Metrics

| Metric | Cell | Description |
|--------|------|-------------|
| Agents | `oc_agents` | Active agent count |
| Messages | `oc_messages` | Queue depth |
| Tools | `oc_tools` | Calls per minute |
| Memory | `oc_memory` | Heap usage (MB) |
| Uptime | `oc_uptime` | Gateway uptime |

---

## Custom Integration

### Basic Usage

```javascript
// 1. Set template
await fetch('http://localhost:3839/api/v1/template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
        { fn: 'BAR', args: [0, 0, 'cpu', 40] },
        { fn: 'TEXT', args: [42, 0, 'cpu'] },
    ]),
});

// 2. Publish data
await fetch('http://localhost:3839/api/v1/cells', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpu: 0.75 }),
});

// 3. Get rendered PNG
const res = await fetch('http://localhost:3839/api/v1/render');
const png = await res.arrayBuffer();
```

### WebSocket Updates

```javascript
const ws = new WebSocket('ws://localhost:3839');
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'cells') {
        console.log('Updated cells:', msg.changes);
    }
    if (msg.type === 'alert') {
        console.log('Alert:', msg.alert.message);
    }
};
```

---

## Agent Registry

Agents are first-class citizens in pxOS. The Agent Registry gives every connected agent a persistent identity, tracks liveness via heartbeats, and exposes capability discovery.

### Data Model

Each agent is a JSON object with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique agent identifier, auto-generated on registration |
| `name` | string | **Required.** Display name for the agent |
| `status` | string | One of: `online`, `offline`, `error` |
| `capabilities` | string[] | List of capability tags (e.g. `["cpu", "memory", "disk"]`) |
| `lastHeartbeat` | string (ISO 8601) | Timestamp of last heartbeat, or `null` |
| `config` | object | Arbitrary agent configuration |
| `createdAt` | string (ISO 8601) | Registration timestamp |

Agents are persisted to `data/agents.json` and reloaded on server startup.

### Liveness Checking

The server runs a background liveness check (every 30s by default):

- No heartbeat or heartbeat older than **60s** → agent marked `offline`
- Heartbeat older than **120s** → agent marked `error`
- Status transitions emit `agent:offline` and `agent:error` events on the registry

### REST API

#### POST /api/v1/agents — Register a new agent

```bash
curl -X POST http://localhost:3839/api/v1/agents \
  -H 'Content-Type: application/json' \
  -d '{"name": "System Monitor", "capabilities": ["cpu", "memory"], "config": {"interval": 1.0}}'
# 201 — returns agent object with generated id
```

**Required fields:** `name`

**Validation errors** return `400` with `{ "error": "name is required" }`.

#### GET /api/v1/agents — List all agents

```bash
curl http://localhost:3839/api/v1/agents
# 200 — returns array of agent objects
```

#### GET /api/v1/agents/:id — Get a single agent

```bash
curl http://localhost:3839/api/v1/agents/<agent-id>
# 200 — returns agent object
# 404 — { "error": "Agent not found" }
```

#### PUT /api/v1/agents/:id/heartbeat — Send heartbeat

```bash
curl -X PUT http://localhost:3839/api/v1/agents/<agent-id>/heartbeat
# 200 — { "ok": true }
# 404 — { "error": "Agent not found" }
```

Sets the agent's `status` to `online` and updates `lastHeartbeat`.

#### DELETE /api/v1/agents/:id — Remove an agent

```bash
curl -X DELETE http://localhost:3839/api/v1/agents/<agent-id>
# 204 — no body
# 404 — { "error": "Agent not found" }
```

### Python SDK

The `agents/sdk.py` module provides `AgentSDK` for Python agents:

```python
from sdk import AgentSDK

# Create SDK instance
sdk = AgentSDK(base_url="http://localhost:3839")

# Register the agent
agent = sdk.register(
    name="My Agent",
    capabilities=["monitor", "cpu"],
    config={"region": "us-east"}
)
print(f"Registered: {agent['id']}")

# Start automatic heartbeat (daemon thread, 30s interval)
sdk.start_heartbeat(interval=30)

# Report metrics via agent-scoped time-series keys
sdk.report_metric("cpu", 0.75)
sdk.report_metric("memory", 0.45)

# Stop heartbeat on shutdown
sdk.stop_heartbeat()
```

**Methods:**

| Method | Description |
|--------|-------------|
| `register(name, capabilities=None, config=None)` | Register with the server. Stores `agent_id` for subsequent calls. |
| `heartbeat()` | Send a single heartbeat ping. Raises if not registered. |
| `start_heartbeat(interval=30)` | Start background heartbeat loop on a daemon thread. |
| `stop_heartbeat()` | Stop the background heartbeat loop. |
| `report_metric(key, value)` | Post a metric as `agent:{id}:{key}` to the time-series store. |

**Reference implementation:** See `agents/system_monitor.py` for a complete example that registers on startup, runs a heartbeat loop, and reports `cpu`/`mem`/`disk` metrics each cycle.

---

## Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3839
CMD ["node", "bin/pxos-server.js"]
```

```bash
docker build -t pxos .
docker run -p 3839:3839 -v $(pwd)/data:/app/data pxos
```

---

## Systemd Service

```ini
[Unit]
Description=pxOS Server
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/pxos
ExecStart=/usr/bin/node bin/pxos-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable pxos
sudo systemctl start pxos
```
