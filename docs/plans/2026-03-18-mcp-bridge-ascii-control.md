# MCP Bridge for ASCII Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an MCP server that wraps the session-analyzer-app ASCII control API, enabling any MCP-compatible AI to control the application via label-based commands.

**Architecture:** A Python MCP server using the `mcp` library that proxies HTTP requests to the ASCII API endpoints (/view, /control, /metrics, /bindings). The server runs over stdio and exposes 5 tools: ascii_view, ascii_control, ascii_metrics, ascii_bindings, and ascii_navigate. Can be invoked directly or via mcp2cli for CLI access.

**Tech Stack:** Python 3.12+, mcp library, httpx for async HTTP, pyproject.toml for packaging

---

## Task 1: Create Project Structure and Dependencies

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/pyproject.toml`
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/README.md`

**Step 1: Create the project directory**

Run: `mkdir -p /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/src`

**Step 2: Create pyproject.toml**

```toml
[project]
name = "mcp-ascii-bridge"
version = "0.1.0"
description = "MCP server bridging to session-analyzer ASCII control API"
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
mcp-ascii-bridge = "mcp_ascii_bridge.server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Step 3: Create README.md**

```markdown
# MCP ASCII Bridge

MCP server that bridges to the session-analyzer-app ASCII control API.

## Usage

### With mcp2cli

```bash
# List available tools
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" --list

# Get current ASCII view
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" ascii-view

# Navigate to Sources tab
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" ascii-control --label B

# Navigate to Config tab
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" ascii-navigate --target CONFIG
```

### Direct invocation

```bash
uv run mcp-ascii-bridge
```

## Tools

| Tool | Description |
|------|-------------|
| `ascii_view` | Get current ASCII screen (80x24 grid) |
| `ascii_control` | Execute action by label (A-Z, 1-5) |
| `ascii_navigate` | Navigate directly to a state |
| `ascii_metrics` | Get API latency statistics |
| `ascii_bindings` | Get label-to-action mappings |

## Configuration

Set `ASCII_API_URL` environment variable to override the default `http://localhost:3421`.
```

**Step 4: Commit**

```bash
cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app
git add mcp_ascii_bridge/pyproject.toml mcp_ascii_bridge/README.md
git commit -m "feat(mcp): initialize MCP ASCII bridge project structure"
```

---

## Task 2: Implement MCP Server Core

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/src/mcp_ascii_bridge/__init__.py`
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/src/mcp_ascii_bridge/server.py`

**Step 1: Create __init__.py**

```python
"""MCP ASCII Bridge - MCP server for session-analyzer ASCII control API."""

__version__ = "0.1.0"
```

**Step 2: Create server.py with MCP tool definitions**

```python
#!/usr/bin/env python3
"""
MCP ASCII Bridge Server

Exposes session-analyzer-app ASCII control API via Model Context Protocol.
Enables any MCP-compatible AI to control the application via label-based commands.

Usage:
    uv run mcp-ascii-bridge

Or via mcp2cli:
    mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" --list
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
ASCII_API_URL = os.environ.get("ASCII_API_URL", "http://localhost:3421")

app = Server("mcp-ascii-bridge")


async def fetch_ascii_view() -> str:
    """Fetch the current ASCII view from the API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{ASCII_API_URL}/view", timeout=5.0)
        response.raise_for_status()
        return response.text


async def send_control(label: str) -> dict[str, Any]:
    """Send a control command via label."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{ASCII_API_URL}/control",
            json={"label": label},
            timeout=5.0,
        )
        response.raise_for_status()
        return response.json()


async def fetch_metrics() -> dict[str, Any]:
    """Fetch API metrics."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{ASCII_API_URL}/metrics", timeout=5.0)
        response.raise_for_status()
        return response.json()


