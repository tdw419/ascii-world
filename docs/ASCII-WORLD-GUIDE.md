# ASCII World - Complete Guide

## Overview

ASCII World is a **Spatial Operating System** that transforms web applications into ASCII-rendered interfaces. It enables both humans and AI agents to interact with multiple applications through a unified, text-based portal.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ASCII WORLD :: MASTER PORTAL              [WP] [CLAW] [YT] [PHP] Focus     │
├──────────────────────┬──────────────────────────────────────────────────────┤
│  NEURAL MAP (40%)    │  REALITY PANE (60%)                                  │
│  ┌────────────────┐  │  ┌────────────────────────────────────────────────┐  │
│  │ Raw ASCII      │  │  │ System Orchestrator                           │  │
│  │ from all       │  │  ├────────────────────────────────────────────────┤  │
│  │ substrates     │  │  │ WordPress Substrate                           │  │
│  │                │  │  ├────────────────────────────────────────────────┤  │
│  │ ● Live         │  │  │ ClawLauncher (Agent Control)                  │  │
│  └────────────────┘  │  ├────────────────────────────────────────────────┤  │
│                      │  │ Safe YouTube (Audio Only)                      │  │
│                      │  ├────────────────────────────────────────────────┤  │
│                      │  │ PHP Site Bridge                               │  │
│                      │  └────────────────────────────────────────────────┘  │
├──────────────────────┴──────────────────────────────────────────────────────┤
│  Penta-Sync Active │ Substrates: 5 Running │ Standard: Neural-Reality v2   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### The Neural-Reality Dual Substrate Pattern

Every ASCII World portal maintains two synchronized views:

| Pane | Purpose | Audience |
|------|---------|----------|
| **Neural Map (Left)** | Raw ASCII tokens | AI agents, debugging |
| **Reality Pane (Right)** | Rendered GUI cards | Humans |

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Master Portal                          │
│  - Vite/React frontend (port 5174)                         │
│  - Event routing (global vs local keys)                    │
│  - Substrate polling (1.5s interval)                       │
├─────────────────────────────────────────────────────────────┤
│                      Substrates                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Manager     │ │ WordPress   │ │ ClawLauncher│ ...       │
│  │ :3422       │ │ :3450       │ │ :3425       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  Each substrate exposes:                                    │
│  - GET /          → ASCII view                              │
│  - GET /health    → Health check                            │
│  - POST /control  → Execute action by label                 │
├─────────────────────────────────────────────────────────────┤
│                      Standards                              │
│  - docs/ASCII-VISUAL-PATTERN.md (design spec)              │
│  - ~/.claude/skills/ascii-visual-portal.md (AI skill)      │
│  - ~/.claude/projects/.../memory/ (persistent patterns)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Substrates

### Current Substrates

| ID | Name | Port | Purpose | Color |
|----|------|------|---------|-------|
| `manager` | System Orchestrator | 3422 | Project management, health checks | `#00d9ff` |
| `wordpress` | WordPress Bridge | 3450 | CMS control via ASCII | `#00ff88` |
| `clawlauncher` | ClawLauncher | 3425 | AI agent launcher | `#00d9ff` |
| `youtube` | Safe YouTube | 3470 | Audio-only YouTube | `#ff0055` |
| `php` | PHP Bridge | 3480 | PHP site wrapper | `#ff9900` |

### Substrate API

Every substrate must implement:

```typescript
// GET / or /view - Returns ASCII representation
Response: text/plain (ASCII art)

// GET /health - Returns health status
Response: { "status": "healthy", "port": number }

// POST /control - Execute action
Request:  { "label": "A" }
Response: { "success": boolean, "action": string }
```

---

## Event Routing

### Global Keys

These keys **always** route to the Manager (3422):

| Key | Action |
|-----|--------|
| `A` | Go to Projects |
| `B` | Go to Templates |
| `R` | Refresh All |
| `H` | Health Check |
| `M` | Metrics |
| `X` | Global Shutdown |

### Local Keys

All other keys route to the **focused** substrate:

| Focus | Target | Example Keys |
|-------|--------|--------------|
| WP | WordPress (3450) | `D`, `P`, `G`, `S` |
| CLAW | ClawLauncher (3425) | `A`, `S`, `1-9` |
| YT | Safe YouTube (3470) | `1-3`, `P`, `S`, `M` |
| PHP | PHP Bridge (3480) | `H`, `A`, `C`, `R` |

---

## Running ASCII World

### Start All Services

```bash
# 1. Manager (port 3422)
bun run src/manager/manager-server.ts

# 2. WordPress Bridge (port 3450)
cd apps/wp-ascii-bridge && bun run src/bun/server.ts

# 3. ClawLauncher (port 3425)
cd apps/clawlauncher && bun run server.ts

# 4. Safe YouTube (port 3470)
cd apps/safe_browsing/src && python3 server.py

# 5. PHP Bridge (port 3480)
cd apps/php-bridge && python3 server.py

# 6. Portal Frontend (port 5174)
cd src/renderer && bun x vite demo --port 5174
```

### Access the Portal

```
http://localhost:5174/portal.html
```

---

## Creating a New Substrate

### Step 1: Create the Server

