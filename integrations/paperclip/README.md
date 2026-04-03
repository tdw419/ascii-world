# Paperclip ASCII Bridge

> Control Paperclip's agent orchestration GUI from an ASCII terminal interface.

## What It Does

The Paperclip ASCII Bridge connects two systems:

- **Paperclip** -- an AI agent orchestration platform running at `http://localhost:3100`. It manages agents, issues, projects, goals, and costs through a React GUI and REST API.
- **ASCII World** -- a TUI-style interface framework where `.ascii` files are the single source of truth, rendered in a browser, synced via WebSocket on port 3839.

The bridge lets you see and control Paperclip's entire state (agents, issues, projects) from an ASCII dashboard, with button clicks flowing back through to Paperclip's API.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Paperclip REST API (:3100)                                    │
│   ┌───────────────────────┐                                     │
│   │ /api/companies/:id/   │                                     │
│   │   agents              │──── polls every 5s ────┐            │
│   │   issues              │                        │            │
│   │   projects            │                        ▼            │
│   │   dashboard           │              paperclip-bridge.js    │
│   │   agents/:id/wakeup   │              (renderer + handler)   │
│   │   issues/:id/checkout │                        │            │
│   │   issues/:id PATCH    │◄── button clicks ──────┘            │
│   └───────────────────────┘                        │            │
│                                                     │            │
│                        paperclip.ascii ◄────────────┘            │
│                             │                                   │
│                             ▼                                   │
│                     sync-server.js (:3839)                      │
│                        WebSocket                                │
│                             │                                   │
│                             ▼                                   │
│                      ASCII World GUI                            │
│                      (browser renderer)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

### Three Components

| File | Role |
|------|------|
| `sync/paperclip-bridge.js` | Polls Paperclip API, renders `.ascii` dashboard, processes button clicks into API calls |
| `sync/sync-server.js` | Routes paperclip actions through the bridge, broadcasts updates to WebSocket clients |
| `data/paperclip.ascii` | The rendered dashboard file -- auto-generated, never edit manually |

### Two Data Flows

**Read path** (Paperclip state --> ASCII dashboard):

1. `paperclip-bridge.js` polls Paperclip REST API every 5 seconds
2. Fetches: agents, issues, projects, dashboard stats
3. Renders everything into a compliant `.ascii` file with hash verification
4. Writes `data/paperclip.ascii`
5. `sync-server.js` detects the file change, broadcasts to all WebSocket clients
6. ASCII World GUI receives the update and re-renders

**Write path** (ASCII button click --> Paperclip action):

1. User clicks a button in the ASCII World GUI (e.g. `[W] Wake CEO`)
2. GUI sends `{ type: "gui_action", key: "W", label: "Wake CEO", context: "paperclip" }` via WebSocket
3. `sync-server.js` receives the message, routes it to `handlePaperclipAction()` based on `context`
4. `paperclip-bridge.js` translates the button into a Paperclip API call (e.g. `POST /api/agents/:id/wakeup`)
5. After the API call, it re-fetches fresh state and re-renders the `.ascii` file
6. Updated dashboard broadcasts back to all clients

## The ASCII Dashboard

Here's what the rendered dashboard looks like:

