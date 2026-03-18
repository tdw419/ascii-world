# Session Analyzer v1.1 - Technical Specification

## Overview

This specification defines the requirements for auto-scheduling and configuration UI in Session Analyzer v1.1.

## Requirements

### SCHED-001: Auto-Schedule Engine

**Priority:** Critical
**Status:** Required**

Background timer that triggers analysis at configurable intervals.

| Requirement | Description |
|-------------|-------------|
| SCHED-001.1 | Configurable interval (1min - 24hours) |
| SCHED-001.2 | Start/stop/pause controls |
| SCHED-001.3 | Respects system idle state (optional) |
| SCHED-001.4 | Prevents overlapping runs |
| SCHED-001.5 | Persists schedule state across restarts |

**ScheduleConfig Structure:**
```typescript
interface ScheduleConfig {
  enabled: boolean;
  intervalMs: number;        // 60000 - 86400000
  cronExpression?: string;   // Optional: "*/5 * * * *" format
  skipIfIdle: boolean;       // Skip if no file changes
  maxConcurrent: 1;          // Always 1 for now
  lastRunTime: string | null;
  nextRunTime: string | null;
}
```

**Acceptance Criteria:**
- [ ] Runs trigger at exact interval ±1 second
- [ ] Can be paused/resumed without restart
- [ ] No drift over long operation
- [ ] State persists across app restart

### SCHED-002: Configuration Schema

**Priority:** Critical
**Status:** Required**

Unified configuration schema for all app settings.

| Requirement | Description |
|-------------|-------------|
| SCHED-002.1 | Project path configuration |
| SCHED-002.2 | Schedule settings (interval, enabled) |
| SCHED-002.3 | Model settings (API key, model ID) |
| SCHED-002.4 | Prompt template customization |
| SCHED-002.5 | Notification preferences |

**AppConfig Structure:**
```typescript
interface AppConfig {
  version: "1.1";
  project: {
    path: string;
    watchGit: boolean;
    watchPatterns: string[];
    ignorePatterns: string[];
  };
  schedule: ScheduleConfig;
  model: {
    provider: "openai" | "anthropic" | "zai" | "local";
    modelId: string;
    apiKeyEnv: string;         // Env var name, not actual key
    baseUrl?: string;
    temperature: number;
    maxTokens: number;
  };
  prompts: {
    systemPrompt: string;
    runbookPrompt: string;
    commitTemplate: string;
  };
  notifications: {
    enabled: boolean;
    onRunComplete: boolean;
    onTestFail: boolean;
    onError: boolean;
  };
  ui: {
    theme: "dark" | "light";
    showTrayIcon: boolean;
    minimizeToTray: boolean;
  };
}
```

**Acceptance Criteria:**
- [ ] Schema validates on load
- [ ] Migration from v1.0 state format
- [ ] Defaults sensible for new users
- [ ] Sensitive fields (API keys) never logged

### SCHED-003: Configuration UI

**Priority:** High
**Status:** Required**

Visual editor for all configuration options.

| Requirement | Description |
|-------------|-------------|
| SCHED-003.1 | Tab-based layout (Project, Schedule, Model, Prompts) |
| SCHED-003.2 | Form validation with error messages |
| SCHED-003.3 | Save/Reset buttons |
| SCHED-003.4 | Live preview for prompt changes |
| SCHED-003.5 | Profile save/load dropdown |

**UI Components:**
```typescript
// Config Tab Structure
const CONFIG_TABS = [
  { id: "project", label: "Project", icon: "folder" },
  { id: "schedule", label: "Schedule", icon: "clock" },
  { id: "model", label: "Model", icon: "cpu" },
  { id: "prompts", label: "Prompts", icon: "file-text" },
  { id: "notifications", label: "Notifications", icon: "bell" },
];
```

**Acceptance Criteria:**
- [ ] All config fields editable
- [ ] Validation errors shown inline
- [ ] Changes apply immediately (no restart)
- [ ] Reset to defaults works
- [ ] Profile switching works