```python
# apps/my-substrate/server.py
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

PORT = 3490  # Choose an unused port

class MyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/view':
            ascii_view = """
╔════════════════════════════════════════╗
║  MY SUBSTRATE                          ║
╠════════════════════════════════════════╣
║  [A] Action 1   [B] Action 2           ║
║                                        ║
║  Status: ● Online                      ║
╚════════════════════════════════════════╝
"""
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(ascii_view.encode())

        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy", "port": PORT}).encode())

    def do_POST(self):
        if self.path == '/control':
            # Handle label actions
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            data = json.loads(body)
            label = data.get('label', '')

            # Process the label...
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), MyHandler)
    server.serve_forever()
```

### Step 2: Add to MasterPortal

```typescript
// src/renderer/components/portal/MasterPortal.tsx

// 1. Add URL constant
const MY_URL = 'http://localhost:3490';

// 2. Add state
const [myView, setMyView] = useState<string>('');

// 3. Add polling
try {
    const res = await fetch(MY_URL + '/');
    if (res.ok) setMyView(await res.text());
} catch (e) { setMyView("MY SUBSTRATE OFFLINE [3490]"); }

// 4. Add focus type
const [focus, setFocus] = useState<'WP' | 'CLAW' | 'YOUTUBE' | 'PHP' | 'MY'>('WP');

// 5. Add routing
else if (sourceSubstrate === 'MY' || (focus === 'MY' && !sourceSubstrate)) {
    targetUrl = MY_URL;
}

// 6. Add glass card
<div className="glass-card" style={{ borderLeft: '4px solid #customcolor' }}>
    <div className="card-title" style={{ color: '#customcolor' }}>My Substrate</div>
    <AutoRenderer ascii={myView} onControl={(l) => handleControl(l, 'MY')} />
</div>
```

---

## Visual Specifications

### Colors

| Element | Value |
|---------|-------|
| Background | `radial-gradient(circle at top right, #1a1a2e, #050508)` |
| Neural text | `#00ff41` (terminal green) |
| System accent | `#00d9ff` (neon blue) |
| Active substrate | `#00ff88` (neon green) |
| Glass background | `rgba(255, 255, 255, 0.03)` |
| Glass border | `rgba(255, 255, 255, 0.1)` |

### Typography

```css
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

### Layout

- Grid split: 40% Neural Map / 60% Reality Pane
- Glass cards: `backdrop-filter: blur(10px)`
- Polling interval: 1500ms

---

## Keyboard Shortcuts

Press `?` in the portal to toggle the help overlay.

### Global

| Key | Action |
|-----|--------|
| `?` | Toggle help |
| `Esc` | Close help |
| `A` | Projects |
| `B` | Templates |
| `R` | Refresh All |
| `H` | Health Check |
| `X` | Shutdown |

### YouTube

| Key | Action |
|-----|--------|
| `1-3` | Select video |
| `P` | Play |
| `S` | Stop |
| `M` | Mute |

---

## File Structure

```
ascii_world/
├── src/
│   ├── manager/
│   │   ├── manager-server.ts      # System orchestrator
│   │   ├── substrate-registry.ts  # Auto-discovery
│   │   └── templates/
│   │       └── master.ascii       # Portal template
│   ├── renderer/
│   │   ├── components/
│   │   │   ├── portal/
│   │   │   │   ├── MasterPortal.tsx
│   │   │   │   └── MasterPortal.css
│   │   │   └── AutoRenderer.tsx
│   │   ├── demo/
│   │   │   ├── portal.html        # Entry point
│   │   │   └── portal.tsx
│   │   └── hooks/
│   │       └── useAsciiState.ts
│   └── ascii/
│       ├── state/
│       ├── templates/
│       └── bindings.json
├── apps/
│   ├── wp-ascii-bridge/           # WordPress substrate
│   ├── clawlauncher/              # Agent launcher
│   ├── safe_browsing/             # YouTube substrate
│   └── php-bridge/                # PHP site wrapper
├── docs/
│   ├── ASCII-VISUAL-PATTERN.md    # Design standard
│   └── ASCII-WORLD-GUIDE.md       # This file
└── ~/.claude/
    └── skills/
        └── ascii-visual-portal.md # AI skill
```

---

## AI Integration

### For AI Agents

ASCII World is designed for AI-first interaction:

1. **Read State**: `GET http://localhost:PORT/`
2. **Parse Labels**: Look for `[A]`, `[B]`, etc.
3. **Execute**: `POST http://localhost:PORT/control {"label": "A"}`

### Example Agent Workflow

```python
import requests

# 1. Get current view
view = requests.get('http://localhost:3470/').text
print(view)

# 2. Parse available actions
# Look for [X] patterns in the ASCII

# 3. Execute action
requests.post('http://localhost:3470/control', json={'label': '1'})
requests.post('http://localhost:3470/control', json={'label': 'P'})

# 4. Verify state change
new_view = requests.get('http://localhost:3470/').text
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3422

# Kill process
kill -9 <PID>
```

### Substrate Not Responding

```bash
# Check health
curl http://localhost:PORT/health

# Check logs
# Each substrate prints to stdout
```

### Portal Not Loading

```bash
# Verify Vite is running
curl http://localhost:5174/portal.html

# Restart Vite
cd src/renderer && bun x vite demo --port 5174
```

---

## References

- [ASCII-Visual Pattern](./ASCII-VISUAL-PATTERN.md) - Design specification
- [ASCII-First Architecture](./ASCII-FIRST-ARCHITECTURE12.md) - Core architecture
- [Visual Demo](../src/renderer/demo/visual-demo.html) - Original demo

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-03-20 | Penta-substrate portal, Neural-Reality v2 |
| 1.0 | 2026-03-18 | Initial ASCII-First architecture |
