# Proposal: Dashboard Templates

## Summary
Add ability to save, load, and manage visualization templates as named dashboards.

## Problem
- Templates are ephemeral (lost on restart)
- No way to save multiple dashboard configurations
- Can't switch between different views

## Solution
Template management API:
- POST /api/v1/dashboards - Save current template as named dashboard
- GET /api/v1/dashboards - List saved dashboards
- GET /api/v1/dashboards/:name - Load dashboard
- DELETE /api/v1/dashboards/:name - Delete dashboard

## Timeline
- Task 1: Template store (10 min)
- Task 2: Server endpoints (10 min)
- Task 3: Tests (10 min)

**Total: ~30 minutes**
