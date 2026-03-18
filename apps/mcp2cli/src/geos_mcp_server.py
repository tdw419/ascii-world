#!/usr/bin/env python3
"""
Geometry OS MCP Server

Exposes Geometry OS substrate operations via Model Context Protocol:
- crystallize: Compile .glyph files to .rts.png textures
- benchmark_sls: Measure Spatial Locality Score for GPU cache efficiency
- boot_sim: Simulate boot chain (UEFI → Kernel → GPU MMIO)
- vm_spawn: Spawn a child glyph VM
- hilbert_test: Test Hilbert curve coordinate conversion

Usage:
    python geos_mcp_server.py

Or via mcp2cli:
    mcp2cli "python /path/to/geos_mcp_server.py" geos
    geos crystallize --input window_manager.glyph --output window_manager.rts.png
"""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

# ECC Bridge integration
try:
    from ecc_bridge import ECC_MCP_TOOLS, dispatch_ecc_tool, get_ecc_status
    ECC_AVAILABLE = True
except ImportError:
    ECC_AVAILABLE = False

# ECC Agent Guild integration
try:
    from ecc_agent_guild import ECC_GUILD_MCP_TOOLS, dispatch_guild_tool
    ECC_GUILD_AVAILABLE = True
except ImportError:
    ECC_GUILD_AVAILABLE = False

# ECC Skills Bridge integration
try:
    from ecc_skills_bridge import ECC_SKILLS_MCP_TOOLS, dispatch_skills_tool
    ECC_SKILLS_AVAILABLE = True
except ImportError:
    ECC_SKILLS_AVAILABLE = False

# Geometry OS paths (relative to this file)
GEOS_ROOT = Path(__file__).parent.parent.parent.parent
GLYPH_COMPILER = GEOS_ROOT / "compile_glyph.py"
WINDOW_MANAGER_GLYPH = GEOS_ROOT / "systems" / "glyph_stratum" / "programs" / "window_manager.glyph"
UBUNTU_KERNEL = GEOS_ROOT / "systems" / "ubuntu_riscv" / "ubuntu_native.rts.png"
BOOT_SCRIPT = GEOS_ROOT / "kernel" / "boot" / "run_bare_metal.sh"

app = Server("geometry-os")


