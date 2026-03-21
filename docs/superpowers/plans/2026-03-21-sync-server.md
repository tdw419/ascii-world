# pxOS Sync Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an HTTP + WebSocket server that exposes the PixelFormulaEngine via a clean API for AI agents and browser clients.

**Architecture:** Node.js HTTP server with WebSocket support. Cell store holds reactive state. PixelFormulaEngine evaluates templates. PNG output served via HTTP. Live updates broadcast via WebSocket.

**Tech Stack:** Node.js ES modules, ws (WebSocket), PixelFormulaEngine, PixelBuffer

---

## Overview

The server provides:

```
HTTP API:
  POST /api/v1/cells          → Update cell values
  GET  /api/v1/cells          → Read current cell values
  GET  /api/v1/render         → Render current state as PNG
  GET  /health                → Health check

WebSocket:
  ws://localhost:3839         → Live updates when cells change
```

## File Structure

```
pxos/
├── sync/
│   ├── pixel-buffer.js        — EXISTS
│   ├── glyph-atlas.js         — EXISTS
│   ├── pixel-formula-engine.js — EXISTS
│   ├── pixel-renderer.js      — EXISTS
│   ├── cell-store.js          — NEW: Key-value state management
│   └── server.js              — NEW: HTTP + WebSocket server
├── tests/
│   ├── pixel-*.test.js        — EXISTS (28 tests)
│   ├── cell-store.test.js     — NEW: Cell store tests
│   └── server.test.js         — NEW: Server API tests
└── package.json               — UPDATE: Add ws dependency
```

---

## Task 1: Create CellStore Module

**Files:**
- Create: `sync/cell-store.js`
- Test: `tests/cell-store.test.js`

### Design

CellStore manages reactive cell values and notifies subscribers on change.

```javascript
class CellStore {
  constructor() {
    this.cells = {};
    this.subscribers = new Set();
  }

  setCells(cells)           // Update multiple cells
  getCells()                // Get all cells
  getCell(key)              // Get single cell
  subscribe(callback)       // Register change listener
  unsubscribe(callback)     // Remove listener
}
```

- [ ] **Step 1: Create cell-store.js skeleton**

```javascript
// sync/cell-store.js
// Reactive cell store with change notification

export class CellStore {
    constructor() {
        this.cells = {};
        this.subscribers = new Set();
    }

    setCells(cells) {
        const changes = {};
        for (const [key, value] of Object.entries(cells)) {
            if (this.cells[key] !== value) {
                this.cells[key] = value;
                changes[key] = value;
            }
        }
        if (Object.keys(changes).length > 0) {
            this.notify(changes);
        }
        return changes;
    }

    getCells() {
        return { ...this.cells };
    }

    getCell(key) {
        return this.cells[key];
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.unsubscribe(callback);
    }

    unsubscribe(callback) {
        this.subscribers.delete(callback);
    }

    notify(changes) {
        for (const callback of this.subscribers) {
            callback(changes, this.cells);
        }
    }
}
```

- [ ] **Step 2: Create test file**

```javascript
// tests/cell-store.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CellStore } from '../sync/cell-store.js';

describe('CellStore', () => {
    let store;

    beforeEach(() => {
        store = new CellStore();
    });

    it('starts empty', () => {
        assert.deepStrictEqual(store.getCells(), {});
    });

    it('setCells stores values', () => {
        store.setCells({ cpu: 0.67, mem: 28.1 });
        assert.strictEqual(store.getCell('cpu'), 0.67);
        assert.strictEqual(store.getCell('mem'), 28.1);
    });

    it('getCells returns copy', () => {
        store.setCells({ cpu: 0.5 });
        const cells = store.getCells();
        cells.cpu = 0.9;
        assert.strictEqual(store.getCell('cpu'), 0.5);
    });

    it('setCells returns only changed keys', () => {
        store.setCells({ cpu: 0.5 });
        const changes = store.setCells({ cpu: 0.5, mem: 10 });
        assert.deepStrictEqual(changes, { mem: 10 });
    });

    it('subscribe notifies on change', () => {
        let notified = null;
        store.subscribe((changes, cells) => {
            notified = { changes, cells };
        });
        store.setCells({ cpu: 0.75 });
        assert.deepStrictEqual(notified.changes, { cpu: 0.75 });
        assert.strictEqual(notified.cells.cpu, 0.75);
    });

    it('subscribe returns unsubscribe function', () => {
        let count = 0;
        const unsub = store.subscribe(() => count++);
        store.setCells({ cpu: 0.5 });
        assert.strictEqual(count, 1);
        unsub();
        store.setCells({ cpu: 0.6 });
        assert.strictEqual(count, 1);
    });

    it('no notification if no changes', () => {
        let count = 0;
        store.subscribe(() => count++);
        store.setCells({ cpu: 0.5 });
        store.setCells({ cpu: 0.5 });
        assert.strictEqual(count, 1);
    });
});
```

