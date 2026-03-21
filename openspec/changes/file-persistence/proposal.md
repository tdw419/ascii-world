# Proposal: File Persistence

## Summary
Save dashboards, templates, and configuration to files so they persist across server restarts.

## Problem
- Dashboards lost when server restarts
- Templates must be reconfigured each time
- No way to preserve state

## Solution
JSON file storage:
- `data/dashboards.json` - Saved dashboards
- `data/config.json` - Server configuration
- Auto-load on startup, auto-save on changes

## Timeline
- Task 1: Add file save/load (15 min)
- Task 2: Server startup integration (10 min)
- Task 3: Tests (10 min)

**Total: ~35 minutes**
