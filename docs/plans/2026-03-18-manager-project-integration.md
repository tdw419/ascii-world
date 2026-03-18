# Manager Project Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the ASCII Interface Manager to register, control, and proxy ASCII views from managed projects like the Session Analyzer app.

**Architecture:** Extend the Manager with project proxy capabilities - when a project is selected and "viewed", the Manager fetches the managed project's /view endpoint and displays it. Control commands are forwarded to the managed project's /control endpoint. This creates a hierarchical control structure where AI can manage multiple ASCII apps through a single Manager interface.

**Tech Stack:** Bun, TypeScript, HTTP proxying, MCP tools extension

---

## Overview

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
│  │  [N] New Project...                                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  [V] View Selected Project's ASCII   [C] Control Selected Project          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ [V] View pressed
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROXY VIEW: session-analyzer-app (Port 3421)                               │
├─────────────────────────────────────────────────────────────────────────────┤
║  [A] Dashboard  [B] Sources  [C] Config  [D] History  [X] Back to Manager  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  (Fetched from http://localhost:3421/view)                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Task 1: Add Project Proxy Endpoints to Manager Server

**Files:**
- Modify: `src/manager/manager-server.ts`

**Step 1: Add proxy view endpoint**

Add a new endpoint `GET /projects/:id/view` that fetches the managed project's ASCII view.

```typescript
// Add after existing endpoints in handleRequest method

// Proxy view - fetch managed project's ASCII view
if (path.match(/^\/projects\/[^/]+\/view$/) && method === 'GET') {
    const projectId = path.split('/')[2];

    if (!this.validateProjectId(projectId)) {
        return this.jsonResponse({ error: 'Invalid project ID format' }, 400);
    }

    const project = this.registry.getProject(projectId);
    if (!project) {
        return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
    }

    if (project.status !== 'running') {
        return this.jsonResponse({
            error: `Project not running. Status: ${project.status}`,
            project: { id: project.id, status: project.status }
        }, 503);
    }

    try {
        const response = await fetch(`http://localhost:${project.port}/view`, {
            method: 'GET',
            headers: { 'Accept': 'text/plain' }
        });

        if (!response.ok) {
            return this.jsonResponse({
                error: `Project view error: ${response.status}`,
                projectId
            }, 502);
        }

        const asciiView = await response.text();
        this.updateMetrics('/projects/:id/view', 'GET', Date.now() - startTime);

        return new Response(asciiView, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                ...this.corsHeaders()
            }
        });
    } catch (error) {
        return this.jsonResponse({
            error: `Failed to connect to project: ${error instanceof Error ? error.message : 'Unknown error'}`,
            projectId,
            port: project.port
        }, 502);
    }
}
```

**Step 2: Add proxy control endpoint**

Add a new endpoint `POST /projects/:id/control` that forwards control commands to the managed project.

```typescript
// Proxy control - forward command to managed project
if (path.match(/^\/projects\/[^/]+\/control$/) && method === 'POST') {
    const projectId = path.split('/')[2];

    if (!this.validateProjectId(projectId)) {
        return this.jsonResponse({ error: 'Invalid project ID format' }, 400);
    }

    const project = this.registry.getProject(projectId);
    if (!project) {
        return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
    }

    if (project.status !== 'running') {
        return this.jsonResponse({
            error: `Project not running. Status: ${project.status}`,
            project: { id: project.id, status: project.status }
        }, 503);
    }

    try {
        const body = await request.json();
        const label = body.label;

        if (!label || typeof label !== 'string') {
            return this.jsonResponse({ error: 'Missing or invalid label' }, 400);
        }

        const response = await fetch(`http://localhost:${project.port}/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ label })
        });

        const result = await response.json();
        this.updateMetrics('/projects/:id/control', 'POST', Date.now() - startTime);

        return this.jsonResponse({
            projectId,
            port: project.port,
            ...result
        }, response.ok ? 200 : response.status);
    } catch (error) {
        return this.jsonResponse({
            error: `Failed to control project: ${error instanceof Error ? error.message : 'Unknown error'}`,
            projectId,
            port: project.port
        }, 502);
    }
}
```

**Step 3: Add project bindings endpoint**

Add a new endpoint `GET /projects/:id/bindings` that fetches the managed project's bindings.

```typescript
// Get project bindings
if (path.match(/^\/projects\/[^/]+\/bindings$/) && method === 'GET') {
    const projectId = path.split('/')[2];

    if (!this.validateProjectId(projectId)) {
        return this.jsonResponse({ error: 'Invalid project ID format' }, 400);
    }

    const project = this.registry.getProject(projectId);
    if (!project) {
        return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
    }

    // Read bindings from project's bindings file
    const bindingsPath = join(project.path, 'src/ascii/bindings.json');
    if (!existsSync(bindingsPath)) {
        return this.jsonResponse({
            error: 'Bindings file not found for project',
            expectedPath: bindingsPath
        }, 404);
    }

    try {
        const bindingsContent = readFileSync(bindingsPath, 'utf8');
        const bindings = JSON.parse(bindingsContent);
        this.updateMetrics('/projects/:id/bindings', 'GET', Date.now() - startTime);

        return this.jsonResponse({
            projectId,
            ...bindings
        });
    } catch (error) {
        return this.jsonResponse({
            error: `Failed to read bindings: ${error instanceof Error ? error.message : 'Unknown error'}`,
            projectId
        }, 500);
    }
}
```

**Step 4: Run tests to verify compilation**

Run: `bun build src/manager/manager-server.ts --target=bun 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/manager/manager-server.ts
git commit -m "feat(manager): add proxy endpoints for viewing and controlling managed projects"
```

---

## Task 2: Add Manager State for Project View Mode

**Files:**
- Modify: `src/manager/manager-state.ts`
- Modify: `src/ascii/manager-bindings.json`
- Create: `src/ascii/states/project-view.ascii`

**Step 1: Add PROJECT_VIEW state to ManagerState type**

```typescript
// Update the ManagerState type
export type ManagerState = 'PROJECTS' | 'TEMPLATES' | 'BINDINGS' | 'TEST' | 'GIT' | 'PROJECT_VIEW';
```

**Step 2: Update manager-bindings.json**

Add state transition for PROJECT_VIEW:

```json
{
  "stateTransitions": {
    "PROJECTS": { ... },
    "TEMPLATES": { ... },
    "BINDINGS": { ... },
    "TEST": { ... },
    "GIT": { ... },
    "PROJECT_VIEW": {
      "A": "PROJECTS",
      "X": "PROJECTS"
    }
  }
}
```

**Step 3: Add enterProjectView method to ManagerStateManager**

```typescript
/**
 * Enter project view mode for a specific project
 */
public enterProjectView(projectId: string): void {
    this._context = {
        ...this._context,
        state: 'PROJECT_VIEW',
        selectedProjectId: projectId
    };
}
```

**Step 4: Create project-view.ascii template**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  PROXY VIEW: {{project_name}} (Port {{port}})                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Back to Projects  [X] Quit Manager                                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  MANAGED PROJECT VIEW (fetched from http://localhost:{{port}}/view)        ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  {{proxied_view}}                                                       │║
║  │  (Content fetched from managed project)                                 │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [1-9] Execute Label  [V] Refresh View  [B] View Bindings                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Step 5: Commit**

```bash
git add src/manager/manager-state.ts src/ascii/manager-bindings.json src/ascii/states/project-view.ascii
git commit -m "feat(manager): add PROJECT_VIEW state for displaying managed project views"
```

---

## Task 3: Update Manager Server to Handle Project View State

**Files:**
- Modify: `src/manager/manager-server.ts`

**Step 1: Add project view rendering**

Update the `/view` endpoint to render project view when state is PROJECT_VIEW:

```typescript
// In the /view endpoint handler, add handling for PROJECT_VIEW state
if (path === '/view' && method === 'GET') {
    const state = this.stateManager.getState();
    const context = this.stateManager.getData();

    if (state === 'PROJECT_VIEW' && context.selectedProjectId) {
        const project = this.registry.getProject(context.selectedProjectId);

        if (!project) {
            return this.jsonResponse({ error: 'Selected project not found' }, 404);
        }

        // Fetch the managed project's view
        let proxiedView = 'Unable to fetch project view';
        if (project.status === 'running') {
            try {
                const response = await fetch(`http://localhost:${project.port}/view`);
                if (response.ok) {
                    proxiedView = await response.text();
                }
            } catch {
                proxiedView = `Connection failed to project at port ${project.port}`;
            }
        } else {
            proxiedView = `Project status: ${project.status}`;
        }

        const viewData = {
            app_version: APP_VERSION,
            project_name: project.name,
            port: project.port,
            proxied_view: proxiedView.split('\n').slice(0, 10).join('\n') // Limit lines
        };

        const ascii = this.asciiGenerator.render('PROJECT_VIEW', viewData);
        return new Response(ascii, {
            headers: { ...this.corsHeaders(), 'Content-Type': 'text/plain' }
        });
    }

    // ... existing view rendering logic
}
```

**Step 2: Add control handling for project view mode**

Update the `/control` endpoint to forward labels when in PROJECT_VIEW state:

```typescript
// In the /control endpoint handler
if (path === '/control' && method === 'POST') {
    // ... existing validation ...

    const state = this.stateManager.getState();
    const context = this.stateManager.getData();

    // If in PROJECT_VIEW mode and label is numeric, forward to managed project
    if (state === 'PROJECT_VIEW' && context.selectedProjectId && /^[A-Z1-9]$/.test(label)) {
        if (label === 'A' || label === 'X') {
            // Navigation back to projects
            const result = this.stateManager.handleAction(label);
            return this.jsonResponse({
                status: 'ok',
                action: 'return_to_projects',
                state: this.stateManager.getState()
            });
        }

        // Forward to managed project
        const project = this.registry.getProject(context.selectedProjectId);
        if (project && project.status === 'running') {
            try {
                const response = await fetch(`http://localhost:${project.port}/control`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label })
                });

                const result = await response.json();
                return this.jsonResponse({
                    status: 'forwarded',
                    projectId: project.id,
                    port: project.port,
                    result
                });
            } catch (error) {
                return this.jsonResponse({
                    error: 'Failed to forward control to project',
                    projectId: project.id
                }, 502);
            }
        }
    }

    // ... existing control logic
}
```

**Step 3: Add 'V' action to enter project view**

```typescript
// Handle 'V' action to view selected project
if (label === 'V' && context.selectedProjectId) {
    this.stateManager.enterProjectView(context.selectedProjectId);
    return this.jsonResponse({
        status: 'ok',
        action: 'enter_project_view',
        projectId: context.selectedProjectId,
        state: this.stateManager.getState()
    });
}
```

**Step 4: Commit**

```bash
git add src/manager/manager-server.ts
git commit -m "feat(manager): integrate project view mode with proxy rendering and control forwarding"
```

---

## Task 4: Add MCP Tools for Project Proxy

**Files:**
- Modify: `mcp_manager_bridge/src/mcp_manager_bridge/server.py`

**Step 1: Add project_view tool**

```python
Tool(
    name="manager_project_view",
    description=(
        "Get the ASCII view from a managed project. "
        "Fetches the /view endpoint from the specified project and returns it. "
        "Use this to see the current state of a managed ASCII application."
    ),
    inputSchema={
        "type": "object",
        "properties": {
            "project_id": {
                "type": "string",
                "description": "The ID of the project to view"
            }
        },
        "required": ["project_id"]
    }
),
```

**Step 2: Add project_control tool**

```python
Tool(
    name="manager_project_control",
    description=(
        "Send a control command to a managed project. "
        "Forwards a label command to the specified project's /control endpoint. "
        "Use this to interact with managed ASCII applications."
    ),
    inputSchema={
        "type": "object",
        "properties": {
            "project_id": {
                "type": "string",
                "description": "The ID of the project to control"
            },
            "label": {
                "type": "string",
                "description": "Single character label (A-Z or 1-9)",
                "pattern": "^[A-Z1-9]$"
            }
        },
        "required": ["project_id", "label"]
    }
),
```

**Step 3: Add project_bindings tool**

```python
Tool(
    name="manager_project_bindings",
    description=(
        "Get the label bindings for a managed project. "
        "Returns the full bindings.json from the project, including "
        "available labels, actions, and state transitions."
    ),
    inputSchema={
        "type": "object",
        "properties": {
            "project_id": {
                "type": "string",
                "description": "The ID of the project"
            }
        },
        "required": ["project_id"]
    }
),
```

**Step 4: Implement tool handlers**

```python
# In call_tool function
if name == "manager_project_view":
    project_id = arguments.get("project_id")
    if not project_id:
        return [TextContent(type="text", text="Error: project_id is required")]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{MANAGER_API_URL}/projects/{project_id}/view",
            timeout=10.0
        )
        return [TextContent(type="text", text=response.text)]

