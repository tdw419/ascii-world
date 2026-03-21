# Proposal: Sync Server

## Summary
Build an HTTP + WebSocket server that exposes the PixelFormulaEngine via a clean API for AI agents and browser clients.

## Problem
- PixelFormulaEngine exists but has no external interface
- AI agents need a way to post cell values
- Browser clients need live updates via WebSocket
- No way to render and retrieve PNG output

## Solution
HTTP server with WebSocket support:
- `POST /api/v1/cells` — Update cell values from AI agents
- `GET /api/v1/cells` — Read current state
- `GET /api/v1/render` — Render PNG output
- `POST /api/v1/template` — Set render template
- `ws://localhost:3839` — Live updates

## Impact
- pxOS becomes usable by external systems
- AI agents can post data and get visual output
- Browser clients can subscribe to live updates
- Foundation for dashboard/monitoring applications

## Timeline
- Task 1: CellStore module (10 min)
- Task 2: Server module (20 min)
- Task 3: CLI entry point (5 min)
- Task 4: Documentation (5 min)
- Task 5: Verification (5 min)

**Total: ~45 minutes**