```
╔══════════════════════════════════════════════════════════════╗
║  PAPERCLIP — GlyphLang                      ver:2a119815  ║
╠══════════════════════════════════════════════════════════════╣
║  [1] Dashboard  [2] Agents  [3] Issues  [4] Projects  [R] Refresh  ║
╠══════════════════════════════════════════════════════════════╣
║  Server ● online  v0.3.1  2026-04-03 15:20:42                ║
║                                                              ║
║  ┌─ Overview ──────────────────────────────────────────────┐   ║
║  │  Agents:  2 active    1 running    0 paused    │   ║
║  │  Issues:  7 open      0 active      0 done      │   ║
║  │  Cost:   $    0.00 / $    0.00                  │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                              ║
║  ┌─ Agents ────────────────────────────────────────────────┐   ║
║  │  Key  Role        Name         Status      Adapter      │   ║
║  │  ───  ──────────  ───────────  ──────────  ───────────  │   ║
║  │  [A]  engineer     GPUEngineer   ● running    hermes_local  │   ║
║  │  [B]  ceo          CEO           ○ idle       hermes_local  │   ║
║  │                                                          │   ║
║  │  [W] Wake CEO     [P] Pause All     [X] Refresh          │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                              ║
║  ┌─ Issues ────────────────────────────────────────────────┐   ║
║  │  ID        Pri  Status     Title                        │   ║
║  │  ────────  ───  ─────────  ──────────────────────────   │   ║
║  │  GLY-1      ↑   ○ todo      016: GPU Shader Optimizat…  │   ║
║  │  GLY-3      ↑   ○ todo      4.1: Wire glyph run --gpu…  │   ║
║  │                                                          │   ║
║  │  [N] New Issue    [S] Start Next    [D] Done Next         │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                              ║
║  ┌─ Projects ──────────────────────────────────────────────┐   ║
║  │  GlyphLang Compiler & GPU  ◐ in_progress                 │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  Actions: Click buttons above  |  Auto-refresh every 5s      ║
╚══════════════════════════════════════════════════════════════╝
```

### Sections

| Section | What It Shows |
|---------|---------------|
| **Header** | Company name + content hash for sync verification |
| **Navigation** | Tab buttons (Dashboard, Agents, Issues, Projects, Refresh) |
| **Server** | Health status (`● online` / `◉ offline`), version, timestamp |
| **Overview** | Agent counts, issue counts, cost tracking |
| **Agents** | Per-agent table with role, name, status, adapter type |
| **Issues** | Issue list with ID, priority, status, title (max 8 shown) |
| **Projects** | Active project list with status |
| **Benchmarks** | Pipeline benchmark data from `openspec/learnings.md` -- avg/min/max times, trends, slowest pipeline |

### Status Symbols

```
● running     ○ idle/todo     ◐ paused/in_progress     ◉ error/blocked     ✓ done     ✗ cancelled
```

### Priority Arrows

```
↑ high     → medium     ↓ low
```

## Button Actions

Every `[KEY]` in the dashboard is a clickable button. Here's what each one does:

### Agent Controls

| Button | API Call | Effect |
|--------|----------|--------|
| `[W] Wake CEO` | `POST /api/agents/:id/wakeup` | Triggers the CEO agent's heartbeat, waking it up to process its inbox |
| `[A]`, `[B]`, etc. | `POST /api/agents/:id/wakeup` | Wakes the agent at that position (A=first, B=second) |
| `[P] Pause All` | `PATCH /api/agents/:id` {status: "paused"} | Pauses every agent in the company |

### Issue Controls

| Button | API Call | Effect |
|--------|----------|--------|
| `[S] Start Next` | `POST /api/issues/:id/checkout` | Checks out the first `todo` issue to the first agent |
| `[D] Done Next` | `PATCH /api/issues/:id` {status: "completed"} | Marks the first `in_progress` issue as completed |
| `[N] New Issue` | (placeholder for future) | Would create a new issue |

### General

| Button | Effect |
|--------|--------|
| `[R] Refresh` / `[X] Refresh` | Forces a fresh state fetch from Paperclip |

### Benchmark Controls

| Button | Effect |
|--------|--------|
| `[B] Run Bench` | Runs `glyph bench --persist` in the GlyphLang project, writes results to `learnings.md`, dashboard re-renders with new data |
| `[T] Strategist` | Runs `scripts/auto_strategist.py` which reads benchmark data, identifies the slowest pipeline, and creates a Paperclip issue assigned to GPUEngineer |
| `[F] Full Cycle` | Runs both Bench + Strategist in sequence -- the complete ouroboros loop |