if name == "manager_project_control":
    project_id = arguments.get("project_id")
    label = arguments.get("label", "").upper()

    if not project_id:
        return [TextContent(type="text", text="Error: project_id is required")]
    if not LABEL_PATTERN.match(label):
        return [TextContent(type="text", text="Error: label must be A-Z or 1-9")]

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MANAGER_API_URL}/projects/{project_id}/control",
            json={"label": label},
            timeout=10.0
        )
        return [TextContent(type="text", text=response.text)]

if name == "manager_project_bindings":
    project_id = arguments.get("project_id")
    if not project_id:
        return [TextContent(type="text", text="Error: project_id is required")]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{MANAGER_API_URL}/projects/{project_id}/bindings",
            timeout=10.0
        )
        return [TextContent(type="text", text=response.text)]
```

**Step 5: Commit**

```bash
git add mcp_manager_bridge/src/mcp_manager_bridge/server.py
git commit -m "feat(mcp): add project proxy tools for viewing and controlling managed projects"
```

---

## Task 5: Register Session Analyzer with Manager

**Files:**
- Create: `scripts/register-session-analyzer.sh`

**Step 1: Create registration script**

```bash
#!/bin/bash
# Register the Session Analyzer app with the ASCII Interface Manager

set -e

MANAGER_URL="http://localhost:3422"
PROJECT_PATH="/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app"
PROJECT_PORT=3421