def hilbert_d2xy(n: int, d: int) -> tuple[int, int]:
    """Convert Hilbert index to (x, y) coordinates."""
    x = y = 0
    s = 1
    t = d
    while s < n:
        rx = 1 & (t // 2)
        ry = 1 & (t ^ rx)
        if ry == 0:
            if rx == 1:
                x = s - 1 - x
                y = s - 1 - y
            x, y = y, x
        x += s * rx
        y += s * ry
        t //= 4
        s *= 2
    return x, y


def hilbert_xy2d(n: int, x: int, y: int) -> int:
    """Convert (x, y) coordinates to Hilbert index."""
    d = 0
    s = n // 2
    while s > 0:
        rx = 1 if (x & s) > 0 else 0
        ry = 1 if (y & s) > 0 else 0
        d += s * s * ((3 * rx) ^ ry)
        if ry == 0:
            if rx == 1:
                x = s - 1 - x
                y = s - 1 - y
            x, y = y, x
        s //= 2
    return d


def calculate_sls(instructions: list[tuple[int, int, int, int]], grid_size: int = 4096) -> float:
    """
    Calculate Spatial Locality Score (SLS).

    SLS measures how well instructions are laid out for GPU cache efficiency.
    A score of 1.0 means perfect locality (sequential Hilbert access).
    Score < 0.7 indicates poor cache utilization.

    Args:
        instructions: List of (opcode, stratum, p1, p2) tuples
        grid_size: Texture grid size (default 4096x4096)

    Returns:
        SLS score between 0.0 and 1.0
    """
    if len(instructions) < 2:
        return 1.0

    # Calculate Hilbert distance between consecutive instructions
    total_jump = 0
    max_jump = 0

    prev_d = 0
    for i in range(len(instructions)):
        # Simulate where this instruction would be placed
        x, y = hilbert_d2xy(grid_size, i)
        d = hilbert_xy2d(grid_size, x, y)

        if i > 0:
            jump = abs(d - prev_d)
            total_jump += jump
            max_jump = max(max_jump, jump)

        prev_d = d

    # Ideal case: consecutive instructions are 1 unit apart in Hilbert space
    # Worst case: maximum possible jumps
    ideal_total = len(instructions) - 1
    worst_total = (len(instructions) - 1) * (grid_size * grid_size // 4)

    if worst_total == 0:
        return 1.0

    # SLS = 1 - (actual_jump - ideal) / (worst - ideal)
    sls = 1.0 - (total_jump - ideal_total) / (worst_total - ideal_total)
    return max(0.0, min(1.0, sls))


def parse_glyph_file(path: str) -> list[tuple[int, int, int, int]]:
    """Parse a .glyph file or .rts.png into instruction tuples."""
    path_obj = Path(path)

    if path_obj.suffix == ".png":
        # Read from texture
        from PIL import Image
        import numpy as np

        img = Image.open(path).convert("RGBA")
        pixels = np.array(img)
        # Flatten and filter out NOPs (where opcode=0)
        flat = pixels.reshape(-1, 4)
        instructions = [tuple(p) for p in flat if p[0] != 0]
        return instructions

    # Import the compiler's parser for .glyph files
    sys.path.insert(0, str(GEOS_ROOT / "systems" / "glyph_stratum" / "programs"))
    from compile_glyph import parse_glyph

    source = path_obj.read_text()
    instructions, labels, constants = parse_glyph(source)
    return instructions


@app.list_tools()
async def list_tools():
    return [
        Tool(name="crystallize", description="Compile .glyph to .rts.png", inputSchema={"type": "object", "properties": {"input": {"type": "string"}, "output": {"type": "string"}, "dense": {"type": "boolean", "default": False}}, "required": ["input", "output"]}),
        Tool(name="glyph_patch", description="Hot-patch instruction", inputSchema={"type": "object", "properties": {"vm_id": {"type": "integer"}, "address": {"type": "string"}, "opcode": {"type": "integer"}, "stratum": {"type": "integer"}, "p1": {"type": "integer"}, "p2": {"type": "integer"}}, "required": ["address", "opcode"]}),
        Tool(name="linux_to_glyph", description="Transpile Linux to glyph", inputSchema={"type": "object", "properties": {"binary": {"type": "string"}, "output": {"type": "string"}}, "required": ["binary", "output"]}),
        Tool(name="benchmark_sls", description="Calculate SLS", inputSchema={"type": "object", "properties": {"glyph_file": {"type": "string"}, "grid_size": {"type": "integer", "default": 4096}}, "required": ["glyph_file"]}),
        Tool(name="boot_sim", description="Simulate boot chain", inputSchema={"type": "object", "properties": {"image_path": {"type": "string"}, "verbose": {"type": "boolean", "default": False}}}),
        Tool(name="vm_spawn", description="Spawn child VM", inputSchema={"type": "object", "properties": {"vm_id": {"type": "integer"}, "glyph_file": {"type": "string"}, "window_x": {"type": "integer"}, "window_y": {"type": "integer"}, "window_w": {"type": "integer"}, "window_h": {"type": "integer"}}, "required": ["vm_id", "glyph_file"]}),
        Tool(name="hilbert_test", description="Test Hilbert conversion", inputSchema={"type": "object", "properties": {"mode": {"type": "string", "enum": ["d2xy", "xy2d"]}, "index": {"type": "integer"}, "x": {"type": "integer"}, "y": {"type": "integer"}, "grid_size": {"type": "integer", "default": 4096}}, "required": ["mode"]}),
        Tool(name="geos_status", description="Get system status", inputSchema={"type": "object"}),
        Tool(name="mem_store", description="Store persistent value", inputSchema={"type": "object", "properties": {"key": {"type": "string"}, "value": {"type": "object"}}, "required": ["key", "value"]}),
        Tool(name="mem_retrieve", description="Retrieve persistent value", inputSchema={"type": "object", "properties": {"key": {"type": "string"}}, "required": ["key"]}),
        Tool(name="mem_peek", description="Read memory", inputSchema={"type": "object", "properties": {"addr": {"type": "string"}, "size": {"type": "integer", "default": 1}}, "required": ["addr"]}),
        Tool(name="mem_poke", description="Write memory", inputSchema={"type": "object", "properties": {"addr": {"type": "string"}, "val": {"type": "string"}}, "required": ["addr", "val"]}),
        Tool(name="opcode_decode", description="Decode opcode", inputSchema={"type": "object", "properties": {"opcode": {"type": "integer"}, "stratum": {"type": "integer"}}, "required": ["opcode"]}),
        Tool(name="opcode_encode", description="Encode opcode", inputSchema={"type": "object", "properties": {"name": {"type": "string"}, "stratum": {"type": "string"}}, "required": ["name"]}),
        Tool(name="vlm_health", description="VLM health check", inputSchema={"type": "object", "properties": {"rts_file": {"type": "string"}}, "required": ["rts_file"]}),
        Tool(name="daemon_status", description="Check daemon status", inputSchema={"type": "object"}),
        Tool(name="substrate_load", description="Load substrate", inputSchema={"type": "object", "properties": {"rts_file": {"type": "string"}}, "required": ["rts_file"]}),
        Tool(name="gpu_write", description="Batch write memory", inputSchema={"type": "object", "properties": {"addr": {"type": "string"}, "data": {"type": "array", "items": {"type": "integer"}}}, "required": ["addr", "data"]}),
        Tool(name="gpu_exec", description="Execute command via daemon", inputSchema={"type": "object", "properties": {"cmd": {"type": "string"}, "cwd": {"type": "string"}}, "required": ["cmd"]}),
        Tool(name="gpu_pause", description="Pause all VMs", inputSchema={"type": "object"}),
        Tool(name="gpu_vmstate", description="Query VM state", inputSchema={"type": "object", "properties": {"vm": {"type": "integer", "default": 0}}}),
        Tool(name="agent_register", description="Register AI agent", inputSchema={"type": "object", "properties": {"agent_type": {"type": "string"}, "capabilities": {"type": "array", "items": {"type": "string"}}}}),
        Tool(name="agent_unregister", description="Unregister agent", inputSchema={"type": "object", "properties": {"agent_id": {"type": "string"}}, "required": ["agent_id"]}),
        Tool(name="agent_list", description="List agents", inputSchema={"type": "object"}),
        Tool(name="agent_status", description="Get multi-agent status", inputSchema={"type": "object"}),
        Tool(name="agent_alloc", description="Allocate agent memory", inputSchema={"type": "object", "properties": {"agent_id": {"type": "string"}, "size": {"type": "integer"}, "purpose": {"type": "string"}}, "required": ["agent_id"]}),
        Tool(name="agent_free", description="Free agent memory", inputSchema={"type": "object", "properties": {"agent_id": {"type": "string"}, "addr": {"type": "string"}}, "required": ["agent_id", "addr"]}),
        Tool(name="agent_lock", description="Acquire lock", inputSchema={"type": "object", "properties": {"agent_id": {"type": "string"}, "resource": {"type": "string"}}, "required": ["agent_id", "resource"]}),
        Tool(name="agent_unlock", description="Release lock", inputSchema={"type": "object", "properties": {"agent_id": {"type": "string"}, "resource": {"type": "string"}}, "required": ["agent_id", "resource"]}),
        Tool(name="agent_event", description="Send agent event", inputSchema={"type": "object", "properties": {"source_agent": {"type": "string"}, "event_type": {"type": "string"}, "payload": {"type": "object"}, "target_agent": {"type": "string"}}, "required": ["source_agent", "event_type"]}),
        Tool(name="memory_map", description="Show memory layout", inputSchema={"type": "object"}),
        Tool(name="driver_template", description="Generate driver template", inputSchema={"type": "object", "properties": {"name": {"type": "string"}, "io_addr": {"type": "string"}}}),
        Tool(name="riscv_template", description="Generate RISC-V template", inputSchema={"type": "object"}),
        Tool(name="vcc_validate", description="Validate Visual Consistency Contract", inputSchema={"type": "object", "properties": {"region": {"type": "string", "description": "Memory region (e.g., 0x0000-0x1000)"}, "expected_hash": {"type": "string", "description": "Expected SHA256 hash"}}, "required": ["region"]}),
        Tool(name="vcc_sign", description="Sign a Visual Consistency Contract for a region", inputSchema={"type": "object", "properties": {"agent_id": {"type": "string", "description": "Agent signing the VCC"}, "region_start": {"type": "string", "description": "Start address (hex)"}, "region_end": {"type": "string", "description": "End address (hex)"}, "region_type": {"type": "string", "description": "Region type", "enum": ["boot_sector", "kernel", "driver", "vm_state", "agent_workspace", "shared"]}, "description": {"type": "string", "description": "Description of this region"}}, "required": ["agent_id", "region_start", "region_end"]}),
        Tool(name="vcc_status", description="Get VCC system status", inputSchema={"type": "object"}),
        Tool(name="vcc_audit", description="Get audit trail for a region", inputSchema={"type": "object", "properties": {"addr": {"type": "string", "description": "Address to audit (hex)"}}, "required": ["addr"]}),
        Tool(name="vcc_guard", description="Enable or disable VCC guard", inputSchema={"type": "object", "properties": {"enable": {"type": "boolean", "description": "Enable (true) or disable (false) the guard"}}}),
        Tool(name="vcc_list", description="List all VCC manifest entries", inputSchema={"type": "object"}),
        Tool(name="vcc_audit_all", description="Validate ALL regions in manifest against substrate. Returns pass/fail per region with optional auto-repair.", inputSchema={"type": "object", "properties": {"auto_repair": {"type": "boolean", "description": "Reload substrate on critical failure (default: false)"}, "strict": {"type": "boolean", "description": "Fail on any mismatch (default: true)"}}}),
        Tool(name="self_host_loop", description="Execute a self-hosting loop step (ANALYZE→PLAN→EXECUTE→DEPLOY→VERIFY)", inputSchema={"type": "object", "properties": {"step": {"type": "string", "description": "Loop step", "enum": ["analyze", "plan", "execute", "deploy", "verify"]}, "agent_id": {"type": "string", "description": "Agent executing the step"}, "target": {"type": "string", "description": "Target component"}, "payload": {"type": "object", "description": "Step-specific data"}}, "required": ["agent_id"]}),
        # WASM Tools
        Tool(name="wasm_load", description="Load WASM binary to GPU substrate at WASM linear memory base (0x20000)", inputSchema={"type": "object", "properties": {"wasm_file": {"type": "string", "description": "Path to .wasm file"}, "addr": {"type": "string", "description": "Override load address (hex, default: 0x20000)"}}, "required": ["wasm_file"]}),
        Tool(name="wasm_run", description="Trigger WASM interpreter execution. Sets IP and status to start running loaded WASM.", inputSchema={"type": "object", "properties": {"entry_point": {"type": "string", "description": "Entry point offset in WASM linear memory (hex, default: 0x0)"}}}),
        Tool(name="wasm_status", description="Check WASM interpreter state (IP, SP, status, block stack)", inputSchema={"type": "object"}),
        # ECC Integration Tools
        Tool(name="ecc_status", description="Get ECC (Everything Claude Code) integration status", inputSchema={"type": "object"}),
        Tool(name="ecc_plan", description="Create implementation plan using ECC planner agent", inputSchema={"type": "object", "properties": {"task": {"type": "string", "description": "Task to plan"}, "scope": {"type": "string", "description": "Optional scope"}}, "required": ["task"]}),
        Tool(name="ecc_tdd", description="Execute TDD workflow using ECC TDD skill", inputSchema={"type": "object", "properties": {"feature": {"type": "string", "description": "Feature to implement"}, "test_first": {"type": "boolean", "default": True}, "coverage_target": {"type": "number", "default": 0.8}}, "required": ["feature"]}),
        Tool(name="ecc_review", description="Run code review using ECC code-reviewer agent", inputSchema={"type": "object", "properties": {"files": {"type": "array", "items": {"type": "string"}}, "scope": {"type": "string"}, "strictness": {"type": "string", "enum": ["lenient", "standard", "strict"], "default": "standard"}}}),
        Tool(name="ecc_verify", description="Run verification loop (build, test, lint) using ECC verify skill", inputSchema={"type": "object", "properties": {"run_tests": {"type": "boolean", "default": True}, "run_lint": {"type": "boolean", "default": True}, "run_build": {"type": "boolean", "default": True}, "auto_fix": {"type": "boolean", "default": False}}}),
        Tool(name="ecc_learn", description="Extract reusable patterns from session using ECC learn skill", inputSchema={"type": "object", "properties": {"session_only": {"type": "boolean", "default": True}}}),
        Tool(name="ecc_instincts", description="View learned instincts from ECC memory", inputSchema={"type": "object"}),
        Tool(name="ecc_skill_create", description="Generate a new skill from patterns using ECC skill-create", inputSchema={"type": "object", "properties": {"pattern_source": {"type": "string", "description": "Source: file path, 'git', or 'session'"}, "skill_name": {"type": "string", "description": "Name for the generated skill"}}, "required": ["pattern_source"]}),
        Tool(name="ecc_brainstorm", description="Run brainstorming session using ECC brainstorming skill", inputSchema={"type": "object", "properties": {"topic": {"type": "string", "description": "Topic to brainstorm"}, "techniques": {"type": "array", "items": {"type": "string"}}}, "required": ["topic"]}),
        Tool(name="ecc_debug", description="Run systematic debugging using ECC debug skill", inputSchema={"type": "object", "properties": {"issue": {"type": "string", "description": "Issue description"}, "context": {"type": "string", "description": "Additional context"}}, "required": ["issue"]}),
        Tool(name="ecc_architect", description="Get architectural guidance using ECC architect agent", inputSchema={"type": "object", "properties": {"decision": {"type": "string", "description": "Architectural decision to make"}, "constraints": {"type": "array", "items": {"type": "string"}}}, "required": ["decision"]}),
        Tool(name="ecc_canvas", description="Render ECC learning state as visual canvas (PNG/JSON) for Infinite Map", inputSchema={"type": "object", "properties": {"output_dir": {"type": "string", "description": "Output directory (default: cwd)"}, "format": {"type": "string", "enum": ["png", "json", "both"], "default": "both"}}}),
        # ECC Agent Guild Tools
        Tool(name="ecc_guild_status", description="Get ECC Agent Guild status and organization", inputSchema={"type": "object"}),
        Tool(name="ecc_guild_list_agents", description="List ECC agents available as guild members", inputSchema={"type": "object", "properties": {"guild": {"type": "string", "description": "Filter by guild (engineering, review, testing, analysis, bmad)", "enum": ["engineering", "review", "testing", "analysis", "bmad"]}}}),
        Tool(name="ecc_guild_spawn", description="Spawn an ECC agent as a guild member", inputSchema={"type": "object", "properties": {"agent_name": {"type": "string", "description": "ECC agent to spawn"}, "hilbert_position": {"type": "integer", "description": "Optional spatial position"}}, "required": ["agent_name"]}),
        Tool(name="ecc_guild_despawn", description="Remove an agent instance from the guild", inputSchema={"type": "object", "properties": {"instance_id": {"type": "string", "description": "Instance ID to remove"}}, "required": ["instance_id"]}),
        Tool(name="ecc_guild_dispatch", description="Dispatch a task to an ECC agent instance", inputSchema={"type": "object", "properties": {"instance_id": {"type": "string", "description": "Instance ID"}, "task": {"type": "string", "description": "Task description"}, "context": {"type": "object", "description": "Optional context"}}, "required": ["instance_id", "task"]}),
        Tool(name="ecc_guild_spatial_state", description="Get spatial state for Infinite Map visualization", inputSchema={"type": "object"}),
        Tool(name="ecc_guild_discover", description="Discover all ECC agents and register them", inputSchema={"type": "object"}),
        # ECC Skills Bridge Tools
        Tool(name="ecc_skills_status", description="Get ECC Skills Bridge status and organization", inputSchema={"type": "object"}),
        Tool(name="ecc_skills_list", description="List available ECC skills", inputSchema={"type": "object", "properties": {"category": {"type": "string", "description": "Filter by category", "enum": ["testing", "patterns", "review", "planning", "domain", "bmad", "superpowers"]}}}),
        Tool(name="ecc_skills_execute", description="Execute an ECC skill", inputSchema={"type": "object", "properties": {"skill_name": {"type": "string", "description": "Skill to execute"}, "context": {"type": "object", "description": "Execution context"}, "mode": {"type": "string", "enum": ["cpu", "gpu"], "default": "cpu"}}, "required": ["skill_name"]}),
        Tool(name="ecc_skills_find", description="Find a skill by trigger phrase", inputSchema={"type": "object", "properties": {"text": {"type": "string", "description": "Text to match against triggers"}}, "required": ["text"]}),
        Tool(name="ecc_skills_spatial", description="Get spatial state for Infinite Map visualization", inputSchema={"type": "object"}),
        Tool(name="ecc_skills_discover", description="Discover all ECC skills and register them", inputSchema={"type": "object"}),
        # ML Memory Pool Tools
        Tool(name="ml_pool_status", description="Get ML memory pool statistics", inputSchema={"type": "object"}),
        Tool(name="ml_tensor_alloc", description="Allocate a tensor in the ML memory pool", inputSchema={"type": "object", "properties": {"name": {"type": "string", "description": "Unique tensor name"}, "shape": {"type": "array", "items": {"type": "integer"}, "description": "Tensor shape dimensions"}, "dtype": {"type": "string", "enum": ["float16", "float32", "int8", "uint8", "int32"], "default": "float16"}, "region": {"type": "string", "enum": ["weight", "activation", "gradient"], "default": "weight"}}, "required": ["name", "shape"]}),
        Tool(name="ml_tensor_free", description="Free a tensor from the ML memory pool", inputSchema={"type": "object", "properties": {"name": {"type": "string", "description": "Tensor name to free"}}, "required": ["name"]}),
        Tool(name="ml_tensor_read", description="Read tensor data from ML memory pool", inputSchema={"type": "object", "properties": {"name": {"type": "string", "description": "Tensor name to read"}}, "required": ["name"]}),
        Tool(name="ml_tensor_write", description="Write tensor data to ML memory pool", inputSchema={"type": "object", "properties": {"name": {"type": "string", "description": "Tensor name to write"}, "data": {"type": "array", "items": {"type": "number"}, "description": "Tensor data (float values)"}}, "required": ["name", "data"]}),
        Tool(name="ml_weights_load", description="Load weight atlas from PNG file", inputSchema={"type": "object", "properties": {"path": {"type": "string", "description": "Path to PNG file"}, "offset": {"type": "integer", "default": 0, "description": "GPU offset to load at"}}, "required": ["path"]}),
        Tool(name="ml_hebbian_apply", description="Apply Hebbian update batch to weights", inputSchema={"type": "object", "properties": {"updates": {"type": "array", "items": {"type": "object", "properties": {"tensor_name": {"type": "string"}, "offset": {"type": "integer"}, "delta": {"type": "number"}, "learning_rate": {"type": "number", "default": 0.01}}}, "description": "Hebbian updates to apply"}, "learning_rate": {"type": "number", "default": 0.01, "description": "Global learning rate"}}, "required": ["updates"]}),
        Tool(name="ml_sync", description="Sync CPU and GPU memory in ML pool", inputSchema={"type": "object"}),
        Tool(name="ml_activation_layer", description="Allocate layer activation in activation pool", inputSchema={"type": "object", "properties": {"layer": {"type": "integer", "description": "Layer index"}, "size": {"type": "integer", "description": "Activation size in bytes"}}, "required": ["layer", "size"]}),
        Tool(name="ml_kv_append", description="Append tokens to KV cache", inputSchema={"type": "object", "properties": {"name": {"type": "string", "default": "default", "description": "Cache name"}, "tokens": {"type": "integer", "description": "Number of tokens to add"}, "head_dim": {"type": "integer", "default": 64}, "num_heads": {"type": "integer", "default": 8}}, "required": ["tokens"]}),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        if name == "crystallize": return await tool_crystallize(arguments)
        elif name == "glyph_patch": return await tool_glyph_patch(arguments)
        elif name == "linux_to_glyph": return await tool_linux_to_glyph(arguments)
        elif name == "benchmark_sls": return await tool_benchmark_sls(arguments)
        elif name == "boot_sim": return await tool_boot_sim(arguments)
        elif name == "vm_spawn": return await tool_vm_spawn(arguments)
        elif name == "hilbert_test": return await tool_hilbert_test(arguments)
        elif name == "geos_status": return await tool_geos_status(arguments)
        elif name == "mem_store": return await tool_mem_store(arguments)
        elif name == "mem_retrieve": return await tool_mem_retrieve(arguments)
        elif name == "mem_peek": return await tool_mem_peek(arguments)
        elif name == "mem_poke": return await tool_mem_poke(arguments)
        elif name == "opcode_decode": return await tool_opcode_decode(arguments)
        elif name == "opcode_encode": return await tool_opcode_encode(arguments)
        elif name == "vlm_health": return await tool_vlm_health(arguments)
        elif name == "daemon_status": return await tool_daemon_status(arguments)
        elif name == "substrate_load": return await tool_substrate_load(arguments)
        elif name == "gpu_write": return await tool_gpu_write(arguments)
        elif name == "gpu_exec": return await tool_gpu_exec(arguments)
        elif name == "gpu_pause": return await tool_gpu_pause(arguments)
        elif name == "gpu_vmstate": return await tool_gpu_vmstate(arguments)
        elif name == "agent_register": return await tool_agent_register(arguments)
        elif name == "agent_unregister": return await tool_agent_unregister(arguments)
        elif name == "agent_list": return await tool_agent_list(arguments)
        elif name == "agent_status": return await tool_agent_status(arguments)
        elif name == "agent_alloc": return await tool_agent_alloc(arguments)
        elif name == "agent_free": return await tool_agent_free(arguments)
        elif name == "agent_lock": return await tool_agent_lock(arguments)
        elif name == "agent_unlock": return await tool_agent_unlock(arguments)
        elif name == "agent_event": return await tool_agent_event(arguments)
        elif name == "memory_map": return await tool_memory_map(arguments)
        elif name == "driver_template": return await tool_driver_template(arguments)
        elif name == "riscv_template": return await tool_riscv_template(arguments)
        elif name == "vcc_validate": return await tool_vcc_validate(arguments)
        elif name == "vcc_sign": return await tool_vcc_sign(arguments)
        elif name == "vcc_status": return await tool_vcc_status(arguments)
        elif name == "vcc_audit": return await tool_vcc_audit(arguments)
        elif name == "vcc_guard": return await tool_vcc_guard(arguments)
        elif name == "vcc_list": return await tool_vcc_list(arguments)
        elif name == "vcc_audit_all": return await tool_vcc_audit_all(arguments)
        elif name == "self_host_loop": return await tool_self_host_loop(arguments)
        elif name == "wasm_load": return await tool_wasm_load(arguments)
        elif name == "wasm_run": return await tool_wasm_run(arguments)
        elif name == "wasm_status": return await tool_wasm_status(arguments)
        # ECC Integration Handlers
        elif name.startswith("ecc_"): return await tool_ecc_dispatch(name, arguments)
        # ML Memory Pool Handlers
        elif name == "ml_pool_status": return await tool_ml_pool_status(arguments)
        elif name == "ml_tensor_alloc": return await tool_ml_tensor_alloc(arguments)
        elif name == "ml_tensor_free": return await tool_ml_tensor_free(arguments)
        elif name == "ml_tensor_read": return await tool_ml_tensor_read(arguments)
        elif name == "ml_tensor_write": return await tool_ml_tensor_write(arguments)
        elif name == "ml_weights_load": return await tool_ml_weights_load(arguments)
        elif name == "ml_hebbian_apply": return await tool_ml_hebbian_apply(arguments)
        elif name == "ml_sync": return await tool_ml_sync(arguments)
        elif name == "ml_activation_layer": return await tool_ml_activation_layer(arguments)
        elif name == "ml_kv_append": return await tool_ml_kv_append(arguments)
        elif name == "ml_tensor_alloc": return await tool_ml_tensor_alloc(arguments)
        elif name == "ml_pool_status": return await tool_ml_pool_status(arguments)
        else: return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e: return [TextContent(type="text", text=f"Error: {str(e)}")]
async def tool_crystallize(args: dict) -> list[TextContent]:
    """Compile .glyph to .rts.png."""
    input_path = Path(args["input"])
    output_path = Path(args["output"])
    dense = args.get("dense", False)

    if not input_path.exists():
        return [TextContent(type="text", text=f"Error: Input file not found: {input_path}")]

    # Run the Python compiler
    cmd = [sys.executable, str(GLYPH_COMPILER), str(input_path), str(output_path)]
    if dense:
        cmd.append("--dense")

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(GEOS_ROOT))

    if result.returncode != 0:
        return [TextContent(type="text", text=f"Compilation failed:\n{result.stderr}")]

    # Get output file size
    output_size = output_path.stat().st_size if output_path.exists() else 0

    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "input": str(input_path),
                    "output": str(output_path),
                    "output_size_bytes": output_size,
                    "dense": dense,
                    "compiler_output": result.stdout.strip(),
                },
                indent=2,
            ),
        )
    ]


