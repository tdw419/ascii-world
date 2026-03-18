# Session Analyzer v1.1 - Auto-Schedule & Config UI

## Problem

The Session Analyzer desktop app currently requires manual triggering for each analysis run. This creates friction:

- **No autonomous operation** - User must click "Run Now" every time
- **Config requires code changes** - To adjust prompts, intervals, or model settings, user must edit source files
- **No visual feedback** - Config is hidden in JSON files, not exposed in the UI
- **Single project limitation** - Can only monitor one project at a time

## Proposed Solution

Add **auto-scheduling** and **configuration UI** to enable autonomous, hands-off operation:

1. **Auto-Schedule Engine** - Background timer that triggers analysis at configurable intervals
2. **Config Editor UI** - Visual editor for prompts, model settings, schedule
3. **Project Profiles** - Save/load configurations for multiple projects
4. **Status Bar** - Show next scheduled run, countdown timer

This transforms the app from a manual tool into an autonomous agent companion.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Session Analyzer App v1.1                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    CONFIG LAYER                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ profiles/   │  │ config.json │  │  ConfigUI    │  │  │
│  │  │ *.json      │  │ (active)    │  │  (Tab)       │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  SCHEDULER LAYER                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ Timer       │  │ CronParser  │  │  RunQueue    │  │  │
│  │  │ (Interval)  │  │ (Flexible)  │  │  (Ordered)   │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    UI LAYER                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ Dashboard   │  │ Config Tab  │  │  Status Bar  │  │  │
│  │  │ (Existing)  │  │ (New)       │  │  (New)       │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    API LAYER                          │  │
│  │  GET /config          - Get current config            │  │
│  │  POST /config         - Update config                 │  │
│  │  GET /schedule        - Get schedule status           │  │
│  │  POST /schedule/start - Start auto-schedule           │  │
│  │  POST /schedule/stop  - Stop auto-schedule            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Resources

| Resource | Path |
|----------|------|
| **Current App** | `apps/session-analyzer-app/` |
| **HTTP API** | `apps/session-analyzer-app/src/bun/api.ts` |
| **Main Process** | `apps/session-analyzer-app/src/bun/index.ts` |
| **Frontend** | `apps/session-analyzer-app/src/mainview/` |
| **MCP Server** | `apps/session-analyzer-app/src/bun/mcp.ts` |

## Success Criteria

- [ ] Auto-schedule runs analysis at configured interval
- [ ] Config UI shows all editable settings
- [ ] Changes to config take effect immediately
- [ ] Profile save/load works correctly
- [ ] Status bar shows countdown to next run
- [ ] All existing functionality still works
- [ ] API endpoints for config/schedule work
- [ ] MCP tools updated to support scheduling

## Phases

| Phase | Focus | Tasks |
|-------|-------|-------|
| 1 | Config Infrastructure | 3 tasks |
| 2 | Auto-Schedule Engine | 3 tasks |
| 3 | Config UI | 3 tasks |
| 4 | Status Bar & Polish | 2 tasks |
| 5 | API & MCP Updates | 2 tasks |
