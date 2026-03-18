# ASCII Interface Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a meta-ASCII interface that manages ASCII-wrapped applications, enabling AI agents to develop, test, and deploy ASCII-first apps entirely through the ASCII paradigm itself - achieving self-hosting development.

**Architecture:** A Bun/TypeScript application with its own ASCII interface that provides: Project Browser (list/select ASCII projects), Template Editor (edit .ascii files), Bindings Editor (modify bindings.json), Test Runner (execute tests and show results), Live Preview (see changes in real-time), and Git Integration (commit/push changes). Each feature accessible via labeled actions. The manager itself becomes an ASCII-wrapped app that AI can control.

**Tech Stack:** Bun, TypeScript, ASCII templates (Mustache-style), HTTP API on port 3422, MCP bridge for Claude Code integration

---

## Overview: Self-Hosting ASCII Development

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ASCII INTERFACE MANAGER (Port 3422)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ PROJECTS ─────────────────────────────────────────────────────────────┐ │
│  │  [1] session-analyzer-app    (port 3421)  ● Running                    │ │
│  │  [2] ascii-interface-manager (port 3422)  ● Running (self)             │ │
│  │  [3] my-new-app              (port 3423)  ○ Stopped                    │ │
│  │  [N] New Project...                                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  [S] Start  [T] Stop  [R] Restart  [V] View  [E] Edit                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** AI uses the same ASCII interface to develop ASCII interfaces. The paradigm is consistent at every level.

---

## Task 1: Create Project Structure

**Files:**
- Create: `src/manager/manager.ts`
- Create: `src/manager/state-manager.ts`
- Create: `src/manager/project-registry.ts`
- Create: `src/ascii/states/projects.ascii`
- Create: `src/ascii/states/templates.ascii`
- Create: `src/ascii/states/bindings.ascii`
- Create: `src/ascii/states/test.ascii`
- Create: `src/ascii/states/git.ascii`
- Create: `src/ascii/manager-bindings.json`

**Step 1: Create directory structure**

Run: `mkdir -p src/manager src/ascii/states`

**Step 2: Create manager-bindings.json**

```json
{
  "bindings": [
    { "label": "A", "action": "goto_projects", "target": "PROJECTS" },
    { "label": "B", "action": "goto_templates", "target": "TEMPLATES" },
    { "label": "C", "action": "goto_bindings", "target": "BINDINGS" },
    { "label": "D", "action": "goto_test", "target": "TEST" },
    { "label": "E", "action": "goto_git", "target": "GIT" },
    { "label": "X", "action": "quit", "target": "QUIT" },
    { "label": "1", "action": "select_item_1", "target": null },
    { "label": "2", "action": "select_item_2", "target": null },
    { "label": "3", "action": "select_item_3", "target": null },
    { "label": "N", "action": "new_item", "target": null },
    { "label": "S", "action": "start_project", "target": null },
    { "label": "T", "action": "stop_project", "target": null },
    { "label": "R", "action": "restart_project", "target": null },
    { "label": "V", "action": "view_detail", "target": null },
    { "label": "W", "action": "save_changes", "target": null },
    { "label": "U", "action": "undo_changes", "target": null },
    { "label": "G", "action": "run_tests", "target": null },
    { "label": "L", "action": "git_status", "target": null },
    { "label": "M", "action": "git_commit", "target": null },
    { "label": "P", "action": "git_push", "target": null }
  ],
  "stateTransitions": {
    "PROJECTS": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "TEST",
      "E": "GIT",
      "X": "QUIT"
    },
    "TEMPLATES": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "TEST",
      "E": "GIT",
      "X": "QUIT"
    },
    "BINDINGS": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "TEST",
      "E": "GIT",
      "X": "QUIT"
    },
    "TEST": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "TEST",
      "E": "GIT",
      "X": "QUIT"
    },
    "GIT": {
      "A": "PROJECTS",
      "B": "TEMPLATES",
      "C": "BINDINGS",
      "D": "TEST",
      "E": "GIT",
      "X": "QUIT"
    }
  }
}
```

**Step 3: Commit**

```bash
git add src/manager/ src/ascii/states/ src/ascii/manager-bindings.json
git commit -m "feat(manager): initialize ASCII Interface Manager project structure"
```

---

## Task 2: Create ASCII Templates for Manager

**Files:**
- Create: `src/ascii/states/projects.ascii`
- Create: `src/ascii/states/templates.ascii`
- Create: `src/ascii/states/bindings.ascii`
- Create: `src/ascii/states/test.ascii`
- Create: `src/ascii/states/git.ascii`

