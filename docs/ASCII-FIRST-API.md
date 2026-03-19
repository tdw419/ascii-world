# ASCII-First API Reference

## HTTP Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{ "status": "healthy" }
```

### GET /view

Get the current ASCII screen.

**Response:** Plain text ASCII (80x24 grid)

**Example:**
```bash
curl http://localhost:3421/view
```

### POST /control

Execute an action by label.

**Request:**
```json
{ "label": "A" }
```

**Response:**
```json
{
  "success": true,
  "state": "DASHBOARD",
  "action": null
}
```

**Example:**
```bash
curl -X POST http://localhost:3421/control \
  -H "Content-Type: application/json" \
  -d '{"label":"B"}'
```

### GET /state

Get current state as JSON.

**Response:**
```json
{
  "state": "DASHBOARD",
  "timestamp": "2026-03-18T...",
  "appVersion": "1.0.0",
  "status": "READY"
}
```

### GET /bindings

Get all label-to-action mappings.

**Response:**
```json
{
  "stateTransitions": { ... },
  "actions": { ... }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| ascii_view | Get current ASCII screen |
| ascii_control | Execute action by label |
| ascii_navigate | Navigate to state |
| ascii_state | Get state as JSON |
| ascii_bindings | Get label mappings |

## Using with Claude Code

```bash
# Start ASCII World
bun run ascii

# In Claude Code, the MCP tools are available:
# "Use ascii_view to see the current screen"
# "Navigate to Sources using ascii_navigate"
```
