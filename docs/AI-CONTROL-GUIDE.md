# AI Control Guide

## Overview

The ASCII Interface Manager provides a text-based control plane for AI agents. Instead of learning complex GUIs or APIs, AI agents interact through simple ASCII views and single-character commands.

## The Problem

AI agents struggle with traditional software:

1. **Visual UIs are unreadable** — AI cannot reliably parse screenshots or complex DOM structures
2. **Multiple APIs** — Each app has different endpoints, authentication, and data formats
3. **State is hidden** — Understanding what the app is doing requires synthesizing information from multiple sources

## The Solution

The ASCII Interface Manager provides:

1. **Unified ASCII Views** — 80x24 text grids that any LLM can read
2. **Single-Character Control** — Press `A`, `B`, `C`, etc. to navigate and act
3. **State Machine** — Predictable state transitions
4. **Health at a7 Glance** — Dashboard shows all projects and their status

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Agent (Claude)                      │
│                           │                             │
│                           ▼                             │
│                    MCP Protocol                          │
│                           │                             │
│                           ▼                             │
┌─────────────────────────────────────────────────────────────┐
│                  ASCII Interface Manager                   │
│                      (port 3422)                         │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  ASCII View (80x24 text grid)                       │ │
│  │                                                     │ │
│  │  ╔══════════════════════════════════════════════╗   │ │
│  │  ║  PROJECTS                              ║   │ │
│  │  ║  [A] Projects  [B] Templates  [F] Dashboard  ║   │ │
│  │  ╠══════════════════════════════════════════════╝   │ │
│  │                                                     │ │
│  │  ┌───────────────────────────────────────────────┐   │ │
│  │  │  [1] session-analyzer-app   3421  ● running  │   │ │
│  │  │  [2] my-other-app           3423  ○ stopped  │   │ │
│  │  └───────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  State Machine: PROJECTS → TEMPLATES → BINDINGS → DASHBOARD → etc.  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Proxy
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Managed ASCII Applications                 │
│                                                           │
│  session-analyzer-app (3421)                              │
│  my-other-app (3423)                                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### ASCII Views

Every screen is an 80x24 character grid. The AI reads this as plain text:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ASCII INTERFACE MANAGER - DASHBOARD                         v1.0.0           │
├──────────────────────────────────────────────────────────────────────────────┤
│  [A] Projects  [B] Templates  [C] Bindings  [F] Dashboard  [X] Quit          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SYSTEM HEALTH                                           Last Check: 10:42   │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Project                    Port    Status    Uptime     Last Check         ││
│  ├──────────────────────────────────────────────────────────────────────────┤│
│  │  [1] session-analyzer-app   3421    ● running  2h 15m    10:42:15         ││
│  │  [2] my-other-app           3423    ○ stopped  --         --              ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Summary: 1 running, 1 stopped, 0 error                                         │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  [R] Refresh  [1-9] Select Project                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**What the AI can see:**
- 2 projects discovered
- Project 1 is running (●), Project 2 is stopped (○)
- Available actions: Press R to refresh, or 1/2 to select

### Label-Based Control

Single character commands instead of complex API calls:

| Label | Action | Result |
|-------|--------|--------|
| `A` | Navigate to Projects view | Shows project list |
| `B` | Navigate to Templates view | Shows ASCII templates |
| `F` | Navigate to Dashboard | Shows health overview |
| `R` | Refresh | Reloads current view |
| `1-9` | Select item | Selects project by number |
| `S` | Start | Starts selected project |
| `T` | Stop | Stops selected project |
| `X` | Quit | Shuts down manager |

### State Machine

Predictable transitions between views:

```
PROJECTS ──F──> DASHBOARD
    │                  │
    └─────A────────────┘
```

The AI always knows:
- Current state (which view)
- Available actions (from the label bar)
- What will happen (state machine defines transitions)

## MCP Tools

The Manager exposes these MCP tools for AI agents:

| Tool | Description |
|------|-------------|
| `manager_view` | Get current ASCII view |
| `manager_control` | Send a label command |
| `manager_list_projects` | List all registered projects |
| `manager_project_view` | View a managed project's ASCII |
| `manager_project_control` | Control a managed project |
| `manager_project_bindings` | Get available labels for a project |

### Example Usage

**Check system health:**
```
1. Call `manager_control` with label="F" → Navigate to Dashboard
2. Call `manager_view` → Read the health overview
3. Parse the output: "1 running, 1 stopped"
```

**Start a stopped project:**
```
1. Call `manager_control` with label="A" → Navigate to Projects
2. Call `manager_view` → See project list with numbers
3. Call `manager_control` with label="2" → Select project 2
4. Call `manager_control` with label="S" → Start it
```

**Control a managed app:**
```
1. Call `manager_project_view` with project_id="session-analyzer-app"
2. Read the app's ASCII view
3. Call `manager_project_bindings` to see available labels
4. Call `manager_project_control` with label="B" → Navigate within the app
```

## Why This Helps AI Agents

### 1. Readability
```
Before: AI must parse complex JSON or HTML
After: AI reads plain text,80x24 grid
```

### 2. Simplicity
```
Before: Learn 50+ API endpoints, each with different parameters
After: Learn: view, control + single character
```

### 3. Predictability
```
Before: "What happens if I call this endpoint?"
After: State machine guarantees: A always goes to Projects, F always goes to Dashboard
```

### 4. Aggregation
```
Before: Call 10 different apps to check their status
After: Dashboard shows all apps in one view
```

## Getting Started

1. Start the Manager:
```bash
bun run src/manager/manager-server.ts
```

2. The Manager auto-discovers ASCII apps in `~/zion/projects/`

3. AI agents connect via MCP:
```
mcp_manager_bridge
```

4. AI reads views and sends commands through the Manager

## See Also

- [ASCII Interface Manager](./ASCII-INTERFACE-MANAGER.md) — Full API reference
- [ASCII-First Architecture](./ASCII-FIRST-ARCHITECTure.md) — Design philosophy
