# pxOS — Pixel Operating System

**AI agents produce data. Humans consume pixels. pxOS bridges the gap.**

An AI posts `{"cpu": 0.67}` — two hundred bytes. A formula engine evaluates that into a pixel grid. The pixel grid is the substrate.

## The Architecture

```
AI Agent                    Server                      Viewers
────────                    ──────                      ───────

{"cpu": 0.67}     POST     ┌──────────────────┐
{"mem_pct": 0.45} ──────►  │  Cell Store       │
{"disk_pct": 0.92}         │  (key → value)    │
                           └────────┬─────────┘
                                    │
                            ┌───────▼─────────┐
                            │ PixelFormula     │
                            │ Engine           │
                            │                  │
                            │ =BAR(cpu, 40)    │──► drawProgressBar()
                            │ =STATUS(state)   │──► drawTextCell()
                            │ =SPARKLINE(...)  │──► drawRect() series
                            └───────┬──────────┘
                                    │
                            ┌───────▼──────────┐
                            │  PixelBuffer      │
                            │  480×240 RGBA     │
                            └───────┬──────────┘
                                    │
                            ┌───────▼──────────┐
                            │  PNG Output       │
                            └──────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Expected: 42 tests passing

# Start server
npm start
```

## Components

| File | Purpose | Tests |
|------|---------|-------|
| `sync/pixel-buffer.js` | RGBA pixel buffer with drawing primitives | 16 |
| `sync/glyph-atlas.js` | 6×10 bitmap font for text rendering | - |
| `sync/pixel-formula-engine.js` | Reactive formula evaluator | 28 |
| `sync/cell-store.js` | Reactive key-value store | 7 |
| `sync/server.js` | HTTP + WebSocket server | 7 |
| `sync/alert-engine.js` | Threshold-based alerting | 10 |
| `sync/pixel-renderer.js` | ASCII → PNG bridge | - |
| `sync/cell-store.js` | Reactive key-value store | 7 |
| `sync/server.js` | HTTP + WebSocket server | 7 |

**Total: 91 tests**

## Formula Functions

### Basic Formulas

| Function | Pixel Operation | Example |
|----------|-----------------|---------|
| `BAR(col, row, val, w)` | Progress bar | `BAR(0, 0, 'cpu', 40)` |
| `TEXT(col, row, val)` | Text label | `TEXT(0, 0, 'label')` |
| `STATUS(col, row, val, ...)` | Status indicator | `STATUS(0, 0, 'state', 2, '◉ done', '○ idle')` |
| `BOX(col, row, w, h)` | Box outline | `BOX(0, 0, 40, 5)` |
| `SPARKLINE(col, row, arr, w)` | Mini chart | `SPARKLINE(0, 0, 'history', 50)` |
| `RECT(col, row, w, h, color)` | Filled rectangle | `RECT(0, 0, 10, 5, 'barFill')` |
| `LINE(col, row, len, dir, color)` | Line (h/v) | `LINE(0, 0, 40, 'h', 'border')` |
| `CIRCLE(col, row, r, color, fill)` | Circle | `CIRCLE(10, 5, 3, 'active', true)` |
| `GAUGE(col, row, val, r, color)` | Circular gauge | `GAUGE(10, 5, 'cpu', 3, 'active')` |
| `NUMBER(col, row, val, fmt)` | Formatted number | `NUMBER(0, 0, 'cpu', '0%')` |
| `TIME(col, row, fmt)` | Current time | `TIME(70, 0, 'HH:mm')` |

### Advanced Formulas