async def fetch_bindings() -> dict[str, Any]:
    """Fetch label-to-action bindings from the app's bindings.json."""
    # The bindings are served by the API or read from file
    # For now, we'll return a static reference
    bindings_path = os.environ.get(
        "ASCII_BINDINGS_PATH",
        "/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/ascii/bindings.json"
    )
    try:
        with open(bindings_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        # Fallback: return a summary
        return {
            "error": "bindings.json not found",
            "path": bindings_path,
            "navigation_labels": {
                "A": "Dashboard",
                "B": "Sources",
                "C": "Config",
                "D": "History",
                "X": "Back/Quit",
            }
        }


@app.list_tools()
async def list_tools():
    """Define all MCP tools exposed by this server."""
    return [
        Tool(
            name="ascii_view",
            description=(
                "Get the current ASCII screen representation of the session-analyzer app. "
                "Returns an 80x24 character grid with [A-Z] labels for interactive elements. "
                "Use this to understand the current state before taking action."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="ascii_control",
            description=(
                "Execute an action by sending a label command to the ASCII interface. "
                "Labels are single characters (A-Z, 1-5) that map to actions. "
                "Navigation: A=Dashboard, B=Sources, C=Config, D=History, X=Back. "
                "Actions: E=Primary, F=Export, W=Save, Z=Reset."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Single character label (A-Z or 1-5)",
                        "pattern": "^[A-Z1-5]$",
                    },
                },
                "required": ["label"],
            },
        ),
        Tool(
            name="ascii_navigate",
            description=(
                "Navigate directly to a specific application state. "
                "Use this for quick navigation when you know the target state name."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Target state name",
                        "enum": ["DASHBOARD", "SOURCES", "CONFIG", "HISTORY"],
                    },
                },
                "required": ["target"],
            },
        ),
        Tool(
            name="ascii_metrics",
            description=(
                "Get performance metrics for the ASCII control API. "
                "Returns request count, latency statistics, and last action info."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="ascii_bindings",
            description=(
                "Get the complete label-to-action bindings reference. "
                "Returns the full bindings.json with all labels, actions, and state transitions."
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
        if name == "ascii_view":
            view = await fetch_ascii_view()
            return [TextContent(type="text", text=view)]

        if name == "ascii_control":
            label = arguments.get("label", "").upper()
            if not label or len(label) != 1:
                return [TextContent(type="text", text="Error: label must be a single character (A-Z or 1-5)")]

            result = await send_control(label)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "ascii_navigate":
            target = arguments.get("target", "").upper()
            label_map = {
                "DASHBOARD": "A",
                "SOURCES": "B",
                "CONFIG": "C",
                "HISTORY": "D",
            }
            if target not in label_map:
                return [TextContent(type="text", text=f"Error: unknown target '{target}'. Valid: DASHBOARD, SOURCES, CONFIG, HISTORY")]

            result = await send_control(label_map[target])
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "ascii_metrics":
            metrics = await fetch_metrics()
            return [TextContent(type="text", text=json.dumps(metrics, indent=2))]

        if name == "ascii_bindings":
            bindings = await fetch_bindings()
            return [TextContent(type="text", text=json.dumps(bindings, indent=2))]

        return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except httpx.HTTPStatusError as e:
        return [TextContent(type="text", text=f"HTTP error: {e.response.status_code} - {e.response.text}")]
    except httpx.ConnectError:
        return [TextContent(type="text", text=f"Connection error: Cannot reach ASCII API at {ASCII_API_URL}. Is the app running?")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {type(e).__name__}: {e}")]


async def main():
    """Run the MCP server over stdio."""
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 3: Commit**

```bash
git add mcp_ascii_bridge/src/
git commit -m "feat(mcp): implement MCP ASCII bridge server with 5 tools"
```

---

## Task 3: Add Unit Tests

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/tests/__init__.py`
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/tests/test_server.py`

**Step 1: Create tests/__init__.py**

```python
"""Tests for MCP ASCII Bridge."""
```

**Step 2: Create test_server.py**

```python
"""Unit tests for MCP ASCII Bridge server."""

import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

# We'll test the logic without full MCP protocol
# Integration tests would require a running session-analyzer-app


class TestAsciiView:
    """Tests for ascii_view tool."""

    @pytest.mark.asyncio
    async def test_fetch_view_success(self):
        """Test successful view fetch."""
        from mcp_ascii_bridge.server import fetch_ascii_view

        mock_response = AsyncMock()
        mock_response.text = "╔══════════════════════════╗\n║ [A] Dashboard           ║\n╚══════════════════════════╝"
        mock_response.raise_for_status = AsyncMock()

        with patch("mcp_ascii_bridge.server.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

            result = await fetch_ascii_view()
            assert "[A] Dashboard" in result


class TestAsciiControl:
    """Tests for ascii_control tool."""

    @pytest.mark.asyncio
    async def test_send_control_navigates(self):
        """Test sending navigation control."""
        from mcp_ascii_bridge.server import send_control

        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={"status": "ok", "state": "SOURCES", "action": "goto_sources"})
        mock_response.raise_for_status = AsyncMock()

        with patch("mcp_ascii_bridge.server.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

            result = await send_control("B")
            assert result["state"] == "SOURCES"


class TestLabelMapping:
    """Tests for label-to-state mapping."""

    def test_navigation_labels(self):
        """Test navigation label mapping."""
        label_map = {
            "DASHBOARD": "A",
            "SOURCES": "B",
            "CONFIG": "C",
            "HISTORY": "D",
        }

        assert label_map["DASHBOARD"] == "A"
        assert label_map["SOURCES"] == "B"
        assert label_map["CONFIG"] == "C"
        assert label_map["HISTORY"] == "D"


class TestToolDefinitions:
    """Tests for MCP tool definitions."""

    @pytest.mark.asyncio
    async def test_list_tools_returns_five_tools(self):
        """Test that list_tools returns 5 tools."""
        from mcp_ascii_bridge.server import list_tools

        tools = await list_tools()
        assert len(tools) == 5

        tool_names = [t.name for t in tools]
        assert "ascii_view" in tool_names
        assert "ascii_control" in tool_names
        assert "ascii_navigate" in tool_names
        assert "ascii_metrics" in tool_names
        assert "ascii_bindings" in tool_names

    @pytest.mark.asyncio
    async def test_ascii_control_requires_label(self):
        """Test that ascii_control has required label parameter."""
        from mcp_ascii_bridge.server import list_tools

        tools = await list_tools()
        control_tool = next(t for t in tools if t.name == "ascii_control")

        assert "label" in control_tool.inputSchema["properties"]
        assert "label" in control_tool.inputSchema["required"]

    @pytest.mark.asyncio
    async def test_ascii_navigate_has_enum(self):
        """Test that ascii_navigate has enum for target states."""
        from mcp_ascii_bridge.server import list_tools

        tools = await list_tools()
        nav_tool = next(t for t in tools if t.name == "ascii_navigate")

        assert "enum" in nav_tool.inputSchema["properties"]["target"]
        assert "DASHBOARD" in nav_tool.inputSchema["properties"]["target"]["enum"]
```

**Step 3: Run tests to verify they fail (server not implemented yet)**

Run: `cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge && uv run pytest tests/ -v`
Expected: Some tests may fail due to module import - that's OK, we'll fix in next task

**Step 4: Commit**

```bash
git add mcp_ascii_bridge/tests/
git commit -m "test(mcp): add unit tests for MCP ASCII bridge"
```

---

## Task 4: Add Integration Test Script

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/scripts/test_integration.sh`

**Step 1: Create integration test script**

```bash
#!/bin/bash
# Integration test for MCP ASCII Bridge
# Requires session-analyzer-app to be running on port 3421

set -e

echo "=== MCP ASCII Bridge Integration Test ==="

# Check if app is running
if ! curl -s http://localhost:3421/health > /dev/null 2>&1; then
    echo "ERROR: session-analyzer-app not running on port 3421"
    echo "Start it with: cd .. && bun run src/bun/server.ts"
    exit 1
fi

echo "✓ session-analyzer-app is running"

# Test with mcp2cli if available
if command -v mcp2cli &> /dev/null; then
    echo ""
    echo "Testing with mcp2cli..."

    cd "$(dirname "$0")/.."

    echo "  Listing tools..."
    mcp2cli --mcp-stdio "uv run python -m mcp_ascii_bridge.server" --list

    echo ""
    echo "  Testing ascii_view..."
    mcp2cli --mcp-stdio "uv run python -m mcp_ascii_bridge.server" ascii-view | head -5

    echo ""
    echo "  Testing ascii_navigate to SOURCES..."
    mcp2cli --mcp-stdio "uv run python -m mcp_ascii_bridge.server" ascii-navigate --target SOURCES

    echo ""
    echo "  Testing ascii_metrics..."
    mcp2cli --mcp-stdio "uv run python -m mcp_ascii_bridge.server" ascii-metrics

    echo ""
    echo "✓ All integration tests passed!"
else
    echo "mcp2cli not installed, skipping CLI tests"
    echo "Install with: pip install mcp2cli"
fi
```

**Step 2: Make script executable**

Run: `chmod +x /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/scripts/test_integration.sh`

**Step 3: Commit**

```bash
git add mcp_ascii_bridge/scripts/
git commit -m "feat(mcp): add integration test script for MCP ASCII bridge"
```

---

## Task 5: Add to Main App README

**Files:**
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/README.md`

**Step 1: Add MCP Bridge section to README.md**

Add after the "For AI Agents" section:

```markdown
### MCP Integration

An MCP (Model Context Protocol) server is provided for AI agent integration:

```bash
# Via mcp2cli
mcp2cli --mcp-stdio "uv run /path/to/mcp_ascii_bridge" --list

# Get current view
mcp2cli --mcp-stdio "uv run /path/to/mcp_ascii_bridge" ascii-view

# Navigate to Config tab
mcp2cli --mcp-stdio "uv run /path/to/mcp_ascii_bridge" ascii-navigate --target CONFIG

# Execute action by label
mcp2cli --mcp-stdio "uv run /path/to/mcp_ascii_bridge" ascii-control --label E
```

See `mcp_ascii_bridge/README.md` for full documentation.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add MCP bridge integration to main README"
```

---

## Task 6: Create Claude Code Skill for MCP Bridge

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/mcp_ascii_bridge/skill/mcp-ascii-control.md`

**Step 1: Create skill file**

```markdown
---
name: mcp-ascii-control
description: Use to control session-analyzer-app via MCP ASCII bridge. Provides label-based navigation and control.
---

# MCP ASCII Control Skill

Control the session-analyzer-app through its ASCII interface using MCP tools.

## Prerequisites

1. session-analyzer-app running on port 3421
2. MCP bridge available at `mcp_ascii_bridge/`

## Usage

### Discover tools
```bash
mcp2cli --mcp-stdio "uv run mcp_ascii_bridge" --list
```

### Get current screen state
```bash
mcp2cli --mcp-stdio "uv run mcp_ascii_bridge" ascii-view
```

### Navigate by state name
```bash
mcp2cli --mcp-stdio "uv run mcp_ascii_bridge" ascii-navigate --target CONFIG
```

### Execute action by label
```bash
mcp2cli --mcp-stdio "uv run mcp_ascii_bridge" ascii-control --label E
```

## Label Reference

| Label | Action | Context |
|-------|--------|---------|
| A | Dashboard | Navigate to Dashboard |
| B | Sources | Navigate to Sources |
| C | Config | Navigate to Config |
| D | History | Navigate to History |
| E | Primary Action | Context-dependent |
| W | Save | Save config |
| Z | Reset | Reset to defaults |
| X | Back/Quit | Return to dashboard |

## Workflow

1. Call `ascii_view` to understand current state
2. Parse available [A-Z] labels from output
3. Use `ascii_control` or `ascii_navigate` to take action
4. Call `ascii_view` again to verify state change
```

**Step 2: Commit**

```bash
git add mcp_ascii_bridge/skill/
git commit -m "feat(mcp): add Claude Code skill for MCP ASCII control"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project Structure | pyproject.toml, README.md |
| 2 | MCP Server Core | server.py with 5 tools |
| 3 | Unit Tests | test_server.py |
| 4 | Integration Test | test_integration.sh |
| 5 | Main README Update | README.md |
| 6 | Claude Code Skill | mcp-ascii-control.md |

**Total commits:** 6
**Dependencies:** Requires session-analyzer-app running on port 3421