echo "Registering Session Analyzer with Manager..."

# Check if manager is running
if ! curl -s "$MANAGER_URL/health" > /dev/null 2>&1; then
    echo "Error: Manager not running at $MANAGER_URL"
    echo "Start it with: bun run src/manager/manager-server.ts"
    exit 1
fi

# Register the project
RESPONSE=$(curl -s -X POST "$MANAGER_URL/projects" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$PROJECT_PATH\", \"port\": $PROJECT_PORT}")

echo "Response: $RESPONSE"

# Check if registration was successful
if echo "$RESPONSE" | grep -q '"id"'; then
    echo "✓ Session Analyzer registered successfully"
    echo ""
    echo "Available commands:"
    echo "  curl $MANAGER_URL/projects                    # List all projects"
    echo "  curl $MANAGER_URL/projects/session-analyzer-app/view     # View ASCII"
    echo "  curl -X POST $MANAGER_URL/projects/session-analyzer-app/control -d '{\"label\":\"A\"}'"
else
    echo "✗ Registration failed"
    exit 1
fi
```

**Step 2: Make script executable**

Run: `chmod +x scripts/register-session-analyzer.sh`

**Step 3: Commit**

```bash
git add scripts/register-session-analyzer.sh
git commit -m "feat(scripts): add registration script for Session Analyzer"
```

---

## Task 6: Add Integration Tests

**Files:**
- Create: `tests/manager/project-proxy.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