| Function | Pixel Operation | Example |
|----------|-----------------|---------|
| `CHART(col, row, arr, w, h, color)` | Bar chart | `CHART(0, 2, 'data', 40, 3, 'barFill')` |
| `DONUT(col, row, val, r, color, bg)` | Donut chart | `DONUT(10, 5, 'cpu', 3, 'active', 'barEmpty')` |
| `PROGRESS(col, row, val, size, color)` | Circular progress | `PROGRESS(70, 3, 'cpu', 3, 'active')` |
| `BADGE(col, row, text, bg, fg)` | Status badge | `BADGE(0, 0, 'ACTIVE', 'active', 'white')` |
| `COND(col, row, val, thresh, above, below)` | Conditional color | `COND(0, 2, 'cpu', 0.8, 'critical', 'active')` |
| `HISTORY(col, row, val, prev, fmt)` | Value with trend | `HISTORY(0, 2, 'cpu', 'cpu_prev', '0%')` |
| `GRID(col, row, arr, cols, color)` | Array as grid | `GRID(0, 5, 'metrics', 4, 'text')` |
| `TEXT(col, row, val)` | Text label | `TEXT(0, 0, 'label')` |
| `STATUS(col, row, val, ...)` | Status indicator | `STATUS(0, 0, 'state', 2, '◉ done', '○ idle')` |
| `BOX(col, row, w, h)` | Box outline | `BOX(0, 0, 40, 5)` |
| `SPARKLINE(col, row, arr, w)` | Mini chart | `SPARKLINE(0, 0, 'history', 50)` |
| `RECT(col, row, w, h, color)` | Filled rectangle | `RECT(0, 0, 10, 5, 'barFill')` |
| `LINE(col, row, len, dir, color)` | Line (h/v) | `LINE(0, 0, 40, 'h', 'border')` |
| `CIRCLE(col, row, r, color, fill)` | Circle | `CIRCLE(10, 5, 3, 'active', true)` |
| `GAUGE(col, row, val, r, color)` | Circular gauge | `GAUGE(10, 5, 'cpu', 3, 'active')` |
| `NUMBER(col, row, val, fmt)` | Formatted number | `NUMBER(0, 0, 'cpu', '0%')` |
| `TIME(col, row, fmt)` | Current time | `TIME(70, 0, 'HH:mm')` |

### Colors

Named colors: `active`, `idle`, `critical`, `barFill`, `barEmpty`, `border`, `borderHighlight`, `text`, `textMuted`, `white`, `black`, `red`, `green`, `blue`, `yellow`, `cyan`, `magenta`

Or use RGB: `[255, 0, 0]` or hex: `0xff0000`

## Usage

```javascript
import { PixelFormulaEngine } from './sync/pixel-formula-engine.js';

const engine = new PixelFormulaEngine(480, 240);

// Set reactive cell values
engine.setCells({ cpu: 0.67, mem: 28.1 });

// Draw formulas
engine.BAR(0, 0, 'cpu', 40);
engine.TEXT(42, 0, 'cpu');
engine.STATUS(0, 1, 'state', 2, '◉ done', 1, '● active', '○ idle');

// Export as PNG
const png = await engine.toPNG();
```

## Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| active | `#3fb950` | ● healthy status |
| idle | `#484f58` | ○ inactive status |
| critical | `#f85149` | ◉ error/done |
| barFill | `#238636` | Progress bar filled |
| barEmpty | `#161b22` | Progress bar empty |
| border | `#30363d` | Box outlines |
| text | `#c9d1d9` | Default text |

## Coordinate System

```
Pixel space:    (0,0) to (479, 239)     — 480×240 pixels
Cell space:     (0,0) to (79, 23)       — 80×24 characters

Conversion:
  pixel → cell:   col = floor(px / 6),  row = floor(py / 10)
  cell → pixel:   px = col * 6,         py = row * 10
```

## API

```javascript
class PixelFormulaEngine {
  constructor(width = 480, height = 240)
  
  // State
  setCells(cells)
  resolveValue(cellValue)
  
  // Formulas
  BAR(col, row, cellValue, widthCells)
  TEXT(col, row, cellValue)
  STATUS(col, row, cellValue, ...thresholds)
  BOX(col, row, widthCells, heightCells)
  SPARKLINE(col, row, cellValue, widthCells)
  
  // Output
  clear()
  renderTemplate(template)
  toPNG() → Promise<Buffer>
}
```

## Running the Server

```bash
# Start server (default port 3839)
npm start

# Or specify port
PORT=8080 npm start
node bin/pxos-server.js 8080
```

## Server API

### HTTP Endpoints

#### GET /health
Health check endpoint.

```bash
curl http://localhost:3839/health
# {"status":"ok","timestamp":1711050000000}
```

#### GET /api/v1/cells
Get all current cell values.

```bash
curl http://localhost:3839/api/v1/cells
# {"cpu":0.67,"mem":28.1}
```

#### POST /api/v1/cells
Update cell values. Returns changed keys.

```bash
curl -X POST http://localhost:3839/api/v1/cells \
  -H 'Content-Type: application/json' \
  -d '{"cpu":0.75,"disk":45}'
# {"ok":true,"changes":{"cpu":0.75,"disk":45}}
```

#### GET /api/v1/render
Render current state as PNG image.

```bash
curl -o output.png http://localhost:3839/api/v1/render
```

#### POST /api/v1/template
Set the render template (array of formula operations).

```bash
curl -X POST http://localhost:3839/api/v1/template \
  -H 'Content-Type: application/json' \
  -d '[{"fn":"BAR","args":[0,0,"cpu",40]}]'
# {"ok":true,"templateSize":1}
```