- [ ] **Step 3: Run tests**

```bash
node --test tests/cell-store.test.js
```

Expected: 7 tests pass

- [ ] **Step 4: Commit**

```bash
git add sync/cell-store.js tests/cell-store.test.js
git commit -m "feat: add CellStore with reactive change notification (7 tests)"
```

---

## Task 2: Create Server Module

**Files:**
- Create: `sync/server.js`
- Test: `tests/server.test.js`
- Modify: `package.json` (add ws dependency)

### Design

HTTP server with WebSocket upgrade. CellStore holds state. PixelFormulaEngine renders output.

```javascript
class PxOSServer {
  constructor(port = 3839)
  start()
  stop()
  handleHTTPRequest(req, res)
  handleWebSocket(ws)
}
```

### API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/cells` | GET | Get all cell values |
| `/api/v1/cells` | POST | Update cell values |
| `/api/v1/render` | GET | Render current state as PNG |
| `/api/v1/template` | POST | Set render template |

- [ ] **Step 1: Update package.json with ws dependency**

```json
{
  "dependencies": {
    "sharp": "^0.33.0",
    "ws": "^8.18.0"
  }
}
```

Run: `npm install`

- [ ] **Step 2: Create server.js skeleton**

```javascript
// sync/server.js
// HTTP + WebSocket server for pxOS

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { CellStore } from './cell-store.js';
import { PixelFormulaEngine } from './pixel-formula-engine.js';

export class PxOSServer {
    constructor(port = 3839) {
        this.port = port;
        this.cellStore = new CellStore();
        this.engine = new PixelFormulaEngine(480, 240);
        this.template = [];
        this.httpServer = null;
        this.wss = null;
        this.clients = new Set();
    }

    async start() {
        // Create HTTP server
        this.httpServer = createServer((req, res) => {
            this.handleHTTPRequest(req, res);
        });

        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.httpServer });
        this.wss.on('connection', (ws) => this.handleWebSocket(ws));

        // Subscribe to cell changes
        this.cellStore.subscribe((changes, cells) => {
            this.broadcast({ type: 'cells', changes, cells });
        });

        return new Promise((resolve) => {
            this.httpServer.listen(this.port, () => {
                console.log(`pxOS server listening on http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.wss) {
                for (const client of this.clients) {
                    client.close();
                }
                this.wss.close();
            }
            if (this.httpServer) {
                this.httpServer.close(() => {
                    console.log('pxOS server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async handleHTTPRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const pathname = url.pathname;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        try {
            if (pathname === '/health') {
                this.handleHealth(req, res);
            } else if (pathname === '/api/v1/cells') {
                if (req.method === 'GET') {
                    this.handleGetCells(req, res);
                } else if (req.method === 'POST') {
                    await this.handlePostCells(req, res);
                } else {
                    this.sendError(res, 405, 'Method not allowed');
                }
            } else if (pathname === '/api/v1/render') {
                await this.handleRender(req, res);
            } else if (pathname === '/api/v1/template') {
                if (req.method === 'POST') {
                    await this.handlePostTemplate(req, res);
                } else {
                    this.sendError(res, 405, 'Method not allowed');
                }
            } else {
                this.sendError(res, 404, 'Not found');
            }
        } catch (err) {
            console.error('Request error:', err);
            this.sendError(res, 500, 'Internal server error');
        }
    }

    handleHealth(req, res) {
        this.sendJSON(res, 200, { status: 'ok', timestamp: Date.now() });
    }

    handleGetCells(req, res) {
        this.sendJSON(res, 200, this.cellStore.getCells());
    }

    async handlePostCells(req, res) {
        const body = await this.readBody(req);
        const cells = JSON.parse(body);
        const changes = this.cellStore.setCells(cells);
        this.sendJSON(res, 200, { ok: true, changes });
    }

    async handleRender(req, res) {
        this.engine.setCells(this.cellStore.getCells());
        this.engine.renderTemplate(this.template);
        const png = await this.engine.toPNG();
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(png);
    }

    async handlePostTemplate(req, res) {
        const body = await this.readBody(req);
        this.template = JSON.parse(body);
        this.sendJSON(res, 200, { ok: true, templateSize: this.template.length });
    }

    handleWebSocket(ws) {
        this.clients.add(ws);
        console.log(`WebSocket client connected. Total: ${this.clients.size}`);

        // Send current state
        ws.send(JSON.stringify({
            type: 'cells',
            cells: this.cellStore.getCells(),
            changes: {}
        }));

        ws.on('close', () => {
            this.clients.delete(ws);
            console.log(`WebSocket client disconnected. Total: ${this.clients.size}`);
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            this.clients.delete(ws);
        });
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(data);
            }
        }
    }

    readBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    sendJSON(res, status, data) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    sendError(res, status, message) {
        this.sendJSON(res, status, { error: message });
    }
}
```

- [ ] **Step 3: Create server test file**

```javascript
// tests/server.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { PxOSServer } from '../sync/server.js';

