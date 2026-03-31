# GPU Agent Bridge - pxOS Integration

The bridge between pxOS dashboards and the GPU computational universe.

## Overview

```
pxOS Dashboard ──HTTP/WebSocket──> GPU Agent Bridge ──CLI──> GPU Agents (RTX 5090)
       ↑                                                                    │
       └────────────── Stats & Scans ───────────────────────────────────────┘
```

## API Endpoints

### Agent Control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gpu/agent/start` | POST | Start the GPU agent process |
| `/api/v1/gpu/agent/stop` | POST | Stop the GPU agent process |
| `/api/v1/gpu/agent/stats` | GET | Get current stats (pixels, fps, frames) |

### Signal Injection

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gpu/inject` | POST | Inject a single pixel/agent |
| `/api/v1/gpu/wire` | POST | Draw a wire between two points |
| `/api/v1/gpu/gate` | POST | Place a logic gate |

### Circuit Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gpu/circuit/load` | POST | Load ASCII circuit or template |
| `/api/v1/gpu/circuit/scan` | GET | Scan GPU region → ASCII |
| `/api/v1/gpu/circuit/templates` | GET | List available templates |

### Visualization

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gpu/heatmap` | POST | Get colored heat-map of signals |

### Network Bridge

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gpu/bridge/start` | POST | Start network bridge server |
| `/api/v1/gpu/bridge/connect` | POST | Connect to remote bridge |

### Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gpu/glyphs` | GET | Get glyph→opcode mapping |

## Request/Response Examples

### Inject Signal

```bash
POST /api/v1/gpu/inject
{
    "x": 100,
    "y": 100,
    "opcode": "*",    # or 0x07 for REPLICATE
    "r": 255,
    "g": 255,
    "b": 255
}

Response:
{
    "x": 100,
    "y": 100,
    "opcode": 7,
    "output": "✓ Injected REPLICATE at (100, 100)"
}
```

### Draw Wire

```bash
POST /api/v1/gpu/wire
{
    "x1": 50,
    "y1": 50,
    "x2": 200,
    "y2": 50,
    "color": "00FF00"
}

Response:
{
    "x1": 50,
    "y1": 50,
    "x2": 200,
    "y2": 50,
    "output": "✓ Drew 151 wire pixels"
}
```

### Place Gate

```bash
POST /api/v1/gpu/gate
{
    "type": "and",  # or "xor"
    "x": 150,
    "y": 100
}

Response:
{
    "type": "and",
    "x": 150,
    "y": 100,
    "output": "✓ AND gate at (150, 100)"
}
```

### Load Circuit

```bash
POST /api/v1/gpu/circuit/load
{
    "ascii": "--X--\n--&--",
    "x": 100,
    "y": 50
}

# Or use a template:
{
    "template": "half-adder",
    "x": 100,
    "y": 50
}

Response:
{
    "loaded": true,
    "x": 100,
    "y": 50,
    "output": "✓ Loaded 10 pixels from ASCII"
}
```

### Scan Region

```bash
GET /api/v1/gpu/circuit/scan?x=100&y=50&width=40&height=20

Response:
{
    "ascii": "┌────────────┐\n│------&--X--│\n└────────────┘",
    "stats": {
        "activePixels": 14
    },
    "raw": "..."
}
```

## ASCII Glyph Reference

| Glyph | Opcode | Name | Color | Description |
|-------|--------|------|-------|-------------|
| `-` | 0x01 | MOVE_RIGHT | Green | Horizontal wire |
| `|` | 0x02 | MOVE_DOWN | Green | Vertical wire |
| `&` | 0x04 | AND | Cyan | AND gate (needs N AND W) |
| `X` | 0x05 | XOR | Magenta | XOR gate |
| `*` | 0x07 | REPLICATE | Yellow | Replicates to neighbors |
| `@` | 0x08 | INFECT | Red | Converts neighbors to self |
| `+` | 0x10 | EMIT_SIGNAL | White | Active signal source |
| `!` | 0x11 | SLEEP | Gray | Dormant agent |
| `>` | 0x12 | DIODE_R | Blue | One-way right |
| `<` | 0x13 | DIODE_L | Blue | One-way left |
| `^` | 0x14 | DIODE_U | Blue | One-way up |
| `v` | 0x15 | DIODE_D | Blue | One-way down |
| `?` | 0x20 | RANDOM | Orange | Probabilistic |