### Alerting API

#### GET /api/v1/alerts
Get current alert rules.

```bash
curl http://localhost:3839/api/v1/alerts
# [{"name":"high_cpu","cell":"cpu","operator":">","threshold":0.8,...}]
```

#### POST /api/v1/alerts
Set alert rules.

```bash
curl -X POST http://localhost:3839/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{"name":"high_cpu","cell":"cpu","operator":">","threshold":0.8,"severity":"critical","message":"CPU above 80%"}]'
# {"ok":true,"ruleCount":1}
```

#### GET /api/v1/alerts/history
Get alert history.

```bash
curl http://localhost:3839/api/v1/alerts/history
# [{"rule":"high_cpu","cell":"cpu","value":0.9,"timestamp":1711050000000,...}]
```

### Alert Rule Format

```json
{
  "name": "high_cpu",
  "cell": "cpu",
  "operator": ">",
  "threshold": 0.8,
  "severity": "critical",
  "message": "CPU usage above 80%",
  "cooldown": 60,
  "enabled": true,
  "webhook": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
}
```

### Webhook Notifications

When an alert triggers and has a `webhook` URL configured, pxOS sends a POST request:

```bash
curl -X POST http://localhost:3839/api/v1/alerts \
  -d '[{
    "name": "high_cpu",
    "cell": "cpu",
    "operator": ">",
    "threshold": 0.8,
    "webhook": "https://hooks.slack.com/services/YOUR/WEBHOOK"
  }]'
```

**Webhook Payload:**
```json
{
  "rule": "high_cpu",
  "cell": "cpu",
  "value": 0.85,
  "threshold": 0.8,
  "severity": "critical",
  "message": "CPU above 80%",
  "timestamp": 1711050000000
}
```

**Supported:**
- Slack incoming webhooks
- Discord webhooks
- PagerDuty Events API
- Custom endpoints (any URL that accepts JSON POST)

### Dashboard Management

Save, load, and switch between visualization configurations. **Dashboards persist across server restarts** in `data/dashboards.json`.

#### POST /api/v1/dashboards
Save current template and alerts as a named dashboard.

```bash
curl -X POST http://localhost:3839/api/v1/dashboards \
  -H 'Content-Type: application/json' \
  -d '{"name": "system-monitor"}'
# {"ok":true,"name":"system-monitor"}
```

#### GET /api/v1/dashboards
List all saved dashboards.

```bash
curl http://localhost:3839/api/v1/dashboards
# [{"name":"system-monitor","created":1711050000000,"templateSize":5,"alertCount":2}]
```

**Persistence:** Dashboards are automatically saved to `data/dashboards.json` and loaded on server startup.

#### GET /api/v1/dashboards/:name
Load a dashboard (applies template and alerts).

```bash
curl http://localhost:3839/api/v1/dashboards/system-monitor
# {"ok":true,"template":[...],"alerts":[...]}
```

#### DELETE /api/v1/dashboards/:name
Delete a dashboard.

```bash
curl -X DELETE http://localhost:3839/api/v1/dashboards/system-monitor
# {"ok":true}
```

### Time-Series API

#### GET /api/v1/history/:cell
Get historical values for a specific cell.

```bash
curl http://localhost:3839/api/v1/history/cpu?points=100
# [{"t":1711050000000,"v":0.75},{"t":1711049999000,"v":0.72},...]
```

#### GET /api/v1/history
Get history for all tracked cells.

```bash
curl http://localhost:3839/api/v1/history?points=50
# {"cpu":[...],"mem":[...]}
```

**Configuration:**
- `maxPoints`: 1000 (max points stored per cell)
- `minInterval`: 1000ms (minimum time between recordings)

### WebSocket

Connect to `ws://localhost:3839` for live updates.

```javascript
const ws = new WebSocket('ws://localhost:3839');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type === 'cells'
  // msg.cells = { cpu: 0.67, ... }
  // msg.changes = { cpu: 0.67 } (only changed)
};
```

## Example: Live Dashboard

```javascript
// Set up template
await fetch('http://localhost:3839/api/v1/template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([
    { fn: 'TEXT', args: [0, 0, 'title'] },
    { fn: 'BAR', args: [0, 1, 'cpu', 40] },
    { fn: 'BAR', args: [0, 2, 'mem', 40] },
    { fn: 'STATUS', args: [42, 2, 'state', 2, '◉ done', 1, '● active', '○ idle'] }
  ])
});

// Update cells (e.g., from an AI agent)
await fetch('http://localhost:3839/api/v1/cells', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'System Monitor',
    cpu: 0.67,
    mem: 0.45,
    state: 1
  })
});

// Get rendered PNG
const res = await fetch('http://localhost:3839/api/v1/render');
const png = await res.arrayBuffer();
```