describe('PxOSServer', () => {
    let server;

    beforeEach(async () => {
        server = new PxOSServer(3840); // Use different port for tests
        await server.start();
    });

    afterEach(async () => {
        await server.stop();
    });

    it('starts and stops', () => {
        assert.ok(server.httpServer);
    });

    it('GET /health returns ok', async () => {
        const res = await fetch('http://localhost:3840/health');
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, 'ok');
    });

    it('GET /api/v1/cells returns empty object initially', async () => {
        const res = await fetch('http://localhost:3840/api/v1/cells');
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.deepStrictEqual(data, {});
    });

    it('POST /api/v1/cells stores values', async () => {
        const res1 = await fetch('http://localhost:3840/api/v1/cells', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpu: 0.67, mem: 28 })
        });
        assert.strictEqual(res1.status, 200);
        const data1 = await res1.json();
        assert.strictEqual(data1.ok, true);

        const res2 = await fetch('http://localhost:3840/api/v1/cells');
        const data2 = await res2.json();
        assert.strictEqual(data2.cpu, 0.67);
        assert.strictEqual(data2.mem, 28);
    });

    it('GET /api/v1/render returns PNG', async () => {
        // Set template first
        await fetch('http://localhost:3840/api/v1/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ fn: 'BAR', args: [0, 0, 'cpu', 40] }])
        });

        await fetch('http://localhost:3840/api/v1/cells', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpu: 0.5 })
        });

        const res = await fetch('http://localhost:3840/api/v1/render');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('content-type'), 'image/png');

        const buffer = await res.arrayBuffer();
        // Check PNG magic bytes
        const view = new Uint8Array(buffer);
        assert.strictEqual(view[0], 0x89);
        assert.strictEqual(view[1], 0x50); // 'P'
        assert.strictEqual(view[2], 0x4E); // 'N'
        assert.strictEqual(view[3], 0x47); // 'G'
    });

    it('POST /api/v1/template sets render template', async () => {
        const template = [
            { fn: 'BAR', args: [0, 0, 'cpu', 40] },
            { fn: 'TEXT', args: [42, 0, 'cpu'] }
        ];
        const res = await fetch('http://localhost:3840/api/v1/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(template)
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.ok, true);
        assert.strictEqual(data.templateSize, 2);
    });

    it('returns 404 for unknown routes', async () => {
        const res = await fetch('http://localhost:3840/unknown');
        assert.strictEqual(res.status, 404);
    });
});
```

- [ ] **Step 4: Run tests**

```bash
npm install
node --test tests/cell-store.test.js tests/server.test.js
```

Expected: 7 + 7 = 14 tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add PxOSServer with HTTP API and WebSocket (14 tests)

API:
- GET /health - health check
- GET /api/v1/cells - read cell values
- POST /api/v1/cells - update cell values
- GET /api/v1/render - render PNG
- POST /api/v1/template - set render template
- WebSocket ws://localhost:3839 - live updates"
```