describe('Project Proxy Integration', () => {

    describe('Proxy View Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch('http://localhost:3422/projects/non-existent/view');
            expect(response.status).toBe(404);
        });

        it('should return 503 for stopped project', async () => {
            // First register a project
            await fetch('http://localhost:3422/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: '/tmp/test-project',
                    port: 9999
                })
            });

            const response = await fetch('http://localhost:3422/projects/test-project/view');
            expect(response.status).toBe(503);
        });
    });

    describe('Proxy Control Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch('http://localhost:3422/projects/non-existent/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'A' })
            });
            expect(response.status).toBe(404);
        });

        it('should validate label format', async () => {
            const response = await fetch('http://localhost:3422/projects/some-project/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'INVALID' })
            });
            expect(response.status).toBe(400);
        });
    });

    describe('Project Bindings Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch('http://localhost:3422/projects/non-existent/bindings');
            expect(response.status).toBe(404);
        });
    });
});
```

**Step 2: Run tests**

Run: `bun test tests/manager/project-proxy.test.ts`

**Step 3: Commit**

```bash
git add tests/manager/project-proxy.test.ts
git commit -m "test(manager): add integration tests for project proxy endpoints"
```

---

## Task 7: Update Documentation

**Files:**
- Modify: `docs/ASCII-INTERFACE-MANAGER.md`

**Step 1: Add Project Proxy section**

Add after the "API Endpoints Reference" section:

```markdown
### Project Proxy Endpoints

