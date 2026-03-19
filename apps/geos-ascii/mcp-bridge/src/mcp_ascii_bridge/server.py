"""MCP Server for ASCII World control.

Provides tools for AI agents to interact with ASCII World applications:
- ascii_view: Get current ASCII screen
- ascii_control: Execute action by label
- ascii_navigate: Navigate to specific state
- ascii_state: Get current state as JSON
- ascii_bindings: Get label reference
"""

import asyncio
import os
import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

ASCII_API_URL = os.environ.get("ASCII_API_URL", "http://localhost:3421")
app = Server("mcp-ascii-bridge")


@app.list_tools()
async def list_tools():
    return [
        Tool(
            name="ascii_view",
            description="Get the current ASCII screen from ASCII World",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="ascii_control",
            description="Execute an action by label (A-Z). Use to click buttons or navigate.",
            inputSchema={
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Single letter label (A-Z) from the ASCII screen"
                    }
                },
                "required": ["label"]
            }
        ),
        Tool(
            name="ascii_navigate",
            description="Navigate directly to a specific state/screen",
            inputSchema={
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "enum": ["DASHBOARD", "SOURCES", "CONFIG", "HISTORY", "PROVIDERS"],
                        "description": "Target state name"
                    }
                },
                "required": ["target"]
            }
        ),
        Tool(
            name="ascii_state",
            description="Get the current state as JSON (includes all variables)",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="ascii_bindings",
            description="Get all label-to-action mappings",
            inputSchema={"type": "object", "properties": {}}
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict):
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            if name == "ascii_view":
                response = await client.get(f"{ASCII_API_URL}/view")
                return [TextContent(type="text", text=response.text)]

            if name == "ascii_control":
                label = arguments.get("label", "").upper()
                if len(label) != 1 or not label.isalpha():
                    return [TextContent(type="text", text="Error: Label must be a single letter A-Z")]

                response = await client.post(
                    f"{ASCII_API_URL}/control",
                    json={"label": label}
                )
                data = response.json()
                return [TextContent(
                    type="text",
                    text=f"Success: {data.get('state', 'unknown')}" if data.get('success') else f"Failed: {data.get('error', 'unknown error')}"
                )]

            if name == "ascii_navigate":
                target = arguments.get("target", "DASHBOARD")
                nav_map = {
                    "DASHBOARD": "A",
                    "SOURCES": "B",
                    "CONFIG": "C",
                    "HISTORY": "D",
                    "PROVIDERS": "E"
                }
                label = nav_map.get(target, "A")
                response = await client.post(
                    f"{ASCII_API_URL}/control",
                    json={"label": label}
                )
                data = response.json()
                return [TextContent(
                    type="text",
                    text=f"Navigated to {data.get('state', target)}"
                )]

            if name == "ascii_state":
                response = await client.get(f"{ASCII_API_URL}/state")
                import json
                return [TextContent(type="text", text=json.dumps(response.json(), indent=2))]

            if name == "ascii_bindings":
                response = await client.get(f"{ASCII_API_URL}/bindings")
                import json
                return [TextContent(type="text", text=json.dumps(response.json(), indent=2))]

            return [TextContent(type="text", text=f"Unknown tool: {name}")]

        except httpx.ConnectError:
            return [TextContent(
                type="text",
                text=f"Error: Cannot connect to ASCII API at {ASCII_API_URL}. Is the server running?"
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