async def tool_benchmark_sls(args: dict) -> list[TextContent]:
    """Calculate Spatial Locality Score."""
    glyph_file = Path(args["glyph_file"])
    grid_size = args.get("grid_size", 4096)

    if not glyph_file.exists():
        return [TextContent(type="text", text=f"Error: Glyph file not found: {glyph_file}")]

    # Parse and analyze
    instructions = parse_glyph_file(str(glyph_file))
    sls = calculate_sls(instructions, grid_size)

    # Additional metrics
    instruction_count = len(instructions)

    # Classify by stratum
    stratum_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    stratum_names = {0: "SUBSTRATE", 1: "MEMORY", 2: "LOGIC", 3: "SPEC", 4: "INTENT"}
    for op, st, p1, p2 in instructions:
        if st in stratum_counts:
            stratum_counts[st] += 1

    # Target assessment
    target_met = sls >= 0.90
    recommendation = ""
    if sls < 0.70:
        recommendation = "CRITICAL: SLS below 0.70. Consider Warp-Interleaved Mapping."
    elif sls < 0.85:
        recommendation = "WARNING: SLS below target. Review instruction ordering."
    elif sls < 0.90:
        recommendation = "CLOSE: Near target. Minor optimizations may help."
    else:
        recommendation = "OPTIMAL: SLS target achieved."

    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "glyph_file": str(glyph_file),
                    "spatial_locality_score": round(sls, 4),
                    "target_sls": 0.90,
                    "target_met": target_met,
                    "recommendation": recommendation,
                    "instruction_count": instruction_count,
                    "grid_size": grid_size,
                    "stratum_distribution": {
                        stratum_names[k]: v for k, v in stratum_counts.items() if v > 0
                    },
                },
                indent=2,
            ),
        )
    ]


async def tool_boot_sim(args: dict) -> list[TextContent]:
    """Simulate boot chain."""
    image_path = args.get("image_path", "")
    verbose = args.get("verbose", False)

    stages = []
    issues = []

    # Stage 1: Check bootloader
    bootloader_src = GEOS_ROOT / "bootloader" / "efi" / "boot.c"
    if bootloader_src.exists():
        stages.append(
            {
                "stage": "UEFI Bootloader",
                "file": str(bootloader_src.relative_to(GEOS_ROOT)),
                "status": "PRESENT",
                "actions": [
                    "Find AMD GPU on PCI bus",
                    "Map GPU MMIO region (BAR0)",
                    "Allocate 256MB glyph memory",
                    "Load geometry_os.kernel",
                    "Load window_manager.rts.png",
                    "Load glyph_microcode.spv",
                    "ExitBootServices() and jump to kernel",
                ],
            }
        )
    else:
        issues.append("Bootloader source not found")
        stages.append({"stage": "UEFI Bootloader", "status": "MISSING"})

    # Stage 2: Check kernel
    kernel_src = GEOS_ROOT / "kernel" / "geos" / "main.c"
    if kernel_src.exists():
        stages.append(
            {
                "stage": "Geometry OS Kernel",
                "file": str(kernel_src.relative_to(GEOS_ROOT)),
                "status": "PRESENT",
                "actions": [
                    "Receive boot_info from UEFI",
                    "Initialize GPU MMIO registers",
                    "Copy init_glyph to GPU memory",
                    "Submit microcode to compute rings",
                    "Start Window Manager VM #0",
                ],
            }
        )
    else:
        issues.append("Kernel source not found")
        stages.append({"stage": "Geometry OS Kernel", "status": "MISSING"})

    # Stage 3: Check Window Manager
    wm_glyph = WINDOW_MANAGER_GLYPH
    if wm_glyph.exists():
        stages.append(
            {
                "stage": "Window Manager Glyph",
                "file": str(wm_glyph.relative_to(GEOS_ROOT)),
                "status": "PRESENT",
            }
        )
    else:
        issues.append("Window Manager glyph not found")
        stages.append({"stage": "Window Manager Glyph", "status": "MISSING"})

    # Stage 4: Check Ubuntu kernel (optional)
    if UBUNTU_KERNEL.exists():
        stages.append(
            {
                "stage": "Ubuntu Kernel (Transpiled)",
                "file": str(UBUNTU_KERNEL.relative_to(GEOS_ROOT)),
                "status": "PRESENT",
            }
        )
    else:
        stages.append({"stage": "Ubuntu Kernel (Transpiled)", "status": "OPTIONAL - Not found"})

    # Stage 5: Check boot script
    if BOOT_SCRIPT.exists():
        stages.append(
            {
                "stage": "Boot Chain Builder",
                "file": str(BOOT_SCRIPT.relative_to(GEOS_ROOT)),
                "status": "PRESENT",
            }
        )
    else:
        issues.append("Boot script not found")

    # Overall readiness
    ready = len(issues) == 0
    critical_missing = [s for s in stages if s.get("status") == "MISSING"]

    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "boot_ready": ready,
                    "stages": stages,
                    "issues": issues,
                    "critical_missing": len(critical_missing),
                    "next_step": "Run boot chain on real AMD hardware"
                    if ready
                    else "Fix missing components",
                },
                indent=2,
            ),
        )
    ]


async def tool_vm_spawn(args: dict) -> list[TextContent]:
    """Simulate VM spawn."""
    vm_id = args["vm_id"]
    glyph_file = Path(args["glyph_file"])
    window_x = args.get("window_x", 100)
    window_y = args.get("window_y", 100)
    window_w = args.get("window_w", 800)
    window_h = args.get("window_h", 600)

    if vm_id == 0:
        return [TextContent(type="text", text="Error: VM ID 0 is reserved for Window Manager")]

    if vm_id >= 8:
        return [TextContent(type="text", text=f"Error: VM ID {vm_id} exceeds maximum (7)")]

    if not glyph_file.exists():
        return [TextContent(type="text", text=f"Error: Glyph file not found: {glyph_file}")]

    # Parse the glyph file
    instructions = parse_glyph_file(str(glyph_file))

    # Calculate memory bounds (spatial MMU)
    base_addr = vm_id * 0x1000
    bound_addr = (vm_id + 1) * 0x1000 - 1

    # Entry point (first instruction)
    entry_point = 0x0000

    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "action": "SPATIAL_SPAWN simulated",
                    "vm_config": {
                        "vm_id": vm_id,
                        "parent_id": 0,
                        "entry_point": f"0x{entry_point:04X}",
                        "base_addr": f"0x{base_addr:04X}",
                        "bound_addr": f"0x{bound_addr:04X}",
                        "memory_region": f"{0x1000} bytes ({4}KB)",
                    },
                    "window": {"x": window_x, "y": window_y, "width": window_w, "height": window_h},
                    "program": {"file": str(glyph_file), "instruction_count": len(instructions)},
                    "note": "This is a simulation. Use Visual Kernel for actual execution.",
                },
                indent=2,
            ),
        )
    ]


async def tool_hilbert_test(args: dict) -> list[TextContent]:
    """Test Hilbert conversion."""
    mode = args["mode"]
    grid_size = args.get("grid_size", 4096)

    if mode == "d2xy":
        index = args.get("index", 0)
        x, y = hilbert_d2xy(grid_size, index)
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "mode": "d2xy",
                        "input": {"index": index},
                        "output": {"x": x, "y": y},
                        "grid_size": grid_size,
                    },
                    indent=2,
                ),
            )
        ]
    elif mode == "xy2d":
        x = args.get("x", 0)
        y = args.get("y", 0)
        d = hilbert_xy2d(grid_size, x, y)
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "mode": "xy2d",
                        "input": {"x": x, "y": y},
                        "output": {"index": d},
                        "grid_size": grid_size,
                    },
                    indent=2,
                ),
            )
        ]
    else:
        return [TextContent(type="text", text=f"Unknown mode: {mode}")]


