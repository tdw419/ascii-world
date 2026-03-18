#!/usr/bin/env python3
"""
ECC (Everything Claude Code) Bridge for Geometry OS

Exposes ECC commands as MCP tools, allowing AI assistants to invoke
planning, TDD, verification, and learning workflows directly.

Integration Points:
- MCP Bridge → ECC Commands (this module)
- Swarm Guilds → ECC Agents (future)
- Visual Shell → ECC Canvas (future)
- Glyph Programs → ECC Skills (future)
"""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


# ECC Configuration
ECC_HOME = Path.home() / ".claude"
ECC_COMMANDS_DIR = ECC_HOME / "commands"
ECC_SKILLS_DIR = ECC_HOME / "skills"
ECC_AGENTS_DIR = ECC_HOME / "agents"
ECC_RULES_DIR = ECC_HOME / "rules"
ECC_MEMORY_DIR = Path.cwd() / ".claude" / "memory"


class ECCCommand(Enum):
    """Available ECC slash commands."""
    PLAN = "/plan"
    TDD = "/tdd"
    CODE_REVIEW = "/code-review"
    VERIFY = "/verify"
    LEARN = "/learn"
    INSTINCT_STATUS = "/instinct-status"
    SKILL_CREATE = "/skill-create"
    BRAINSTORM = "/brainstorming"
    DEBUG = "/systematic-debugging"
    ARCHITECT = "/architect"


@dataclass
class ECCResult:
    """Result from an ECC command execution."""
    command: str
    success: bool
    output: str
    error: Optional[str] = None
    metadata: Optional[dict] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ECCStatus:
    """Status of the ECC integration."""
    commands_available: int
    skills_available: int
    agents_available: int
    rules_available: int
    memory_entries: int
    instincts_count: int

    def to_dict(self) -> dict:
        return asdict(self)


def count_files_in_dir(dir_path: Path) -> int:
    """Count files in a directory, handling non-existent paths."""
    if not dir_path.exists():
        return 0
    return len(list(dir_path.glob("**/*")))


def get_ecc_status() -> ECCStatus:
    """Get current ECC integration status."""
    # Count available components
    commands = count_files_in_dir(ECC_COMMANDS_DIR)
    skills = count_files_in_dir(ECC_SKILLS_DIR)
    agents = count_files_in_dir(ECC_AGENTS_DIR)
    rules = count_files_in_dir(ECC_RULES_DIR)

    # Count memory entries
    memory_files = 0
    instincts = 0
    if ECC_MEMORY_DIR.exists():
        memory_files = len(list(ECC_MEMORY_DIR.glob("*.md")))
        # Check for instincts specifically
        instincts_dir = ECC_MEMORY_DIR / "instincts"
        if instincts_dir.exists():
            instincts = len(list(instincts_dir.glob("*.md")))

    return ECCStatus(
        commands_available=commands,
        skills_available=skills,
        agents_available=agents,
        rules_available=rules,
        memory_entries=memory_files,
        instincts_count=instincts
    )


async def execute_ecc_command(
    command: str,
    args: Optional[str] = None,
    cwd: Optional[str] = None,
    timeout: int = 120
) -> ECCResult:
    """
    Execute an ECC command and return structured result.

    Args:
        command: ECC command (e.g., "/plan", "/tdd")
        args: Command arguments
        cwd: Working directory
        timeout: Execution timeout in seconds

    Returns:
        ECCResult with success status and output
    """
    # Build command
    cmd_args = ["claude", command]
    if args:
        # Handle multi-word args
        cmd_args.append(args)

    try:
        result = subprocess.run(
            cmd_args,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd or os.getcwd()
        )

        return ECCResult(
            command=command,
            success=result.returncode == 0,
            output=result.stdout,
            error=result.stderr if result.returncode != 0 else None,
            metadata={
                "returncode": result.returncode,
                "args": args
            }
        )

    except subprocess.TimeoutExpired:
        return ECCResult(
            command=command,
            success=False,
            output="",
            error=f"Command timed out after {timeout}s"
        )
    except FileNotFoundError:
        return ECCResult(
            command=command,
            success=False,
            output="",
            error="Claude CLI not found. Ensure 'claude' is in PATH."
        )
    except Exception as e:
        return ECCResult(
            command=command,
            success=False,
            output="",
            error=str(e)
        )


# ============================================================================
# ECC Tool Implementations for MCP Bridge
# ============================================================================

