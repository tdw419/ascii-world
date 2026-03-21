# Proposal: Built-in Status Dashboard

## Summary
Add a pre-configured status dashboard that shows pxOS server health and metrics.

## Problem
- No built-in way to see server status
- Need to manually create monitoring dashboard
- Want quick health check visualization

## Solution
Built-in `/status` endpoint returns a pre-configured dashboard showing:
- Uptime
- Connected clients
- Cell count
- Alert count
- Memory usage
- Request rate

## Timeline
- Task 1: Add /status dashboard endpoint (10 min)
- Task 2: Add server metrics tracking (10 min)
- Task 3: Tests (5 min)

**Total: ~25 minutes**
