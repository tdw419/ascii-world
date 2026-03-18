# ASCII Interface Manager

> **The Meta-ASCII Interface** - Develop ASCII-wrapped applications through the ASCII paradigm itself.

## Overview

The ASCII Interface Manager is a meta-application that enables AI agents to develop, test, and deploy ASCII-first applications entirely through the ASCII paradigm - achieving **self-hosting development**. The manager itself is an ASCII-wrapped application that AI can control using the same interface patterns used by all ASCII applications.

### What is Self-Hosting Development?

Self-hosting means the ASCII Interface Manager uses ASCII interfaces to develop ASCII interfaces. AI agents interact with the manager through the same paradigm they use to interact with any ASCII-wrapped application. This creates a consistent, learnable pattern at every level of the system.

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
│  Selected: my-new-app                                                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [S] Start  [T] Stop  [R] Restart  [V] View ASCII  [E] Edit Project        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Starting the Manager

### Prerequisites

- [Bun](https://bun.sh) runtime installed
- Python 3.12+ (for MCP bridge)

### Quick Start

```bash
# Navigate to the project directory
cd /path/to/ascii_interface

# Start the manager server
bun run src/manager/manager-server.ts

# The manager will be available at http://localhost:3422
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MANAGER_CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3422` |
| `MANAGER_ALLOWED_DIRS` | Colon-separated list of allowed base directories | Current working directory |
| `ALLOWED_SCAFFOLD_BASE` | Base directory for scaffolding new projects | Current working directory |

---

## API Endpoints Reference

The ASCII Interface Manager exposes a REST API on port 3422.

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
  "view": "╔══════════════════════════════════════════════════════════════════════════════╗\n║  ASCII INTERFACE MANAGER                                   v1.0.0  ║\n...",
  "context": {
    "selectedProjectId": "my-app",
    "editMode": false,
    "unsavedChanges": false
  }
}
```

### POST /control

Execute an action by label. This is the primary way to interact with the manager.

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

## Label Reference

The ASCII Interface Manager uses labeled actions for navigation and control. Each label corresponds to a specific action.

### Navigation Labels (Available in all states)

| Label | Action | Description |
|-------|--------|-------------|
| `A` | `goto_projects` | Navigate to Projects view |
| `B` | `goto_templates` | Navigate to Templates view |
| `C` | `goto_bindings` | Navigate to Bindings view |
| `D` | `goto_test` | Navigate to Test view |
| `E` | `goto_git` | Navigate to Git view |
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

The ASCII Interface Manager provides an MCP (Model Context Protocol) bridge that enables AI assistants like Claude to interact with the manager through standardized tools.

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
    "ascii-manager": {
      "command": "uv",
      "args": ["--directory", "/path/to/ascii_interface/mcp_manager_bridge", "run", "mcp-manager-bridge"],
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

### Example: Using MCP Tools

```
AI: I'll check the current state of the manager.

[Uses manager_view tool]

╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  REGISTERED ASCII PROJECTS                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  [1] my-app    (port 3421)  ● Running                                   │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

AI: I can see there's one running project. Let me start a new project.

[Uses manager_control tool with label "N"]
```

---

## Self-Hosting Development Workflow

The ASCII Interface Manager enables a unique development workflow where AI agents develop ASCII applications through ASCII interfaces.

### Workflow Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AI Agent       │     │  ASCII Manager  │     │  Target App     │
│  (Claude)       │     │  (Port 3422)    │     │  (Port 3421)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. View Manager      │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │  2. Register Project  │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │  3. Scaffold New App  │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │  4. Start Project     │                       │
         │──────────────────────>│──────────────────────>│
         │                       │                       │
         │  5. View App ASCII    │                       │
         │──────────────────────>│<──────────────────────│
         │                       │                       │
         │  6. Edit Templates    │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │  7. Run Tests         │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │  8. Git Commit        │                       │
         │──────────────────────>│                       │
         │                       │                       │
```

### Step-by-Step Workflow

1. **View Current State**
   ```
   GET /view
   ```

2. **Register Existing Project**
   ```
   POST /projects
   { "path": "/path/to/project" }
   ```

3. **Create New Project (via Scaffold)**
   Use the scaffold API or manually create the project structure.

4. **Start Project**
   ```
   POST /control
   { "label": "1" }  # Select project
   POST /control
   { "label": "S" }  # Start project
   ```

5. **View Running App**
   ```
   POST /control
   { "label": "V" }  # View ASCII
   ```

6. **Edit Templates**
   Navigate to Templates view and modify ASCII templates.

7. **Run Tests**
   Navigate to Test view and execute the test suite.

8. **Git Operations**
   Navigate to Git view to commit and push changes.

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
│                          ASCII INTERFACE MANAGER                             │
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

### Data Flow

```
Request → ManagerServer → Validation → StateManager/Registry → AsciiGenerator → Response
                                    ↓
                              Process Spawning (for project start/stop)
```

### Security Features

- **Path validation**: Prevents path traversal attacks
- **Rate limiting**: 100 requests/minute on `/control` endpoint
- **Input validation**: Strict patterns for labels, project IDs, ports
- **Environment sanitization**: Child processes receive minimal environment
- **CORS**: Configurable allowed origins

---

## Future Enhancements

### Planned Features

1. **Live Preview Pane**
   - Real-time preview of ASCII changes
   - Split-view editing mode

2. **WebSocket Support**
   - Real-time state updates
   - Push notifications for project events

3. **Template Marketplace**
   - Share ASCII templates
   - Import community templates

4. **Enhanced Git Integration**
   - Branch management
   - Merge conflict resolution
   - Pull request creation

5. **Multi-Agent Collaboration**
   - Session sharing
   - Concurrent editing
   - Change attribution

6. **Plugin System**
   - Custom template processors
   - External tool integrations
   - Custom action handlers

7. **Visual Editor Mode**
   - GUI for ASCII template editing
   - Drag-and-drop components
   - Preview-as-you-type

8. **Testing Enhancements**
   - Visual test snapshots
   - Coverage visualization
   - Performance benchmarks

### Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-18 | Initial release with core features |

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
| X                | Quit                                                   |
+------------------+--------------------------------------------------------+

+------------------+--------------------------------------------------------+
| Project Actions  | Action                                                 |
+------------------+--------------------------------------------------------+
| 1-9              | Select project by index                                |
| N                | New project                                            |
| S                | Start selected project                                 |
| T                | Stop selected project                                  |
| R                | Restart selected project                               |
| V                | View project ASCII                                     |
+------------------+--------------------------------------------------------+
```

---

*ASCII Interface Manager - Enabling self-hosting ASCII development since 2026*
