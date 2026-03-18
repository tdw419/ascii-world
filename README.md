# ASCII World

> **Build, Control, and Render** — AI agents create software from ASCII templates. The same ASCII becomes the running app AND can render as beautiful GUIs.

## Overview

ASCII World is a platform for AI agents to build, control, and render software. It provides:

- **Build** — AI describes apps in ASCII templates, they run immediately
- **Control** — One dashboard to manage all your ASCII applications
- **Render** — ASCII templates can render as React, Electron, or mobile GUIs
- **Discover** — Auto-scan filesystem for ASCII-compatible projects

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ASCII WORLD (Port 3422)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [A] Projects  [B] Templates  [C] Bindings  [F] Dashboard  [X] Quit        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ PROJECTS ─────────────────────────────────────────────────────────────┐ │
│  │  [1] session-analyzer-app    (port 3421)  ● Running                    │ │
│  │  [2] ascii-world             (port 3422)  ● Running (self)             │ │
│  │  [3] my-new-app              (port 3423)  ○ Stopped                    │ │
│  │  [N] New Project...                                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Selected: my-new-app                                                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [S] Start  [T] Stop  [R] Refresh  [V] View ASCII  [E] Edit Project        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Starting ASCII World

### Prerequisites

- [Bun](https://bun.sh) runtime installed
- Python 3.12+ (for MCP bridge)

### Quick Start

```bash
# Navigate to the project directory
cd /path/to/ascii-world

# Start the server
bun run src/manager/manager-server.ts

# Available at http://localhost:3422
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MANAGER_CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3422` |
| `MANAGER_ALLOWED_DIRS` | Colon-separated list of allowed base directories | Current working directory |
| `ALLOWED_SCAFFOLD_BASE` | Base directory for scaffolding new projects | Current working directory |

---

## API Endpoints Reference

ASCII World exposes a REST API on port 3422.

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600000,
  "version": "1.0.0"
}
```

### GET /view

Render the current ASCII view based on the manager's state.

**Response:**
```json
{
  "state": "PROJECTS",
  "view": "╔══════════════════════════════════════════════════════════════════════════════╗\n║  ASCII WORLD                                             v1.0.0  ║\n...",
  "context": {
    "selectedProjectId": "my-app",
    "editMode": false,
    "unsavedChanges": false
  }
}
```

### POST /control

Execute an action by label. This is the primary way to interact with ASCII World.

**Request Body:**
```json
{
  "label": "A",
  "projectId": "optional-project-id",
  "action": "optional-specific-action"
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `label` | string | Single character label (A-Z or 1-9) |
| `projectId` | string | Optional: Target a specific project |
| `action` | string | Optional: Specific action (start, stop, select) |

**Response:**
```json
{
  "success": true,
  "action": "goto_projects",
  "newState": "PROJECTS"
}
```

### GET /projects

List all registered ASCII projects.

**Response:**
```json
{
  "projects": [
    {
      "id": "my-app",
      "name": "my-app",
      "path": "/home/user/projects/my-app",
      "port": 3421,
      "status": "running",
      "pid": 12345,
      "lastStarted": 1700000000000,
      "asciiPath": "/home/user/projects/my-app/src/ascii/states",
      "bindingsPath": "/home/user/projects/my-app/src/ascii/bindings.json"
    }
  ],
  "count": 1
}
```

### POST /projects

Register a new ASCII project with the manager.

**Request Body:**
```json
{
  "path": "/home/user/projects/my-new-app",
  "port": 3423
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Absolute path to the project directory |
| `port` | number | No | Port number (auto-assigned if omitted) |

**Response:**
```json
{
  "success": true,
  "project": {
    "id": "my-new-app",
    "name": "my-new-app",
    "path": "/home/user/projects/my-new-app",
    "port": 3423,
    "status": "stopped"
  }
}
```

### GET /projects/:id

Get details for a specific project.

### DELETE /projects/:id

Unregister a project (stops it if running first).

### POST /projects/:id/start

Start a registered project.

### POST /projects/:id/stop

Stop a running project.

### GET /metrics

Get performance metrics for the manager API.

**Response:**
```json
{
  "server": {
    "uptime": 3600000,
    "totalRequests": 150,
    "errors": 2,
    "averageResponseTime": 12.5,
    "lastRequestTime": 1700000000000
  },
  "requests": {
    "byEndpoint": {
      "/view": 100,
      "/control": 45,
      "/projects": 5
    },
    "byMethod": {
      "GET": 105,
      "POST": 45
    }
  },
  "projects": {
    "total": 3,
    "running": 2,
    "stopped": 1
  },
  "asciiGenerator": {
    "cacheSize": 5
  }
}
```

---

### Project Proxy Endpoints

ASCII World can proxy requests to managed ASCII projects:

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

# View its ASCII output through ASCII World
curl http://localhost:3422/projects/session-analyzer-app/view

# Send a control command
curl -X POST http://localhost:3422/projects/session-analyzer-app/control \
  -H "Content-Type: application/json" \
  -d '{"label": "B"}'  # Navigate to Sources tab
```

---

## Dashboard View

The Dashboard provides a health-at-a-glance view of all discovered projects.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/view` | GET | Renders dashboard when state is DASHBOARD |
| `/control` | POST | Use `F` to navigate to dashboard, `R` to refresh |

### Dashboard Features

- **Status Icons**: ● running, ○ stopped, ⚠ error
- **Uptime**: Shows time since project started (e.g., "2h 15m")
- **Last Check**: Timestamp of most recent health check
- **Summary**: Count of running/stopped/error projects

#### Example: View Dashboard

```bash
# Navigate to dashboard
curl -X POST http://localhost:3422/control \
  -H "Content-Type: application/json" \
  -d '{"label": "F"}'

# View the dashboard
curl http://localhost:3422/view

# Refresh health data
curl -X POST http://localhost:3422/control \
  -H "Content-Type: application/json" \
  -d '{"label": "R"}'
```

---

## Label Reference

ASCII World uses labeled actions for navigation and control. Each label corresponds to a specific action.

### Navigation Labels (Available in all states)

| Label | Action | Description |
|-------|--------|-------------|
| `A` | `goto_projects` | Navigate to Projects view |
| `B` | `goto_templates` | Navigate to Templates view |
| `C` | `goto_bindings` | Navigate to Bindings view |
| `D` | `goto_test` | Navigate to Test view |
| `E` | `goto_git` | Navigate to Git view |
| `F` | `goto_dashboard` | Navigate to Dashboard view |
| `X` | `quit` | Shutdown the manager |

### Project Management Labels

| Label | Action | Description |
|-------|--------|-------------|
| `1-9` | `select_item_N` | Select project by index |
| `N` | `new_item` | Create new project |
| `S` | `start_project` | Start selected project |
| `T` | `stop_project` | Stop selected project |
| `R` | `restart_project` | Restart selected project |
| `V` | `view_detail` | View project ASCII interface |
| `E` | `edit_project` | Edit project configuration |

### Edit Labels

| Label | Action | Description |
|-------|--------|-------------|
| `W` | `save_changes` | Save current edits |
| `U` | `undo_changes` | Undo unsaved changes |

### Test Labels

| Label | Action | Description |
|-------|--------|-------------|
| `G` | `run_tests` | Execute test suite |

### Git Labels

| Label | Action | Description |
|-------|--------|-------------|
| `L` | `git_status` | Refresh git status |
| `M` | `git_commit` | Commit changes |
| `P` | `git_push` | Push to remote |

---

## MCP Integration

ASCII World provides an MCP (Model Context Protocol) bridge that enables AI assistants like Claude to interact with the manager through standardized tools.

### Installing the MCP Bridge

```bash
cd mcp_manager_bridge
uv sync
```

### Configuring Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "ascii-world": {
      "command": "uv",
      "args": ["--directory", "/path/to/ascii-world/mcp_manager_bridge", "run", "mcp-manager-bridge"],
      "env": {
        "MANAGER_API_URL": "http://localhost:3422"
      }
    }
  }
}
```

### MCP Tools Reference

| Tool | Description |
|------|-------------|
| `manager_view` | Get current ASCII view of the manager |
| `manager_control` | Execute an action by label |
| `manager_list_projects` | List all registered projects |
| `manager_register_project` | Register a new project |
| `manager_metrics` | Get performance metrics |
| `manager_start_project` | Start the selected project |
| `manager_stop_project` | Stop the selected project |
| `manager_project_view` | View a managed project's ASCII |
| `manager_project_control` | Control a managed project |
| `manager_project_bindings` | Get available labels for a project |

### Example: Using MCP Tools

```
AI: I'll check the current state of ASCII World.

[Uses manager_view tool]

╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII WORLD                                               v1.0.0             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [F] Dashboard  [X] Quit          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  REGISTERED ASCII PROJECTS                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  [1] my-app    (port 3421)  ● Running                                  │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

AI: I can see there's one running project. Let me start a new project.

[Uses manager_control tool with label "N"]
```

---

## Creating New Projects with Scaffold

The scaffold generator creates a complete ASCII-wrapped project with all necessary files.

### Scaffold Structure

```
my-new-app/
├── src/
│   ├── bun/
│   │   └── server.ts        # HTTP API server
│   └── ascii/
│       ├── bindings.json    # Label-to-action bindings
│       └── states/
│           ├── dashboard.ascii  # Dashboard view template
│           └── settings.ascii   # Settings view template
├── package.json
└── README.md
```

### Using the Scaffold Programmatically

```typescript
import { scaffoldProject } from './src/manager/scaffold';

scaffoldProject({
    projectName: 'my-cool-app',
    targetPath: './apps/my-cool-app',
    port: 3425,
    description: 'A cool ASCII-wrapped application'
});
```

### Scaffold Validation

The scaffold includes security validations:

- **Project name**: Must match `^[a-zA-Z0-9_-]{1,64}$`
- **Port**: Must be between 1-65535
- **Target path**: Must be within allowed directories, no path traversal

### Generated Files

**dashboard.ascii:**
```
+------------------------------------------------------------------------------+
|  My Cool App                                               v0.1.0            |
+------------------------------------------------------------------------------+
|  [A] Dashboard  [B] Settings  [X] Quit                                       |
+------------------------------------------------------------------------------+
|                                                                              |
|  Status: Running                                                             |
|                                                                              |
|  Welcome to My Cool App!                                                     |
|                                                                              |
+------------------------------------------------------------------------------+
```

**bindings.json:**
```json
{
  "bindings": [
    { "label": "A", "action": "goto_dashboard", "target": "DASHBOARD" },
    { "label": "B", "action": "goto_settings", "target": "SETTINGS" },
    { "label": "X", "action": "quit", "target": "QUIT" },
    { "label": "W", "action": "save_settings", "target": null },
    { "label": "Z", "action": "reset_defaults", "target": null }
  ],
  "stateTransitions": {
    "DASHBOARD": { "A": "DASHBOARD", "B": "SETTINGS", "X": "QUIT" },
    "SETTINGS": { "A": "DASHBOARD", "B": "SETTINGS", "X": "QUIT" }
  }
}
```

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ASCII WORLD                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ ManagerServer   │  │ ProjectRegistry │  │ StateManager    │             │
│  │ (HTTP API)      │  │ (Persistence)   │  │ (Navigation)    │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                        │
│           └────────────────────┼────────────────────┘                        │
│                                │                                             │
│                    ┌───────────▼───────────┐                                 │
│                    │   AsciiGenerator      │                                 │
│                    │   (Template Engine)   │                                 │
│                    └───────────┬───────────┘                                 │
│                                │                                             │
│           ┌────────────────────┼────────────────────┐                        │
│           │                    │                    │                        │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐              │
│  │ projects.ascii  │  │ templates.ascii │  │ bindings.ascii │  ...         │
│  └─────────────────┘  └─────────────────┘  └────────────────┘              │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                              MCP BRIDGE                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ manager_view    │  │ manager_control │  │ manager_*       │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          MANAGED PROJECTS                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Project A       │  │ Project B       │  │ Project C       │             │
│  │ (Port 3421)     │  │ (Port 3423)     │  │ (Port 3424)     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `ManagerServer` | HTTP API server, request routing, security validation |
| `ProjectRegistry` | Project persistence, discovery, port allocation |
| `StateManager` | Navigation state, selection context, edit mode |
| `AsciiGenerator` | Template loading, Mustache-style rendering, caching |
| `Scaffold` | New project generation with security validation |
| `MCP Bridge` | Protocol translation for AI assistants |

### Security Features

- **Path validation**: Prevents path traversal attacks
- **Rate limiting**: 100 requests/minute on `/control` endpoint
- **Input validation**: Strict patterns for labels, project IDs, ports
- **Environment sanitization**: Child processes receive minimal environment
- **CORS**: Configurable allowed origins

---

## Quick Reference Card

```
+------------------+--------------------------------------------------------+
| Endpoint         | Description                                            |
+------------------+--------------------------------------------------------+
| GET  /health     | Health check                                           |
| GET  /view       | ASCII view of current state                            |
| POST /control    | Execute action by label                                |
| GET  /projects   | List registered projects                               |
| POST /projects   | Register new project                                   |
| GET  /metrics    | Performance metrics                                    |
+------------------+--------------------------------------------------------+

+------------------+--------------------------------------------------------+
| Navigation       | Action                                                 |
+------------------+--------------------------------------------------------+
| A                | Projects view                                          |
| B                | Templates view                                         |
| C                | Bindings view                                          |
| D                | Test view                                              |
| E                | Git view                                               |
| F                | Dashboard view                                         |
| X                | Quit                                                   |
+------------------+--------------------------------------------------------+

+------------------+--------------------------------------------------------+
| Project Actions  | Action                                                 |
+------------------+--------------------------------------------------------+
| 1-9              | Select project by index                                |
| N                | New project                                            |
| S                | Start selected project                                 |
| T                | Stop selected project                                  |
| R                | Refresh selected project                               |
| V                | View project ASCII                                     |
+------------------+--------------------------------------------------------+
```

---

*ASCII World — Build, Control, Render — Since 2026*
