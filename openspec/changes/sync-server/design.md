# Design: Sync Server

## Architecture

```
┌─────────────┐
│  AI Agent   │
│  Browser    │
└──────┬──────┘
       │ HTTP / WebSocket
       ▼
┌─────────────────────────────┐
│  PxOSServer (sync/server.js) │
│                              │
│  ┌─────────────────────┐    │
│  │ HTTP Server         │    │
│  │ /health             │    │
│  │ /api/v1/cells       │    │
│  │ /api/v1/render      │    │
│  │ /api/v1/template    │    │
│  └─────────────────────┘    │
│                              │
│  ┌─────────────────────┐    │
│  │ WebSocket Server    │    │
│  │ broadcast(changes)  │    │
│  └─────────────────────┘    │
│                              │
│  ┌─────────────────────┐    │
│  │ CellStore           │    │
│  │ cells: {}           │    │
│  │ subscribers: Set    │    │
│  └──────────┬──────────┘    │
│             │ notify        │
│             ▼               │
│  ┌─────────────────────┐    │
│  │ PixelFormulaEngine  │    │
│  │ template → PNG      │    │
│  └─────────────────────┘    │
└──────────────────────────────┘
```

## Components

### CellStore (`sync/cell-store.js`)
- Reactive key-value store
- Notifies subscribers on change
- Returns only changed keys

### PxOSServer (`sync/server.js`)
- HTTP server on configurable port (default 3839)
- WebSocket server for live updates
- CORS enabled for browser clients

## HTTP API

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/health` | GET | - | `{status, timestamp}` |
| `/api/v1/cells` | GET | - | `{...cells}` |
| `/api/v1/cells` | POST | `{...cells}` | `{ok, changes}` |
| `/api/v1/render` | GET | - | PNG binary |
| `/api/v1/template` | POST | `[{fn, args}]` | `{ok, templateSize}` |

## WebSocket Protocol

### Server → Client
```json
{
  "type": "cells",
  "cells": { "cpu": 0.67, "mem": 28.1 },
  "changes": { "cpu": 0.67 }
}
```

### Connection
- On connect: server sends current state
- On cell change: server broadcasts to all clients

## Dependencies

- `ws` — WebSocket server
- `PixelFormulaEngine` — Rendering
- `CellStore` — State management

## File Structure

```
sync/
├── cell-store.js    — NEW
├── server.js        — NEW
├── pixel-*.js       — EXISTS

tests/
├── cell-store.test.js — NEW (7 tests)
├── server.test.js     — NEW (7 tests)
└── pixel-*.test.js    — EXISTS (28 tests)

bin/
└── pxos-server.js   — NEW (CLI)
```