---

## Task 3: Create CLI Entry Point

**Files:**
- Create: `bin/pxos-server.js`
- Modify: `package.json` (add bin)

- [ ] **Step 1: Create CLI entry point**

```javascript
#!/usr/bin/env node
// bin/pxos-server.js
// CLI entry point for pxOS server

import { PxOSServer } from '../sync/server.js';

const port = parseInt(process.env.PORT || process.argv[2] || '3839');

const server = new PxOSServer(port);

process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
});

server.start().then(() => {
    console.log(`pxOS server running on http://localhost:${port}`);
    console.log(`WebSocket: ws://localhost:${port}`);
    console.log('Press Ctrl+C to stop');
});
```

- [ ] **Step 2: Update package.json**

```json
{
  "bin": {
    "pxos-server": "./bin/pxos-server.js"
  },
  "scripts": {
    "start": "node bin/pxos-server.js",
    "test": "node --test tests/*.test.js"
  }
}
```

- [ ] **Step 3: Make CLI executable**

```bash
chmod +x bin/pxos-server.js
```

- [ ] **Step 4: Test CLI**

```bash
node bin/pxos-server.js &
sleep 1
curl http://localhost:3839/health
# {"status":"ok","timestamp":...}
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add bin/pxos-server.js package.json
git commit -m "feat: add CLI entry point (pxos-server)"
```

---

## Task 4: Update Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add server documentation to README**

Add after the "Usage" section:

```markdown
## Running the Server

```bash
# Install dependencies
npm install

# Start server
npm start
# or: node bin/pxos-server.js
# or: PORT=8080 npm start

# Server runs on http://localhost:3839
```

## API Reference

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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add server API documentation"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: 28 + 7 + 7 = 42 tests pass

- [ ] **Step 2: Test server manually**

```bash
# Start server
node bin/pxos-server.js &

# Set template
curl -X POST http://localhost:3839/api/v1/template \
  -H 'Content-Type: application/json' \
  -d '[{"fn":"BAR","args":[0,0,"cpu",40]}]'

# Update cells
curl -X POST http://localhost:3839/api/v1/cells \
  -H 'Content-Type: application/json' \
  -d '{"cpu":0.75}'

# Get PNG
curl -o test.png http://localhost:3839/api/v1/render
file test.png
# test.png: PNG image data, 480 x 240, 8-bit/color RGBA

# Cleanup
kill %1
```

- [ ] **Step 3: Check git status**

```bash
git status && git log --oneline -5
```

Expected: Clean working tree, commits show server implementation

---

## Summary

| Task | Steps | Files Changed | Tests |
|------|-------|---------------|-------|
| CellStore | 4 | 2 files | +7 |
| Server | 5 | 3 files | +7 |
| CLI | 5 | 2 files | 0 |
| Docs | 2 | 1 file | 0 |
| Verify | 3 | 0 files | 0 |
| **Total** | **19** | **8 files** | **+14** |

**Estimated time:** 30-45 minutes

**Result:** Full HTTP + WebSocket server exposing PixelFormulaEngine via clean API.

**Total tests:** 42 (28 existing + 14 new)
