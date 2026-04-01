# Agent Dashboard UI

Visual monitoring for registered agents. Uses the pixel-native rendering system (PixelBuffer + GlyphAtlas) to draw agent cards, grids, and detail views.

## Agent Formula Functions

These functions are available in the PixelFormulaEngine when an AgentRegistry and TimeSeriesStore are configured:

```javascript
import { PixelFormulaEngine } from '../sync/pixel-formula-engine.js';
import { AgentRegistry } from '../sync/agent-registry.js';

const registry = new AgentRegistry();
engine.setAgentRegistry(registry);
engine.setTimeSeriesStore(timeSeriesStore);
```

| Function | Returns | Description |
|----------|---------|-------------|
| `AGENT_STATUS(agentId)` | `string` | Agent status: `'online'`, `'offline'`, `'error'`, or `'unknown'` |
| `AGENT_LIST()` | `string` | Comma-separated list of all registered agent IDs |
| `AGENT_METRIC(agentId, metricName)` | `number` | Latest value for `agent:{id}:{metric}` from time-series store |
| `AGENT_COUNT()` | `number` | Number of registered agents |
| `AGENT_NAME(agentId)` | `string` | Agent display name, or `'unknown'` if not found |

### Usage in Templates

Use agent formula functions like any other formula in dashboard templates:

```javascript
// Template operations using agent formulas
[
  { fn: 'TEXT', args: [0, 0, 'Agent Count:'] },
  { fn: 'TEXT', args: [14, 0, '=AGENT_COUNT()'] },
  { fn: 'TEXT', args: [0, 2, '=AGENT_NAME("agent-1")'] },
  { fn: 'STATUS', args: [20, 2, '=AGENT_STATUS("agent-1")', 2, '◉ online', 1, '● offline', '○ unknown'] }
]
```

### Agent Data Model

Each agent in the registry has this shape:

```javascript
{
  id: 'agent-1',
  name: 'System Monitor',
  status: 'online',        // 'online' | 'offline' | 'error' | 'unknown'
  capabilities: ['cpu', 'mem', 'disk'],
  lastHeartbeat: '2026-04-01T12:00:00Z',
  config: {}
}
```

## Dashboard Templates

Two built-in dashboard templates for agent monitoring:

### Agent Grid (`templates/agent-grid.json`)

Shows all agents as a card grid. Each card displays:
- Status badge (colored dot)
- Agent name
- Capability tags
- Relative last-heartbeat time

```javascript
import { AgentGrid } from '../ui/agent-grid.js';

const grid = new AgentGrid({ cols: 4, cardWidth: 20, sortBy: 'name' });

// Render from agent data
const { buffer, agentCount } = grid.render(agents);

// Or fetch from API and render
const result = await grid.fetchAndRender('http://localhost:3839');

// Auto-refresh every 5 seconds
grid.startAutoRefresh('http://localhost:3839', (result) => {
  // Called after each refresh with { buffer, agentCount, agents }
});
grid.stopAutoRefresh();
```

**Grid options:**

| Option | Default | Description |
|--------|---------|-------------|
| `cols` | 4 | Number of card columns |
| `cardWidth` | 20 | Card width in cell units |
| `cellWidth` | 80 | Total grid width in cell units |
| `gapX` | 1 | Horizontal gap between cards (cells) |
| `gapY` | 1 | Vertical gap between cards (cells) |
| `sortBy` | `'name'` | Sort key: `'name'`, `'status'`, or `'heartbeat'` |
| `pollInterval` | 5000 | Auto-refresh interval in ms (0 to disable) |

**Sort options:**
- `name` — Alphabetical by agent name
- `status` — Online first, then offline, error, unknown
- `heartbeat` — Most recent heartbeat first

### Agent Detail (`templates/agent-detail.json`)

Full detail page for a single agent. Sections:

1. **Header** — Status badge, name, capabilities, ID and heartbeat
2. **Metrics** — Sparkline mini bar charts for the last 20 values of up to 3 metrics
3. **Recent Logs** — Last 10 log entries with level, message, and relative timestamp
4. **Task History** — Last 10 tasks with description and status

```javascript
import { AgentDetail } from '../ui/agent-detail.js';

const detail = new AgentDetail({ widthCells: 60 });

// Render from data
const { buffer, widthCells, heightCells } = detail.render(agent, {
  metrics: { cpu: [0.3, 0.5, 0.7], mem: [0.4, 0.45, 0.5] },
  logs: [{ timestamp: '...', level: 'info', message: 'Task completed' }],
  tasks: [{ id: 't1', description: 'Run scan', status: 'done' }]
});

// Or fetch from API
const result = await detail.fetchAndRender('http://localhost:3839', 'agent-1');
```

**Detail options:**

| Option | Default | Description |
|--------|---------|-------------|
| `widthCells` | 60 | Detail page width in cell units |

**API endpoints used:**

| Endpoint | Data |
|----------|------|
| `GET /api/v1/agents/:id` | Agent object |
| `GET /api/v1/agents/:id/logs` | Log entries (optional) |
| `GET /api/v1/agents/:id/tasks` | Task history (optional) |
| `GET /api/v1/agents/:id/metrics` | Metric time-series (optional) |

Detail endpoints that return 404 are silently skipped.

## UI Components

### AgentCard (`ui/agent-card.js`)

Renders a single agent as a pixel block.

**Status colors:**
- Online: green `#3fb950`
- Offline: yellow `#e3b341`
- Error: red `#f85149`
- Unknown: gray `#484f58`

**Helper exports:**
- `formatRelativeTime(isoTimestamp, nowMs?)` — Converts ISO timestamp to `"5s ago"`, `"2m ago"`, etc.
- `getEffectiveStatus(agent)` — Returns normalized status string

### AgentGrid (`ui/agent-grid.js`)

Grid layout with auto-refresh and sorting. See above.

### AgentDetail (`ui/agent-detail.js`)

Multi-section detail view with sparklines, logs, and tasks. See above.

## File Reference

| File | Purpose |
|------|---------|
| `ui/agent-card.js` | Single agent card renderer |
| `ui/agent-grid.js` | Grid of agent cards with sorting and polling |
| `ui/agent-detail.js` | Full agent detail page |
| `templates/agent-grid.json` | Grid dashboard template |
| `templates/agent-detail.json` | Detail dashboard template |
| `sync/agent-registry.js` | Agent registry (CRUD + lookup) |
| `sync/pixel-formula-engine.js` | Formula engine with AGENT_* functions |