The Manager can proxy requests to managed ASCII projects:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects/:id/view` | GET | Fetch managed project's ASCII view |
| `/projects/:id/control` | POST | Forward control command to project |
| `/projects/:id/bindings` | GET | Get project's label bindings |

#### Example: View Session Analyzer

```bash
# Register the Session Analyzer
curl -X POST http://localhost:3422/projects \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/session-analyzer-app", "port": 3421}'

# View its ASCII output through the Manager
curl http://localhost:3422/projects/session-analyzer-app/view

# Send a control command
curl -X POST http://localhost:3422/projects/session-analyzer-app/control \
  -H "Content-Type: application/json" \
  -d '{"label": "B"}'  # Navigate to Sources tab
```

### MCP Project Proxy Tools

New MCP tools for interacting with managed projects:

| Tool | Description |
|------|-------------|
| `manager_project_view` | Fetch ASCII view from a managed project |
| `manager_project_control` | Send control command to managed project |
| `manager_project_bindings` | Get label bindings for managed project |

#### Example Usage with mcp2cli

```bash
# View Session Analyzer through Manager
mcp2cli --mcp-stdio "uv run mcp_manager_bridge" manager-project-view --project-id session-analyzer-app

# Navigate to Sources tab
mcp2cli --mcp-stdio "uv run mcp_manager_bridge" manager-project-control \
  --project-id session-analyzer-app --label B

# Get available labels
mcp2cli --mcp-stdio "uv run mcp_manager_bridge" manager-project-bindings \
  --project-id session-analyzer-app
```
```

**Step 2: Commit**

```bash
git add docs/ASCII-INTERFACE-MANAGER.md
git commit -m "docs: add project proxy endpoint and MCP tool documentation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add Proxy Endpoints | manager-server.ts |
| 2 | Add PROJECT_VIEW State | manager-state.ts, bindings, template |
| 3 | Integrate Project View Mode | manager-server.ts |
| 4 | Add MCP Proxy Tools | server.py |
| 5 | Registration Script | register-session-analyzer.sh |
| 6 | Integration Tests | project-proxy.test.ts |
| 7 | Update Documentation | ASCII-INTERFACE-MANAGER.md |

**Total commits:** 7
**New endpoints:** 3 (view, control, bindings per project)
**New MCP tools:** 3 (project_view, project_control, project_bindings)

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-03-18-manager-project-integration.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
