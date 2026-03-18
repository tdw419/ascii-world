# Claude Code MCP Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install the MCP ASCII bridge as a Claude Code MCP server, enabling any Claude session to control the session-analyzer-app via ASCII commands.

**Architecture:** Configure Claude Code's settings.json to include the mcp-ascii-bridge as an MCP server. Create a skill file for documentation. Test the integration by calling MCP tools from within Claude Code.

**Tech Stack:** Python, MCP protocol, Claude Code settings, uv package manager

---

## Task 1: Create Claude Code Skill File

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/skill/mcp-ascii-control.md`

**Context:** The skill directory exists but is empty. We need a skill file that documents how to use the MCP ASCII bridge.

**Step 1: Create the skill file**

```markdown
---
name: mcp-ascii-control
description: Control session-analyzer-app via MCP ASCII bridge. Use for label-based navigation and control of the ASCII interface.
---

# MCP ASCII Control

Control the session-analyzer-app through its ASCII interface using MCP tools.

## Prerequisites

1. session-analyzer-app running on port 3421
2. MCP bridge installed in Claude Code settings

## MCP Tools Available

| Tool | Description |
|------|-------------|
| `ascii_view` | Get current ASCII screen (80x24 grid) |
| `ascii_control` | Execute action by label (A-Z, 1-5) |
| `ascii_navigate` | Navigate directly to a state |
| `ascii_metrics` | Get API latency statistics |
| `ascii_bindings` | Get label-to-action mappings |

## Usage in Claude Code

Once configured, the MCP tools are automatically available. Use them like any other tool:

```
# Get current screen state
Call: ascii_view

# Navigate to Config tab
Call: ascii_navigate with target="CONFIG"

# Execute Run Analysis
Call: ascii_control with label="E"
```

## Label Reference

### Navigation Labels
| Label | Action |
|-------|--------|
| `A` | Dashboard |
| `B` | Sources |
| `C` | Config |
| `D` | History |
| `X` | Back/Quit |

### Config Section Labels
| Label | Action |
|-------|--------|
| `1` | Project section |
| `2` | Schedule section |
| `3` | Model section |
| `4` | Prompts section |
| `5` | Notifications section |

### Action Labels
| Label | Action |
|-------|--------|
| `E` | Primary action (context-dependent) |
| `F` | Export |
| `W` | Save config |
| `Y` | Save profile as |
| `Z` | Reset defaults |

## Workflow

1. Call `ascii_view` to understand current state
2. Parse available [A-Z] labels from output
3. Use `ascii_control` or `ascii_navigate` to take action
4. Call `ascii_view` again to verify state change

## Error Handling

If the app is not running, tools return connection error. Start the app first:

```bash
cd /path/to/session-analyzer-app
bun run src/bun/server.ts
```
```

**Step 2: Commit**

```bash
cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app
git add mcp_ascii_bridge/skill/mcp-ascii-control.md
git commit -m "docs(mcp): add Claude Code skill file for MCP ASCII control"
```

---

## Task 2: Add MCP Server to Claude Code Settings

**Files:**
- Modify: `~/.claude/settings.json`

**Context:** Claude Code needs the MCP server configured in settings.json to make the tools available.

**Step 1: Read current settings.json**

Run: `cat ~/.claude/settings.json`

**Step 2: Add mcpServers section**

Add the `mcpServers` configuration to settings.json. The file currently has env, model, hooks, enabledPlugins, and extraKnownMarketplaces sections.

Add after the existing sections:

```json
{
  "mcpServers": {
    "ascii-control": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge",
        "python",
        "-m",
        "mcp_ascii_bridge.server"
      ],
      "env": {
        "ASCII_API_URL": "http://localhost:3421"
      }
    }
  }
}
```

**Step 3: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('$HOME/.claude/settings.json'))"`

Expected: No output (valid JSON)

---

## Task 3: Test MCP Integration

**Files:**
- None (testing only)

**Context:** Verify the MCP server is available to Claude Code by testing the tools.

**Step 1: Start session-analyzer-app**

Run in a separate terminal:
```bash
cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app
bun run src/bun/server.ts
```

**Step 2: Verify app is running**

Run: `curl -s http://localhost:3421/health`

Expected: `{"status": "healthy", "service": "session-analyzer-api"}`

**Step 3: Test MCP server directly**

Run:
```bash
cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge
uv run python -c "
import asyncio
from mcp_ascii_bridge.server import list_tools

async def test():
    tools = await list_tools()
    for t in tools:
        print(f'- {t.name}: {t.description[:50]}...')

asyncio.run(test())
"
```

Expected: List of 5 tools with descriptions

**Step 4: Test with mcp2cli (if available)**

Run:
```bash
mcp2cli --mcp-stdio "uv run --directory /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge python -m mcp_ascii_bridge.server" --list
```

Expected: List of available MCP tools

---

## Task 4: Create Integration Test Documentation

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/docs/INTEGRATION.md`

**Context:** Document the full integration process for future reference.

**Step 1: Create integration documentation**

```markdown
# MCP ASCII Bridge Integration Guide

## Overview

This guide explains how to integrate the MCP ASCII Bridge with Claude Code for AI-powered control of session-analyzer-app.

## Architecture

```
Claude Code → MCP Protocol → mcp-ascii-bridge → HTTP API → session-analyzer-app
```

## Prerequisites

- Python 3.12+
- uv package manager
- Bun runtime
- Claude Code CLI

## Installation

### 1. Configure Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "ascii-control": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/path/to/mcp_ascii_bridge",
        "python",
        "-m",
        "mcp_ascii_bridge.server"
      ],
      "env": {
        "ASCII_API_URL": "http://localhost:3421"
      }
    }
  }
}
```

### 2. Start the App

```bash
cd /path/to/session-analyzer-app
bun run src/bun/server.ts
```

### 3. Verify Integration

In Claude Code, the MCP tools should now be available. Test by asking Claude to call `ascii_view`.

## Usage Examples

### Get Current State

Ask Claude: "Show me the current ASCII view of the app"

Claude will call `ascii_view` and display the 80x24 grid.

### Navigate

Ask Claude: "Navigate to the Config tab"

Claude will call `ascii_navigate` with `target="CONFIG"`.

### Execute Action

Ask Claude: "Run the analysis"

Claude will call `ascii_control` with `label="E"`.

## Troubleshooting

### Connection Error

If tools return connection errors:
1. Verify session-analyzer-app is running on port 3421
2. Check `ASCII_API_URL` environment variable
3. Test with `curl http://localhost:3421/health`

### MCP Server Not Found

If Claude Code doesn't see the MCP tools:
1. Verify settings.json has valid JSON
2. Restart Claude Code
3. Check the path in `mcpServers.ascii-control.args`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASCII_API_URL` | `http://localhost:3421` | URL of the ASCII control API |
| `ASCII_BINDINGS_PATH` | (auto) | Path to bindings.json |
```

**Step 2: Commit**

```bash
cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app
mkdir -p mcp_ascii_bridge/docs
git add mcp_ascii_bridge/docs/INTEGRATION.md
git commit -m "docs(mcp): add integration guide for Claude Code MCP setup"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create Claude Code Skill File | skill/mcp-ascii-control.md |
| 2 | Add MCP Server to Settings | ~/.claude/settings.json |
| 3 | Test MCP Integration | (testing only) |
| 4 | Create Integration Docs | docs/INTEGRATION.md |

**Total commits:** 2
**Manual steps:** Modify settings.json, test integration