async def ecc_plan(task: str, scope: Optional[str] = None) -> dict:
    """
    Create an implementation plan using ECC planner.

    Args:
        task: The task to plan
        scope: Optional scope (e.g., "systems/glyph_allocator")

    Returns:
        Plan result with steps and analysis
    """
    args = f'"{task}"'
    if scope:
        args += f" --scope {scope}"

    result = await execute_ecc_command("/plan", args, timeout=180)

    return {
        "status": "success" if result.success else "error",
        "task": task,
        "scope": scope,
        "plan": result.output if result.success else None,
        "error": result.error
    }


async def ecc_tdd(
    feature: str,
    test_first: bool = True,
    coverage_target: float = 0.80
) -> dict:
    """
    Execute TDD workflow using ECC TDD skill.

    Args:
        feature: Feature to implement
        test_first: Write tests before implementation
        coverage_target: Target test coverage (0.0-1.0)

    Returns:
        TDD workflow result
    """
    args = f'"{feature}"'
    if not test_first:
        args += " --no-test-first"
    args += f" --coverage {coverage_target}"

    result = await execute_ecc_command("/tdd", args, timeout=300)

    return {
        "status": "success" if result.success else "error",
        "feature": feature,
        "test_first": test_first,
        "coverage_target": coverage_target,
        "workflow_output": result.output if result.success else None,
        "error": result.error
    }


async def ecc_code_review(
    files: Optional[list[str]] = None,
    scope: Optional[str] = None,
    strictness: str = "standard"
) -> dict:
    """
    Run code review using ECC code-reviewer.

    Args:
        files: Specific files to review
        scope: Scope to review (e.g., "systems/")
        strictness: Review strictness (lenient, standard, strict)

    Returns:
        Review findings
    """
    args = ""
    if files:
        args = " ".join(files)
    elif scope:
        args = f"--scope {scope}"
    args += f" --strictness {strictness}"

    result = await execute_ecc_command("/code-review", args, timeout=180)

    return {
        "status": "success" if result.success else "error",
        "files": files,
        "scope": scope,
        "strictness": strictness,
        "findings": result.output if result.success else None,
        "error": result.error
    }


async def ecc_verify(
    run_tests: bool = True,
    run_lint: bool = True,
    run_build: bool = True,
    auto_fix: bool = False
) -> dict:
    """
    Run verification loop using ECC verify skill.

    Args:
        run_tests: Run test suite
        run_lint: Run linters
        run_build: Run build
        auto_fix: Automatically fix issues

    Returns:
        Verification results
    """
    args = ""
    if not run_tests:
        args += " --no-tests"
    if not run_lint:
        args += " --no-lint"
    if not run_build:
        args += " --no-build"
    if auto_fix:
        args += " --auto-fix"

    result = await execute_ecc_command("/verify", args, timeout=300)

    return {
        "status": "success" if result.success else "error",
        "checks": {
            "tests": run_tests,
            "lint": run_lint,
            "build": run_build
        },
        "auto_fix": auto_fix,
        "results": result.output if result.success else None,
        "error": result.error
    }


async def ecc_learn(session_only: bool = True) -> dict:
    """
    Extract reusable patterns using ECC learn skill.

    Args:
        session_only: Only analyze current session

    Returns:
        Extracted patterns
    """
    args = ""
    if session_only:
        args = "--session"

    result = await execute_ecc_command("/learn", args, timeout=120)

    return {
        "status": "success" if result.success else "error",
        "session_only": session_only,
        "patterns": result.output if result.success else None,
        "error": result.error
    }


async def ecc_instinct_status() -> dict:
    """
    Get status of learned instincts.

    Returns:
        Instinct status and list
    """
    result = await execute_ecc_command("/instinct-status", timeout=60)

    return {
        "status": "success" if result.success else "error",
        "instincts": result.output if result.success else None,
        "error": result.error
    }


async def ecc_skill_create(
    pattern_source: str,
    skill_name: Optional[str] = None
) -> dict:
    """
    Generate a skill from git history or patterns.

    Args:
        pattern_source: Source for patterns (file, git, session)
        skill_name: Name for the generated skill

    Returns:
        Generated skill details
    """
    args = pattern_source
    if skill_name:
        args += f" --name {skill_name}"

    result = await execute_ecc_command("/skill-create", args, timeout=180)

    return {
        "status": "success" if result.success else "error",
        "pattern_source": pattern_source,
        "skill_name": skill_name,
        "skill_content": result.output if result.success else None,
        "error": result.error
    }


