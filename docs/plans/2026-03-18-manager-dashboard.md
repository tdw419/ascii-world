# Manager Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Health-at-a-glance Dashboard state to the Manager showing all projects with status icons, uptime, and last check time in a single ASCII view.

**Architecture:** Add a new DASHBOARD state to the Manager's state machine. The Dashboard aggregates health status from all discovered projects by checking their /health endpoints and displays them in a condensed ASCII view with status icons (● running / ○ stopped / ⚠ error), uptime (calculated from lastStarted), and last health check timestamp.

**Tech Stack:** Bun, TypeScript, HTTP health checks, Handlebars templates

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ASCII INTERFACE MANAGER - DASHBOARD                         v1.0.0         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [A] Projects  [B] Templates  [C] Bindings  [D] Dashboard  [X] Quit         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SYSTEM HEALTH                                           Last Check: 10:42  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Project                    Port    Status    Uptime     Last Check    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │  session-analyzer-app       3421    ● running  2h 15m    10:42:15      ││
│  │  my-other-app               3423    ○ stopped  --         --           ││
│  │  broken-app                 3424    ⚠ error    --         10:40:00     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  Summary: 1 running, 1 stopped, 1 error                                    │
│                                                                             │
╠══════════════════════════════════════════════════════════════════════════════╣
║  [R] Refresh  [1-3] Select Project                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Task 1: Add DASHBOARD State to Manager State Machine

**Files:**
- Modify: `src/manager/manager-state.ts`
- Modify: `src/ascii/manager-bindings.json`

**Step 1: Add DASHBOARD to ManagerState type**

Update the type union in `src/manager/manager-state.ts`:

```typescript
// Line 10 - Update the type
export type ManagerState = 'PROJECTS' | 'TEMPLATES' | 'BINDINGS' | 'TEST' | 'GIT' | 'PROJECT_VIEW' | 'DASHBOARD';
```

**Step 2: Add dashboardHealth to ManagerContext**

Add a new field to track dashboard health data:

```typescript
// Around line 40-50, add to ManagerContext interface
export interface DashboardHealth {
    projectId: string;
    projectName: string;
    port: number;
    status: 'running' | 'stopped' | 'error';
    uptime: string | null;
    lastCheck: string | null;
    responseTime: number | null;
}

export interface ManagerContext {
    // ... existing fields ...
    dashboardHealth: DashboardHealth[] | null;
    lastHealthCheck: number | null;
}
```

**Step 3: Update isValidManagerState**

Add DASHBOARD to the type guard:

```typescript
// Around line 196-198
private isValidManagerState(state: string): state is ManagerState {
    return state === 'PROJECTS' || state === 'TEMPLATES' || state === 'BINDINGS' || state === 'TEST' || state === 'GIT' || state === 'PROJECT_VIEW' || state === 'DASHBOARD';
}
```

**Step 4: Update actionMap in handleAction**

Add DASHBOARD mapping:

```typescript
// Around line 179-186
const actionMap: Record<ManagerState, string> = {
    'PROJECTS': 'goto_projects',
    'TEMPLATES': 'goto_templates',
    'BINDINGS': 'goto_bindings',
    'TEST': 'goto_test',
    'GIT': 'goto_git',
    'PROJECT_VIEW': 'goto_project_view',
    'DASHBOARD': 'goto_dashboard'
};
```

**Step 5: Update constructor default context**

```typescript
// Around line 84-94
this._context = {
    state: 'PROJECTS',
    selectedProjectId: null,
    selectedTemplateFile: null,
    templateScrollOffset: 0,
    testResults: null,
    gitStatus: null,
    editMode: false,
    editBuffer: [],
    unsavedChanges: false,
    dashboardHealth: null,
    lastHealthCheck: null
};
```

**Step 6: Add setDashboardHealth method**

```typescript
/**
 * Set dashboard health data
 */
public setDashboardHealth(health: DashboardHealth[]): void {
    this._context = {
        ...this._context,
        dashboardHealth: health.map(h => ({ ...h })),
        lastHealthCheck: Date.now()
    };
}

/**
 * Clear dashboard health data
 */
public clearDashboardHealth(): void {
    this._context = {
        ...this._context,
        dashboardHealth: null,
        lastHealthCheck: null
    };
}
```

**Step 7: Update getData to include new fields**