## Hash Verification

The dashboard uses ASCII World's hash verification system:

1. When rendered, the content hash is computed (SHA-256, first 8 hex chars) and embedded as `ver:XXXXXXXX`
2. The ASCII World GUI parses the file and sends a parse report with the hash
3. Both sides verify the hash matches -- if it does, the dashboard is in sync
4. Every 5 seconds, the poller re-fetches Paperclip state and only writes the file if the hash changed

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PAPERCLIP_URL` | `http://localhost:3100` | Paperclip server URL |
| `SYNC_PORT` | `3839` | ASCII World sync server WebSocket port |
| `DATA_DIR` | `../data` (relative to sync/) | Directory for `.ascii` files |
| `GLYPHLANG_DIR` | `~/zion/projects/glyphlang` | GlyphLang project root (for benchmark data) |

### Auth

Paperclip runs in `local_trusted` mode -- no API keys or tokens needed. The bridge makes unauthenticated requests to `localhost:3100`. If you switch Paperclip to `authenticated` mode, you'll need to add auth headers to the `api()` function in `paperclip-bridge.js`.

## Running It

### Start the sync server (includes the bridge):

```bash
cd ~/zion/projects/ascii_world/ascii_world
node sync/sync-server.js
```

Output:
```
ASCII Sync Server listening on ws://localhost:3839
Watching /path/to/data for .ascii files
Starting Paperclip poller (every 5000ms)
```

### One-shot render (no polling):

```bash
cd ~/zion/projects/ascii_world/ascii_world
node sync/paperclip-bridge.js
```

Writes `data/paperclip.ascii` once and exits.

### Standalone poller (no sync server):

```bash
cd ~/zion/projects/ascii_world/ascii_world
node sync/paperclip-bridge.js poll
```

Polls every 5 seconds and writes the file, but doesn't broadcast via WebSocket.

## Paperclip API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Server status, version, deployment mode |
| `/api/companies` | GET | List all companies (uses first one) |
| `/api/companies/:id/agents` | GET | List agents with status |
| `/api/companies/:id/issues` | GET | List issues with status, priority |
| `/api/companies/:id/projects` | GET | List projects |
| `/api/companies/:id/dashboard` | GET | Aggregated stats |
| `/api/agents/:id/wakeup` | POST | Wake an agent |
| `/api/issues/:id/checkout` | POST | Assign issue to agent |
| `/api/issues/:id` | PATCH | Update issue status |

## Adding New Buttons

To add a new action:

1. Add the button to the template in `renderDashboard()` (e.g. `[Z] Zap All`)
2. Add a handler in `handlePaperclipAction()` that matches `key === 'Z'` or `label.includes('zap')`
3. Call the appropriate Paperclip API
4. The fresh re-render at the end of the handler will pick up any state changes

Example:

```javascript
// In handlePaperclipAction():
if (key === 'Z' || label.includes('zap all')) {
    const state = await fetchPaperclipState();
    for (const agent of state.agents) {
        await api(`/agents/${agent.id}`, { method: 'PATCH', body: { status: 'paused' } });
        changes.push(`Zapped ${agent.name}`);
    }
}
```

## Troubleshooting

**Dashboard shows stale data**: The poller only writes when the hash changes. If Paperclip's state changes but the rendered ASCII is identical (same counts, same agents), the file won't be rewritten. Force a refresh with `[R]`.

**Button click has no effect**: Check the sync server console for errors. The most common issue is the action not routing to `paperclip.ascii` -- make sure `context: 'paperclip'` is in the WebSocket message.

**"Paperclip API error"**: Paperclip must be running at `localhost:3100`. Check with `curl http://localhost:3100/api/health`.

**Hash mismatch**: The `ver:--------` placeholder must appear in the template for `updateHash()` to work. Don't use `ver:XXXXXXXX` or other non-placeholder values.