async def ecc_brainstorm(topic: str, techniques: Optional[list[str]] = None) -> dict:
    """
    Run brainstorming session using ECC brainstorming skill.

    Args:
        topic: Topic to brainstorm
        techniques: Specific techniques to use

    Returns:
        Brainstorming results
    """
    args = f'"{topic}"'
    if techniques:
        args += f" --techniques {','.join(techniques)}"

    result = await execute_ecc_command("/brainstorming", args, timeout=180)

    return {
        "status": "success" if result.success else "error",
        "topic": topic,
        "techniques": techniques,
        "ideas": result.output if result.success else None,
        "error": result.error
    }


async def ecc_debug(issue: str, context: Optional[str] = None) -> dict:
    """
    Run systematic debugging using ECC debug skill.

    Args:
        issue: Issue description
        context: Additional context

    Returns:
        Debug analysis and suggestions
    """
    args = f'"{issue}"'
    if context:
        args += f' --context "{context}"'

    result = await execute_ecc_command("/systematic-debugging", args, timeout=180)

    return {
        "status": "success" if result.success else "error",
        "issue": issue,
        "context": context,
        "analysis": result.output if result.success else None,
        "error": result.error
    }


async def ecc_architect(decision: str, constraints: Optional[list[str]] = None) -> dict:
    """
    Get architectural guidance using ECC architect skill.

    Args:
        decision: Decision to make
        constraints: List of constraints

    Returns:
        Architectural recommendation
    """
    args = f'"{decision}"'
    if constraints:
        args += f" --constraints {','.join(constraints)}"

    result = await execute_ecc_command("/architect", args, timeout=180)

    return {
        "status": "success" if result.success else "error",
        "decision": decision,
        "constraints": constraints,
        "recommendation": result.output if result.success else None,
        "error": result.error
    }


async def ecc_canvas(output_dir: Optional[str] = None, format: str = "both") -> dict:
    """
    Render ECC learning state as visual canvas (PNG/JSON).

    This renders instincts, skills, agents, and memory as pixels
    on a 1024x1024 canvas for visual debugging on the Infinite Map.

    Args:
        output_dir: Output directory (default: cwd)
        format: Output format - "png", "json", or "both"

    Returns:
        Render result with paths to generated files
    """
    try:
        # Import the ECC canvas module
        spatial_debugger_path = Path(__file__).parent.parent.parent.parent / "systems" / "spatial_debugger"
        sys.path.insert(0, str(spatial_debugger_path))

        from ecc_canvas import ECCCanvas

        canvas = ECCCanvas(Path(output_dir) if output_dir else None)
        state = canvas.collect_state()

        result = {
            "status": "success",
            "state": asdict(state),
            "files": {}
        }

        if format in ("png", "both"):
            png_path = canvas.render()
            result["files"]["png"] = png_path

        if format in ("json", "both"):
            json_path = png_path.replace(".png", ".json") if format == "both" else str(Path(output_dir or ".") / "ecc_canvas.json")
            with open(json_path, "w") as f:
                f.write(canvas.to_json())
            result["files"]["json"] = json_path

        result["health"] = canvas._calculate_health()

        return result

    except ImportError as e:
        return {
            "status": "error",
            "error": f"ECC Canvas module not available: {e}",
            "hint": "Ensure systems/spatial_debugger/ecc_canvas.py exists",
            "searched_path": str(spatial_debugger_path)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


# ============================================================================
# MCP Tool Definitions
# ============================================================================

ECC_MCP_TOOLS = [
    {
        "name": "ecc_status",
        "description": "Get ECC (Everything Claude Code) integration status",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "ecc_plan",
        "description": "Create implementation plan using ECC planner agent",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task": {"type": "string", "description": "Task to plan"},
                "scope": {"type": "string", "description": "Optional scope (e.g., 'systems/glyph_allocator')"}
            },
            "required": ["task"]
        }
    },
    {
        "name": "ecc_tdd",
        "description": "Execute TDD workflow using ECC TDD skill",
        "inputSchema": {
            "type": "object",
            "properties": {
                "feature": {"type": "string", "description": "Feature to implement"},
                "test_first": {"type": "boolean", "default": True},
                "coverage_target": {"type": "number", "default": 0.8}
            },
            "required": ["feature"]
        }
    },
    {
        "name": "ecc_review",
        "description": "Run code review using ECC code-reviewer agent",
        "inputSchema": {
            "type": "object",
            "properties": {
                "files": {"type": "array", "items": {"type": "string"}},
                "scope": {"type": "string"},
                "strictness": {"type": "string", "enum": ["lenient", "standard", "strict"], "default": "standard"}
            }
        }
    },
    {
        "name": "ecc_verify",
        "description": "Run verification loop (build, test, lint) using ECC verify skill",
        "inputSchema": {
            "type": "object",
            "properties": {
                "run_tests": {"type": "boolean", "default": True},
                "run_lint": {"type": "boolean", "default": True},
                "run_build": {"type": "boolean", "default": True},
                "auto_fix": {"type": "boolean", "default": False}
            }
        }
    },
    {
        "name": "ecc_learn",
        "description": "Extract reusable patterns from session using ECC learn skill",
        "inputSchema": {
            "type": "object",
            "properties": {
                "session_only": {"type": "boolean", "default": True}
            }
        }
    },
    {
        "name": "ecc_instincts",
        "description": "View learned instincts from ECC memory",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "ecc_skill_create",
        "description": "Generate a new skill from patterns using ECC skill-create",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pattern_source": {"type": "string", "description": "Source: file path, 'git', or 'session'"},
                "skill_name": {"type": "string", "description": "Name for the generated skill"}
            },
            "required": ["pattern_source"]
        }
    },
    {
        "name": "ecc_brainstorm",
        "description": "Run brainstorming session using ECC brainstorming skill",
        "inputSchema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "Topic to brainstorm"},
                "techniques": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["topic"]
        }
    },
    {
        "name": "ecc_debug",
        "description": "Run systematic debugging using ECC debug skill",
        "inputSchema": {
            "type": "object",
            "properties": {
                "issue": {"type": "string", "description": "Issue description"},
                "context": {"type": "string", "description": "Additional context"}
            },
            "required": ["issue"]
        }
    },
    {
        "name": "ecc_architect",
        "description": "Get architectural guidance using ECC architect agent",
        "inputSchema": {
            "type": "object",
            "properties": {
                "decision": {"type": "string", "description": "Architectural decision to make"},
                "constraints": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["decision"]
        }
    },
    {
        "name": "ecc_canvas",
        "description": "Render ECC learning state as visual canvas (PNG/JSON)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "output_dir": {"type": "string", "description": "Output directory (default: cwd)"},
                "format": {"type": "string", "enum": ["png", "json", "both"], "default": "both"}
            }
        }
    }
]