### SCHED-004: Status Bar

**Priority:** High
**Status:** Required**

Real-time status display in app header.

| Requirement | Description |
|-------------|-------------|
| SCHED-004.1 | Next run countdown timer |
| SCHED-004.2 | Schedule enabled/disabled indicator |
| SCHED-004.3 | Current run progress (if running) |
| SCHED-004.4 | Quick toggle for schedule on/off |

**Status Bar Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Session Analyzer          ⏸️ Paused │ Next: --:-- │ ▶ Start │
└─────────────────────────────────────────────────────────────┘

Running:
┌─────────────────────────────────────────────────────────────┐
│ Session Analyzer          ▶️ Running │ Elapsed: 02:34 │ ⏹ Stop │
└─────────────────────────────────────────────────────────────┘

Scheduled:
┌─────────────────────────────────────────────────────────────┐
│ Session Analyzer          🔄 Auto │ Next: 02:30 │ ⏸ Pause │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Countdown accurate to second
- [ ] Visual state clear at glance
- [ ] Toggle buttons work correctly
- [ ] Updates in real-time

### SCHED-005: Profile Management

**Priority:** Medium
**Status:** Required**

Save/load configurations for different projects.

| Requirement | Description |
|-------------|-------------|
| SCHED-005.1 | Save current config as named profile |
| SCHED-005.5 | List saved profiles |
| SCHED-005.3 | Load profile by name |
| SCHED-005.4 | Delete profile |
| SCHED-005.5 | Profile includes project path |

**Profile Storage:**
```
~/.session-analyzer/
├── profiles/
│   ├── geometry-os.json
│   ├── ai-auto-dev.json
│   └── default.json
├── config.json           # Active config
└── state.json            # Runtime state
```

**Acceptance Criteria:**
- [ ] Profile list shows all saved
- [ ] Switching profile updates all settings
- [ ] Profile name shown in title bar
- [ ] Last used profile remembered

## API Endpoints

### New Endpoints

```
GET  /api/config              - Get current config
POST /api/config              - Update config (partial OK)
POST /api/config/reset        - Reset to defaults
GET  /api/profiles            - List profiles
POST /api/profiles            - Save current as profile
GET  /api/profiles/:name      - Load profile
DELETE /api/profiles/:name    - Delete profile
GET  /api/schedule            - Get schedule status
POST /api/schedule/start      - Start auto-schedule
POST /api/schedule/stop       - Stop auto-schedule
POST /api/schedule/trigger    - Manual trigger (immediate)
```

## MCP Tool Updates

### Updated Tools

```typescript
const SESSION_ANALYZER_TOOLS_V11 = [
  {
    name: "session_analyzer_status",
    // Add: scheduleState, nextRunTime
  },
  {
    name: "session_analyzer_run",
    // Add: options: { schedule: boolean }
  },
  {
    name: "session_analyzer_config_get",
    description: "Get current configuration",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "session_analyzer_config_set",
    description: "Update configuration",
    inputSchema: {
      type: "object",
      properties: {
        config: { type: "object" }
      }
    }
  },
  {
    name: "session_analyzer_schedule",
    description: "Control auto-schedule",
    inputSchema: {
      type: "object",
      properties: {
        action: { enum: ["start", "stop", "status"] }
      }
    }
  }
];
```

## Integration Points

### Existing Components

```
SchedulerEngine (new)
    │
    ├──► AnalysisRunner (existing)
    │        └──► runAnalysis()
    │
    ├──► ConfigManager (new)
    │        └──► loadConfig(), saveConfig()
    │
    └──► StatePersistence (existing)
             └──► session_analyzer_state.json
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Config load | <50ms |
| Config save | <100ms |
| Schedule trigger latency | <1s |
| UI update on config change | <100ms |
| Profile switch | <200ms |

## Quality Requirements

| Metric | Target |
|--------|--------|
| Test coverage | >80% |
| Config validation | 100% fields |
| No schedule drift | ±1s per hour |
| Zero config loss | Never |