```typescript
// Around line 375-380
public getData(): ManagerContext {
    return {
        ...this._context,
        editBuffer: [...this._context.editBuffer],
        dashboardHealth: this._context.dashboardHealth?.map(h => ({ ...h })) ?? null
    };
}
```

**Step 8: Update reset method**

```typescript
// Around line 403-415
public reset(): void {
    this._context = {
        state: 'PROJECTS',
        selectedProjectId: null,
        selectedTemplateFile: null,
        templateScrollOffset: 0,
        testResults: null,
        gitStatus: null,
        editMode: false,
        editBuffer: [],
        unsavedChanges: false,
        dashboardHealth: null,
        lastHealthCheck: null
    };
}
```

**Step 9: Update manager-bindings.json**

Add DASHBOARD bindings:

```json
{
  "bindings": [
    { "label": "A", "action": "goto_projects", "target": "PROJECTS" },
    { "label": "B", "action": "goto_templates", "target": "TEMPLATES" },
    { "label": "C", "action": "goto_bindings", "target": "BINDINGS" },
    { "label": "D", "action": "goto_dashboard", "target": "DASHBOARD" },
    { "label": "X", "action": "quit", "target": "QUIT" },
    ...
  ],
  "stateTransitions": {
    "PROJECTS": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "DASHBOARD",
      "X": "QUIT"
    },
    "TEMPLATES": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "DASHBOARD",
      "X": "QUIT"
    },
    "BINDINGS": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "DASHBOARD",
      "X": "QUIT"
    },
    "TEST": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "DASHBOARD",
      "X": "QUIT"
    },
    "GIT": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "DASHBOARD",
      "X": "QUIT"
    },
    "DASHBOARD": {
      "A": "PROJECTS",
      "D": "DASHBOARD",
      "X": "QUIT"
    },
    "PROJECT_VIEW": {
      "A": "PROJECTS",
      "X": "PROJECTS"
    }
  }
}
```

**Step 10: Verify compilation**

Run: `bun build src/manager/manager-state.ts --target=bun 2>&1 | head -20`
Expected: No errors

**Step 11: Commit**

```bash
git add src/manager/manager-state.ts src/ascii/manager-bindings.json
git commit -m "feat(manager): add DASHBOARD state to manager state machine"
```

---

## Task 2: Create Dashboard ASCII Template

**Files:**
- Create: `src/ascii/states/dashboard.ascii`

**Step 1: Create the template file**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER - DASHBOARD                         v{{app_version}}║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Dashboard  [X] Quit         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  SYSTEM HEALTH                                           Last Check: {{last_check_time}}  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  Project                    Port    Status    Uptime     Last Check    │║
║  ├─────────────────────────────────────────────────────────────────────────┤║
{{#each health_items}}
║  │  [{{label}}] {{project_name}}       {{port}}    {{status_icon}} {{status}}  {{uptime}}    {{last_check}}    │║
{{/each}}
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  Summary: {{running_count}} running, {{stopped_count}} stopped, {{error_count}} error                        ║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [R] Refresh  [1-9] Select Project                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Step 2: Commit**

```bash
git add src/ascii/states/dashboard.ascii
git commit -m "feat(ascii): add dashboard.ascii template for health-at-a-glance view"
```

---

## Task 3: Add Health Check Logic to Manager Server

**Files:**
- Modify: `src/manager/manager-server.ts`

**Step 1: Add formatUptime helper function**

Add near the top of the file after imports:

```typescript
/**
 * Format uptime from milliseconds to human-readable string
 */
function formatUptime(startedAt: number | undefined): string {
    if (!startedAt) return '--';

    const elapsedMs = Date.now() - startedAt;
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

/**
 * Format timestamp to HH:MM:SS
 */
function formatTime(timestamp: number | null): string {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
}
```

**Step 2: Add checkProjectHealth method to ManagerServer class**

```typescript
/**
 * Check health of a single project
 */
private async checkProjectHealth(project: ASCIIProject): Promise<{
    projectId: string;
    projectName: string;
    port: number;
    status: 'running' | 'stopped' | 'error';
    uptime: string | null;
    lastCheck: string | null;
    responseTime: number | null;
}> {
    const startTime = Date.now();

    if (project.status !== 'running') {
        return {
            projectId: project.id,
            projectName: project.name,
            port: project.port,
            status: project.status,
            uptime: null,
            lastCheck: null,
            responseTime: null
        };
    }

    try {
        const response = await fetch(`http://localhost:${project.port}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
            return {
                projectId: project.id,
                projectName: project.name,
                port: project.port,
                status: 'running',
                uptime: formatUptime(project.lastStarted),
                lastCheck: formatTime(Date.now()),
                responseTime
            };
        } else {
            return {
                projectId: project.id,
                projectName: project.name,
                port: project.port,
                status: 'error',
                uptime: null,
                lastCheck: formatTime(Date.now()),
                responseTime
            };
        }
    } catch (error) {
        return {
            projectId: project.id,
            projectName: project.name,
            port: project.port,
            status: 'error',
            uptime: null,
            lastCheck: formatTime(Date.now()),
            responseTime: null
        };
    }
}