## Dashboard Integration

### Cell Naming Convention

Cells named `gpu_X_Y` are automatically synced to GPU coordinates:

```javascript
// Set cell value
cellStore.setCells({
    'gpu_100_100': '*',  // Inject REPLICATE at (100, 100)
    'gpu_150_50': '&',   // Place AND gate at (150, 50)
});

// Values are auto-injected when cells change
```

### WebSocket Events

The server broadcasts GPU stats to connected clients:

```javascript
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    
    if (msg.type === 'gpu-stats') {
        console.log('Active pixels:', msg.stats.activePixels);
        console.log('FPS:', msg.stats.fps);
    }
};
```

## Usage

### Start Server

```bash
cd ~/zion/projects/ascii_world/ascii_world/sync
node server.js
```

### Open Dashboard

```
http://localhost:3839/viewer/gpu-agent-dashboard.html
```

### Programmatic Control

```javascript
// Start agent
await fetch('http://localhost:3839/api/v1/gpu/agent/start', { method: 'POST' });

// Inject replicator
await fetch('http://localhost:3839/api/v1/gpu/inject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x: 240, y: 120, opcode: '*' })
});

// Load circuit template
await fetch('http://localhost:3839/api/v1/gpu/circuit/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template: 'half-adder', x: 100, y: 50 })
});

// Scan region
const scan = await fetch('http://localhost:3839/api/v1/gpu/circuit/scan?x=100&y=50&width=40&height=20')
    .then(r => r.json());
console.log(scan.ascii);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         pxOS Server (3839)                      │
├─────────────────────────────────────────────────────────────────┤
│  HTTP API ◄──────► GPUAgentBridge ◄──────► CLI Tools           │
│     │                   │                      │                │
│     │                   │                      ├─ injector      │
│     │                   │                      ├─ scanner       │
│     │                   │                      ├─ heatmap       │
│     │                   │                      └─ bridge        │
│     │                   │                                       │
│  WebSocket          Shared Memory                               │
│     │             /tmp/pixel-universe.mem                       │
│     │                   │                                       │
│     ▼                   ▼                                       │
│  Dashboard          GPU Agent (Rust/WGPU)                       │
│  (HTML/JS)              │                                       │
│                         ▼                                       │
│                    RTX 5090                                     │
│                    (150M px/sec)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Performance

- **Inject latency**: <1ms (shared memory)
- **Scan latency**: <5ms for 40×20 region
- **Broadcast latency**: <10ms (WebSocket)
- **Throughput**: 30 FPS sustained

## Files

```
ascii_world/
├── sync/
│   ├── server.js              — pxOS HTTP/WebSocket server
│   └── gpu-agent-bridge.js    — Bridge module
├── viewer/
│   └── gpu-agent-dashboard.html — Web UI
└── gpu/
    ├── target/release/
    │   ├── agent              — GPU agent binary
    │   ├── injector           — Signal injector
    │   ├── scanner            — ASCII ↔ GPU bridge
    │   ├── heatmap            — Signal visualization
    │   └── bridge             — Network bridge
    └── circuits/ascii/        — Circuit templates
```

## See Also

- [INJECTOR.md](../gpu/INJECTOR.md) — Signal injector documentation
- [SCANNER.md](../gpu/SCANNER.md) — Scanner documentation
- [BUS.md](../gpu/BUS.md) — Universal bus system
- [README.md](../gpu/README.md) — Complete GPU system guide