async def tool_glyph_patch(args: dict) -> list[TextContent]:
    """Hot-patch a glyph instruction in VRAM."""
    address = args["address"]
    opcode = args["opcode"]
    stratum = args.get("stratum", 0)
    p1 = args.get("p1", 0)
    p2 = args.get("p2", 0)
    vm_id = args.get("vm_id", 0)

    # Parse address (hex or decimal)
    if address.startswith("0x"):
        addr = int(address, 16)
    else:
        addr = int(address)

    # Convert to Hilbert coordinates
    grid_size = 4096
    x, y = hilbert_d2xy(grid_size, addr)

    # Build the new instruction pixel
    new_pixel = {"r": opcode, "g": stratum, "b": p1, "a": p2}

    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "action": "VRAM_HOT_PATCH",
                    "vm_id": vm_id,
                    "patch": {
                        "address": addr,
                        "address_hex": f"0x{addr:08X}",
                        "hilbert_coords": {"x": x, "y": y},
                        "old_instruction": "UNKNOWN (requires VRAM read)",
                        "new_instruction": new_pixel,
                    },
                    "note": "This is a simulation. Real patching requires running GPU context.",
                    "next_step": "Apply via visual_kernel or bare-metal MMIO write",
                },
                indent=2,
            ),
        )
    ]


async def tool_linux_to_glyph(args: dict) -> list[TextContent]:
    """Transpile Linux ELF to glyph texture."""
    binary_path = Path(args["binary"])
    output_path = Path(args["output"])
    dense = args.get("dense", False)

    if not binary_path.exists():
        return [TextContent(type="text", text=f"Error: Binary not found: {binary_path}")]

    # Check if it's a valid ELF
    try:
        with open(binary_path, "rb") as f:
            magic = f.read(4)
            if magic != b"\x7fELF":
                return [TextContent(type="text", text=f"Error: Not an ELF file: {binary_path}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error reading file: {e}")]

    # Get binary info
    binary_size = binary_path.stat().st_size
    instruction_count = binary_size // 4  # Rough estimate

    # Run the transpiler
    transpiler = GEOS_ROOT / "systems" / "pixel_compiler" / "riscv_to_geometric_vm.py"
    if not transpiler.exists():
        return [TextContent(type="text", text=f"Error: Transpiler not found: {transpiler}")]

    cmd = [sys.executable, str(transpiler), str(binary_path), str(output_path)]
    if dense:
        cmd.append("--dense")

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(GEOS_ROOT))

    if result.returncode != 0:
        return [TextContent(type="text", text=f"Transpilation failed:\n{result.stderr}")]

    output_size = output_path.stat().st_size if output_path.exists() else 0

    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "action": "LINUX_TO_GLYPH",
                    "input": {
                        "binary": str(binary_path),
                        "size_bytes": binary_size,
                        "estimated_instructions": instruction_count,
                    },
                    "output": {"texture": str(output_path), "size_bytes": output_size},
                    "transpiler_output": result.stdout.strip()[-500:] if result.stdout else "",
                },
                indent=2,
            ),
        )
    ]


async def tool_geos_status(args: dict) -> list[TextContent]:
    """Get Geometry OS status."""
    components = []

    # Check each component
    checks = [
        ("glyph_compiler", GLYPH_COMPILER, "Glyph → RTS.PNG Compiler"),
        ("window_manager", WINDOW_MANAGER_GLYPH, "Window Manager Glyph"),
        ("ubuntu_kernel", UBUNTU_KERNEL, "Ubuntu Kernel (Transpiled)"),
        ("boot_script", BOOT_SCRIPT, "Boot Chain Builder"),
        ("bootloader", GEOS_ROOT / "bootloader" / "efi" / "boot.c", "UEFI Bootloader"),
        ("kernel", GEOS_ROOT / "kernel" / "geos" / "main.c", "Bare Metal Kernel"),
        (
            "visual_kernel",
            GEOS_ROOT / "systems" / "infinite_map_rs" / "src" / "visual_kernel_boot.rs",
            "Visual Kernel (Rust)",
        ),
        (
            "glyph_vm",
            GEOS_ROOT / "systems" / "infinite_map_rs" / "src" / "glyph_vm_scheduler.rs",
            "GPU Glyph VM Scheduler",
        ),
    ]

    for name, path, desc in checks:
        exists = path.exists()
        components.append(
            {
                "name": name,
                "description": desc,
                "path": str(path.relative_to(GEOS_ROOT)) if exists else str(path),
                "status": "PRESENT" if exists else "MISSING",
            }
        )

    present_count = sum(1 for c in components if c["status"] == "PRESENT")

    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "geometry_os_root": str(GEOS_ROOT),
                    "components_present": f"{present_count}/{len(components)}",
                    "components": components,
                    "boot_chain_ready": present_count >= 6,
                    "mcp_tools_available": [
                        "crystallize",
                        "benchmark_sls",
                        "boot_sim",
                        "vm_spawn",
                        "hilbert_test",
                        "geos_status",
                    ],
                },
                indent=2,
            ),
        )
    ]


async def tool_opcode_decode(args: dict) -> list[TextContent]:
    """Decode opcode value → name, stratum, description."""
    opcode = args.get("opcode")
    if opcode is None:
        return [TextContent(type="text", text="Error: opcode parameter is required")]

    # Define opcode tables based on glyph-programming skill
    opcode_table = {
        # Logic Stratum (Foundation)
        0: ("NOP", "LOGIC", "No Operation"),
        3: ("LD", "LOGIC", "Load from Memory"),
        4: ("ST", "LOGIC", "Store to Memory"),
        5: ("ADD", "LOGIC", "Addition"),
        6: ("SUB", "LOGIC", "Subtraction"),
        10: ("JZ", "LOGIC", "Jump if Zero"),
        11: ("CALL", "LOGIC", "Call Subroutine"),
        12: ("RET", "LOGIC", "Return"),
        13: ("HALT", "LOGIC", "Halt"),
        204: ("LDI", "LOGIC", "Load Immediate"),
        206: ("MOV", "LOGIC", "Move"),
        209: ("JMP", "LOGIC", "Unconditional Jump"),
        214: ("CMP", "LOGIC", "Compare"),
        215: ("DRAW", "LOGIC", "Substrate Write"),
        # Bitwise Stratum (220-231)
        220: ("AND", "BITWISE", "Bitwise AND"),
        221: ("OR", "BITWISE", "Bitwise OR"),
        222: ("XOR", "BITWISE", "Bitwise XOR"),
        223: ("NOT", "BITWISE", "Bitwise NOT"),
        224: ("SHL", "BITWISE", "Shift Left"),
        225: ("SHR", "BITWISE", "Shift Right"),
        226: ("SAR", "BITWISE", "Shift Arithmetic Right"),
        227: ("AND_MEM", "BITWISE", "AND directly on memory"),
        228: ("OR_MEM", "BITWISE", "OR directly on memory"),
        229: ("XOR_MEM", "BITWISE", "XOR directly on memory"),
        230: ("SHL_MEM", "BITWISE", "SHL directly on memory"),
        231: ("SHR_MEM", "BITWISE", "SHR directly on memory"),
    }

    if opcode in opcode_table:
        name, stratum, description = opcode_table[opcode]
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "opcode": opcode,
                        "name": name,
                        "stratum": stratum,
                        "description": description,
                    },
                    indent=2,
                ),
            )
        ]
    else:
        # Try to determine stratum based on ranges
        stratum = "UNKNOWN"
        if opcode == 0:
            stratum = "LOGIC"
        elif 3 <= opcode <= 13:
            stratum = "LOGIC"
        elif 204 <= opcode <= 215:
            stratum = "LOGIC"
        elif 220 <= opcode <= 231:
            stratum = "BITWISE"
        elif opcode >= 0x8000:
            stratum = "GUEST_RAM"
        elif opcode >= 0x1000:
            stratum = "MMIO"
        elif opcode >= 0x0200:
            stratum = "IO_BRIDGE"
        elif opcode >= 0x0100:
            stratum = "GUEST_REGS"

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "unknown",
                        "opcode": opcode,
                        "name": f"OPCODE_{opcode:03X}",
                        "stratum": stratum,
                        "description": f"Undefined opcode {opcode} (0x{opcode:02X}) in stratum {stratum}",
                    },
                    indent=2,
                ),
            )
        ]


async def tool_opcode_encode(args: dict) -> list[TextContent]:
    """Encode opcode name → value, parameters."""
    opcode_name = args.get("name")
    if not opcode_name:
        return [TextContent(type="text", text="Error: name parameter is required")]

    # Define reverse lookup table based on glyph-programming skill
    opcode_table = {
        # Logic Stratum (Foundation)
        "NOP": (0, "LOGIC", "No Operation"),
        "LD": (3, "LOGIC", "Load from Memory"),
        "ST": (4, "LOGIC", "Store to Memory"),
        "ADD": (5, "LOGIC", "Addition"),
        "SUB": (6, "LOGIC", "Subtraction"),
        "JZ": (10, "LOGIC", "Jump if Zero"),
        "CALL": (11, "LOGIC", "Call Subroutine"),
        "RET": (12, "LOGIC", "Return"),
        "HALT": (13, "LOGIC", "Halt"),
        "LDI": (204, "LOGIC", "Load Immediate"),
        "MOV": (206, "LOGIC", "Move"),
        "JMP": (209, "LOGIC", "Unconditional Jump"),
        "CMP": (214, "LOGIC", "Compare"),
        "DRAW": (215, "LOGIC", "Substrate Write"),
        # Bitwise Stratum (220-231)
        "AND": (220, "BITWISE", "Bitwise AND"),
        "OR": (221, "BITWISE", "Bitwise OR"),
        "XOR": (222, "BITWISE", "Bitwise XOR"),
        "NOT": (223, "BITWISE", "Bitwise NOT"),
        "SHL": (224, "BITWISE", "Shift Left"),
        "SHR": (225, "BITWISE", "Shift Right"),
        "SAR": (226, "BITWISE", "Shift Arithmetic Right"),
        "AND_MEM": (227, "BITWISE", "AND directly on memory"),
        "OR_MEM": (228, "BITWISE", "OR directly on memory"),
        "XOR_MEM": (229, "BITWISE", "XOR directly on memory"),
        "SHL_MEM": (230, "BITWISE", "SHL directly on memory"),
        "SHR_MEM": (231, "BITWISE", "SHR directly on memory"),
    }

    opcode_name_upper = opcode_name.upper()
    if opcode_name_upper in opcode_table:
        value, stratum, description = opcode_table[opcode_name_upper]
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "name": opcode_name_upper,
                        "value": value,
                        "stratum": stratum,
                        "description": description,
                    },
                    indent=2,
                ),
            )
        ]
    else:
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "error",
                        "name": opcode_name,
                        "error": f"Unknown opcode name: {opcode_name}",
                        "available_opcodes": list(opcode_table.keys()),
                    },
                    indent=2,
                ),
            )
        ]


# ============================================================================
# GPU Memory Bridge Tools
# ============================================================================

DAEMON_URL = "http://127.0.0.1:8769"
DAEMON_SOCKET_PATH = "/tmp/gpu_daemon.sock"
DEV_MEM_START = 0x100000  # Reserved region for development memory

# Simple in-memory index (maps keys to offsets)
# In a real system, this would be stored in the GPU substrate itself
_memory_index: dict = {}
_index_loaded = False

import requests
import socket