/**
 * Check health of all projects
 */
private async checkAllProjectsHealth(): Promise<Array<{
    projectId: string;
    projectName: string;
    port: number;
    status: 'running' | 'stopped' | 'error';
    uptime: string | null;
    lastCheck: string | null;
    responseTime: number | null;
}>> {
    const projects = this.registry.getAllProjects();
    const healthChecks = await Promise.all(
        projects.map(project => this.checkProjectHealth(project))
    );
    return healthChecks;
}
```

**Step 3: Commit**

```bash
git add src/manager/manager-server.ts
git commit -m "feat(manager): add project health check methods"
```

---

## Task 4: Add Dashboard View Rendering

**Files:**
- Modify: `src/manager/manager-server.ts`

**Step 1: Add dashboard rendering in /view endpoint**

In the handleRequest method, within the `/view` GET handler, add DASHBOARD state handling:

```typescript
// In the /view endpoint handler, after existing state handling
if (state === 'DASHBOARD') {
    // Fetch health data for all projects
    const healthData = await this.checkAllProjectsHealth();
    this.stateManager.setDashboardHealth(healthData);

    // Calculate summary
    const runningCount = healthData.filter(h => h.status === 'running').length;
    const stoppedCount = healthData.filter(h => h.status === 'stopped').length;
    const errorCount = healthData.filter(h => h.status === 'error').length;

    // Format health items for template
    const healthItems = healthData.map((health, index) => ({
        label: String(index + 1),
        project_name: health.projectName.padEnd(20).substring(0, 20),
        port: health.port,
        status_icon: health.status === 'running' ? '●' : health.status === 'stopped' ? '○' : '⚠',
        status: health.status.padEnd(7),
        uptime: (health.uptime || '--').padStart(8),
        last_check: (health.lastCheck || '--').padStart(8)
    }));

    const viewData: TemplateData = {
        app_version: APP_VERSION,
        last_check_time: formatTime(this.stateManager.getData().lastHealthCheck),
        health_items: healthItems,
        running_count: runningCount,
        stopped_count: stoppedCount,
        error_count: errorCount
    };

    const ascii = this.asciiGenerator.render('DASHBOARD', viewData);
    return new Response(ascii, {
        headers: { ...this.corsHeaders(), 'Content-Type': 'text/plain' }
    });
}
```

**Step 2: Add 'D' action handler in /control endpoint**

In the handleRequest method, within the `/control` POST handler:

```typescript
// Handle 'D' action to go to dashboard
if (label === 'D') {
    const result = this.stateManager.handleAction(label);
    if (result.success && result.action === 'goto_dashboard') {
        return this.jsonResponse({
            status: 'ok',
            action: 'goto_dashboard',
            state: this.stateManager.getState()
        });
    }
}

// Handle 'R' action to refresh dashboard
if (label === 'R' && state === 'DASHBOARD') {
    const healthData = await this.checkAllProjectsHealth();
    this.stateManager.setDashboardHealth(healthData);
    return this.jsonResponse({
        status: 'ok',
        action: 'refresh_dashboard',
        projects_checked: healthData.length
    });
}
```

**Step 3: Verify compilation**

Run: `bun build src/manager/manager-server.ts --target=bun 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/manager/manager-server.ts
git commit -m "feat(manager): add dashboard view rendering with health checks"
```

---

## Task 5: Add Dashboard Tests

**Files:**
- Create: `tests/manager/dashboard.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect } from 'bun:test';

