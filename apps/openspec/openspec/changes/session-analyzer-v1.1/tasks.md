# Session Analyzer v1.1 - Task Breakdown

## Phase 1: Config Infrastructure

### Task 1.1: Config Schema & Types
- [ ] Create `src/bun/config/types.ts` with AppConfig interface
- [ ] Create `src/bun/config/defaults.ts` with default config values
- [ ] Create `src/bun/config/validator.ts` with validation functions
- [ ] Write tests for config validation
- [ ] Commit: `feat(config): add configuration schema and validation`

### Task 1.2: Config Persistence
- [ ] Create `src/bun/config/manager.ts` with ConfigManager class
- [ ] Implement `loadConfig()` - read from JSON, validate, migrate
- [ ] Implement `saveConfig()` - validate, atomic write
- [ ] Add migration logic from v1.0 state format
- [ ] Write tests for persistence
- [ ] Commit: `feat(config): add configuration persistence with migration`

### Task 1.3: Profile Management
- [ ] Add `listProfiles()` to ConfigManager
- [ ] Add `saveProfile(name)` to ConfigManager
- [ ] Add `loadProfile(name)` to ConfigManager
- [ ] Add `deleteProfile(name)` to ConfigManager
- [ ] Create `~/.session-analyzer/profiles/` directory structure
- [ ] Write tests for profile operations
- [ ] Commit: `feat(config): add profile management`

## Phase 2: Auto-Schedule Engine

### Task 2.1: Scheduler Core
- [ ] Create `src/bun/scheduler/engine.ts` with SchedulerEngine class
- [ ] Implement interval-based scheduling (setTimeout recursion)
- [ ] Add start/stop/pause methods
- [ ] Prevent overlapping runs (isRunning check)
- [ ] Persist schedule state (lastRun, nextRun)
- [ ] Write tests for scheduler
- [ ] Commit: `feat(scheduler): add auto-schedule engine`

### Task 2.2: Scheduler Integration
- [ ] Integrate SchedulerEngine into main `index.ts`
- [ ] Connect scheduler to existing `runAnalysis()` function
- [ ] Add schedule state to global state object
- [ ] Emit events on schedule start/stop/complete
- [ ] Commit: `feat(scheduler): integrate with main process`

### Task 2.3: Idle Detection (Optional)
- [ ] Add `skipIfIdle` option to scheduler
- [ ] Check for file changes since last run
- [ ] Skip run if no changes detected
- [ ] Add idle state to status
- [ ] Commit: `feat(scheduler): add idle detection`

## Phase 3: Config UI

### Task 3.1: Config Tab Structure
- [ ] Add "Config" tab to main UI navigation
- [ ] Create `src/mainview/config/` directory
- [ ] Create `ConfigTab.ts` with tab container
- [ ] Create sub-tabs: Project, Schedule, Model, Prompts
- [ ] Add CSS styling for config forms
- [ ] Commit: `feat(ui): add config tab structure`

### Task 3.2: Config Forms
- [ ] Create `ProjectForm.ts` - path, watch patterns
- [ ] Create `ScheduleForm.ts` - interval, cron, options
- [ ] Create `ModelForm.ts` - provider, model, API settings
- [ ] Create `PromptsForm.ts` - system, runbook, commit template
- [ ] Add validation error display
- [ ] Commit: `feat(ui): add configuration forms`

### Task 3.3: Config RPC Integration
- [ ] Add RPC methods: `getConfig`, `updateConfig`, `resetConfig`
- [ ] Add RPC methods: `listProfiles`, `saveProfile`, `loadProfile`
- [ ] Connect forms to RPC calls
- [ ] Add save/reset buttons with confirmation
- [ ] Show toast on save success
- [ ] Commit: `feat(ui): connect config forms to backend`

## Phase 4: Status Bar & Polish

### Task 4.1: Status Bar Component
- [ ] Create `src/mainview/components/StatusBar.ts`
- [ ] Show schedule state: running/paused/scheduled
- [ ] Show countdown timer to next run
- [ ] Add quick toggle button (start/pause)
- [ ] Add stop button (when running)
- [ ] Commit: `feat(ui): add status bar with schedule controls`

### Task 4.2: Profile Dropdown
- [ ] Add profile dropdown to header
- [ ] Show current profile name
- [ ] List available profiles on click
- [ ] Switch profile on selection
- [ ] Show "Save Profile" option
- [ ] Commit: `feat(ui): add profile selector dropdown`

## Phase 5: API & MCP Updates

### Task 5.1: Config API Endpoints
- [ ] Add `GET /api/config` endpoint
- [ ] Add `POST /api/config` endpoint
- [ ] Add `POST /api/config/reset` endpoint
- [ ] Add profile endpoints: list, save, load, delete
- [ ] Add schedule endpoints: status, start, stop, trigger
- [ ] Update API documentation
- [ ] Commit: `feat(api): add config and schedule endpoints`

### Task 5.2: MCP Tool Updates
- [ ] Add `session_analyzer_config_get` tool
- [ ] Add `session_analyzer_config_set` tool
- [ ] Add `session_analyzer_schedule` tool
- [ ] Update `session_analyzer_status` to include schedule info
- [ ] Update MCP documentation
- [ ] Commit: `feat(mcp): add config and schedule tools`

## Execution Order

Tasks can be parallelized within phases:
- **Phase 1**: Tasks 1.1 → 1.2 → 1.3 (sequential, each depends on previous)
- **Phase 2**: Tasks 2.1 → 2.2 → 2.3 (sequential)
- **Phase 3**: Tasks 3.1 → 3.2 → 3.3 (sequential)
- **Phase 4**: Tasks 4.1, 4.2 can run in parallel
- **Phase 5**: Tasks 5.1, 5.2 can run in parallel

## Agent Assignment

| Agent Type | Assigned Tasks |
|------------|----------------|
| **Backend Developer** | Phase 1 (Config), Phase 2 (Scheduler) |
| **Frontend Developer** | Phase 3 (UI), Phase 4 (Status Bar) |
| **API Engineer** | Phase 5 (API/MCP) |
| **QA Engineer** | All phases (write/run tests) |

## Verification Checklist

After all phases complete:
- [ ] Auto-schedule runs at configured interval
- [ ] Config UI shows all settings correctly
- [ ] Changes apply without restart
- [ ] Profile save/load works
- [ ] Status bar shows accurate countdown
- [ ] API endpoints return correct data
- [ ] MCP tools work from Claude Code
- [ ] All tests pass
- [ ] No console errors
