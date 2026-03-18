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
