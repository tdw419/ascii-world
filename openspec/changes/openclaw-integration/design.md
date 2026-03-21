# Design: OpenClaw Integration

## Architecture

```
┌─────────────────────┐
│  OpenClaw Gateway   │
│                     │
│  - Agents           │
│  - Messages         │
│  - Tools            │
└──────────┬──────────┘
           │
           │ Publish state
           ▼
┌─────────────────────┐
│  pxOS Server        │
│  localhost:3839     │
│                     │
│  Cells:             │
│  - agents: 3        │
│  - messages: 45     │
│  - tools: 12        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Browser Viewer     │
│  /pxos command      │
└─────────────────────┘
```

## OpenClaw Cells

| Cell | Description |
|------|-------------|
| `oc_agents` | Active agent count |
| `oc_messages` | Message queue depth |
| `oc_tools` | Tool calls per minute |
| `oc_memory` | Context memory usage |
| `oc_uptime` | Gateway uptime |

## Implementation

### 1. OpenClaw Publisher Script

```javascript
// In OpenClaw Gateway
const PXOS_URL = 'http://localhost:3839';

async function publishState(state) {
  await fetch(`${PXOS_URL}/api/v1/cells`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oc_agents: state.agents.length,
      oc_messages: state.messageQueue,
      oc_tools: state.toolCalls,
      oc_memory: state.memoryUsage,
      oc_uptime: process.uptime(),
    }),
  });
}
```

### 2. OpenClaw Template

```bash
curl -X POST http://localhost:3839/api/v1/template \
  -d '[
    {"fn": "TEXT", "args": [0, 0, "title"]},
    {"fn": "TIME", "args": [70, 0, "HH:mm:ss"]},
    {"fn": "LINE", "args": [0, 1, 80, "h", "borderHighlight"]},
    {"fn": "TEXT", "args": [0, 2, "agents_label"]},
    {"fn": "NUMBER", "args": [12, 2, "oc_agents", "0"]},
    {"fn": "TEXT", "args": [0, 3, "messages_label"]},
    {"fn": "NUMBER", "args": [12, 3, "oc_messages", "0"]},
    {"fn": "TEXT", "args": [0, 4, "tools_label"]},
    {"fn": "NUMBER", "args": [12, 4, "oc_tools", "0/min"]},
    {"fn": "TEXT", "args": [40, 2, "memory_label"]},
    {"fn": "NUMBER", "args": [52, 2, "oc_memory", "0.0 MB"]}
  ]'
```

### 3. Configuration

Add to `openclaw.json`:

```json
{
  "pxos": {
    "enabled": true,
    "port": 3839,
    "publishInterval": 1000
  }
}
```

### 4. Startup

OpenClaw can start pxOS automatically:

```bash
# In OpenClaw startup
if config.pxos.enabled:
    subprocess.Popen(['node', 'pxos/bin/pxos-server.js', str(config.pxos.port)])
```