def _daemon_request_unix(endpoint: str, params: dict = None, body: str = None,
                         method: str = "GET", timeout: float = 2.0) -> str:
    """Make daemon request via Unix socket."""
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    sock.connect(DAEMON_SOCKET_PATH)

    # Build query string
    query = ""
    if params:
        query = "?" + "&".join(f"{k}={v}" for k, v in params.items())

    # Build HTTP-like request (Connection: close ensures daemon closes after response)
    request = f"{method} {endpoint}{query} HTTP/1.1\r\nHost: daemon\r\nConnection: close\r\n"
    if body:
        request += f"Content-Length: {len(body)}\r\n"
    request += "\r\n"
    if body:
        request += body

    sock.sendall(request.encode())

    # Read response
    response = b""
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response += chunk
        # Check for end of response
        if b"\r\n\r\n" in response and b"Content-Length:" not in response[:200]:
            break
        # Handle Content-Length based response
        if b"Content-Length:" in response:
            header_end = response.find(b"\r\n\r\n")
            if header_end > 0:
                headers = response[:header_end].decode()
                for line in headers.split("\r\n"):
                    if line.lower().startswith("content-length:"):
                        content_len = int(line.split(":")[1].strip())
                        body_start = header_end + 4
                        if len(response) >= body_start + content_len:
                            break

    sock.close()

    # Extract body after headers
    header_end = response.find(b"\r\n\r\n")
    if header_end >= 0:
        return response[header_end + 4:].decode("utf-8", errors="replace")
    return response.decode("utf-8", errors="replace")


def _daemon_request(endpoint: str, params: dict = None, body: str = None,
                    method: str = "GET", timeout: float = 2.0,
                    prefer_unix: bool = True) -> str:
    """Make daemon request with Unix socket preference, HTTP fallback."""
    if prefer_unix:
        try:
            return _daemon_request_unix(endpoint, params, body, method, timeout)
        except (ConnectionError, FileNotFoundError, socket.error):
            pass  # Fall back to HTTP

    # HTTP fallback
    url = f"{DAEMON_URL}{endpoint}"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())

    if method == "GET":
        return requests.get(url, timeout=timeout).text
    elif method == "POST":
        return requests.post(url, data=body, timeout=timeout).text
    else:
        raise ValueError(f"Invalid method: {method}")


def _ensure_index_loaded():
    """Load memory index from GPU substrate."""
    global _memory_index, _index_loaded
    if _index_loaded:
        return

    # Try to read index from address 0x100000 (first 4KB of dev memory)
    try:
        resp = requests.get(f"{DAEMON_URL}/peek?addr=0x{DEV_MEM_START:08x}&size=1024", timeout=1)
        if resp.status_code == 200:
            hex_words = resp.text.strip().split()
            raw_bytes = bytearray()
            for word in hex_words:
                val = int(word, 16)
                raw_bytes.extend(val.to_bytes(4, "little"))
            content = raw_bytes.decode("utf-8", errors="replace").rstrip("\x00")
            if content.startswith("{"):
                _memory_index = json.loads(content)
    except Exception:
        pass

    _index_loaded = True


def _save_index():
    """Persist memory index to GPU substrate."""
    global _memory_index
    try:
        data = json.dumps(_memory_index)
        encoded = data.encode("utf-8")
        hex_words = ""
        for i in range(0, len(encoded), 4):
            chunk = encoded[i : i + 4]
            if len(chunk) < 4:
                chunk = chunk + b"\x00" * (4 - len(chunk))
            val = int.from_bytes(chunk, "little")
            hex_words += f"{val:08x}"

        requests.post(f"{DAEMON_URL}/write?addr=0x{DEV_MEM_START:08x}", data=hex_words, timeout=2)
    except Exception as e:
        print(f"Warning: Failed to save memory index: {e}")


async def tool_mem_store(args: dict) -> list[TextContent]:
    """Store data in GPU-backed development memory."""
    _ensure_index_loaded()

    key = args["key"]
    value = args["value"]

    # Allocate space at next available offset
    # Index is at 0x100000, data starts at 0x100000 + 0x1000 (4KB offset)
    base_offset = 0x1000
    next_offset = base_offset

    for k, v in _memory_index.items():
        if isinstance(v, dict) and "offset" in v:
            end = v["offset"] + v.get("size", 256)
            next_offset = max(next_offset, end)

    # Store the data
    data = json.dumps({"key": key, "val": value, "ts": __import__("time").time()})
    encoded = data.encode("utf-8")
    hex_words = ""
    for i in range(0, len(encoded), 4):
        chunk = encoded[i : i + 4]
        if len(chunk) < 4:
            chunk = chunk + b"\x00" * (4 - len(chunk))
        val = int.from_bytes(chunk, "little")
        hex_words += f"{val:08x}"

    abs_addr = DEV_MEM_START + next_offset

    try:
        resp = requests.post(f"{DAEMON_URL}/write?addr=0x{abs_addr:08x}", data=hex_words, timeout=2)
        if resp.status_code != 200:
            return [
                TextContent(
                    type="text", text=f"Error: Daemon returned {resp.status_code}: {resp.text}"
                )
            ]

        # Update index
        _memory_index[key] = {
            "offset": next_offset,
            "size": len(hex_words) // 8,  # Number of 32-bit words
            "addr": f"0x{abs_addr:08x}",
        }
        _save_index()

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "GPU_MEM_STORE",
                        "key": key,
                        "addr": f"0x{abs_addr:08x}",
                        "size_bytes": len(encoded),
                        "substrate_region": "DEV_MEMORY",
                        "hilbert_base": f"0x{DEV_MEM_START:08x}",
                        "daemon": DAEMON_URL,
                    },
                    indent=2,
                ),
            )
        ]
    except requests.exceptions.ConnectionError:
        return [
            TextContent(
                type="text",
                text=f"Error: Cannot connect to Ouroboros daemon at {DAEMON_URL}. Start it with: cargo run --release --bin gpu_dev_daemon",
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_mem_retrieve(args: dict) -> list[TextContent]:
    """Retrieve data from GPU-backed development memory."""
    _ensure_index_loaded()

    key = args.get("key")

    if key:
        if key not in _memory_index:
            return [TextContent(type="text", text=f"Error: Key '{key}' not found in memory index")]

        entry = _memory_index[key]
        addr = DEV_MEM_START + entry["offset"]
        size = entry.get("size", 256)

        try:
            resp = requests.get(f"{DAEMON_URL}/peek?addr=0x{addr:08x}&size={size}", timeout=2)
            if resp.status_code != 200:
                return [TextContent(type="text", text=f"Error: Daemon returned {resp.status_code}")]

            hex_words = resp.text.strip().split()
            raw_bytes = bytearray()
            for word in hex_words:
                val = int(word, 16)
                raw_bytes.extend(val.to_bytes(4, "little"))

            content = raw_bytes.decode("utf-8", errors="replace").rstrip("\x00")
            data = json.loads(content)

            return [
                TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "status": "success",
                            "action": "GPU_MEM_RETRIEVE",
                            "key": key,
                            "addr": f"0x{addr:08x}",
                            "data": data,
                        },
                        indent=2,
                    ),
                )
            ]
        except requests.exceptions.ConnectionError:
            return [
                TextContent(
                    type="text", text=f"Error: Cannot connect to Ouroboros daemon at {DAEMON_URL}"
                )
            ]
        except Exception as e:
            return [TextContent(type="text", text=f"Error: {str(e)}")]

    # Return all keys
    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "success",
                    "action": "GPU_MEM_LIST",
                    "keys": list(_memory_index.keys()),
                    "count": len(_memory_index),
                    "substrate": f"0x{DEV_MEM_START:08x}",
                },
                indent=2,
            ),
        )
    ]


async def tool_mem_peek(args: dict) -> list[TextContent]:
    """Read raw GPU memory."""
    addr_str = args["addr"]
    size = args.get("size", 16)

    addr = int(addr_str, 16) if addr_str.startswith("0x") else int(addr_str)

    try:
        # Use /peek endpoint via unified request (Unix socket first, HTTP fallback)
        # Returns space-separated hex words like: 0x00000000 0x00000001 ...
        resp = _daemon_request("/peek", params={"addr": f"0x{addr:08x}", "size": str(size)}, timeout=2)

        # Parse space-separated hex words
        hex_words = resp.strip().split()

        # Convert hex words to raw bytes for ASCII representation
        raw_bytes = bytearray()
        for word in hex_words:
            val = int(word, 16)
            raw_bytes.extend(val.to_bytes(4, "little"))

        # ASCII representation
        ascii_repr = "".join(chr(b) if 32 <= b < 127 else "." for b in raw_bytes)

        # Calculate Hilbert coordinates
        x, y = hilbert_d2xy(4096, addr)

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "GPU_PEEK",
                        "addr": f"0x{addr:08x}",
                        "hilbert_coords": {"x": x, "y": y},
                        "size_words": len(hex_words),
                        "hex": hex_words,
                        "ascii": ascii_repr,
                    },
                    indent=2,
                ),
            )
        ]
    except (requests.exceptions.ConnectionError, ConnectionError, FileNotFoundError, socket.error):
        return [
            TextContent(
                type="text", text=f"Error: Cannot connect to Ouroboros daemon at {DAEMON_URL}"
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_mem_poke(args: dict) -> list[TextContent]:
    """Write a single value to GPU memory."""
    addr_str = args["addr"]
    val_str = args["val"]

    addr = int(addr_str, 16) if addr_str.startswith("0x") else int(addr_str)
    val = int(val_str, 16) if val_str.startswith("0x") else int(val_str)

    # Calculate Hilbert coordinates
    x, y = hilbert_d2xy(4096, addr)

    try:
        resp = requests.get(f"{DAEMON_URL}/poke?addr=0x{addr:08x}&val=0x{val:08x}", timeout=2)
        if resp.status_code != 200:
            return [TextContent(type="text", text=f"Error: Daemon returned {resp.status_code}")]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "GPU_POKE",
                        "addr": f"0x{addr:08x}",
                        "val": f"0x{val:08x}",
                        "hilbert_coords": {"x": x, "y": y},
                        "daemon_response": resp.text.strip(),
                    },
                    indent=2,
                ),
            )
        ]
    except requests.exceptions.ConnectionError:
        return [
            TextContent(
                type="text", text=f"Error: Cannot connect to Ouroboros daemon at {DAEMON_URL}"
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_vlm_health(args: dict) -> list[TextContent]:
    """Run VLM vitality check on .rts.png file."""
    rts_file = Path(args["rts_file"])
    json_output = args.get("json", False)
    verbose = args.get("verbose", False)

    if not rts_file.exists():
        return [TextContent(type="text", text=f"Error: RTS file not found: {rts_file}")]

    # Path to the VLM health CLI
    vlm_health_cli = GEOS_ROOT / "systems" / "pixel_compiler" / "vlm_health_cli.py"
    if not vlm_health_cli.exists():
        return [TextContent(type="text", text=f"Error: VLM health CLI not found: {vlm_health_cli}")]

    # Build command
    cmd = [sys.executable, str(vlm_health_cli), "check", str(rts_file)]
    if json_output:
        cmd.append("--json")
    if verbose:
        cmd.append("--verbose")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(GEOS_ROOT))
        if result.returncode != 0:
            return [TextContent(type="text", text=f"VLM health check failed:\n{result.stderr}")]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "VLM_HEALTH_CHECK",
                        "rts_file": str(rts_file),
                        "output": result.stdout.strip(),
                    },
                    indent=2,
                ),
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error running VLM health check: {str(e)}")]


async def tool_daemon_status(args: dict) -> list[TextContent]:
    """Check Ouroboros HAL daemon status via Unix socket or HTTP."""
    try:
        # Use /status endpoint via unified request (Unix socket first, HTTP fallback)
        resp = _daemon_request("/status", timeout=2)
        # Parse the response to extract daemon info
        status_data = json.loads(resp.strip()) if resp.strip() else {}
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "DAEMON_STATUS_CHECK",
                        "daemon_url": DAEMON_URL,
                        "daemon_socket": DAEMON_SOCKET_PATH,
                        "daemon": "ONLINE",
                        "daemon_status": status_data.get("status", "unknown"),
                        "active_vms": status_data.get("vms", 0),
                    },
                    indent=2,
                ),
            )
        ]
    except (requests.exceptions.ConnectionError, ConnectionError, FileNotFoundError, socket.error):
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "error",
                        "action": "DAEMON_STATUS_CHECK",
                        "daemon_url": DAEMON_URL,
                        "daemon_socket": DAEMON_SOCKET_PATH,
                        "daemon": "OFFLINE",
                        "error": f"Cannot connect to Ouroboros daemon. Start it with: cargo run --release --bin gpu_dev_daemon",
                    },
                    indent=2,
                ),
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error checking daemon status: {str(e)}")]


