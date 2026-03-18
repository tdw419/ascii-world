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
import logging
import os
import re
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

# Configure logging
logger = logging.getLogger("mcp_manager_bridge")

# Configuration
MANAGER_API_URL = os.environ.get("MANAGER_API_URL", "http://localhost:3422")

# Tool name constants
TOOL_MANAGER_VIEW = "manager_view"
TOOL_MANAGER_CONTROL = "manager_control"
TOOL_MANAGER_LIST_PROJECTS = "manager_list_projects"
TOOL_MANAGER_REGISTER_PROJECT = "manager_register_project"
TOOL_MANAGER_METRICS = "manager_metrics"
TOOL_MANAGER_START_PROJECT = "manager_start_project"
TOOL_MANAGER_STOP_PROJECT = "manager_stop_project"
TOOL_MANAGER_PROJECT_VIEW = "manager_project_view"
TOOL_MANAGER_PROJECT_CONTROL = "manager_project_control"
TOOL_MANAGER_PROJECT_BINDINGS = "manager_project_bindings"

# Validation constants
LABEL_PATTERN = re.compile(r"^[A-Z1-9]$")

# Shared HTTP client (lazily initialized)
_http_client: httpx.AsyncClient | None = None


async def get_http_client() -> httpx.AsyncClient:
    """Get or create the shared HTTP client."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient()
        logger.debug("Created shared HTTP client")
    return _http_client


async def close_http_client() -> None:
    """Close the shared HTTP client."""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
        logger.debug("Closed shared HTTP client")


app = Server("mcp-manager-bridge")


async def fetch_view() -> str:
    """Fetch current ASCII view from manager."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/view"
    logger.debug(f"GET {url}")
    response = await client.get(url, timeout=5.0)
    response.raise_for_status()
    logger.debug(f"GET {url} -> {response.status_code}")
    return response.text


async def send_control(label: str) -> dict[str, Any]:
    """Send control command to manager."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/control"
    logger.debug(f"POST {url} with label={label}")
    response = await client.post(
        url,
        json={"label": label},
        timeout=5.0,
    )
    response.raise_for_status()
    logger.debug(f"POST {url} -> {response.status_code}")
    return response.json()


async def get_projects() -> list[dict[str, Any]]:
    """Get list of registered ASCII projects."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/projects"
    logger.debug(f"GET {url}")
    response = await client.get(url, timeout=5.0)
    response.raise_for_status()
    logger.debug(f"GET {url} -> {response.status_code}")
    return response.json()


async def register_project(path: str, port: int | None = None) -> dict[str, Any]:
    """Register a new ASCII project."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/projects"
    logger.debug(f"POST {url} with path={path}, port={port}")
    response = await client.post(
        url,
        json={"path": path, "port": port},
        timeout=5.0,
    )
    response.raise_for_status()
    logger.debug(f"POST {url} -> {response.status_code}")
    return response.json()


async def get_metrics() -> dict[str, Any]:
    """Get manager performance metrics."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/metrics"
    logger.debug(f"GET {url}")
    response = await client.get(url, timeout=5.0)
    response.raise_for_status()
    logger.debug(f"GET {url} -> {response.status_code}")
    return response.json()


async def fetch_project_view(project_id: str) -> str:
    """Fetch ASCII view from a managed project via manager proxy."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/projects/{project_id}/view"
    logger.debug(f"GET {url}")
    response = await client.get(url, timeout=5.0)
    response.raise_for_status()
    logger.debug(f"GET {url} -> {response.status_code}")
    return response.text


async def send_project_control(project_id: str, label: str) -> dict[str, Any]:
    """Send control command to a managed project via manager proxy."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/projects/{project_id}/control"
    logger.debug(f"POST {url} with label={label}")
    response = await client.post(
        url,
        json={"label": label},
        timeout=5.0,
    )
    response.raise_for_status()
    logger.debug(f"POST {url} -> {response.status_code}")
    return response.json()


async def get_project_bindings(project_id: str) -> dict[str, Any]:
    """Get label bindings for a managed project via manager proxy."""
    client = await get_http_client()
    url = f"{MANAGER_API_URL}/projects/{project_id}/bindings"
    logger.debug(f"GET {url}")
    response = await client.get(url, timeout=5.0)
    response.raise_for_status()
    logger.debug(f"GET {url} -> {response.status_code}")
    return response.json()