# ============================================================================
# Tool Dispatcher
# ============================================================================

async def dispatch_ecc_tool(name: str, arguments: dict) -> dict:
    """Dispatch an ECC tool call to the appropriate handler."""
    if name == "ecc_status":
        return {"status": "success", **get_ecc_status().to_dict()}
    elif name == "ecc_plan":
        return await ecc_plan(arguments["task"], arguments.get("scope"))
    elif name == "ecc_tdd":
        return await ecc_tdd(
            arguments["feature"],
            arguments.get("test_first", True),
            arguments.get("coverage_target", 0.8)
        )
    elif name == "ecc_review":
        return await ecc_code_review(
            arguments.get("files"),
            arguments.get("scope"),
            arguments.get("strictness", "standard")
        )
    elif name == "ecc_verify":
        return await ecc_verify(
            arguments.get("run_tests", True),
            arguments.get("run_lint", True),
            arguments.get("run_build", True),
            arguments.get("auto_fix", False)
        )
    elif name == "ecc_learn":
        return await ecc_learn(arguments.get("session_only", True))
    elif name == "ecc_instincts":
        return await ecc_instinct_status()
    elif name == "ecc_skill_create":
        return await ecc_skill_create(
            arguments["pattern_source"],
            arguments.get("skill_name")
        )
    elif name == "ecc_brainstorm":
        return await ecc_brainstorm(
            arguments["topic"],
            arguments.get("techniques")
        )
    elif name == "ecc_debug":
        return await ecc_debug(
            arguments["issue"],
            arguments.get("context")
        )
    elif name == "ecc_architect":
        return await ecc_architect(
            arguments["decision"],
            arguments.get("constraints")
        )
    elif name == "ecc_canvas":
        return await ecc_canvas(
            arguments.get("output_dir"),
            arguments.get("format", "both")
        )
    else:
        return {"status": "error", "error": f"Unknown ECC tool: {name}"}


# ============================================================================
# CLI Entry Point (for testing)
# ============================================================================

async def main():
    """Test ECC bridge directly."""
    print("=== ECC Bridge Test ===\n")

    # Get status
    status = get_ecc_status()
    print(f"ECC Status:")
    print(f"  Commands: {status.commands_available}")
    print(f"  Skills: {status.skills_available}")
    print(f"  Agents: {status.agents_available}")
    print(f"  Rules: {status.rules_available}")
    print(f"  Memory: {status.memory_entries}")
    print(f"  Instincts: {status.instincts_count}")
    print()

    # Test a simple command
    print("Testing /instinct-status...")
    result = await ecc_instinct_status()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