**Step 1: Create projects.ascii**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  REGISTERED ASCII PROJECTS                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
{{#each projects}}
║  │  [{{label}}] {{name}}    (port {{port}})  {{status_icon}} {{status}}     │║
{{/each}}
║  │  [N] New Project...                                                      │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  Selected: {{selected_project}}                                             ║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [S] Start  [T] Stop  [R] Restart  [V] View ASCII  [E] Edit Project         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Step 2: Create templates.ascii**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  TEMPLATE FILES: {{project_name}}                                           ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
{{#each templates}}
║  │  [{{label}}] {{name}}    {{lines}} lines                                │║
{{/each}}
║  │  [N] New Template...                                                    │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  CURRENT: {{current_template}}                                              ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │{{line_1}}                                                               │║
║  │{{line_2}}                                                               │║
║  │{{line_3}}                                                               │║
║  │{{line_4}}                                                               │║
║  │{{line_5}}                                                               │║
║  │... ({{total_lines}} lines total)                                        │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [W] Save  [U] Undo  [↑] Line Up  [↓] Line Down  [I] Insert  [D] Delete     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Step 3: Create bindings.ascii**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  BINDINGS: {{project_name}}                                                 ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  Labels                          Actions                                │║
║  ├─────────────────────────────────────────────────────────────────────────┤║
{{#each bindings}}
║  │  [{{label}}] {{description}}    → {{action}}                            │║
{{/each}}
║  │  [N] Add Binding...                                                     │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  STATE TRANSITIONS                                                         ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  From: {{from_state}}                                                   │║
║  │  {{transition_1}}                                                       │║
║  │  {{transition_2}}                                                       │║
║  │  {{transition_3}}                                                       │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [W] Save  [U] Undo  [E] Edit Label  [D] Delete  [T] Edit Transitions       ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Step 4: Create test.ascii**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  TEST RUNNER: {{project_name}}                                              ║
║                                                                             ║
║  Status: {{test_status}}     Last Run: {{last_run_time}}                    ║
║                                                                             ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  RESULTS                                                                │║
║  │  ┌─────────────┬─────────────┬─────────────┐                           │║
║  │  │ Passed      │ Failed      │ Skipped     │                           │║
║  │  │   {{passed}}   │    {{failed}}   │    {{skipped}}   │                           │║
║  │  └─────────────┴─────────────┴─────────────┘                           │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  FAILED TESTS:                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
{{#each failed_tests}}
║  │  [{{label}}] {{test_name}}                                              │║
║  │    Error: {{error_summary}}                                             │║
{{/each}}
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [G] Run All Tests  [1-5] Run Specific Test  [V] View Full Output           ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Step 5: Create git.ascii**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  GIT: {{project_name}}                                                      ║
║  Branch: {{branch}}        Status: {{git_status}}                           ║
║                                                                             ║
║  CHANGED FILES:                                                             ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
{{#each changed_files}}
║  │  [{{label}}] {{change_type}} {{file_path}}                              │║
{{/each}}
║  │  ({{changed_count}} files changed)                                      │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  RECENT COMMITS:                                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
{{#each recent_commits}}
║  │  {{hash}} {{message}}                                                   │║
{{/each}}
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [L] Status  [M] Commit  [P] Push  [F] Pull  [B] Branches  [H] History      ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Step 6: Commit**

```bash
git add src/ascii/states/
git commit -m "feat(manager): add ASCII templates for all manager views"
```

---

## Task 3: Implement Project Registry

**Files:**
- Create: `src/manager/project-registry.ts`

**Step 1: Create project-registry.ts**

```typescript
/**
 * Project Registry for ASCII Interface Manager
 *
 * Manages the list of ASCII-wrapped projects and their state.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface ASCIIProject {
    id: string;
    name: string;
    path: string;
    port: number;
    status: 'running' | 'stopped' | 'error';
    pid?: number;
    lastStarted?: number;
    asciiPath: string;
    bindingsPath: string;
}

export class ProjectRegistry {
    private projects: Map<string, ASCIIProject> = new Map();
    private registryPath: string;

    constructor(registryPath: string = '.ascii-registry.json') {
        this.registryPath = registryPath;
        this.load();
    }

    private load(): void {
        if (existsSync(this.registryPath)) {
            const data = JSON.parse(readFileSync(this.registryPath, 'utf8'));
            for (const project of data.projects || []) {
                this.projects.set(project.id, project);
            }
        }
    }

    private save(): void {
        const data = {
            projects: Array.from(this.projects.values())
        };
        writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
    }

    public registerProject(path: string, port: number): ASCIIProject {
        const id = basename(path);
        const project: ASCIIProject = {
            id,
            name: id,
            path,
            port,
            status: 'stopped',
            asciiPath: join(path, 'src/ascii/states'),
            bindingsPath: join(path, 'src/ascii/bindings.json')
        };
        this.projects.set(id, project);
        this.save();
        return project;
    }

    public unregisterProject(id: string): boolean {
        const result = this.projects.delete(id);
        if (result) {
            this.save();
        }
        return result;
    }

    public getProject(id: string): ASCIIProject | undefined {
        return this.projects.get(id);
    }

    public getAllProjects(): ASCIIProject[] {
        return Array.from(this.projects.values());
    }

    public updateProjectStatus(id: string, status: ASCIIProject['status'], pid?: number): void {
        const project = this.projects.get(id);
        if (project) {
            project.status = status;
            if (pid !== undefined) {
                project.pid = pid;
            }
            if (status === 'running') {
                project.lastStarted = Date.now();
            }
            this.save();
        }
    }

    public discoverProjects(searchPath: string): string[] {
        const discovered: string[] = [];

        const scanDir = (dir: string, depth: number = 0) => {
            if (depth > 3) return; // Limit recursion depth

            try {
                const entries = readdirSync(dir);
                for (const entry of entries) {
                    const fullPath = join(dir, entry);
                    try {
                        const stat = statSync(fullPath);
                        if (stat.isDirectory()) {
                            // Check if this directory has ASCII interface markers
                            const bindingsPath = join(fullPath, 'src/ascii/bindings.json');
                            if (existsSync(bindingsPath)) {
                                discovered.push(fullPath);
                            } else if (entry !== 'node_modules' && entry !== '.git') {
                                scanDir(fullPath, depth + 1);
                            }
                        }
                    } catch {
                        // Skip inaccessible directories
                    }
                }
            } catch {
                // Skip directories we can't read
            }
        };

        scanDir(searchPath);
        return discovered;
    }

    public findAvailablePort(startPort: number = 3421): number {
        const usedPorts = new Set(
            Array.from(this.projects.values()).map(p => p.port)
        );
        let port = startPort;
        while (usedPorts.has(port)) {
            port++;
        }
        return port;
    }
}
```

**Step 2: Commit**

```bash
git add src/manager/project-registry.ts
git commit -m "feat(manager): implement project registry for managing ASCII projects"
```

---

## Task 4: Implement Manager State Manager

**Files:**
- Create: `src/manager/manager-state.ts`

**Step 1: Create manager-state.ts**

```typescript
/**
 * State Manager for ASCII Interface Manager
 *
 * Manages the manager's own state, selected project, and view context.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export type ManagerState = 'PROJECTS' | 'TEMPLATES' | 'BINDINGS' | 'TEST' | 'GIT';

export interface ManagerContext {
    state: ManagerState;
    selectedProjectId: string | null;
    selectedTemplateFile: string | null;
    templateScrollOffset: number;
    testResults: TestResults | null;
    gitStatus: GitStatus | null;
    editMode: boolean;
    editBuffer: string[];
    unsavedChanges: boolean;
}

export interface TestResults {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    duration: number;
    failedTests: Array<{
        name: string;
        error: string;
    }>;
    lastRun: number;
}

export interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: string[];
    unstaged: string[];
    untracked: string[];
    lastCommit: {
        hash: string;
        message: string;
        author: string;
        date: string;
    };
}

export class ManagerStateManager {
    public context: ManagerContext;
    private bindings: any;

    constructor() {
        const bindingsPath = join(import.meta.dir, '..', 'ascii', 'manager-bindings.json');
        this.bindings = JSON.parse(readFileSync(bindingsPath, 'utf8'));

        this.context = {
            state: 'PROJECTS',
            selectedProjectId: null,
            selectedTemplateFile: null,
            templateScrollOffset: 0,
            testResults: null,
            gitStatus: null,
            editMode: false,
            editBuffer: [],
            unsavedChanges: false
        };
    }

    public getState(): ManagerState {
        return this.context.state;
    }

    public setState(state: ManagerState): void {
        this.context.state = state;
    }

    public async handleAction(label: string): Promise<{ success: boolean; action?: string; error?: string }> {
        const stateTransitions = this.bindings.stateTransitions[this.context.state];

        if (!stateTransitions || !stateTransitions[label]) {
            // Check for non-navigation actions
            const binding = this.bindings.bindings.find((b: any) => b.label === label);
            if (binding) {
                return { success: true, action: binding.action };
            }
            return { success: false, error: `No action for label [${label}] in state ${this.context.state}` };
        }

        const targetState = stateTransitions[label];

        // Handle QUIT
        if (targetState === 'QUIT') {
            process.exit(0);
        }

        // Handle state transitions
        if (['PROJECTS', 'TEMPLATES', 'BINDINGS', 'TEST', 'GIT'].includes(targetState)) {
            this.context.state = targetState as ManagerState;
            const actionMap: Record<string, string> = {
                'PROJECTS': 'goto_projects',
                'TEMPLATES': 'goto_templates',
                'BINDINGS': 'goto_bindings',
                'TEST': 'goto_test',
                'GIT': 'goto_git'
            };
            return { success: true, action: actionMap[targetState] };
        }

        return { success: true, action: 'unknown' };
    }

    public selectProject(projectId: string): void {
        this.context.selectedProjectId = projectId;
    }

    public selectTemplate(templateFile: string): void {
        this.context.selectedTemplateFile = templateFile;
        this.context.templateScrollOffset = 0;
    }

    public scrollTemplate(direction: 'up' | 'down'): void {
        if (direction === 'up' && this.context.templateScrollOffset > 0) {
            this.context.templateScrollOffset--;
        } else if (direction === 'down') {
            this.context.templateScrollOffset++;
        }
    }

    public enterEditMode(lines: string[]): void {
        this.context.editMode = true;
        this.context.editBuffer = [...lines];
    }

    public exitEditMode(save: boolean): void {
        if (save) {
            this.context.unsavedChanges = true;
        }
        this.context.editMode = false;
    }

    public getData(): ManagerContext {
        return this.context;
    }
}
```

**Step 2: Commit**

```bash
git add src/manager/manager-state.ts
git commit -m "feat(manager): implement manager state with navigation and context"
```

---

## Task 5: Implement Manager HTTP API

**Files:**
- Create: `src/manager/manager-server.ts`

**Step 1: Create manager-server.ts**

```typescript
#!/usr/bin/env bun
/**
 * ASCII Interface Manager Server
 *
 * HTTP API server on port 3422 for managing ASCII-wrapped applications.
 */

import { serve } from "bun";
import { ProjectRegistry, ASCIIProject } from "./project-registry";
import { ManagerStateManager, ManagerContext } from "./manager-state";
import { AsciiGenerator } from "./ascii-generator";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";

const registry = new ProjectRegistry();
const stateManager = new ManagerStateManager();
const asciiGenerator = new AsciiGenerator();

const projectProcesses: Map<string, ChildProcess> = new Map();

const metrics = {
    requests: 0,
    totalLatencyMs: 0,
    minLatencyMs: Infinity,
    maxLatencyMs: 0,
    lastAction: '',
    lastActionTime: 0,
};

const PORT = 3422;

// Helper to render current view
function renderView(): string {
    const state = stateManager.getState();
    const context = stateManager.getData();
    const projects = registry.getAllProjects();

    const viewData: Record<string, any> = {
        app_version: "0.1.0",
        state,
    };

    switch (state) {
        case 'PROJECTS':
            viewData.projects = projects.map((p, i) => ({
                label: String(i + 1),
                name: p.name,
                port: p.port,
                status: p.status,
                status_icon: p.status === 'running' ? '●' : '○'
            }));
            viewData.selected_project = context.selectedProjectId || 'None';
            break;

        case 'TEMPLATES':
            const selectedProject = context.selectedProjectId
                ? registry.getProject(context.selectedProjectId)
                : null;

            if (selectedProject) {
                const templates = listTemplates(selectedProject);
                viewData.project_name = selectedProject.name;
                viewData.templates = templates.map((t, i) => ({
                    label: String(i + 1),
                    name: t.name,
                    lines: t.lines
                }));
                viewData.current_template = context.selectedTemplateFile || 'None selected';

                if (context.selectedTemplateFile) {
                    const templatePath = join(selectedProject.asciiPath, context.selectedTemplateFile);
                    if (existsSync(templatePath)) {
                        const content = readFileSync(templatePath, 'utf8');
                        const lines = content.split('\n');
                        const offset = context.templateScrollOffset;
                        viewData.line_1 = lines[offset] || '';
                        viewData.line_2 = lines[offset + 1] || '';
                        viewData.line_3 = lines[offset + 2] || '';
                        viewData.line_4 = lines[offset + 3] || '';
                        viewData.line_5 = lines[offset + 4] || '';
                        viewData.total_lines = lines.length;
                    }
                }
            }
            break;

        case 'TEST':
            const testProject = context.selectedProjectId
                ? registry.getProject(context.selectedProjectId)
                : null;
            if (testProject) {
                viewData.project_name = testProject.name;
                viewData.test_status = context.testResults ? 'Completed' : 'Not run';
                viewData.last_run_time = context.testResults
                    ? new Date(context.testResults.lastRun).toISOString()
                    : 'Never';

                if (context.testResults) {
                    viewData.passed = context.testResults.passed;
                    viewData.failed = context.testResults.failed;
                    viewData.skipped = context.testResults.skipped;
                    viewData.failed_tests = context.testResults.failedTests.map((t, i) => ({
                        label: String(i + 1),
                        test_name: t.name,
                        error_summary: t.error.slice(0, 50)
                    }));
                } else {
                    viewData.passed = 0;
                    viewData.failed = 0;
                    viewData.skipped = 0;
                    viewData.failed_tests = [];
                }
            }
            break;

        case 'GIT':
            const gitProject = context.selectedProjectId
                ? registry.getProject(context.selectedProjectId)
                : null;
            if (gitProject) {
                viewData.project_name = gitProject.name;
                viewData.branch = context.gitStatus?.branch || 'unknown';
                viewData.git_status = context.gitStatus
                    ? (context.gitStatus.staged.length + context.gitStatus.unstaged.length > 0
                        ? 'Modified'
                        : 'Clean')
                    : 'Unknown';

                const allChanges = [
                    ...(context.gitStatus?.staged.map(f => ({ type: 'S', path: f })) || []),
                    ...(context.gitStatus?.unstaged.map(f => ({ type: 'M', path: f })) || []),
                    ...(context.gitStatus?.untracked.map(f => ({ type: '?', path: f })) || [])
                ];

                viewData.changed_files = allChanges.slice(0, 5).map((f, i) => ({
                    label: String(i + 1),
                    change_type: f.type,
                    file_path: f.path
                }));
                viewData.changed_count = allChanges.length;

                viewData.recent_commits = []; // Would need to run git log
            }
            break;

        case 'BINDINGS':
            const bindingsProject = context.selectedProjectId
                ? registry.getProject(context.selectedProjectId)
                : null;
            if (bindingsProject && existsSync(bindingsProject.bindingsPath)) {
                const bindings = JSON.parse(readFileSync(bindingsProject.bindingsPath, 'utf8'));
                viewData.project_name = bindingsProject.name;
                viewData.bindings = bindings.bindings.slice(0, 8).map((b: any, i: number) => ({
                    label: b.label,
                    description: b.action.replace(/_/g, ' '),
                    action: b.action
                }));
            }
            break;
    }

    return asciiGenerator.render(state, viewData);
}

function listTemplates(project: ASCIIProject): Array<{ name: string; lines: number }> {
    if (!existsSync(project.asciiPath)) return [];

    const files = [];
    const entries = require('fs').readdirSync(project.asciiPath);
    for (const entry of entries) {
        if (entry.endsWith('.ascii')) {
            const content = readFileSync(join(project.asciiPath, entry), 'utf8');
            files.push({
                name: entry,
                lines: content.split('\n').length
            });
        }
    }
    return files;
}

async function startProject(project: ASCIIProject): Promise<boolean> {
    if (project.status === 'running') return true;

    const serverPath = join(project.path, 'src/bun/test-server.ts');
    if (!existsSync(serverPath)) {
        registry.updateProjectStatus(project.id, 'error');
        return false;
    }

    const proc = spawn('bun', ['run', serverPath], {
        cwd: project.path,
        env: { ...process.env, PORT: String(project.port) },
        stdio: 'pipe'
    });

    projectProcesses.set(project.id, proc);
    registry.updateProjectStatus(project.id, 'running', proc.pid);

    proc.on('exit', () => {
        registry.updateProjectStatus(project.id, 'stopped');
        projectProcesses.delete(project.id);
    });

    return true;
}

function stopProject(projectId: string): boolean {
    const proc = projectProcesses.get(projectId);
    if (proc) {
        proc.kill();
        projectProcesses.delete(projectId);
        registry.updateProjectStatus(projectId, 'stopped');
        return true;
    }
    return false;
}

console.log(`Starting ASCII Interface Manager on port ${PORT}...`);

const server = serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;
        const startTime = performance.now();

        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { headers });
        }

        try {
            // Health check
            if (path === "/health") {
                return new Response(JSON.stringify({
                    status: "healthy",
                    service: "ascii-interface-manager",
                    port: PORT,
                    projects: registry.getAllProjects().length
                }), { headers });
            }

            // ASCII View
            if (path === "/view" && req.method === "GET") {
                const ascii = renderView();
                const latency = performance.now() - startTime;
                updateMetrics(latency, 'view');
                return new Response(ascii, {
                    headers: { ...headers, 'Content-Type': 'text/plain' }
                });
            }

            // Control
            if (path === "/control" && req.method === "POST") {
                const body = await req.json();
                const label = body.label?.toUpperCase();

                if (!label) {
                    return new Response(JSON.stringify({ error: "Missing label" }), { status: 400, headers });
                }

                // Handle numeric selection
                if (/^[1-9]$/.test(label)) {
                    const index = parseInt(label) - 1;
                    const projects = registry.getAllProjects();

                    if (stateManager.getState() === 'PROJECTS' && index < projects.length) {
                        stateManager.selectProject(projects[index].id);
                    }
                }

                // Handle start/stop
                if (label === 'S' && stateManager.context.selectedProjectId) {
                    const project = registry.getProject(stateManager.context.selectedProjectId);
                    if (project) await startProject(project);
                }

                if (label === 'T' && stateManager.context.selectedProjectId) {
                    stopProject(stateManager.context.selectedProjectId);
                }

                const result = await stateManager.handleAction(label);
                const latency = performance.now() - startTime;
                updateMetrics(latency, label);

                if (result.success) {
                    return new Response(JSON.stringify({
                        status: 'ok',
                        state: stateManager.getState(),
                        action: result.action,
                        context: stateManager.getData(),
                        latencyMs: Math.round(latency * 100) / 100
                    }), { headers });
                } else {
                    return new Response(JSON.stringify({
                        status: 'error',
                        error: result.error
                    }), { status: 400, headers });
                }
            }

            // Projects API
            if (path === "/projects" && req.method === "GET") {
                return new Response(JSON.stringify(registry.getAllProjects()), { headers });
            }

            if (path === "/projects" && req.method === "POST") {
                const body = await req.json();
                const port = registry.findAvailablePort(body.port || 3421);
                const project = registry.registerProject(body.path, port);
                return new Response(JSON.stringify(project), { headers });
            }

            // Metrics
            if (path === "/metrics" && req.method === "GET") {
                return new Response(JSON.stringify({
                    ...metrics,
                    avgLatencyMs: metrics.requests > 0
                        ? Math.round(metrics.totalLatencyMs / metrics.requests * 100) / 100
                        : 0
                }), { headers });
            }

            return new Response(JSON.stringify({ error: `Not found: ${path}` }), { status: 404, headers });
        } catch (e: any) {
            console.error(`API Error (${path}):`, e);
            return new Response(JSON.stringify({ error: e.message || "Internal Server Error" }), { status: 500, headers });
        }
    }
});

function updateMetrics(latency: number, action: string) {
    metrics.requests++;
    metrics.totalLatencyMs += latency;
    metrics.minLatencyMs = Math.min(metrics.minLatencyMs, latency);
    metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latency);
    metrics.lastAction = action;
    metrics.lastActionTime = Date.now();
}

console.log(`✓ ASCII Interface Manager running at http://localhost:${PORT}`);
console.log(`  Endpoints:`);
console.log(`    GET  /health   - Health check`);
console.log(`    GET  /view     - ASCII view`);
console.log(`    POST /control  - Execute action`);
console.log(`    GET  /projects - List projects`);
console.log(`    POST /projects - Register project`);
console.log(`    GET  /metrics  - Performance metrics`);
```

**Step 2: Commit**

```bash
git add src/manager/manager-server.ts
git commit -m "feat(manager): implement HTTP API server with project management"
```

---

## Task 6: Implement ASCII Generator

**Files:**
- Create: `src/manager/ascii-generator.ts`

**Step 1: Create ascii-generator.ts**

```typescript
/**
 * ASCII Generator for Interface Manager
 *
 * Renders ASCII templates with data substitution.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export class AsciiGenerator {
    private templateCache: Map<string, string> = new Map();
    private templatesPath: string;

    constructor(templatesPath?: string) {
        this.templatesPath = templatesPath || join(import.meta.dir, '..', 'ascii', 'states');
    }

    private loadTemplate(state: string): string {
        if (this.templateCache.has(state)) {
            return this.templateCache.get(state)!;
        }

        const templatePath = join(this.templatesPath, `${state.toLowerCase()}.ascii`);
        if (!existsSync(templatePath)) {
            return this.getDefaultTemplate(state);
        }

        const template = readFileSync(templatePath, 'utf8');
        this.templateCache.set(state, template);
        return template;
    }

    private getDefaultTemplate(state: string): string {
        return `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  State: ${state}                                                             ║
║                                                                             ║
║  No template found for this state.                                          ║
║                                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝`;
    }

    public render(state: string, data: Record<string, any>): string {
        let template = this.loadTemplate(state);

        // Process {{#each}} blocks
        template = this.processEachBlocks(template, data);

        // Process simple {{variable}} substitutions
        template = this.processVariables(template, data);

        // Process {{#if}} conditionals
        template = this.processConditionals(template, data);

        return template;
    }

    private processVariables(template: string, data: Record<string, any>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = data[key];
            if (value === undefined || value === null) {
                return '';
            }
            return String(value);
        });
    }

    private processEachBlocks(template: string, data: Record<string, any>): string {
        const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

        return template.replace(eachRegex, (match, arrayKey, innerTemplate) => {
            const array = data[arrayKey];
            if (!Array.isArray(array) || array.length === 0) {
                return '';
            }

            return array.map((item, index) => {
                let result = innerTemplate;

                // Replace nested {{key}} with item[key]
                result = result.replace(/\{\{(\w+)\}\}/g, (m, key) => {
                    if (item && typeof item === 'object' && key in item) {
                        return String(item[key]);
                    }
                    return m;
                });

                return result;
            }).join('');
        });
    }

    private processConditionals(template: string, data: Record<string, any>): string {
        const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

        return template.replace(ifRegex, (match, conditionKey, innerTemplate) => {
            const value = data[conditionKey];
            if (value) {
                return innerTemplate;
            }
            return '';
        });
    }

    public clearCache(): void {
        this.templateCache.clear();
    }
}
```

**Step 2: Commit**

```bash
git add src/manager/ascii-generator.ts
git commit -m "feat(manager): implement ASCII template generator with Mustache-style syntax"
```

---

## Task 7: Create MCP Bridge for Manager

**Files:**
- Create: `mcp_manager_bridge/pyproject.toml`
- Create: `mcp_manager_bridge/src/mcp_manager_bridge/__init__.py`
- Create: `mcp_manager_bridge/src/mcp_manager_bridge/server.py`

**Step 1: Create pyproject.toml**

```toml
[project]
name = "mcp-manager-bridge"
version = "0.1.0"
description = "MCP server bridging to ASCII Interface Manager API"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "mcp>=1.0.0",
    "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]

[project.scripts]
mcp-manager-bridge = "mcp_manager_bridge.server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/mcp_manager_bridge"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
pythonpath = ["src"]
```

**Step 2: Create __init__.py**

```python
"""MCP Manager Bridge - MCP server for ASCII Interface Manager."""

__version__ = "0.1.0"
```

**Step 3: Create server.py**

```python
#!/usr/bin/env python3
"""
MCP Manager Bridge Server

Exposes ASCII Interface Manager API via Model Context Protocol.
Enables AI agents to develop ASCII-wrapped applications through ASCII itself.

Usage:
    uv run mcp-manager-bridge
"""

import asyncio
import json
import os
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

# Configuration
MANAGER_API_URL = os.environ.get("MANAGER_API_URL", "http://localhost:3422")

app = Server("mcp-manager-bridge")


async def fetch_view() -> str:
    """Fetch current ASCII view from manager."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{MANAGER_API_URL}/view", timeout=5.0)
        response.raise_for_status()
        return response.text


async def send_control(label: str) -> dict[str, Any]:
    """Send control command to manager."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MANAGER_API_URL}/control",
            json={"label": label},
            timeout=5.0,
        )
        response.raise_for_status()
        return response.json()


async def get_projects() -> list[dict[str, Any]]:
    """Get list of registered ASCII projects."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{MANAGER_API_URL}/projects", timeout=5.0)
        response.raise_for_status()
        return response.json()


async def register_project(path: str, port: int | None = None) -> dict[str, Any]:
    """Register a new ASCII project."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MANAGER_API_URL}/projects",
            json={"path": path, "port": port},
            timeout=5.0,
        )
        response.raise_for_status()
        return response.json()


async def get_metrics() -> dict[str, Any]:
    """Get manager performance metrics."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{MANAGER_API_URL}/metrics", timeout=5.0)
        response.raise_for_status()
        return response.json()


@app.list_tools()
async def list_tools():
    """Define all MCP tools exposed by this server."""
    return [
        Tool(
            name="manager_view",
            description=(
                "Get the current ASCII view of the Interface Manager. "
                "Shows all registered projects, templates, bindings, test results, or git status. "
                "Use this to understand what ASCII projects exist and their state."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="manager_control",
            description=(
                "Execute an action in the Interface Manager by label. "
                "Navigation: A=Projects, B=Templates, C=Bindings, D=Test, E=Git, X=Quit. "
                "Project actions: 1-9=Select, S=Start, T=Stop, R=Restart, V=View. "
                "Edit actions: W=Save, U=Undo. "
                "Git actions: L=Status, M=Commit, P=Push."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Single character label (A-Z or 1-9)",
                        "pattern": "^[A-Z1-9]$",
                    },
                },
                "required": ["label"],
            },
        ),
        Tool(
            name="manager_list_projects",
            description=(
                "Get a list of all registered ASCII-wrapped projects. "
                "Returns project details including name, path, port, and status."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="manager_register_project",
            description=(
                "Register a new ASCII-wrapped project with the manager. "
                "Provide the path to the project directory. "
                "Optionally specify a port (will auto-assign if not provided)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the ASCII project directory",
                    },
                    "port": {
                        "type": "integer",
                        "description": "Optional port number for the project's API",
                    },
                },
                "required": ["path"],
            },
        ),
        Tool(
            name="manager_metrics",
            description=(
                "Get performance metrics for the Interface Manager API. "
                "Returns request count, latency statistics, and last action info."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="manager_start_project",
            description=(
                "Start a registered ASCII project. "
                "First select the project (use manager_control with 1-9), then start it."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="manager_stop_project",
            description=(
                "Stop a running ASCII project. "
                "First select the project (use manager_control with 1-9), then stop it."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict):
    """Handle tool invocations."""
    try:
        if name == "manager_view":
            view = await fetch_view()
            return [TextContent(type="text", text=view)]

        if name == "manager_control":
            label = arguments.get("label", "").upper()
            if not label or len(label) != 1:
                return [TextContent(type="text", text="Error: label must be a single character (A-Z or 1-9)")]

            result = await send_control(label)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "manager_list_projects":
            projects = await get_projects()
            return [TextContent(type="text", text=json.dumps(projects, indent=2))]

        if name == "manager_register_project":
            path = arguments.get("path")
            if not path:
                return [TextContent(type="text", text="Error: path is required")]

            result = await register_project(path, arguments.get("port"))
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "manager_metrics":
            metrics = await get_metrics()
            return [TextContent(type="text", text=json.dumps(metrics, indent=2))]

        if name == "manager_start_project":
            result = await send_control("S")
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "manager_stop_project":
            result = await send_control("T")
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except httpx.HTTPStatusError as e:
        return [TextContent(type="text", text=f"HTTP error: {e.response.status_code} - {e.response.text}")]
    except httpx.ConnectError:
        return [TextContent(type="text", text=f"Connection error: Cannot reach Manager API at {MANAGER_API_URL}. Is the manager running?")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {type(e).__name__}: {e}")]


async def main():
    """Run the MCP server over stdio."""
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 4: Commit**

```bash
git add mcp_manager_bridge/
git commit -m "feat(manager): add MCP bridge for AI control of Interface Manager"
```

---

## Task 8: Create New Project Scaffold Generator

**Files:**
- Create: `src/manager/scaffold.ts`

**Step 1: Create scaffold.ts**

```typescript
/**
 * Project Scaffold Generator
 *
 * Creates a new ASCII-wrapped project with all necessary files.
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ScaffoldOptions {
    projectName: string;
    targetPath: string;
    port: number;
    description?: string;
}

const ASCII_TEMPLATE = `╔══════════════════════════════════════════════════════════════════════════════╗
║  {{app_name}}                                              v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Dashboard  [B] Settings  [X] Quit                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  Status: {{app_status}}                                                     ║
║                                                                             ║
║  Welcome to {{app_name}}!                                                   ║
║                                                                             ║
║  This is your new ASCII-wrapped application.                                ║
║                                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

const SETTINGS_TEMPLATE = `╔══════════════════════════════════════════════════════════════════════════════╗
║  {{app_name}} - Settings                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Dashboard  [B] Settings  [X] Quit                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  SETTINGS                                                                   ║
║                                                                             ║
║  [1] API Port: {{api_port}}                                                 ║
║  [2] Debug Mode: {{debug_mode}}                                             ║
║  [3] Log Level: {{log_level}}                                               ║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [W] Save Settings  [Z] Reset Defaults                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

const BINDINGS_TEMPLATE = {
    bindings: [
        { label: "A", action: "goto_dashboard", target: "DASHBOARD" },
        { label: "B", action: "goto_settings", target: "SETTINGS" },
        { label: "X", action: "quit", target: "QUIT" },
        { label: "W", action: "save_settings", target: null },
        { label: "Z", action: "reset_defaults", target: null }
    ],
    stateTransitions: {
        DASHBOARD: { A: "DASHBOARD", B: "SETTINGS", X: "QUIT" },
        SETTINGS: { A: "DASHBOARD", B: "SETTINGS", X: "QUIT" }
    }
};

const SERVER_TEMPLATE = `#!/usr/bin/env bun
/**
 * {{app_name}} ASCII API Server
 * Port: {{api_port}}
 */

import { serve } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

export type AppState = 'DASHBOARD' | 'SETTINGS';

export class StateManager {
    public currentState: AppState = 'DASHBOARD';
    private bindings: any;

    constructor() {
        const bindingsPath = join(import.meta.dir, '..', 'ascii', 'bindings.json');
        this.bindings = JSON.parse(readFileSync(bindingsPath, 'utf8'));
    }

    public async handleAction(label: string): Promise<{ success: boolean; action?: string; error?: string }> {
        const stateTransitions = this.bindings.stateTransitions[this.currentState];

        if (!stateTransitions || !stateTransitions[label]) {
            return { success: false, error: \`No action for label [\${label}] in state \${this.currentState}\` };
        }

        const targetState = stateTransitions[label];

        switch (targetState) {
            case 'DASHBOARD':
                this.currentState = 'DASHBOARD';
                return { success: true, action: 'goto_dashboard' };
            case 'SETTINGS':
                this.currentState = 'SETTINGS';
                return { success: true, action: 'goto_settings' };
            case 'QUIT':
                process.exit(0);
        }

        return { success: true, action: targetState.toLowerCase() };
    }

    public getState(): AppState {
        return this.currentState;
    }
}

class AsciiGenerator {
    render(state: string, data: Record<string, any>): string {
        const templatePath = join(import.meta.dir, '..', 'ascii', 'states', \`\${state.toLowerCase()}.ascii\`);
        let template = readFileSync(templatePath, 'utf8');

        for (const [key, value] of Object.entries(data)) {
            template = template.replace(new RegExp(\`{{\${key}}}\`, 'g'), String(value));
        }

        return template;
    }
}

const stateManager = new StateManager();
const asciiGenerator = new AsciiGenerator();
const PORT = {{api_port}};

console.log(\`Starting {{app_name}} on port \${PORT}...\`);

serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        };

        if (path === "/health") {
            return new Response(JSON.stringify({ status: "healthy", port: PORT }), { headers });
        }

        if (path === "/view" && req.method === "GET") {
            const viewData = {
                app_name: "{{app_name}}",
                app_version: "0.1.0",
                app_status: "Running",
                api_port: PORT,
                debug_mode: "Off",
                log_level: "Info"
            };

            const ascii = asciiGenerator.render(stateManager.getState(), viewData);
            return new Response(ascii, { headers: { ...headers, 'Content-Type': 'text/plain' } });
        }

        if (path === "/control" && req.method === "POST") {
            const body = await req.json();
            const result = await stateManager.handleAction(body.label);

            if (result.success) {
                return new Response(JSON.stringify({
                    status: 'ok',
                    state: stateManager.getState(),
                    action: result.action
                }), { headers });
            } else {
                return new Response(JSON.stringify({ error: result.error }), { status: 400, headers });
            }
        }

        return new Response(JSON.stringify({ error: \`Not found: \${path}\` }), { status: 404, headers });
    }
});

console.log(\`✓ {{app_name}} running at http://localhost:\${PORT}\`);
`;

export function scaffoldProject(options: ScaffoldOptions): void {
    const { projectName, targetPath, port, description } = options;

    // Create directory structure
    const dirs = [
        targetPath,
        join(targetPath, 'src'),
        join(targetPath, 'src/bun'),
        join(targetPath, 'src/ascii'),
        join(targetPath, 'src/ascii/states')
    ];

    for (const dir of dirs) {
        mkdirSync(dir, { recursive: true });
    }

    // Create ASCII templates
    const appName = projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    writeFileSync(
        join(targetPath, 'src/ascii/states/dashboard.ascii'),
        ASCII_TEMPLATE.replace(/{{app_name}}/g, appName).replace('{{app_version}}', '0.1.0')
    );

    writeFileSync(
        join(targetPath, 'src/ascii/states/settings.ascii'),
        SETTINGS_TEMPLATE.replace(/{{app_name}}/g, appName).replace('{{app_version}}', '0.1.0')
    );

    // Create bindings.json
    writeFileSync(
        join(targetPath, 'src/ascii/bindings.json'),
        JSON.stringify(BINDINGS_TEMPLATE, null, 2)
    );

    // Create server.ts
    writeFileSync(
        join(targetPath, 'src/bun/server.ts'),
        SERVER_TEMPLATE
            .replace(/{{app_name}}/g, appName)
            .replace(/{{api_port}}/g, String(port))
    );

    // Create package.json
    writeFileSync(
        join(targetPath, 'package.json'),
        JSON.stringify({
            name: projectName,
            version: "0.1.0",
            description: description || `${appName} - ASCII-wrapped application`,
            scripts: {
                start: "bun run src/bun/server.ts",
                dev: "bun --watch run src/bun/server.ts"
            },
            dependencies: {}
        }, null, 2)
    );

    // Create README
    writeFileSync(
        join(targetPath, 'README.md'),
        `# ${appName}

${description || 'An ASCII-wrapped application.'}

## Running

\`\`\`bash
bun run src/bun/server.ts
\`\`\`

## API Endpoints

- GET /health - Health check
- GET /view - ASCII view
- POST /control - Execute action

## Labels

| Label | Action |
|-------|--------|
| A | Dashboard |
| B | Settings |
| X | Quit |
| W | Save Settings |
| Z | Reset Defaults |
`
    );
}
```

**Step 2: Commit**

```bash
git add src/manager/scaffold.ts
git commit -m "feat(manager): add project scaffold generator for new ASCII apps"
```

---

## Task 9: Add Tests

**Files:**
- Create: `tests/manager/project-registry.test.ts`
- Create: `tests/manager/manager-state.test.ts`
- Create: `tests/manager/ascii-generator.test.ts`

**Step 1: Create project-registry.test.ts**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { ProjectRegistry } from '../../src/manager/project-registry';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/ascii-manager-test';

describe('ProjectRegistry', () => {
    let registry: ProjectRegistry;
    const registryPath = join(TEST_DIR, 'test-registry.json');

    beforeEach(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true });
        }
        mkdirSync(TEST_DIR, { recursive: true });
        registry = new ProjectRegistry(registryPath);
    });

    it('starts with empty projects', () => {
        expect(registry.getAllProjects()).toHaveLength(0);
    });

    it('registers a new project', () => {
        const project = registry.registerProject('/path/to/project', 3421);

        expect(project.id).toBe('project');
        expect(project.name).toBe('project');
        expect(project.port).toBe(3421);
        expect(project.status).toBe('stopped');
    });

    it('lists all registered projects', () => {
        registry.registerProject('/path/to/project-a', 3421);
        registry.registerProject('/path/to/project-b', 3422);

        const projects = registry.getAllProjects();
        expect(projects).toHaveLength(2);
    });

    it('finds available port', () => {
        registry.registerProject('/path/to/project', 3421);

        const port = registry.findAvailablePort(3421);
        expect(port).toBe(3422);
    });

    it('updates project status', () => {
        registry.registerProject('/path/to/project', 3421);
        registry.updateProjectStatus('project', 'running', 12345);

        const project = registry.getProject('project');
        expect(project?.status).toBe('running');
        expect(project?.pid).toBe(12345);
    });

    it('unregisters a project', () => {
        registry.registerProject('/path/to/project', 3421);

        const result = registry.unregisterProject('project');
        expect(result).toBe(true);
        expect(registry.getAllProjects()).toHaveLength(0);
    });
});
```

**Step 2: Create manager-state.test.ts**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { ManagerStateManager } from '../../src/manager/manager-state';

describe('ManagerStateManager', () => {
    let stateManager: ManagerStateManager;

    beforeEach(() => {
        stateManager = new ManagerStateManager();
    });

    it('starts in PROJECTS state', () => {
        expect(stateManager.getState()).toBe('PROJECTS');
    });

    it('handles navigation to TEMPLATES', async () => {
        const result = await stateManager.handleAction('B');

        expect(result.success).toBe(true);
        expect(result.action).toBe('goto_templates');
        expect(stateManager.getState()).toBe('TEMPLATES');
    });

    it('handles navigation to BINDINGS', async () => {
        const result = await stateManager.handleAction('C');

        expect(result.success).toBe(true);
        expect(result.action).toBe('goto_bindings');
        expect(stateManager.getState()).toBe('BINDINGS');
    });

    it('handles navigation to TEST', async () => {
        const result = await stateManager.handleAction('D');

        expect(result.success).toBe(true);
        expect(result.action).toBe('goto_test');
        expect(stateManager.getState()).toBe('TEST');
    });

    it('handles navigation to GIT', async () => {
        const result = await stateManager.handleAction('E');

        expect(result.success).toBe(true);
        expect(result.action).toBe('goto_git');
        expect(stateManager.getState()).toBe('GIT');
    });

    it('returns error for invalid label in current state', async () => {
        const result = await stateManager.handleAction('Z');

        expect(result.success).toBe(false);
        expect(result.error).toContain('No action');
    });

    it('selects a project', () => {
        stateManager.selectProject('test-project');

        expect(stateManager.context.selectedProjectId).toBe('test-project');
    });

    it('enters and exits edit mode', () => {
        stateManager.enterEditMode(['line 1', 'line 2']);

        expect(stateManager.context.editMode).toBe(true);
        expect(stateManager.context.editBuffer).toHaveLength(2);

        stateManager.exitEditMode(true);
        expect(stateManager.context.editMode).toBe(false);
        expect(stateManager.context.unsavedChanges).toBe(true);
    });
});
```

**Step 3: Create ascii-generator.test.ts**

```typescript
import { describe, it, expect } from 'bun:test';
import { AsciiGenerator } from '../../src/manager/ascii-generator';

describe('AsciiGenerator', () => {
    it('replaces simple variables', () => {
        const generator = new AsciiGenerator();
        const template = 'Hello {{name}}!';
        generator['templateCache'].set('test', template);

        const result = generator.render('test', { name: 'World' });
        expect(result).toBe('Hello World!');
    });

    it('replaces multiple variables', () => {
        const generator = new AsciiGenerator();
        const template = '{{greeting}} {{name}}! Version: {{version}}';
        generator['templateCache'].set('test', template);

        const result = generator.render('test', {
            greeting: 'Hello',
            name: 'World',
            version: '1.0.0'
        });
        expect(result).toBe('Hello World! Version: 1.0.0');
    });

    it('handles missing variables', () => {
        const generator = new AsciiGenerator();
        const template = 'Hello {{name}}!';
        generator['templateCache'].set('test', template);

        const result = generator.render('test', {});
        expect(result).toBe('Hello !');
    });

    it('processes each blocks', () => {
        const generator = new AsciiGenerator();
        const template = 'Items:{{#each items}} [{{label}}:{{value}}]{{/each}}';
        generator['templateCache'].set('test', template);

        const result = generator.render('test', {
            items: [
                { label: 'A', value: '1' },
                { label: 'B', value: '2' }
            ]
        });
        expect(result).toBe('Items: [A:1] [B:2]');
    });

    it('handles empty each blocks', () => {
        const generator = new AsciiGenerator();
        const template = 'Items:{{#each items}}[item]{{/each}}Done';
        generator['templateCache'].set('test', template);

        const result = generator.render('test', { items: [] });
        expect(result).toBe('Items:Done');
    });
});
```

**Step 4: Run tests**

Run: `bun test tests/manager/`

**Step 5: Commit**

```bash
git add tests/manager/
git commit -m "test(manager): add unit tests for project registry, state, and generator"
```

---

## Task 10: Update Documentation

**Files:**
- Create: `docs/ASCII-INTERFACE-MANAGER.md`
- Modify: `README.md`

**Step 1: Create ASCII-INTERFACE-MANAGER.md**

```markdown
# ASCII Interface Manager

A meta-ASCII interface for developing ASCII-wrapped applications. The manager itself is an ASCII-wrapped app that AI agents can control to create, edit, test, and deploy other ASCII apps.

## Overview

The ASCII Interface Manager enables **self-hosting development**: AI agents use the ASCII paradigm to develop ASCII-wrapped applications. The same interface pattern applies at every level.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ASCII INTERFACE MANAGER (Port 3422)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REGISTERED ASCII PROJECTS                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [1] session-analyzer-app    (port 3421)  ● Running                    ││
│  │  [2] my-new-app              (port 3423)  ○ Stopped                    ││
│  │  [N] New Project...                                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Starting the Manager

```bash
cd ascii_interface
bun run src/manager/manager-server.ts
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/view` | GET | Current ASCII screen |
| `/control` | POST | Execute action by label |
| `/projects` | GET | List registered projects |
| `/projects` | POST | Register new project |
| `/metrics` | GET | Performance metrics |

## Label Reference

### Navigation (All States)

| Label | Action |
|-------|--------|
| A | Projects |
| B | Templates |
| C | Bindings |
| D | Test |
| E | Git |
| X | Quit |

### Projects Actions

| Label | Action |
|-------|--------|
| 1-9 | Select project |
| N | New project |
| S | Start selected |
| T | Stop selected |
| R | Restart selected |
| V | View ASCII |

### Templates Actions

| Label | Action |
|-------|--------|
| 1-9 | Select template |
| N | New template |
| W | Save |
| U | Undo |
| ↑/↓ | Scroll |

### Git Actions

| Label | Action |
|-------|--------|
| L | Status |
| M | Commit |
| P | Push |
| F | Pull |

## MCP Integration

The manager has its own MCP bridge for AI control:

```bash
mcp2cli --mcp-stdio "uv run mcp_manager_bridge" manager-view
mcp2cli --mcp-stdio "uv run mcp_manager_bridge" manager-list-projects
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `manager_view` | Get current ASCII screen |
| `manager_control` | Execute action by label |
| `manager_list_projects` | List all registered projects |
| `manager_register_project` | Register a new project |
| `manager_start_project` | Start selected project |
| `manager_stop_project` | Stop selected project |
| `manager_metrics` | Get performance metrics |

## Self-Hosting Development Workflow

1. **AI starts manager**: `bun run src/manager/manager-server.ts`
2. **AI views projects**: `manager_view` → sees registered ASCII apps
3. **AI selects project**: `manager_control` with label "1"
4. **AI navigates to Templates**: `manager_control` with label "B"
5. **AI edits template**: Scrolls, modifies lines
6. **AI saves changes**: `manager_control` with label "W"
7. **AI runs tests**: Navigate to Test, run with "G"
8. **AI commits changes**: Navigate to Git, commit with "M"

## Creating New Projects

Use the scaffold generator:

```typescript
import { scaffoldProject } from './src/manager/scaffold';

scaffoldProject({
    projectName: 'my-new-app',
    targetPath: '/path/to/my-new-app',
    port: 3423,
    description: 'My new ASCII application'
});
```

This creates:
- `src/ascii/states/dashboard.ascii`
- `src/ascii/states/settings.ascii`
- `src/ascii/bindings.json`
- `src/bun/server.ts`
- `package.json`
- `README.md`

## Architecture

```
ascii_interface/
├── src/
│   ├── manager/
│   │   ├── manager-server.ts     # HTTP API server
│   │   ├── manager-state.ts      # State management
│   │   ├── project-registry.ts   # Project tracking
│   │   ├── ascii-generator.ts    # Template rendering
│   │   └── scaffold.ts           # New project generator
│   └── ascii/
│       ├── states/
│       │   ├── projects.ascii
│       │   ├── templates.ascii
│       │   ├── bindings.ascii
│       │   ├── test.ascii
│       │   └── git.ascii
│       └── manager-bindings.json
├── mcp_manager_bridge/
│   └── src/mcp_manager_bridge/
│       └── server.py
└── tests/
    └── manager/
        ├── project-registry.test.ts
        ├── manager-state.test.ts
        └── ascii-generator.test.ts
```

## Benefits

### For AI Agents

1. **Consistent Interface**: Same ASCII paradigm at every level
2. **Self-Hosting**: AI develops ASCII apps through ASCII itself
3. **Full Control**: Create, edit, test, deploy - all via labels
4. **Low Latency**: Sub-10ms responses

### For Developers

1. **Scaffolding**: Quick project creation
2. **Template Management**: Centralized ASCII template editing
3. **Test Integration**: Run tests and see results in ASCII
4. **Git Integration**: Basic version control via ASCII

## Future Enhancements

1. **Multi-file Editing**: Edit multiple templates simultaneously
2. **Live Preview**: See changes reflected in running app
3. **Debug Mode**: Step through state transitions
4. **Plugin System**: Extend with custom panels
5. **Remote Projects**: Manage projects on remote servers
```

**Step 2: Commit**

```bash
git add docs/ASCII-INTERFACE-MANAGER.md
git commit -m "docs: add comprehensive ASCII Interface Manager documentation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project Structure | Directories, bindings.json |
| 2 | ASCII Templates | 5 template files |
| 3 | Project Registry | project-registry.ts |
| 4 | Manager State | manager-state.ts |
| 5 | HTTP API Server | manager-server.ts |
| 6 | ASCII Generator | ascii-generator.ts |
| 7 | MCP Bridge | Python MCP server |
| 8 | Scaffold Generator | scaffold.ts |
| 9 | Unit Tests | 3 test files |
| 10 | Documentation | ASCII-INTERFACE-MANAGER.md |

**Total commits:** 10
**Port:** 3422 (manager), 3421+ (managed projects)

## Execution Options

**Plan complete and saved to `docs/plans/2026-03-18-ascii-interface-manager.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