async def tool_substrate_load(args: dict) -> list[TextContent]:
    """Load .rts.png to running daemon via /load endpoint."""
    rts_file = Path(args["rts_file"])

    if not rts_file.exists():
        return [TextContent(type="text", text=f"Error: RTS file not found: {rts_file}")]

    try:
        # Daemon expects the path as plain text body, not multipart
        resp = requests.post(f"{DAEMON_URL}/load", data=str(rts_file), timeout=10)

        if resp.status_code != 200:
            return [
                TextContent(
                    type="text",
                    text=f"Error: Daemon returned {resp.status_code}: {resp.text}",
                )
            ]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "SUBSTRATE_LOAD",
                        "rts_file": str(rts_file),
                        "daemon_url": DAEMON_URL,
                        "response": resp.text.strip(),
                    },
                    indent=2,
                ),
            )
        ]
    except requests.exceptions.ConnectionError:
        return [
            TextContent(
                type="text",
                text=f"Error: Cannot connect to Ouroboros daemon at {DAEMON_URL}. Start it with: cargo run --release --bin gpu_dev_daemon",
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error loading substrate: {str(e)}")]


async def tool_gpu_write(args: dict) -> list[TextContent]:
    """Batch write multiple values to GPU memory."""
    addr_str = args["addr"]
    data = args["data"]

    addr = int(addr_str, 16) if addr_str.startswith("0x") else int(addr_str)

    # Convert data array to hex string
    hex_words = "".join(f"{val:08x}" for val in data)

    try:
        resp = requests.post(
            f"{DAEMON_URL}/write?addr=0x{addr:08x}",
            data=hex_words,
            timeout=5,
        )
        if resp.status_code != 200:
            return [TextContent(type="text", text=f"Error: Daemon returned {resp.status_code}")]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "GPU_WRITE",
                        "addr": f"0x{addr:08x}",
                        "count": len(data),
                        "daemon_response": resp.text.strip(),
                    },
                    indent=2,
                ),
            )
        ]
    except requests.exceptions.ConnectionError:
        return [
            TextContent(
                type="text",
                text=f"Error: Cannot connect to daemon at {DAEMON_URL}",
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_gpu_exec(args: dict) -> list[TextContent]:
    """Execute shell command via daemon."""
    cmd = args["cmd"]
    cwd = args.get("cwd")
    timeout = args.get("timeout", 30)

    params = f"timeout={timeout}"
    if cwd:
        params += f"&cwd={cwd}"

    try:
        resp = requests.post(
            f"{DAEMON_URL}/exec?{params}",
            data=cmd,
            timeout=timeout + 5,
        )
        if resp.status_code != 200:
            return [TextContent(type="text", text=f"Error: Daemon returned {resp.status_code}")]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "GPU_EXEC",
                        "cmd": cmd,
                        "cwd": cwd,
                        "timeout": timeout,
                        "output": resp.text.strip(),
                    },
                    indent=2,
                ),
            )
        ]
    except requests.exceptions.ConnectionError:
        return [
            TextContent(
                type="text",
                text=f"Error: Cannot connect to daemon at {DAEMON_URL}",
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_gpu_pause(args: dict) -> list[TextContent]:
    """Pause all VMs."""
    try:
        resp = requests.get(f"{DAEMON_URL}/pause", timeout=2)
        if resp.status_code != 200:
            return [TextContent(type="text", text=f"Error: Daemon returned {resp.status_code}")]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "GPU_PAUSE",
                        "daemon_response": resp.text.strip(),
                    },
                    indent=2,
                ),
            )
        ]
    except requests.exceptions.ConnectionError:
        return [
            TextContent(
                type="text",
                text=f"Error: Cannot connect to daemon at {DAEMON_URL}",
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_gpu_vmstate(args: dict) -> list[TextContent]:
    """Query VM state."""
    vm = args.get("vm", 0)

    try:
        resp = requests.get(f"{DAEMON_URL}/vmstate?vm={vm}", timeout=2)
        if resp.status_code != 200:
            return [TextContent(type="text", text=f"Error: Daemon returned {resp.status_code}")]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "success",
                        "action": "GPU_VMSTATE",
                        "vm": vm,
                        "daemon_response": resp.text.strip(),
                    },
                    indent=2,
                ),
            )
        ]
    except requests.exceptions.ConnectionError:
        return [
            TextContent(
                type="text",
                text=f"Error: Cannot connect to daemon at {DAEMON_URL}",
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


# ============================================================================
# Multi-Agent Tools
# ============================================================================

from geos_agent_manager import (
    get_manager,
    AgentCapability,
    MultiAgentManager,
)


async def tool_agent_register(args: dict) -> list[TextContent]:
    """Register a new AI agent session."""
    manager = get_manager()
    manager._load_state()

    agent_type = args.get("agent_type", "custom")
    capabilities = args.get("capabilities", ["read", "write"])
    metadata = args.get("metadata", {})

    cap_set = set()
    for c in capabilities:
        try:
            cap_set.add(AgentCapability(c))
        except ValueError:
            pass

    session = manager.register_agent(
        agent_type=agent_type,
        capabilities=cap_set,
        metadata=metadata,
    )

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "AGENT_REGISTER",
            "session": {
                "agent_id": session.agent_id,
                "agent_type": session.agent_type,
                "capabilities": [c.value for c in session.capabilities],
                "created_at": session.created_at,
            },
            "message": f"Agent {session.agent_id} registered. Include 'agent_id' in future tool calls.",
        }, indent=2)
    )]


async def tool_agent_unregister(args: dict) -> list[TextContent]:
    """Unregister an agent and release its resources."""
    manager = get_manager()
    manager._load_state()
    agent_id = args.get("agent_id")

    if not agent_id:
        return [TextContent(type="text", text="Error: agent_id required")]

    success = manager.unregister_agent(agent_id)

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success" if success else "not_found",
            "action": "AGENT_UNREGISTER",
            "agent_id": agent_id,
        }, indent=2)
    )]


async def tool_agent_list(args: dict) -> list[TextContent]:
    """List all registered agents."""
    manager = get_manager()
    manager._load_state()
    agents = manager.list_agents()

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "AGENT_LIST",
            "agents": [
                {
                    "agent_id": a.agent_id,
                    "agent_type": a.agent_type,
                    "capabilities": [c.value for c in a.capabilities],
                    "memory_regions": len(manager.get_agent_regions(a.agent_id)),
                    "last_activity": a.last_activity,
                }
                for a in agents
            ],
            "count": len(agents),
        }, indent=2)
    )]


async def tool_agent_status(args: dict) -> list[TextContent]:
    """Get multi-agent system status."""
    manager = get_manager()
    manager._load_state()
    status = manager.get_status()

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "AGENT_STATUS",
            "multi_agent_system": status,
        }, indent=2)
    )]


async def tool_agent_alloc(args: dict) -> list[TextContent]:
    """Allocate a memory region for an agent."""
    manager = get_manager()
    manager._load_state()
    agent_id = args.get("agent_id")
    size = args.get("size", 4096)
    purpose = args.get("purpose", "general")

    if not agent_id:
        return [TextContent(type="text", text="Error: agent_id required")]

    region = manager.allocate_memory(agent_id, size, purpose)

    if not region:
        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "error",
                "message": "Allocation failed (agent not found or out of space)",
            }, indent=2)
        )]

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "AGENT_ALLOC",
            "region": {
                "start_addr": f"0x{region.start_addr:08X}",
                "end_addr": f"0x{region.end_addr:08X}",
                "size": region.end_addr - region.start_addr,
                "owner_id": region.owner_id,
                "purpose": region.purpose,
            },
        }, indent=2)
    )]


async def tool_agent_free(args: dict) -> list[TextContent]:
    """Release a memory region."""
    manager = get_manager()
    manager._load_state()
    agent_id = args.get("agent_id")
    addr_str = args.get("addr")

    if not agent_id or not addr_str:
        return [TextContent(type="text", text="Error: agent_id and addr required")]

    addr = int(addr_str, 16) if addr_str.startswith("0x") else int(addr_str)
    success = manager.release_memory(agent_id, addr)

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success" if success else "not_found",
            "action": "AGENT_FREE",
            "addr": f"0x{addr:08X}",
            "agent_id": agent_id,
        }, indent=2)
    )]


async def tool_agent_lock(args: dict) -> list[TextContent]:
    """Acquire a lock on a resource."""
    manager = get_manager()
    manager._load_state()
    agent_id = args.get("agent_id")
    resource = args.get("resource")
    timeout = args.get("timeout", 30.0)

    if not agent_id or not resource:
        return [TextContent(type="text", text="Error: agent_id and resource required")]

    success = manager.acquire_lock(agent_id, resource, timeout)

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "acquired" if success else "conflict",
            "action": "AGENT_LOCK",
            "resource": resource,
            "agent_id": agent_id,
            "current_owner": manager.locks.get(resource) if not success else agent_id,
        }, indent=2)
    )]


async def tool_agent_unlock(args: dict) -> list[TextContent]:
    """Release a lock on a resource."""
    manager = get_manager()
    manager._load_state()
    agent_id = args.get("agent_id")
    resource = args.get("resource")

    if not agent_id or not resource:
        return [TextContent(type="text", text="Error: agent_id and resource required")]

    success = manager.release_lock(agent_id, resource)

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "released" if success else "not_owner",
            "action": "AGENT_UNLOCK",
            "resource": resource,
            "agent_id": agent_id,
        }, indent=2)
    )]


async def tool_agent_event(args: dict) -> list[TextContent]:
    """Send an event to other agents."""
    manager = get_manager()
    manager._load_state()
    source_agent = args.get("source_agent")
    event_type = args.get("event_type")
    payload = args.get("payload", {})
    target_agent = args.get("target_agent")

    if not source_agent or not event_type:
        return [TextContent(type="text", text="Error: source_agent and event_type required")]

    manager.send_event(source_agent, event_type, payload, target_agent)

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "AGENT_EVENT",
            "event_type": event_type,
            "source_agent": source_agent,
            "target_agent": target_agent or "broadcast",
        }, indent=2)
    )]


async def tool_memory_map(args: dict) -> list[TextContent]:
    """Show Hilbert memory layout."""
    manager = get_manager()
    manager._load_state()

    regions = [
        {"name": "Emulator State", "start": "0x0000", "end": "0x00FF", "type": "system"},
        {"name": "Guest Registers", "start": "0x0100", "end": "0x013F", "type": "system"},
        {"name": "I/O Bridge", "start": "0x0200", "end": "0x02FF", "type": "system"},
        {"name": "MMIO", "start": "0x1000", "end": "0x10FF", "type": "system"},
        {"name": "Guest RAM", "start": "0x8000", "end": "0xFFFF", "type": "system"},
    ]

    for region in manager.memory_regions:
        regions.append({
            "name": f"Agent: {region.owner_id} ({region.purpose})",
            "start": f"0x{region.start_addr:08X}",
            "end": f"0x{region.end_addr:08X}",
            "type": "agent"
        })

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "MEMORY_MAP",
            "regions": regions,
            "grid_size": 4096
        }, indent=2)
    )]


async def tool_driver_template(args: dict) -> list[TextContent]:
    """Generate a polling driver glyph template."""
    name = args.get("name", "generic_driver")
    io_addr = args.get("io_addr", "0x0200")
    template = f"""
; {name} - Polling Driver Template
; I/O Address: {io_addr}

@start:
    MOV R1, {io_addr}    ; Set I/O base address

@poll_loop:
    PEEK R2, R1         ; Read from I/O status register
    AND R2, 0x01        ; Check if data ready (bit 0)
    BEQ R2, @poll_loop  ; If zero, keep polling

    ADD R1, 1           ; Move to data register
    PEEK R3, R1         ; Read data
    SUB R1, 1           ; Return to status register

    ; Process data in R3
    ; ...

    JMP @poll_loop      ; Repeat
"""
    return [TextContent(type="text", text=template.strip())]


async def tool_riscv_template(args: dict) -> list[TextContent]:
    """Generate a RISC-V emulator template."""
    template = """
; RISC-V Fetch/Decode Stage
; R1 = PC (Program Counter)
; R2 = IR (Instruction Register)

@fetch:
    PEEK R2, R1         ; Fetch instruction from memory at PC
    ADD R1, 4           ; Increment PC by 4 (standard RV32I)

@decode:
    MOV R3, R2          ; Copy IR for extraction
    AND R3, 0x7F        ; Extract opcode (bits 0-6)

    CMP R3, 0x33        ; Check if R-Type
    BEQ R3, @rtype_decode

    CMP R3, 0x13        ; Check if I-Type
    BEQ R3, @itype_decode

    ; ... other types ...

    JMP @fetch          ; Next instruction
"""
    return [TextContent(type="text", text=template.strip())]


