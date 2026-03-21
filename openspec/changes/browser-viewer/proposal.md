# Proposal: Browser Viewer

## Summary
Create an HTML/JavaScript browser viewer that connects to the pxOS server via WebSocket and renders the pixel buffer in real-time on an HTML canvas.

## Problem
- pxOS server exists but has no visual client
- Need a way to see the rendered output in a browser
- AI agents post data but humans can't see the result

## Solution
Single HTML file with:
- Canvas element for rendering PNG output
- WebSocket connection for live updates
- Auto-reconnect on disconnect
- Status indicator showing connection state

## Impact
- Visual feedback for AI agent data
- Real-time dashboard capability
- No build step required (single HTML file)

## Timeline
- Task 1: Create viewer HTML (15 min)
- Task 2: Add WebSocket logic (10 min)
- Task 3: Add connection status UI (5 min)
- Task 4: Test with server (5 min)

**Total: ~35 minutes**