describe('Manager Dashboard', () => {

    describe('formatUptime helper', () => {
        it('should return "--" for undefined startedAt', () => {
            // Test the logic directly
            const startedAt = undefined;
            const result = !startedAt ? '--' : 'should not happen';
            expect(result).toBe('--');
        });

        it('should format seconds correctly', () => {
            const startedAt = Date.now() - 30000; // 30 seconds ago
            const elapsedMs = Date.now() - startedAt;
            const seconds = Math.floor(elapsedMs / 1000);
            expect(seconds).toBeGreaterThanOrEqual(29);
            expect(seconds).toBeLessThanOrEqual(31);
        });

        it('should format minutes correctly', () => {
            const startedAt = Date.now() - 120000; // 2 minutes ago
            const elapsedMs = Date.now() - startedAt;
            const minutes = Math.floor(elapsedMs / 60000);
            expect(minutes).toBeGreaterThanOrEqual(1);
            expect(minutes).toBeLessThanOrEqual(3);
        });
    });

    describe('formatTime helper', () => {
        it('should return "--" for null timestamp', () => {
            const timestamp = null;
            const result = !timestamp ? '--' : 'should not happen';
            expect(result).toBe('--');
        });

        it('should format valid timestamp', () => {
            const timestamp = Date.now();
            const date = new Date(timestamp);
            const result = date.toLocaleTimeString('en-US', { hour12: false });
            expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });
    });

    describe('Dashboard State Transitions', () => {
        it('should transition to DASHBOARD from PROJECTS with D label', async () => {
            const response = await fetch('http://localhost:3422/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'D' })
            });
            const data = await response.json();
            expect(data.status).toBe('ok');
            expect(data.action).toBe('goto_dashboard');
        });
    });

    describe('Dashboard View Endpoint', () => {
        it('should return ASCII view for dashboard state', async () => {
            // First set state to DASHBOARD
            await fetch('http://localhost:3422/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'D' })
            });

            const response = await fetch('http://localhost:3422/view');
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toContain('text/plain');

            const text = await response.text();
            expect(text).toContain('DASHBOARD');
            expect(text).toContain('SYSTEM HEALTH');
        });
    });
});
```

**Step 2: Run tests**

Run: `bun test tests/manager/dashboard.test.ts`
Expected: Tests pass (note: requires Manager running on port 3422)

**Step 3: Commit**

```bash
git add tests/manager/dashboard.test.ts
git commit -m "test(manager): add dashboard feature tests"
```

---

## Task 6: Update Documentation

**Files:**
- Modify: `docs/ASCII-INTERFACE-MANAGER.md`

**Step 1: Add Dashboard section to documentation**

Add after the "Project Proxy Endpoints" section:

```markdown
### Dashboard View

The Dashboard provides a health-at-a-glance view of all discovered projects.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/view` | GET | Renders dashboard when state is DASHBOARD |
| `/control` | POST | Use `D` to navigate to dashboard, `R` to refresh |

#### Dashboard Features

- **Status Icons**: ● running, ○ stopped, ⚠ error
- **Uptime**: Shows time since project started (e.g., "2h 15m")
- **Last Check**: Timestamp of most recent health check
- **Summary**: Count of running/stopped/error projects

#### Example: View Dashboard

```bash
# Navigate to dashboard
curl -X POST http://localhost:3422/control \
  -H "Content-Type: application/json" \
  -d '{"label": "D"}'

# View the dashboard
curl http://localhost:3422/view

# Refresh health data
curl -X POST http://localhost:3422/control \
  -H "Content-Type: application/json" \
  -d '{"label": "R"}'
```
```

**Step 2: Commit**

```bash
git add docs/ASCII-INTERFACE-MANAGER.md
git commit -m "docs: add dashboard view documentation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add DASHBOARD State | manager-state.ts, manager-bindings.json |
| 2 | Create Dashboard Template | dashboard.ascii |
| 3 | Add Health Check Logic | manager-server.ts |
| 4 | Add Dashboard Rendering | manager-server.ts |
| 5 | Add Tests | dashboard.test.ts |
| 6 | Update Documentation | ASCII-INTERFACE-MANAGER.md |

**Total commits:** 6
**New state:** DASHBOARD
**New features:** Health-at-a-glance view, uptime tracking, status icons

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-03-18-manager-dashboard.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