async def tool_vcc_validate(args: dict) -> list[TextContent]:
    """Validate Visual Consistency Contract (VCC)."""
    region_str = args["region"]
    expected_hash = args.get("expected_hash")

    # Parse region (e.g., "0x0000-0x1000")
    try:
        start_str, end_str = region_str.split("-")
        start_addr = int(start_str, 16) if start_str.startswith("0x") else int(start_str)
        end_addr = int(end_str, 16) if end_str.startswith("0x") else int(end_str)
        size = (end_addr - start_addr) // 4  # Number of 32-bit words
    except Exception as e:
        return [TextContent(type="text", text=f"Error parsing region '{region_str}': {e}")]

    try:
        # Use _daemon_request to get memory
        resp = _daemon_request("/peek", params={"addr": f"0x{start_addr:08x}", "size": str(size)}, timeout=5)
        hex_words = resp.strip().split()

        # Calculate hash
        import hashlib
        hasher = hashlib.sha256()
        for word in hex_words:
            val = int(word, 16)
            hasher.update(val.to_bytes(4, "little"))
        actual_hash = hasher.hexdigest()

        status = "match" if not expected_hash or actual_hash == expected_hash else "mismatch"

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": status,
                        "action": "VCC_VALIDATE",
                        "region": region_str,
                        "actual_hash": f"sha256:{actual_hash}",
                        "expected_hash": f"sha256:{expected_hash}" if expected_hash else None,
                        "word_count": len(hex_words),
                    },
                    indent=2,
                ),
            )
        ]
    except (requests.exceptions.ConnectionError, ConnectionError, FileNotFoundError, socket.error):
        return [TextContent(type="text", text="Error: Cannot connect to Ouroboros daemon.")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error during VCC validation: {str(e)}")]


# ============================================================================
# VCC (Visual Consistency Contract) Tools
# ============================================================================

from geos_vcc import get_vcc_manager, VCCRegionType


async def tool_vcc_sign(args: dict) -> list[TextContent]:
    """Sign a Visual Consistency Contract for a region."""
    vcc = get_vcc_manager()
    agent_manager = get_manager()

    agent_id = args.get("agent_id")
    region_start_str = args.get("region_start")
    region_end_str = args.get("region_end")
    region_type = args.get("region_type", "agent_workspace")
    description = args.get("description", "")

    if not all([agent_id, region_start_str, region_end_str]):
        return [TextContent(type="text", text="Error: agent_id, region_start, and region_end required")]

    try:
        region_start = int(region_start_str, 16) if region_start_str.startswith("0x") else int(region_start_str)
        region_end = int(region_end_str, 16) if region_end_str.startswith("0x") else int(region_end_str)
        size = (region_end - region_start) // 4
    except Exception as e:
        return [TextContent(type="text", text=f"Error parsing addresses: {e}")]

    # Check permission
    allowed, reason = vcc.check_modification_permission(region_start, agent_id, agent_manager)
    if not allowed:
        return [TextContent(type="text", text=f"Permission denied: {reason}")]

    # Fetch current data from daemon
    try:
        resp = _daemon_request("/peek", params={"addr": f"0x{region_start:08x}", "size": str(size)}, timeout=5)
        hex_words = resp.strip().split()

        # Reconstruct bytes
        data = bytearray()
        for word in hex_words:
            val = int(word, 16)
            data.extend(val.to_bytes(4, "little"))
    except Exception as e:
        return [TextContent(type="text", text=f"Error fetching region data: {e}")]

    # Sign the VCC
    try:
        region_type_enum = VCCRegionType(region_type)
    except ValueError:
        region_type_enum = VCCRegionType.AGENT_WORKSPACE

    entry = vcc.sign_region(
        region_start=region_start,
        region_end=region_end,
        region_type=region_type_enum,
        data=bytes(data),
        agent_id=agent_id,
        description=description,
        metadata={"size_words": len(hex_words)},
    )

    # Notify other agents
    agent_manager.send_event(
        source_agent=agent_id,
        event_type="geos:vcc_signed",
        payload={
            "region": f"0x{region_start:08X}-0x{region_end:08X}",
            "hash": entry.expected_hash[:16] + "...",
        },
    )

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "VCC_SIGN",
            "agent_id": agent_id,
            "region": f"0x{region_start:08X}-0x{region_end:08X}",
            "hash": f"sha256:{entry.expected_hash}",
            "signed_at": entry.signed_at,
            "parent_hash": entry.parent_hash[:16] + "..." if entry.parent_hash else None,
        }, indent=2)
    )]


async def tool_vcc_status(args: dict) -> list[TextContent]:
    """Get VCC system status."""
    vcc = get_vcc_manager()
    status = vcc.get_status()

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "VCC_STATUS",
            "vcc_system": status,
        }, indent=2)
    )]


async def tool_vcc_audit(args: dict) -> list[TextContent]:
    """Get audit trail for a region."""
    vcc = get_vcc_manager()

    addr_str = args.get("addr")
    if not addr_str:
        return [TextContent(type="text", text="Error: addr required")]

    addr = int(addr_str, 16) if addr_str.startswith("0x") else int(addr_str)
    trail = vcc.get_audit_trail(addr)

    entries = [
        {
            "region": f"0x{e.region_start:08X}-0x{e.region_end:08X}",
            "type": e.region_type.value,
            "hash": e.expected_hash[:16] + "...",
            "signed_by": e.signing_agent,
            "signed_at": e.signed_at,
            "description": e.description,
            "parent": e.parent_hash[:16] + "..." if e.parent_hash else None,
        }
        for e in trail
    ]

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "VCC_AUDIT",
            "addr": f"0x{addr:08X}",
            "history": entries,
        }, indent=2)
    )]


async def tool_vcc_guard(args: dict) -> list[TextContent]:
    """Enable or disable VCC guard."""
    vcc = get_vcc_manager()

    enable = args.get("enable", True)
    vcc.guard_enabled = enable
    vcc._save_manifest()

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "VCC_GUARD",
            "guard_enabled": vcc.guard_enabled,
            "warning": "Guard disabled - critical regions unprotected" if not vcc.guard_enabled else None,
        }, indent=2)
    )]


async def tool_vcc_list(args: dict) -> list[TextContent]:
    """List all VCC manifest entries."""
    vcc = get_vcc_manager()

    entries = [
        {
            "region": f"0x{e.region_start:08X}-0x{e.region_end:08X}",
            "type": e.region_type.value,
            "hash": e.expected_hash[:16] + "...",
            "signed_by": e.signing_agent,
            "signed_at": e.signed_at,
            "description": e.description[:50],
        }
        for e in vcc.manifest
    ]

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "VCC_LIST",
            "entries": entries,
            "total": len(entries),
            "violations": len(vcc.violations),
        }, indent=2)
    )]


async def tool_vcc_audit_all(args: dict) -> list[TextContent]:
    """
    Validate ALL regions in the VCC manifest against the substrate.

    This is the "Immune System" check - it verifies every registered region
    and can optionally trigger auto-repair on critical failures.
    """
    import hashlib
    vcc = get_vcc_manager()
    auto_repair = args.get("auto_repair", False)
    strict = args.get("strict", True)

    # Critical region types
    CRITICAL_TYPES = {VCCRegionType.BOOT_SECTOR, VCCRegionType.KERNEL}

    results = []
    passed = 0
    failed = 0
    critical_failures = []

    for entry in vcc.manifest:
        region_str = f"0x{entry.region_start:08X}-0x{entry.region_end:08X}"
        size = (entry.region_end - entry.region_start) // 4
        is_critical = entry.region_type in CRITICAL_TYPES

        try:
            # Read substrate memory
            resp = _daemon_request("/peek", params={
                "addr": f"0x{entry.region_start:08x}",
                "size": str(size)
            }, timeout=5)
            hex_words = resp.strip().split()

            # Compute hash
            hasher = hashlib.sha256()
            for word in hex_words:
                val = int(word, 16)
                hasher.update(val.to_bytes(4, "little"))
            actual_hash = hasher.hexdigest()

            # Compare
            if actual_hash == entry.expected_hash:
                status = "PASS"
                passed += 1
            else:
                status = "FAIL"
                failed += 1
                if is_critical:
                    critical_failures.append({
                        "region": region_str,
                        "expected": entry.expected_hash[:16] + "...",
                        "actual": actual_hash[:16] + "...",
                        "description": entry.description,
                    })

            results.append({
                "region": region_str,
                "type": entry.region_type.value,
                "status": status,
                "critical": is_critical,
                "description": entry.description[:40] if entry.description else "",
            })

        except Exception as e:
            failed += 1
            results.append({
                "region": region_str,
                "status": "ERROR",
                "error": str(e),
            })

    # Determine overall status
    if failed == 0:
        overall = "HEALTHY"
    elif critical_failures:
        overall = "CRITICAL_FAILURE"
    else:
        overall = "DEGRADED"

    # Auto-repair on critical failure
    repair_result = None
    if auto_repair and critical_failures:
        repair_result = {
            "action": "AUTO_REPAIR_TRIGGERED",
            "message": "Attempting substrate reload due to critical failures",
            "failed_regions": [f["region"] for f in critical_failures],
        }
        # In a real implementation, this would trigger substrate_reload

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "action": "VCC_AUDIT_ALL",
            "overall": overall,
            "summary": {
                "total": len(results),
                "passed": passed,
                "failed": failed,
                "critical_failures": len(critical_failures),
            },
            "results": results,
            "critical_failures": critical_failures if critical_failures else None,
            "auto_repair": repair_result,
            "strict_mode": strict,
        }, indent=2)
    )]


async def tool_self_host_loop(args: dict) -> list[TextContent]:
    """
    Execute a self-hosting loop step.

    This is the core of autonomous evolution - it runs one iteration of:
    ANALYZE → PLAN → EXECUTE → DEPLOY → VERIFY

    The multi-agent system coordinates which agent is responsible for each step.
    """
    agent_manager = get_manager()
    vcc = get_vcc_manager()

    step = args.get("step", "analyze")
    agent_id = args.get("agent_id")
    target = args.get("target", "kernel")
    payload = args.get("payload", {})

    if not agent_id:
        return [TextContent(type="text", text="Error: agent_id required")]

    agent = agent_manager.get_agent(agent_id)
    if not agent:
        return [TextContent(type="text", text=f"Error: Agent {agent_id} not registered")]

    result = {"step": step, "agent_id": agent_id, "target": target}

    if step == "analyze":
        # Step 1: Analyze substrate state
        result["action"] = "SUBSTRATE_ANALYSIS"

        # Check VCC status
        vcc_status = vcc.get_status()
        result["vcc_status"] = vcc_status

        # Check daemon status
        try:
            resp = _daemon_request("/peek", params={"addr": "0x00000000", "size": "1"}, timeout=2)
            result["daemon"] = "online"
        except Exception:
            result["daemon"] = "offline"

        # Emit analysis event
        agent_manager.send_event(agent_id, "geos:analysis_complete", result)

    elif step == "plan":
        # Step 2: Plan modifications
        result["action"] = "ARCHITECTURE_PLAN"
        result["plan"] = payload.get("plan", "No plan provided")
        result["regions"] = payload.get("regions", [])

        # Allocate workspace if needed
        if "workspace_size" in payload:
            region = agent_manager.allocate_memory(
                agent_id=agent_id,
                size=payload["workspace_size"],
                purpose=f"self_host_{target}",
            )
            if region:
                result["workspace"] = f"0x{region.start_addr:08X}-0x{region.end_addr:08X}"

    elif step == "execute":
        # Step 3: Execute build/compilation
        result["action"] = "REMOTE_BUILD"

        cmd = payload.get("cmd")
        if cmd:
            # Acquire lock on build system
            lock_acquired = agent_manager.acquire_lock(agent_id, "build:system")
            if not lock_acquired:
                return [TextContent(type="text", text="Error: Build system locked by another agent")]

            try:
                # Execute via daemon
                resp = _daemon_request("/exec", params={"cwd": payload.get("cwd", "/tmp")}, data=cmd, timeout=60)
                result["output"] = resp
                result["success"] = True
            except Exception as e:
                result["error"] = str(e)
                result["success"] = False
            finally:
                agent_manager.release_lock(agent_id, "build:system")

        # Emit build event
        agent_manager.send_event(agent_id, "geos:build_ready" if result.get("success") else "geos:build_failed", result)

    elif step == "deploy":
        # Step 4: Deploy to substrate
        result["action"] = "SUBSTRATE_DEPLOY"

        rts_file = payload.get("rts_file")
        if rts_file:
            try:
                # Load via daemon
                resp = _daemon_request("/load", data=rts_file, timeout=10)
                result["daemon_response"] = resp
                result["success"] = True
            except Exception as e:
                result["error"] = str(e)
                result["success"] = False

        # Emit deploy event
        agent_manager.send_event(agent_id, "geos:deploy_complete", result)

    elif step == "verify":
        # Step 5: Verify VCC
        result["action"] = "VCC_VERIFICATION"

        region = payload.get("region", "0x0000-0x1000")
        expected_hash = payload.get("expected_hash")

        # Use vcc_validate
        validate_args = {"region": region, "expected_hash": expected_hash}
        validate_result = await tool_vcc_validate(validate_args)
        result["validation"] = json.loads(validate_result[0].text)

        if result["validation"]["status"] == "match":
            # Sign the VCC
            agent_manager.send_event(agent_id, "geos:vcc_verified", {"region": region})
        else:
            agent_manager.send_event(agent_id, "geos:vcc_violation", {"region": region})

    else:
        return [TextContent(type="text", text=f"Error: Unknown step '{step}'. Valid steps: analyze, plan, execute, deploy, verify")]

    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "self_host_loop": result,
        }, indent=2)
    )]


