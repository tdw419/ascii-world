#!/usr/bin/env python3
"""
ECC HTTP API Server - Phase 5 of ECC Integration

Exposes all ECC functionality via HTTP REST API:
- ECC Commands (plan, tdd, verify, etc.)
- ECC Agent Guild (spawn, dispatch, etc.)
- ECC Skills Bridge (execute, find, etc.)
- ECC Canvas (visualization)

Usage:
    python ecc_http_api.py --port 3421

Or with the GPU daemon:
    The daemon proxies /ecc/* requests to this API
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
import argparse

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

# Import ECC components
try:
    from ecc_bridge import get_ecc_status, dispatch_ecc_tool, ECC_MCP_TOOLS
    ECC_BRIDGE_AVAILABLE = True
except ImportError:
    ECC_BRIDGE_AVAILABLE = False

try:
    from ecc_agent_guild import get_guild, dispatch_guild_tool, ECC_GUILD_MCP_TOOLS
    ECC_GUILD_AVAILABLE = True
except ImportError:
    ECC_GUILD_AVAILABLE = False

try:
    from ecc_skills_bridge import get_bridge, dispatch_skills_tool, ECC_SKILLS_MCP_TOOLS
    ECC_SKILLS_AVAILABLE = True
except ImportError:
    ECC_SKILLS_AVAILABLE = False


@dataclass
class ECCHTTPConfig:
    """Configuration for ECC HTTP API."""
    port: int = 3421
    host: str = "0.0.0.0"
    cors_origins: list[str] = None

    def __post_init__(self):
        if self.cors_origins is None:
            self.cors_origins = ["*"]


class ECCHTTPHandler(BaseHTTPRequestHandler):
    """HTTP request handler for ECC API."""

    config: ECCHTTPConfig = ECCHTTPConfig()

    def log_message(self, format, *args):
        """Override to customize logging."""
        print(f"[ECC API] {args[0]}")

    def _send_json(self, data: dict, status: int = 200):
        """Send JSON response with CORS headers."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def _send_error(self, message: str, status: int = 400):
        """Send error response."""
        self._send_json({"status": "error", "error": message}, status)

    def _read_json_body(self) -> Optional[dict]:
        """Read and parse JSON body."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        try:
            body = self.rfile.read(content_length)
            return json.loads(body.decode())
        except json.JSONDecodeError as e:
            return None

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # Route to appropriate handler
        if path == "/ecc/status":
            self._handle_status()
        elif path == "/ecc/tools":
            self._handle_list_tools()
        elif path == "/ecc/guild/status":
            self._handle_guild_status()
        elif path == "/ecc/guild/agents":
            self._handle_guild_list_agents(query)
        elif path == "/ecc/guild/spatial":
            self._handle_guild_spatial()
        elif path == "/ecc/skills/status":
            self._handle_skills_status()
        elif path == "/ecc/skills/list":
            self._handle_skills_list(query)
        elif path == "/ecc/skills/spatial":
            self._handle_skills_spatial()
        elif path == "/health":
            self._send_json({"status": "healthy", "service": "ecc-http-api"})
        else:
            self._send_error(f"Unknown endpoint: {path}", 404)

    def do_POST(self):
        """Handle POST requests."""
        parsed = urlparse(self.path)
        path = parsed.path

        # Read JSON body
        body = self._read_json_body()
        if body is None:
            self._send_error("Invalid JSON body")
            return

        # Route to appropriate handler
        if path.startswith("/ecc/execute/"):
            tool_name = path[len("/ecc/execute/"):]
            self._handle_execute_tool(tool_name, body)
        elif path == "/ecc/guild/spawn":
            self._handle_guild_spawn(body)
        elif path == "/ecc/guild/despawn":
            self._handle_guild_despawn(body)
        elif path == "/ecc/guild/dispatch":
            self._handle_guild_dispatch(body)
        elif path == "/ecc/skills/execute":
            self._handle_skills_execute(body)
        elif path == "/ecc/skills/find":
            self._handle_skills_find(body)
        elif path == "/ecc/plan":
            self._handle_ecc_plan(body)
        elif path == "/ecc/tdd":
            self._handle_ecc_tdd(body)
        elif path == "/ecc/review":
            self._handle_ecc_review(body)
        elif path == "/ecc/verify":
            self._handle_ecc_verify(body)
        elif path == "/ecc/brainstorm":
            self._handle_ecc_brainstorm(body)
        elif path == "/ecc/debug":
            self._handle_ecc_debug(body)
        elif path == "/ecc/canvas":
            self._handle_ecc_canvas(body)
        else:
            self._send_error(f"Unknown endpoint: {path}", 404)

    # === Status Endpoints ===

    def _handle_status(self):
        """Get overall ECC status."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        status = get_ecc_status()
        # Convert dataclass to dict
        if hasattr(status, 'to_dict'):
            status_dict = status.to_dict()
        else:
            status_dict = status

        status_dict["guild_available"] = ECC_GUILD_AVAILABLE
        status_dict["skills_available"] = ECC_SKILLS_AVAILABLE
        self._send_json(status_dict)

    def _handle_list_tools(self):
        """List all available ECC tools."""
        tools = []

        if ECC_BRIDGE_AVAILABLE:
            for tool in ECC_MCP_TOOLS:
                tool["_source"] = "bridge"
                tools.append(tool)

        if ECC_GUILD_AVAILABLE:
            for tool in ECC_GUILD_MCP_TOOLS:
                tool_copy = tool.copy()
                tool_copy["_source"] = "guild"
                tools.append(tool_copy)

        if ECC_SKILLS_AVAILABLE:
            for tool in ECC_SKILLS_MCP_TOOLS:
                tool_copy = tool.copy()
                tool_copy["_source"] = "skills"
                tools.append(tool_copy)

        self._send_json({
            "status": "success",
            "total": len(tools),
            "tools": tools
        })

    # === Guild Endpoints ===

    def _handle_guild_status(self):
        """Get guild status."""
        if not ECC_GUILD_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Agent Guild not available"
            })
            return

        guild = get_guild()
        self._send_json(guild.get_status())

    def _handle_guild_list_agents(self, query: dict):
        """List guild agents."""
        if not ECC_GUILD_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Agent Guild not available"
            })
            return

        guild = get_guild()
        guild_filter = query.get("guild", [None])[0]
        agents = guild.list_agents(guild_filter)
        self._send_json({
            "status": "success",
            "agents": agents
        })

    def _handle_guild_spatial(self):
        """Get guild spatial state."""
        if not ECC_GUILD_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Agent Guild not available"
            })
            return

        guild = get_guild()
        self._send_json(guild.get_spatial_state())

    def _handle_guild_spawn(self, body: dict):
        """Spawn an agent."""
        if not ECC_GUILD_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Agent Guild not available"
            })
            return

        agent_name = body.get("agent_name")
        if not agent_name:
            self._send_error("Missing agent_name")
            return

        # Run async function in event loop
        result = asyncio.run(dispatch_guild_tool("ecc_guild_spawn", {
            "agent_name": agent_name,
            "hilbert_position": body.get("hilbert_position")
        }))
        self._send_json(result)

    def _handle_guild_despawn(self, body: dict):
        """Despawn an agent."""
        if not ECC_GUILD_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Agent Guild not available"
            })
            return

        instance_id = body.get("instance_id")
        if not instance_id:
            self._send_error("Missing instance_id")
            return

        result = asyncio.run(dispatch_guild_tool("ecc_guild_despawn", {
            "instance_id": instance_id
        }))
        self._send_json(result)

    def _handle_guild_dispatch(self, body: dict):
        """Dispatch task to agent."""
        if not ECC_GUILD_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Agent Guild not available"
            })
            return

        instance_id = body.get("instance_id")
        task = body.get("task")
        if not instance_id or not task:
            self._send_error("Missing instance_id or task")
            return

        result = asyncio.run(dispatch_guild_tool("ecc_guild_dispatch", {
            "instance_id": instance_id,
            "task": task,
            "context": body.get("context")
        }))
        self._send_json(result)

    # === Skills Endpoints ===

    def _handle_skills_status(self):
        """Get skills status."""
        if not ECC_SKILLS_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Skills Bridge not available"
            })
            return

        bridge = get_bridge()
        self._send_json(bridge.get_status())

    def _handle_skills_list(self, query: dict):
        """List skills."""
        if not ECC_SKILLS_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Skills Bridge not available"
            })
            return

        bridge = get_bridge()
        category = query.get("category", [None])[0]
        skills = bridge.list_skills(category)
        self._send_json({
            "status": "success",
            "skills": skills
        })

    def _handle_skills_spatial(self):
        """Get skills spatial state."""
        if not ECC_SKILLS_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Skills Bridge not available"
            })
            return

        bridge = get_bridge()
        self._send_json(bridge.get_spatial_state())

    def _handle_skills_execute(self, body: dict):
        """Execute a skill."""
        if not ECC_SKILLS_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Skills Bridge not available"
            })
            return

        skill_name = body.get("skill_name")
        if not skill_name:
            self._send_error("Missing skill_name")
            return

        result = asyncio.run(dispatch_skills_tool("ecc_skills_execute", {
            "skill_name": skill_name,
            "context": body.get("context"),
            "mode": body.get("mode", "cpu")
        }))
        self._send_json(result)

    def _handle_skills_find(self, body: dict):
        """Find skill by trigger."""
        if not ECC_SKILLS_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Skills Bridge not available"
            })
            return

        text = body.get("text")
        if not text:
            self._send_error("Missing text")
            return

        result = asyncio.run(dispatch_skills_tool("ecc_skills_find", {
            "text": text
        }))
        self._send_json(result)

    # === ECC Bridge Endpoints ===

    def _handle_execute_tool(self, tool_name: str, body: dict):
        """Execute an ECC tool by name."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        result = asyncio.run(dispatch_ecc_tool(tool_name, body))
        self._send_json(result)

    def _handle_ecc_plan(self, body: dict):
        """Create implementation plan."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        task = body.get("task")
        if not task:
            self._send_error("Missing task")
            return

        result = asyncio.run(dispatch_ecc_tool("ecc_plan", {
            "task": task,
            "scope": body.get("scope")
        }))
        self._send_json(result)

    def _handle_ecc_tdd(self, body: dict):
        """Execute TDD workflow."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        feature = body.get("feature")
        if not feature:
            self._send_error("Missing feature")
            return

        result = asyncio.run(dispatch_ecc_tool("ecc_tdd", {
            "feature": feature,
            "test_first": body.get("test_first", True),
            "coverage_target": body.get("coverage_target", 0.8)
        }))
        self._send_json(result)

    def _handle_ecc_review(self, body: dict):
        """Run code review."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        result = asyncio.run(dispatch_ecc_tool("ecc_review", {
            "files": body.get("files"),
            "scope": body.get("scope"),
            "strictness": body.get("strictness", "standard")
        }))
        self._send_json(result)

    def _handle_ecc_verify(self, body: dict):
        """Run verification loop."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        result = asyncio.run(dispatch_ecc_tool("ecc_verify", {
            "run_tests": body.get("run_tests", True),
            "run_lint": body.get("run_lint", True),
            "run_build": body.get("run_build", True),
            "auto_fix": body.get("auto_fix", False)
        }))
        self._send_json(result)

    def _handle_ecc_brainstorm(self, body: dict):
        """Run brainstorming session."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        topic = body.get("topic")
        if not topic:
            self._send_error("Missing topic")
            return

        result = asyncio.run(dispatch_ecc_tool("ecc_brainstorm", {
            "topic": topic,
            "techniques": body.get("techniques")
        }))
        self._send_json(result)

    def _handle_ecc_debug(self, body: dict):
        """Run systematic debugging."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        issue = body.get("issue")
        if not issue:
            self._send_error("Missing issue")
            return

        result = asyncio.run(dispatch_ecc_tool("ecc_debug", {
            "issue": issue,
            "context": body.get("context")
        }))
        self._send_json(result)

    def _handle_ecc_canvas(self, body: dict):
        """Render ECC canvas."""
        if not ECC_BRIDGE_AVAILABLE:
            self._send_json({
                "status": "error",
                "error": "ECC Bridge not available"
            })
            return

        result = asyncio.run(dispatch_ecc_tool("ecc_canvas", {
            "output_dir": body.get("output_dir"),
            "format": body.get("format", "both")
        }))
        self._send_json(result)


def run_server(config: ECCHTTPConfig):
    """Run the ECC HTTP API server."""
    server_address = (config.host, config.port)
    ECCHTTPHandler.config = config
    httpd = HTTPServer(server_address, ECCHTTPHandler)

    print(f"=== ECC HTTP API Server ===")
    print(f"Listening on http://{config.host}:{config.port}")
    print()
    print("Endpoints:")
    print("  GET  /ecc/status           - Get ECC status")
    print("  GET  /ecc/tools            - List all tools")
    print("  POST /ecc/execute/<tool>   - Execute tool by name")
    print("  POST /ecc/plan             - Create plan")
    print("  POST /ecc/tdd              - TDD workflow")
    print("  POST /ecc/review           - Code review")
    print("  POST /ecc/verify           - Verification")
    print("  POST /ecc/brainstorm       - Brainstorming")
    print("  POST /ecc/debug            - Debugging")
    print("  POST /ecc/canvas           - Render canvas")
    print()
    print("  GET  /ecc/guild/status     - Guild status")
    print("  GET  /ecc/guild/agents     - List agents")
    print("  GET  /ecc/guild/spatial    - Spatial state")
    print("  POST /ecc/guild/spawn      - Spawn agent")
    print("  POST /ecc/guild/despawn    - Despawn agent")
    print("  POST /ecc/guild/dispatch   - Dispatch task")
    print()
    print("  GET  /ecc/skills/status    - Skills status")
    print("  GET  /ecc/skills/list      - List skills")
    print("  GET  /ecc/skills/spatial   - Spatial state")
    print("  POST /ecc/skills/execute   - Execute skill")
    print("  POST /ecc/skills/find      - Find by trigger")
    print()
    print("Press Ctrl+C to stop")
    print()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[ECC API] Shutting down...")
        httpd.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ECC HTTP API Server")
    parser.add_argument("--port", type=int, default=3421, help="Port to listen on")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    args = parser.parse_args()

    config = ECCHTTPConfig(port=args.port, host=args.host)
    run_server(config)