@app.list_tools()
async def list_tools():
    """Define all MCP tools exposed by this server."""
    return [
        Tool(
            name=TOOL_MANAGER_VIEW,
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
            name=TOOL_MANAGER_CONTROL,
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
            name=TOOL_MANAGER_LIST_PROJECTS,
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
            name=TOOL_MANAGER_REGISTER_PROJECT,
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
            name=TOOL_MANAGER_METRICS,
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
            name=TOOL_MANAGER_START_PROJECT,
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
            name=TOOL_MANAGER_STOP_PROJECT,
            description=(
                "Stop a running ASCII project. "
                "First select the project (use manager_control with 1-9), then stop it."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name=TOOL_MANAGER_PROJECT_VIEW,
            description=(
                "Fetch the current ASCII view from a managed project. "
                "Use this to see the interface of a specific managed project."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "The ID of the managed project",
                    },
                },
                "required": ["project_id"],
            },
        ),
        Tool(
            name=TOOL_MANAGER_PROJECT_CONTROL,
            description=(
                "Send a control command to a managed project. "
                "Valid labels are A-Z or 1-9."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "The ID of the managed project",
                    },
                    "label": {
                        "type": "string",
                        "description": "Single character label (A-Z or 1-9)",
                        "pattern": "^[A-Z1-9]$",
                    },
                },
                "required": ["project_id", "label"],
            },
        ),
        Tool(
            name=TOOL_MANAGER_PROJECT_BINDINGS,
            description=(
                "Get the label bindings for a managed project. "
                "Shows which labels are available and what actions they perform."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "The ID of the managed project",
                    },
                },
                "required": ["project_id"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict):
    """Handle tool invocations."""
    try:
        if name == TOOL_MANAGER_VIEW:
            view = await fetch_view()
            return [TextContent(type="text", text=view)]

        if name == TOOL_MANAGER_CONTROL:
            label = arguments.get("label", "").upper()
            # Server-side validation: must match ^[A-Z1-9]$ pattern
            if not LABEL_PATTERN.match(label):
                return [TextContent(type="text", text="Error: label must be a single character (A-Z or 1-9)")]

            result = await send_control(label)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == TOOL_MANAGER_LIST_PROJECTS:
            projects = await get_projects()
            return [TextContent(type="text", text=json.dumps(projects, indent=2))]

        if name == TOOL_MANAGER_REGISTER_PROJECT:
            path = arguments.get("path")
            if not path:
                return [TextContent(type="text", text="Error: path is required")]

            result = await register_project(path, arguments.get("port"))
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == TOOL_MANAGER_METRICS:
            metrics = await get_metrics()
            return [TextContent(type="text", text=json.dumps(metrics, indent=2))]

        if name == TOOL_MANAGER_START_PROJECT:
            result = await send_control("S")
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == TOOL_MANAGER_STOP_PROJECT:
            result = await send_control("T")
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == TOOL_MANAGER_PROJECT_VIEW:
            project_id = arguments.get("project_id")
            if not project_id:
                return [TextContent(type="text", text="Error: project_id is required")]

            view = await fetch_project_view(project_id)
            return [TextContent(type="text", text=view)]

        if name == TOOL_MANAGER_PROJECT_CONTROL:
            project_id = arguments.get("project_id")
            if not project_id:
                return [TextContent(type="text", text="Error: project_id is required")]

            label = arguments.get("label", "").upper()
            # Server-side validation: must match ^[A-Z1-9]$ pattern
            if not LABEL_PATTERN.match(label):
                return [TextContent(type="text", text="Error: label must be a single character (A-Z or 1-9)")]

            result = await send_project_control(project_id, label)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == TOOL_MANAGER_PROJECT_BINDINGS:
            project_id = arguments.get("project_id")
            if not project_id:
                return [TextContent(type="text", text="Error: project_id is required")]

            bindings = await get_project_bindings(project_id)
            return [TextContent(type="text", text=json.dumps(bindings, indent=2))]

        return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except httpx.HTTPStatusError as e:
        return [TextContent(type="text", text=f"HTTP error: {e.response.status_code} - {e.response.text}")]
    except httpx.ConnectError:
        return [TextContent(type="text", text=f"Connection error: Cannot reach Manager API at {MANAGER_API_URL}. Is the manager running?")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {type(e).__name__}: {e}")]


async def main():
    """Run the MCP server over stdio."""
    try:
        async with stdio_server() as (read, write):
            await app.run(read, write, app.create_initialization_options())
    finally:
        # Clean up HTTP client on shutdown
        await close_http_client()


if __name__ == "__main__":
    asyncio.run(main())