## Browser Viewer

Open `viewer/viewer.html` in your browser for a live visual dashboard.

### Features
- **Live canvas** - Renders PNG output in real-time
- **Connection status** - Green ● connected, Red ○ disconnected
- **Cell inspector** - Shows all current cell values
- **Auto-reconnect** - Reconnects automatically if server restarts

### Usage

```bash
# Start the server
npm start

# Open viewer in browser
open viewer/viewer.html
# Or serve it:
npx serve .
# Then visit http://localhost:3000/viewer/viewer.html
```

### Screenshot

```
┌─────────────────────────────────────────┐
│ ● Connected | Last: 14:05:32            │
├─────────────────────────────────────────┤
│ [Canvas showing rendered PNG]           │
│                                         │
├─────────────────────────────────────────┤
│ Cells                                   │
│ cpu    0.75                             │
│ mem    28.10                            │
└─────────────────────────────────────────┘
```

## Python Agent Example

Use the included Python agent to monitor system metrics.

### Setup

```bash
# Install Python dependencies
pip install -r agents/requirements.txt

# Start the server
npm start

# Run the agent
python agents/system_monitor.py
```

### Output

```
pxOS System Monitor Agent
Server: http://localhost:3839
Interval: 1.0s

Using default template
Template set (14 operations)

Starting monitor... (Ctrl+C to stop)
--------------------------------------------------
[16:35:42] CPU:  23.5% | MEM:  28.1/62.3GB | DISK: 145.2/500.0GB
[16:35:43] CPU:  18.2% | MEM:  28.1/62.3GB | DISK: 145.2/500.0GB
[16:35:44] CPU:  45.1% | MEM:  28.2/62.3GB | DISK: 145.2/500.0GB
```

### Options

```bash
python agents/system_monitor.py --help

python agents/system_monitor.py --url http://localhost:8080
python agents/system_monitor.py --interval 2
python agents/system_monitor.py --template agents/template.json
python agents/system_monitor.py --once  # Single update, then exit
```

### Custom Agent

```python
import urllib.request
import json

def post_cells(url, cells):
    data = json.dumps(cells).encode('utf-8')
    req = urllib.request.Request(
        f"{url}/api/v1/cells",
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    urllib.request.urlopen(req)

# Post your data
post_cells('http://localhost:3839', {
    'title': 'My Dashboard',
    'cpu': 0.67,
    'status': 'OK'
})
```

## Geometry OS Integration

Monitor Geometry OS internals (NEB, GPU VMs, CTRM, Swarm) in real-time.

### Setup

```bash
# Install Python dependencies
pip install -r agents/requirements.txt

# Start the server
npm start

# Run Geometry OS monitor (with mock data for testing)
python agents/geometry_os_monitor.py --mock

# Or with real Geometry OS installation
python agents/geometry_os_monitor.py --geometry-os-path ~/zion/projects/geometry_os
```

### Output

```
pxOS Geometry OS Monitor
Server: http://localhost:3839
Geometry OS: not specified (using mock)
Mode: mock

Template set (19 operations)

Starting monitor... (Ctrl+C to stop)
------------------------------------------------------------
[16:42:15] NEB: 134.2k/s | GPU: 25/64 tiles | CTRM: 32,847 facts | SWARM: 12 agents
[16:42:16] NEB: 137.8k/s | GPU: 25/64 tiles | CTRM: 32,847 facts | SWARM: 12 agents
```

### Metrics Collected

| Component | Cell Key | Description |
|-----------|----------|-------------|
| NEB | `neb_rate` | Events per second |
| NEB | `neb_total` | Total events |
| GPU | `gpu_tiles` | Tiles loaded |
| GPU | `gpu_pc` | Program counter |
| CTRM | `ctrm_facts` | Total facts |
| CTRM | `ctrm_verified` | Verified facts |
| Swarm | `swarm_agents` | Active agents |
| Swarm | `guilds` | Active guilds |

### Integration Script

```bash
# Set up symlinks in Geometry OS directory
./scripts/integrate-with-geometry-os.sh ~/zion/projects/geometry_os
```

### Options

```bash
python agents/geometry_os_monitor.py --help

python agents/geometry_os_monitor.py --mock  # Use mock data
python agents/geometry_os_monitor.py --geometry-os-path /path/to/geometry_os
python agents/geometry_os_monitor.py --interval 2
python agents/geometry_os_monitor.py --once
```

## License

MIT