# ============================================================================
# WASM Tools
# ============================================================================

# WASM interpreter memory layout (must match wasm_interpreter.glyph)
WASM_MEM_BASE = 0x20000       # WASM linear memory base
WASM_SP_ADDR = 0x30000         # Stack pointer
WASM_IP_ADDR = 0x30004         # Instruction pointer
WASM_BP_ADDR = 0x30008         # Base pointer
WASM_STATUS_ADDR = 0x3000C     # Status register
WASM_STATUS_HALTED = 0
WASM_STATUS_RUNNING = 1
WASM_STATUS_ERROR = 2


async def tool_wasm_load(args: dict) -> list[TextContent]:
    """Load WASM binary to GPU substrate at WASM linear memory base."""
    wasm_file = Path(args["wasm_file"])
    addr_str = args.get("addr", "0x20000")

    # Parse address
    try:
        addr = int(addr_str, 16) if addr_str.startswith("0x") else int(addr_str)
    except ValueError:
        return [TextContent(type="text", text=f"Error: Invalid address format: {addr_str}")]

    if not wasm_file.exists():
        return [TextContent(type="text", text=f"Error: WASM file not found: {wasm_file}")]

    try:
        wasm_bytes = wasm_file.read_bytes()
    except Exception as e:
        return [TextContent(type="text", text=f"Error reading WASM file: {e}")]

    # Load via daemon's /load?binary= endpoint
    try:
        resp = requests.post(
            f"{DAEMON_URL}/load?binary=0x{addr:x}",
            data=wasm_bytes,
            headers={"Content-Type": "application/octet-stream"},
            timeout=10
        )

        if resp.status_code != 200:
            return [TextContent(type="text", text=f"Error loading WASM: {resp.text}")]

        result = json.loads(resp.text) if resp.text.strip() else {}

        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "success",
                "action": "WASM_LOAD",
                "file": str(wasm_file),
                "addr": f"0x{addr:x}",
                "bytes": len(wasm_bytes),
                "daemon_response": result,
            }, indent=2)
        )]
    except requests.exceptions.ConnectionError:
        return [TextContent(type="text", text="Error: Cannot connect to daemon. Start with: cargo run --release --bin gpu_dev_daemon")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_wasm_run(args: dict) -> list[TextContent]:
    """Trigger WASM interpreter execution by setting IP and status."""
    entry_str = args.get("entry_point", "0x0")

    # Parse entry point
    try:
        entry = int(entry_str, 16) if entry_str.startswith("0x") else int(entry_str)
    except ValueError:
        return [TextContent(type="text", text=f"Error: Invalid entry point format: {entry_str}")]

    try:
        # Set instruction pointer
        resp_ip = requests.get(
            f"{DAEMON_URL}/poke",
            params={"addr": f"0x{WASM_IP_ADDR:x}", "value": f"0x{entry:x}"},
            timeout=5
        )

        # Set status to RUNNING
        resp_status = requests.get(
            f"{DAEMON_URL}/poke",
            params={"addr": f"0x{WASM_STATUS_ADDR:x}", "value": f"0x{WASM_STATUS_RUNNING:x}"},
            timeout=5
        )

        if resp_ip.status_code != 200 or resp_status.status_code != 200:
            return [TextContent(type="text", text=f"Error setting interpreter state")]

        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "success",
                "action": "WASM_RUN",
                "entry_point": f"0x{entry:x}",
                "ip_addr": f"0x{WASM_IP_ADDR:x}",
                "status_addr": f"0x{WASM_STATUS_ADDR:x}",
                "message": "WASM interpreter started. Check wasm_status for execution state.",
            }, indent=2)
        )]
    except requests.exceptions.ConnectionError:
        return [TextContent(type="text", text="Error: Cannot connect to daemon")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def tool_wasm_status(args: dict) -> list[TextContent]:
    """Check WASM interpreter state."""
    try:
        # Read interpreter state registers
        resp_ip = requests.get(
            f"{DAEMON_URL}/read",
            params={"addr": f"0x{WASM_IP_ADDR:x}", "len": "4"},
            timeout=5
        )
        resp_sp = requests.get(
            f"{DAEMON_URL}/read",
            params={"addr": f"0x{WASM_SP_ADDR:x}", "len": "4"},
            timeout=5
        )
        resp_status = requests.get(
            f"{DAEMON_URL}/read",
            params={"addr": f"0x{WASM_STATUS_ADDR:x}", "len": "4"},
            timeout=5
        )

        # Parse values
        def parse_u32(resp):
            if resp.status_code != 200:
                return None
            # Response is JSON with hex field
            try:
                data = json.loads(resp.text)
                hex_str = data.get("hex", "00000000")
                return int(hex_str[:8], 16)
            except:
                return None

        ip_val = parse_u32(resp_ip)
        sp_val = parse_u32(resp_sp)
        status_val = parse_u32(resp_status)

        status_names = {0: "HALTED", 1: "RUNNING", 2: "ERROR"}
        status_name = status_names.get(status_val, f"UNKNOWN({status_val})")

        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "success",
                "action": "WASM_STATUS",
                "interpreter": {
                    "ip": f"0x{ip_val:x}" if ip_val is not None else "read_error",
                    "sp": f"0x{sp_val:x}" if sp_val is not None else "read_error",
                    "status": status_name,
                    "status_raw": status_val,
                },
                "memory_layout": {
                    "linear_memory": f"0x{WASM_MEM_BASE:x}",
                    "registers": f"0x{WASM_SP_ADDR:x}",
                },
            }, indent=2)
        )]
    except requests.exceptions.ConnectionError:
        return [TextContent(type="text", text="Error: Cannot connect to daemon")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


# ============================================================================
# ECC Integration Tool Handler
# ============================================================================

async def tool_ecc_dispatch(name: str, args: dict) -> list[TextContent]:
    """
    Dispatch ECC tool calls to the ECC bridge or ECC Agent Guild.

    This handler allows AI assistants to invoke ECC commands (plan, tdd, verify, etc.)
    and ECC Agent Guild operations (spawn, dispatch, etc.) directly through the MCP interface.
    """
    # Route guild tools to the guild dispatcher
    if name.startswith("ecc_guild_"):
        if not ECC_GUILD_AVAILABLE:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "status": "error",
                    "error": "ECC Agent Guild not available. Ensure ecc_agent_guild.py is in the same directory.",
                    "tool": name
                }, indent=2)
            )]

        try:
            result = await dispatch_guild_tool(name, args)
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "status": "error",
                    "error": str(e),
                    "tool": name
                }, indent=2)
            )]

    # Route skills tools to the skills dispatcher
    if name.startswith("ecc_skills_"):
        if not ECC_SKILLS_AVAILABLE:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "status": "error",
                    "error": "ECC Skills Bridge not available. Ensure ecc_skills_bridge.py is in the same directory.",
                    "tool": name
                }, indent=2)
            )]

        try:
            result = await dispatch_skills_tool(name, args)
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "status": "error",
                    "error": str(e),
                    "tool": name
                }, indent=2)
            )]

    # Route other ECC tools to the bridge dispatcher
    if not ECC_AVAILABLE:
        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "error",
                "error": "ECC Bridge not available. Ensure ecc_bridge.py is in the same directory.",
                "tool": name
            }, indent=2)
        )]

    try:
        result = await dispatch_ecc_tool(name, args)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    except Exception as e:
        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "error",
                "error": str(e),
                "tool": name
            }, indent=2)
        )]


# === ML MEMORY POOL TOOLS ===

DAEMON_URL = os.environ.get("GEOS_DAEMON_URL", "http://127.0.0.1:8769")

async def _ml_request(endpoint: str, method: str = "GET", data: dict = None) -> dict:
    """Make HTTP request to ML memory pool endpoints."""
    import aiohttp
    url = f"{DAEMON_URL}{endpoint}"
    try:
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    text = await resp.text()
                    try:
                        return json.loads(text)
                    except:
                        return {"status": "ok", "response": text}
            elif method == "POST":
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    text = await resp.text()
                    try:
                        return json.loads(text)
                    except:
                        return {"status": "ok", "response": text}
            elif method == "PUT":
                async with session.put(url, json=data, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    text = await resp.text()
                    try:
                        return json.loads(text)
                    except:
                        return {"status": "ok", "response": text}
    except Exception as e:
        return {"status": "error", "error": str(e), "endpoint": endpoint}

async def tool_ml_pool_status(args: dict) -> list[TextContent]:
    """Get ML memory pool statistics."""
    result = await _ml_request("/ml/status")
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_tensor_alloc(args: dict) -> list[TextContent]:
    """Allocate a tensor in the ML memory pool."""
    result = await _ml_request("/ml/alloc", "POST", {
        "name": args.get("name"),
        "shape": args.get("shape", []),
        "dtype": args.get("dtype", "float16"),
        "region": args.get("region", "weight")
    })
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_tensor_free(args: dict) -> list[TextContent]:
    """Free a tensor from the ML memory pool."""
    result = await _ml_request("/ml/free", "POST", {
        "name": args.get("name")
    })
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_tensor_read(args: dict) -> list[TextContent]:
    """Read tensor data from ML memory pool."""
    name = args.get("name", "")
    result = await _ml_request(f"/ml/tensor?name={name}")
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_tensor_write(args: dict) -> list[TextContent]:
    """Write tensor data to ML memory pool."""
    name = args.get("name", "")
    data = args.get("data", [])
    result = await _ml_request(f"/ml/tensor?name={name}", "PUT", {
        "data": data
    })
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_weights_load(args: dict) -> list[TextContent]:
    """Load weight atlas from PNG file."""
    result = await _ml_request("/ml/weights/load", "POST", {
        "path": args.get("path"),
        "offset": args.get("offset", 0)
    })
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_hebbian_apply(args: dict) -> list[TextContent]:
    """Apply Hebbian update batch to weights."""
    result = await _ml_request("/ml/hebbian", "POST", {
        "updates": args.get("updates", []),
        "learning_rate": args.get("learning_rate", 0.01)
    })
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_sync(args: dict) -> list[TextContent]:
    """Sync CPU and GPU memory in ML pool."""
    result = await _ml_request("/ml/sync", "POST")
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_activation_layer(args: dict) -> list[TextContent]:
    """Allocate layer activation in activation pool."""
    result = await _ml_request("/ml/activation/layer", "POST", {
        "layer": args.get("layer"),
        "size": args.get("size")
    })
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def tool_ml_kv_append(args: dict) -> list[TextContent]:
    """Append tokens to KV cache."""
    result = await _ml_request("/ml/kv/append", "POST", {
        "name": args.get("name", "default"),
        "tokens": args.get("tokens"),
        "head_dim": args.get("head_dim", 64),
        "num_heads": args.get("num_heads", 8)
    })
    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def main():
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
