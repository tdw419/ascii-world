# Design: Browser Viewer

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser (viewer.html)                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Status Bar                       │   │
│  │ ● Connected | Last: 14:05:32    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Canvas (480×240)                 │   │
│  │ [PNG rendered here]              │   │
│  │                                  │   │
│  │                                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Cell Inspector                   │   │
│  │ cpu: 0.67                        │   │
│  │ mem: 28.1                        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │
         │ WebSocket
         ▼
┌─────────────────────────────────────────┐
│  pxOS Server (localhost:3839)           │
└─────────────────────────────────────────┘
```

## Components

### 1. Canvas Renderer
- Fetches PNG from `/api/v1/render`
- Draws to canvas using `drawImage()`
- Refreshes on cell change

### 2. WebSocket Client
- Connects to `ws://localhost:3839`
- Receives cell updates
- Triggers canvas refresh

### 3. Status Bar
- Shows connection state (● connected, ○ disconnected)
- Shows last update timestamp
- Auto-reconnects on disconnect

### 4. Cell Inspector
- Displays current cell values
- Updates in real-time

## File Structure

```
viewer/
└── viewer.html    — Single HTML file (no build step)
```

## WebSocket Protocol

### Incoming Messages

```json
{
  "type": "cells",
  "cells": { "cpu": 0.67, "mem": 28.1 },
  "changes": { "cpu": 0.67 }
}
```

### Flow

1. Page loads
2. Connect to WebSocket
3. On connect: fetch initial PNG render
4. On cell update: fetch new PNG render
5. On disconnect: show "reconnecting..." and retry

## Features

| Feature | Description |
|---------|-------------|
| Auto-connect | Connects on page load |
| Auto-reconnect | Retries every 2s on disconnect |
| Status indicator | Green ● / Red ○ |
| Cell display | Shows all current cell values |
| Refresh rate | Only on change (push, not poll) |
| CORS | Server already allows * |

## Styling

Dark theme matching pxOS aesthetic:
- Background: `#0d1117`
- Border: `#30363d`
- Text: `#c9d1d9`
- Accent: `#238636` (green)

## No Dependencies

- Pure HTML/CSS/JavaScript
- No npm, no build, no bundler
- Single file that works from `file://` or any HTTP server
