#!/usr/bin/env python3
"""
Geometry OS CLI - Direct access to substrate operations.

Usage:
    geos_cli.py crystallize <input.glyph> <output.rts.png>
    geos_cli.py benchmark <glyph_file>
    geos_cli.py boot-sim [--verbose]
    geos_cli.py status
    geos_cli.py hilbert d2xy <index> [--grid-size 4096]
    geos_cli.py hilbert xy2d <x> <y> [--grid-size 4096]
    geos_cli.py glyph-patch --address <addr> --opcode <op> [--stratum <st>] [--p1 <p1>] [--p2 <p2>] [--vm-id <id>]
    geos_cli.py linux-to-glyph --binary <binary> --output <output>
"""

#!/usr/bin/env python3
"""
Geometry OS CLI - Direct access to substrate operations.

Usage:
    geos_cli.py crystallize <input.glyph> <output.rts.png>
    geos_cli.py benchmark <glyph_file>
    geos_cli.py boot-sim [--verbose]
    geos_cli.py status
    geos_cli.py hilbert d2xy <index> [--grid-size 4096]
    geos_cli.py hilbert xy2d <x> <y> [--grid-size 4096]
    geos_cli.py glyph-patch --address <addr> --opcode <op> [--stratum <st>] [--p1 <p1>] [--p2 <p2>] [--vm-id <id>]
    geos_cli.py linux-to-glyph --binary <binary> --output <output>
    geos_cli.py chat [-i] [prompt]
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))
# Add geometry_os root to path for importing from systems/
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from geos_mcp_server import (
    GEOS_ROOT,
    GLYPH_COMPILER,
    hilbert_d2xy,
    hilbert_xy2d,
    calculate_sls,
    parse_glyph_file,
    WINDOW_MANAGER_GLYPH,
    UBUNTU_KERNEL,
    BOOT_SCRIPT,
    DAEMON_URL,
    tool_glyph_patch,
    tool_linux_to_glyph,
    tool_mem_peek,
    tool_mem_poke,
    tool_gpu_write,
    tool_gpu_exec,
    tool_gpu_pause,
    tool_gpu_vmstate,
    tool_daemon_status,
    tool_substrate_load,
    tool_mem_store,
    tool_mem_retrieve,
)
from systems.geos.firmware import (
    crystallize_firmware,
    extract_firmware,
    crystallize_amdgpu_firmware,
)
import requests

# Optional anthropic import for AI chat
try:
    import anthropic
    from anthropic.types import MessageParam
except ImportError:
    anthropic = None
    MessageParam = None  # type: ignore


def cmd_crystallize(args):
    """Compile .glyph to .rts.png"""
    import subprocess

    input_path = Path(args.input)
    output_path = Path(args.output)
    dense = args.dense

    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        return 1

    print(f"Crystallizing {input_path}...")

    cmd = [sys.executable, str(GLYPH_COMPILER), str(input_path), str(output_path)]
    if dense:
        cmd.append("--dense")

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(GEOS_ROOT))

    if result.returncode != 0:
        print(f"Compilation failed:\n{result.stderr}")
        return 1

    output_size = output_path.stat().st_size if output_path.exists() else 0
    print(f"✓ Compiled to {output_path} ({output_size} bytes)")

    if result.stdout.strip():
        print(result.stdout)

    return 0


def cmd_benchmark(args):
    """Benchmark Spatial Locality Score"""
    glyph_file = Path(args.glyph_file)
    grid_size = args.grid_size

    if not glyph_file.exists():
        print(f"Error: Glyph file not found: {glyph_file}")
        return 1

    print(f"Benchmarking {glyph_file}...")

    instructions = parse_glyph_file(str(glyph_file))
    sls = calculate_sls(instructions, grid_size)

    # Stratum distribution
    stratum_names = {0: "SUBSTRATE", 1: "MEMORY", 2: "LOGIC", 3: "SPEC", 4: "INTENT"}
    stratum_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    for op, st, p1, p2 in instructions:
        if st in stratum_counts:
            stratum_counts[st] += 1

    print(f"\n{'=' * 50}")
    print(f"  Spatial Locality Score: {sls:.4f}")
    print(f"  Target: 0.0000")
    print(f"  Status: {'✓ PASS' if sls >= 0.90 else '✗ FAIL'}")
    print(f"{'=' * 50}")
    print(f"\nInstruction Count: {len(instructions)}")
    print(f"Grid Size: {grid_size}x{grid_size}")
    print(f"\nStratum Distribution:")
    for st, count in stratum_counts.items():
        if count > 0:
            pct = (count / len(instructions)) * 100
            print(f"  {stratum_names[st]:12} {count:5} ({pct:5.1f}%)")

    # Recommendation
    if sls < 0.70:
        print("\n⚠ CRITICAL: SLS below 0.70. Consider Warp-Interleaved Mapping.")
    elif sls < 0.85:
        print("\n⚠ WARNING: SLS below target. Review instruction ordering.")
    elif sls < 0.90:
        print("\n⚡ CLOSE: Near target. Minor optimizations may help.")
    else:
        print("\n✓ OPTIMAL: SLS target achieved.")

    return 0


def cmd_boot_sim(args):
    """Simulate boot chain"""
    verbose = args.verbose

    print("\n" + "=" * 60)
    print("  Geometry OS Boot Chain Simulation")
    print("=" * 60 + "\n")

    stages = []

    # Stage 1: UEFI
    bootloader = GEOS_ROOT / "bootloader" / "efi" / "boot.c"
    if bootloader.exists():
        print("[1] UEFI Bootloader")
        print(f"    File: {bootloader.relative_to(GEOS_ROOT)}")
        print("    Status: ✓ PRESENT")
        if verbose:
            print("    Actions:")
            print("      - Find AMD GPU on PCI bus")
            print("      - Map GPU MMIO (BAR0)")
            print("      - Allocate glyph memory")
            print("      - Load kernel and glyphs")
        stages.append(True)
    else:
        print("[1] UEFI Bootloader: ✗ MISSING")
        stages.append(False)

    # Stage 2: Kernel
    kernel = GEOS_ROOT / "kernel" / "geos" / "main.c"
    if kernel.exists():
        print("\n[2] Geometry OS Kernel")
        print(f"    File: {kernel.relative_to(GEOS_ROOT)}")
        print("    Status: ✓ PRESENT")
        stages.append(True)
    else:
        print("\n[2] Geometry OS Kernel: ✗ MISSING")
        stages.append(False)

    # Stage 3: Window Manager
    if WINDOW_MANAGER_GLYPH.exists():
        print("\n[3] Window Manager Glyph")
        print(f"    File: {WINDOW_MANAGER_GLYPH.relative_to(GEOS_ROOT)}")
        print("    Status: ✓ PRESENT")
        stages.append(True)
    else:
        print("\n[3] Window Manager Glyph: ✗ MISSING")
        stages.append(False)

    # Stage 4: Ubuntu kernel
    if UBUNTU_KERNEL.exists():
        print("\n[4] Ubuntu Kernel (Transpiled)")
        print(f"    File: {UBUNTU_KERNEL.relative_to(GEOS_ROOT)}")
        print("    Status: ✓ PRESENT")
    else:
        print("\n[4] Ubuntu Kernel (Transpiled): ⚠ OPTIONAL (not found)")

    # Stage 5: Boot script
    if BOOT_SCRIPT.exists():
        print("\n[5] Boot Chain Builder")
        print(f"    File: {BOOT_SCRIPT.relative_to(GEOS_ROOT)}")
        print("    Status: ✓ PRESENT")
        stages.append(True)
    else:
        print("\n[5] Boot Chain Builder: ✗ MISSING")
        stages.append(False)

    # Summary
    ready = all(stages[:3])  # First 3 are critical
    print("\n" + "=" * 60)
    if ready:
        print("  Boot Chain: ✓ READY")
        print("  Next: Flash to USB and boot on AMD hardware")
    else:
        print("  Boot Chain: ✗ NOT READY")
        print("  Fix missing components above")
    print("=" * 60 + "\n")

    return 0 if ready else 1


def cmd_status(args):
    """Show Geometry OS status"""
    print("\n" + "=" * 60)
    print("  Geometry OS Status")
    print("=" * 60)
    print(f"\nRoot: {GEOS_ROOT}")

    checks = [
        ("Glyph Compiler", GLYPH_COMPILER),
        ("Window Manager", WINDOW_MANAGER_GLYPH),
        ("Ubuntu Kernel", UBUNTU_KERNEL),
        ("Boot Script", BOOT_SCRIPT),
        ("UEFI Bootloader", GEOS_ROOT / "bootloader" / "efi" / "boot.c"),
        ("Bare Metal Kernel", GEOS_ROOT / "kernel" / "geos" / "main.c"),
    ]

    print("\nComponents:")
    for name, path in checks:
        status = "✓" if path.exists() else "✗"
        rel_path = path.relative_to(GEOS_ROOT) if path.exists() else path
        print(f"  {status} {name}: {rel_path}")

    present = sum(1 for _, p in checks if p.exists())
    print(f"\nTotal: {present}/{len(checks)} components present")

    return 0


def cmd_hilbert(args):
    """Hilbert curve operations"""
    grid_size = args.grid_size

    if args.operation == "d2xy":
        index = args.index
        x, y = hilbert_d2xy(grid_size, index)
        print(f"Hilbert index {index} → ({x}, {y}) on {grid_size}x{grid_size} grid")
    elif args.operation == "xy2d":
        x, y = args.x, args.y
        d = hilbert_xy2d(grid_size, x, y)
        print(f"({x}, {y}) → Hilbert index {d} on {grid_size}x{grid_size} grid")

    return 0


def cmd_glyph_patch(args):
    """Hot-patch glyph instruction"""
    result = asyncio.run(
        tool_glyph_patch(
            {
                "address": args.address,
                "opcode": args.opcode,
                "stratum": args.stratum,
                "p1": args.p1,
                "p2": args.p2,
                "vm_id": args.vm_id,
            }
        )
    )
    print(result[0].text)
    return 0


def cmd_linux_to_glyph(args):
    """Transpile Linux ELF to glyph"""
    result = asyncio.run(
        tool_linux_to_glyph({"binary": args.binary, "output": args.output, "dense": args.dense})
    )
    print(result[0].text)
    return 0


def cmd_firmware(args):
    """Crystallize firmware blobs into RTS textures"""
    if args.operation == "crystallize":
        result = crystallize_firmware(args.firmware, args.output, args.name)
        print(f"✓ Crystallized: {result.name}")
        print(f"  Size: {result.original_size} bytes")
        print(f"  Grid: {result.grid_size}x{result.grid_size}")
        print(f"  Checksum: {result.checksum}")
        print(f"  Output: {result.texture_path}")
        return 0

    elif args.operation == "extract":
        data, meta = extract_firmware(args.texture, args.output)
        print(f"✓ Extracted: {meta.name}")
        print(f"  Size: {len(data)} bytes")
        print(f"  Checksum: {meta.checksum}")
        if args.output:
            print(f"  Output: {args.output}")
        return 0

    elif args.operation == "batch-amd":
        output_dir = args.output_dir or str(GEOS_ROOT / "kernel" / "firmware")
        results = crystallize_amdgpu_firmware(args.firmware_dir, output_dir)
        print(f"\n✓ Crystallized {len(results)} firmware blobs to {output_dir}")
        return 0

    return 1


# ============================================================================
# GPU Daemon Commands
# ============================================================================


def cmd_daemon_status(args):
    """Check daemon status"""
    result = asyncio.run(tool_daemon_status({}))
    print(result[0].text)
    return 0


def cmd_peek(args):
    """Read GPU memory"""
    result = asyncio.run(tool_mem_peek({"addr": args.addr, "size": args.size}))
    print(result[0].text)
    return 0


def cmd_poke(args):
    """Write to GPU memory"""
    result = asyncio.run(tool_mem_poke({"addr": args.addr, "val": args.val}))
    print(result[0].text)
    return 0


def cmd_gpu_write(args):
    """Batch write to GPU memory"""
    result = asyncio.run(tool_gpu_write({"addr": args.addr, "data": args.data}))
    print(result[0].text)
    return 0


def cmd_gpu_exec(args):
    """Execute command via daemon"""
    result = asyncio.run(tool_gpu_exec({"cmd": args.cmd, "cwd": args.cwd, "timeout": args.timeout}))
    print(result[0].text)
    return 0


def cmd_gpu_pause(args):
    """Pause all VMs"""
    result = asyncio.run(tool_gpu_pause({}))
    print(result[0].text)
    return 0


def cmd_gpu_vmstate(args):
    """Query VM state"""
    result = asyncio.run(tool_gpu_vmstate({"vm": args.vm}))
    print(result[0].text)
    return 0


def cmd_substrate_load(args):
    """Load substrate to daemon"""
    result = asyncio.run(tool_substrate_load({"rts_file": args.rts_file}))
    print(result[0].text)
    return 0


def cmd_wasm_load(args):
    """Load WASM binary to daemon at specified address"""
    wasm_path = Path(args.wasm_file)
    if not wasm_path.exists():
        print(f"Error: WASM file not found: {wasm_path}")
        return 1

    wasm_bytes = wasm_path.read_bytes()
    addr = args.base

    print(f"Loading {wasm_path} ({len(wasm_bytes)} bytes) to 0x{addr:x}...")

    # POST to /load?binary=0xADDR
    try:
        response = requests.post(
            f"{DAEMON_URL}/load?binary=0x{addr:x}",
            data=wasm_bytes,
            timeout=30,
        )
        if response.status_code == 200:
            print(f"✓ {response.text.strip()}")
            return 0
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_wasm_run(args):
    """Set WASM interpreter entry point and optionally read result"""
    entry = args.entry

    # Set WASM_IP to entry point
    print(f"Setting entry point to 0x{entry:x}...")

    try:
        # Poke the entry point address
        response = requests.get(
            f"{DAEMON_URL}/poke",
            params={"addr": f"0x30004", "value": f"0x{entry:x}"},
            timeout=10,
        )
        if response.status_code != 200:
            print(f"Error setting IP: {response.text}")
            return 1

        # Set WASM_STATUS to 1 (running)
        response = requests.get(
            f"{DAEMON_URL}/poke",
            params={"addr": "0x3000C", "value": "0x1"},
            timeout=10,
        )
        if response.status_code != 200:
            print(f"Error setting status: {response.text}")
            return 1

        print("✓ WASM interpreter started")

        if args.read_result:
            import time
            time.sleep(0.5)  # Brief wait for execution

            # Read result from WASM memory
            response = requests.get(
                f"{DAEMON_URL}/read",
                params={"addr": "0x20000", "len": args.read_len},
                timeout=10,
            )
            if response.status_code == 200:
                print(f"Result: {response.text.strip()}")
            else:
                print(f"Error reading result: {response.text}")

        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_chat(args):
    """Interactive AI-assisted substrate control"""
    import os
    import sys
    import json as json_module

    # Check which API to use (Z.ai or Anthropic)
    zai_api_key = os.environ.get("ZAI_API_KEY")
    zai_base_url = os.environ.get("ZAI_BASE_URL", "https://api.z.ai/api/coding/paas/v4")

    if zai_api_key:
        # Use Z.ai API (OpenAI-compatible)
        use_zai = True
        api_key = zai_api_key
        base_url = zai_base_url
        print(f"Using Z.ai API at {base_url}")
    elif os.environ.get("ANTHROPIC_API_KEY"):
        # Use Anthropic API
        use_zai = False
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if anthropic is None:
            print("Error: anthropic package not installed")
            print("Install it with: pip install anthropic")
            return 1
        client = anthropic.Anthropic(api_key=api_key)
        print("Using Anthropic Claude API")
    else:
        print("Error: No API key found")
        print("Set ZAI_API_KEY (and optionally ZAI_BASE_URL) for Z.ai API")
        print("Or set ANTHROPIC_API_KEY for Anthropic API")
        return 1

    # Define tools (shared between APIs)
    tools_anthropic = [
        {
            "name": "mem_peek",
            "description": "Read GPU memory at address",
            "input_schema": {
                "type": "object",
                "properties": {
                    "addr": {"type": "string", "description": "Memory address in hex (e.g., 0x1000)"},
                    "size": {"type": "integer", "description": "Number of 32-bit words to read", "default": 16},
                },
                "required": ["addr"],
            },
        },
        {
            "name": "mem_poke",
            "description": "Write value to GPU memory",
            "input_schema": {
                "type": "object",
                "properties": {
                    "addr": {"type": "string", "description": "Memory address in hex"},
                    "val": {"type": "string", "description": "Value to write in hex"},
                },
                "required": ["addr", "val"],
            },
        },
        {
            "name": "gpu_write",
            "description": "Batch write values to GPU memory",
            "input_schema": {
                "type": "object",
                "properties": {
                    "addr": {"type": "string", "description": "Starting address in hex"},
                    "data": {"type": "array", "items": {"type": "integer"}, "description": "List of 32-bit values to write"},
                },
                "required": ["addr", "data"],
            },
        },
        {
            "name": "gpu_exec",
            "description": "Execute shell command via daemon",
            "input_schema": {
                "type": "object",
                "properties": {
                    "cmd": {"type": "string", "description": "Shell command to execute"},
                    "cwd": {"type": "string", "description": "Working directory"},
                    "timeout": {"type": "integer", "description": "Timeout in seconds", "default": 30},
                },
                "required": ["cmd"],
            },
        },
        {
            "name": "gpu_pause",
            "description": "Pause all GPU VMs",
            "input_schema": {"type": "object", "properties": {}},
        },
        {
            "name": "gpu_vmstate",
            "description": "Query VM state",
            "input_schema": {
                "type": "object",
                "properties": {"vm": {"type": "integer", "description": "VM ID (0-7)", "default": 0}},
            },
        },
        {
            "name": "substrate_load",
            "description": "Load .rts.png firmware to daemon",
            "input_schema": {
                "type": "object",
                "properties": {"rts_file": {"type": "string", "description": "Path to .rts.png file"}},
                "required": ["rts_file"],
            },
        },
        {
            "name": "daemon_status",
            "description": "Check daemon health",
            "input_schema": {"type": "object", "properties": {}},
        },
        {
            "name": "mem_store",
            "description": "Store persistent data in GPU memory",
            "input_schema": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Storage key"},
                    "value": {"type": "object", "description": "JSON-serializable value"},
                },
                "required": ["key", "value"],
            },
        },
        {
            "name": "mem_retrieve",
            "description": "Retrieve persistent data from GPU memory",
            "input_schema": {
                "type": "object",
                "properties": {"key": {"type": "string", "description": "Storage key"}},
                "required": ["key"],
            },
        },
    ]

    # Convert to OpenAI format for Z.ai
    tools_openai = []
    for t in tools_anthropic:
        tools_openai.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            }
        })

    def call_zai_api(messages):
        """Call Z.ai API (OpenAI-compatible)"""
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "glm-4.6",  # Z.ai GLM model
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "tools": tools_openai,
            "max_tokens": 1000,
        }
        response = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    def process_zai_response(response_json):
        """Process Z.ai API response and return (text, tool_calls)"""
        choice = response_json["choices"][0]
        message = choice["message"]
        text_content = message.get("content", "")
        tool_calls = []
        if message.get("tool_calls"):
            for tc in message["tool_calls"]:
                tool_calls.append({
                    "id": tc["id"],
                    "name": tc["function"]["name"],
                    "input": json_module.loads(tc["function"]["arguments"]),
                })
        return text_content, tool_calls

    # System prompt describing available tools
    system_prompt = """You are an AI assistant for Geometry OS GPU substrate control.
    You have access to these tools to interact with the GPU daemon at http://127.0.0.1:8769:
    - mem_peek(addr, size): Read GPU memory at address (hex) for size words
    - mem_poke(addr, val): Write value (hex) to GPU memory at address (hex)
    - gpu_write(addr, data): Batch write list of values to GPU memory starting at address
    - gpu_exec(cmd, cwd, timeout): Execute shell command via daemon
    - gpu_pause(): Pause all GPU VMs
    - gpu_vmstate(vm): Query VM state (vm ID 0-7)
    - substrate_load(rts_file): Load .rts.png firmware to daemon
    - daemon_status(): Check daemon health
    - mem_store(key, value): Store persistent data in GPU memory
    - mem_retrieve(key): Retrieve persistent data from GPU memory
    
    All addresses are 32-bit hex values (e.g., 0x1000). Size is number of 32-bit words.
    When users ask questions, use the appropriate tools to gather information, then provide
    a clear, concise answer based on the results."""

    # Prepare conversation history
    history = []
    if args.interactive:
        # Try to load history from daemon storage
        try:
            result = asyncio.run(tool_mem_retrieve({"key": "chat_history"}))
            if result and len(result) > 0 and result[0].type == "text":
                import json

                history = json.loads(result[0].text)
        except Exception:
            pass  # No history yet

    def execute_tool_call(tool_call):
        """Execute a tool call and return result"""
        # Handle both dict (Z.ai) and object (Anthropic) tool calls
        if isinstance(tool_call, dict):
            name = tool_call["name"]
            input_data = tool_call["input"]
        else:
            name = tool_call.name
            input_data = tool_call.input

        # Map tool names to functions
        tool_map = {
            "mem_peek": tool_mem_peek,
            "mem_poke": tool_mem_poke,
            "gpu_write": tool_gpu_write,
            "gpu_exec": tool_gpu_exec,
            "gpu_pause": tool_gpu_pause,
            "gpu_vmstate": tool_gpu_vmstate,
            "substrate_load": tool_substrate_load,
            "daemon_status": tool_daemon_status,
            "mem_store": tool_mem_store,
            "mem_retrieve": tool_mem_retrieve,
            "mem_store": tool_mem_store,  # alias
            "mem_retrieve": tool_mem_retrieve,  # alias
        }

        if name not in tool_map:
            return f"Error: Unknown tool {name}"

        try:
            # Call the tool function
            result = asyncio.run(tool_map[name](input_data))
            if result and len(result) > 0:
                return result[0].text
            return "Tool executed with no output"
        except Exception as e:
            return f"Error executing {name}: {str(e)}"

    def save_history():
        """Save conversation history to daemon"""
        if args.interactive and history:
            try:
                asyncio.run(tool_mem_store({"key": "chat_history", "value": history}))
            except Exception:
                pass  # Failed to save history

    if args.interactive:
        # Interactive REPL mode
        print("Geometry OS AI Chat - Type 'exit' or 'quit' to end")
        print("Daemon URL: http://127.0.0.1:8769")
        print("-" * 50)

        while True:
            try:
                user_input = input("\nYou: ").strip()
                if user_input.lower() in ["exit", "quit"]:
                    print("Goodbye!")
                    save_history()
                    break
                if not user_input:
                    continue

                # Add user message to history
                history.append({"role": "user", "content": user_input})

                # Call Claude with tools
                # Convert history to proper MessageParam types
                claude_messages = []
                for msg in history:
                    if isinstance(msg, dict) and "role" in msg and "content" in msg:
                        claude_messages.append({"role": msg["role"], "content": msg["content"]})

                message = client.messages.create(
                    model="claude-sonnet-4-20240514",
                    max_tokens=1000,
                    system=system_prompt,
                    messages=claude_messages,  # type: ignore
                    tools=[
                        {
                            "name": "mem_peek",
                            "description": "Read GPU memory at address",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "addr": {
                                        "type": "string",
                                        "description": "Memory address in hex (e.g., 0x1000)",
                                    },
                                    "size": {
                                        "type": "integer",
                                        "description": "Number of 32-bit words to read",
                                        "default": 16,
                                    },
                                },
                                "required": ["addr"],
                            },
                        },
                        {
                            "name": "mem_poke",
                            "description": "Write value to GPU memory",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "addr": {
                                        "type": "string",
                                        "description": "Memory address in hex",
                                    },
                                    "val": {
                                        "type": "string",
                                        "description": "Value to write in hex",
                                    },
                                },
                                "required": ["addr", "val"],
                            },
                        },
                        {
                            "name": "gpu_write",
                            "description": "Batch write values to GPU memory",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "addr": {
                                        "type": "string",
                                        "description": "Starting address in hex",
                                    },
                                    "data": {
                                        "type": "array",
                                        "items": {"type": "integer"},
                                        "description": "List of 32-bit values to write",
                                    },
                                },
                                "required": ["addr", "data"],
                            },
                        },
                        {
                            "name": "gpu_exec",
                            "description": "Execute shell command via daemon",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "cmd": {
                                        "type": "string",
                                        "description": "Shell command to execute",
                                    },
                                    "cwd": {"type": "string", "description": "Working directory"},
                                    "timeout": {
                                        "type": "integer",
                                        "description": "Timeout in seconds",
                                        "default": 30,
                                    },
                                },
                                "required": ["cmd"],
                            },
                        },
                        {
                            "name": "gpu_pause",
                            "description": "Pause all GPU VMs",
                            "input_schema": {"type": "object", "properties": {}},
                        },
                        {
                            "name": "gpu_vmstate",
                            "description": "Query VM state",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "vm": {
                                        "type": "integer",
                                        "description": "VM ID (0-7)",
                                        "default": 0,
                                    }
                                },
                            },
                        },
                        {
                            "name": "substrate_load",
                            "description": "Load .rts.png firmware to daemon",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "rts_file": {
                                        "type": "string",
                                        "description": "Path to .rts.png file",
                                    }
                                },
                                "required": ["rts_file"],
                            },
                        },
                        {
                            "name": "daemon_status",
                            "description": "Check daemon health",
                            "input_schema": {"type": "object", "properties": {}},
                        },
                        {
                            "name": "mem_store",
                            "description": "Store persistent data in GPU memory",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "key": {"type": "string", "description": "Storage key"},
                                    "value": {
                                        "type": "object",
                                        "description": "JSON-serializable value",
                                    },
                                },
                                "required": ["key", "value"],
                            },
                        },
                        {
                            "name": "mem_retrieve",
                            "description": "Retrieve persistent data from GPU memory",
                            "input_schema": {
                                "type": "object",
                                "properties": {
                                    "key": {"type": "string", "description": "Storage key"}
                                },
                                "required": ["key"],
                            },
                        },
                    ],
                )

                # Process Claude's response
                assistant_message = {"role": "assistant", "content": []}
                tool_results = []

                for block in message.content:
                    if block.type == "text":
                        assistant_message["content"].append({"type": "text", "text": block.text})
                        print(f"\nClaude: {block.text}")
                    elif block.type == "tool_use":
                        assistant_message["content"].append(
                            {
                                "type": "tool_use",
                                "id": block.id,
                                "name": block.name,
                                "input": block.input,
                            }
                        )

                        # Execute the tool
                        result_text = execute_tool_call(block)
                        tool_results.append(
                            {"type": "tool_result", "tool_use_id": block.id, "content": result_text}
                        )

                # Add assistant message to history
                history.append(assistant_message)

                # Add tool results to history if any
                if tool_results:
                    history.append({"role": "user", "content": tool_results})

            except KeyboardInterrupt:
                print("\nGoodbye!")
                save_history()
                break
            except Exception as e:
                print(f"\nError: {e}")
                save_history()
                break

    else:
        # Single-shot mode
        if not args.prompt:
            print("Error: Please provide a prompt for single-shot mode")
            return 1

        # Add user message
        messages = [{"role": "user", "content": args.prompt}]

        try:
            if use_zai:
                # Z.ai API (OpenAI-compatible)
                response_json = call_zai_api(messages)
                text_content, tool_calls = process_zai_response(response_json)

                if text_content:
                    print(f"\nAI: {text_content}")

                # Execute tool calls
                for tc in tool_calls:
                    result_text = execute_tool_call(tc)
                    print(f"[Tool {tc['name']}: {result_text}]")
            else:
                # Anthropic API
                message = client.messages.create(
                    model="claude-sonnet-4-20240514",
                    max_tokens=1000,
                    system=system_prompt,
                    messages=messages,  # type: ignore
                    tools=tools_anthropic,
                )

                for block in message.content:
                    if block.type == "text":
                        print(f"\nClaude: {block.text}")
                    elif block.type == "tool_use":
                        result_text = execute_tool_call(block)
                        print(f"[Tool {block.name}: {result_text}]")

        except Exception as e:
            print(f"Error: {e}")
            return 1

    return 0


def main():
    parser = argparse.ArgumentParser(description="Geometry OS CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command")

    # crystallize
    crystal = subparsers.add_parser("crystallize", help="Compile .glyph to .rts.png")
    crystal.add_argument("input", help="Input .glyph file")
    crystal.add_argument("output", help="Output .rts.png file")
    crystal.add_argument("--dense", action="store_true", help="Enable dense packing")
    crystal.set_defaults(func=cmd_crystallize)

    # linux-to-glyph
    l2g = subparsers.add_parser("linux-to-glyph", help="Transpile Linux ELF to glyph texture")
    l2g.add_argument("binary", help="Input RISC-V ELF binary")
    l2g.add_argument("output", help="Output .rts.png file")
    l2g.add_argument("--dense", action="store_true", help="Enable dense packing")
    l2g.set_defaults(func=cmd_linux_to_glyph)

    # glyph-patch
    patch = subparsers.add_parser("glyph-patch", help="Hot-patch glyph instruction in VRAM")
    patch.add_argument("--address", required=True, help="Hilbert index or hex address")
    patch.add_argument("--opcode", type=int, required=True, help="New opcode (R channel)")
    patch.add_argument("--stratum", type=int, default=0, help="Stratum (G channel)")
    patch.add_argument("--p1", type=int, default=0, help="Param 1 (B channel)")
    patch.add_argument("--p2", type=int, default=0, help="Param 2 (A channel)")
    patch.add_argument("--vm-id", type=int, default=0, help="VM ID to patch")
    patch.set_defaults(func=cmd_glyph_patch)

    # benchmark
    bench = subparsers.add_parser("benchmark", help="Benchmark Spatial Locality Score")
    bench.add_argument("glyph_file", help=".glyph file to analyze")
    bench.add_argument("--grid-size", type=int, default=4096, help="Grid size")
    bench.set_defaults(func=cmd_benchmark)

    # boot-sim
    boot = subparsers.add_parser("boot-sim", help="Simulate boot chain")
    boot.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    boot.set_defaults(func=cmd_boot_sim)

    # status
    status = subparsers.add_parser("status", help="Show Geometry OS status")
    status.set_defaults(func=cmd_status)

    # hilbert
    hilbert = subparsers.add_parser("hilbert", help="Hilbert curve operations")
    hilbert.add_argument("operation", choices=["d2xy", "xy2d"], help="Conversion direction")
    hilbert.add_argument("--index", type=int, help="Hilbert index (for d2xy)")
    hilbert.add_argument("--x", type=int, help="X coordinate (for xy2d)")
    hilbert.add_argument("--y", type=int, help="Y coordinate (for xy2d)")
    hilbert.add_argument("--grid-size", type=int, default=4096, help="Grid size")
    hilbert.set_defaults(func=cmd_hilbert)

    # firmware
    firmware = subparsers.add_parser(
        "firmware", help="Crystallize firmware blobs into RTS textures"
    )
    firmware.add_argument(
        "operation",
        choices=["crystallize", "extract", "batch-amd"],
        help="Operation: crystallize, extract, or batch-amd",
    )
    firmware.add_argument("--firmware", "-f", help="Input firmware .bin file")
    firmware.add_argument("--texture", "-t", help="Input .rts.png texture (for extract)")
    firmware.add_argument("--output", "-o", help="Output file path")
    firmware.add_argument("--name", "-n", help="Friendly name for firmware")
    firmware.add_argument(
        "--firmware-dir",
        default="/lib/firmware/amdgpu",
        help="Directory containing AMD firmware files",
    )
    firmware.add_argument("--output-dir", help="Output directory for batch-amd")
    firmware.set_defaults(func=cmd_firmware)

    # === GPU Daemon Commands ===

    # daemon-status
    ds = subparsers.add_parser("daemon-status", help="Check Ouroboros daemon status")
    ds.set_defaults(func=cmd_daemon_status)

    # peek
    peek = subparsers.add_parser("peek", help="Read GPU memory at address")
    peek.add_argument("addr", help="Hilbert address (hex, e.g. 0x100000)")
    peek.add_argument("--size", "-s", type=int, default=16, help="Number of words to read")
    peek.set_defaults(func=cmd_peek)

    # poke
    poke = subparsers.add_parser("poke", help="Write value to GPU memory")
    poke.add_argument("addr", help="Hilbert address (hex)")
    poke.add_argument("val", help="Value to write (hex)")
    poke.set_defaults(func=cmd_poke)

    # gpu-write
    gw = subparsers.add_parser("gpu-write", help="Batch write values to GPU memory")
    gw.add_argument("addr", help="Starting address (hex)")
    gw.add_argument("data", nargs="+", type=int, help="Values to write (space-separated integers)")
    gw.set_defaults(func=cmd_gpu_write)

    # gpu-exec
    ge = subparsers.add_parser("gpu-exec", help="Execute shell command via daemon")
    ge.add_argument("cmd", help="Shell command to execute")
    ge.add_argument("--cwd", "-c", help="Working directory")
    ge.add_argument("--timeout", "-t", type=int, default=30, help="Timeout in seconds")
    ge.set_defaults(func=cmd_gpu_exec)

    # gpu-pause
    gp = subparsers.add_parser("gpu-pause", help="Pause all GPU VMs")
    gp.set_defaults(func=cmd_gpu_pause)

    # gpu-vmstate
    gv = subparsers.add_parser("gpu-vmstate", help="Query VM state")
    gv.add_argument("--vm", "-v", type=int, default=0, help="VM ID (0-7)")
    gv.set_defaults(func=cmd_gpu_vmstate)

    # substrate-load
    sl = subparsers.add_parser("substrate-load", help="Load .rts.png to daemon")
    sl.add_argument("rts_file", help="Path to .rts.png file")
    sl.set_defaults(func=cmd_substrate_load)

    # wasm-load
    wl = subparsers.add_parser("wasm-load", help="Load WASM binary to GPU daemon")
    wl.add_argument("wasm_file", help="Path to .wasm file")
    wl.add_argument("--base", "-b", type=lambda x: int(x, 0), default=0x20000,
                    help="Base address in hex (default: 0x20000)")
    wl.set_defaults(func=cmd_wasm_load)

    # wasm-run
    wr = subparsers.add_parser("wasm-run", help="Run WASM program on interpreter")
    wr.add_argument("--entry", "-e", type=lambda x: int(x, 0), default=0x20000,
                    help="Entry point address (default: 0x20000)")
    wr.add_argument("--read-result", "-r", action="store_true",
                    help="Read result from memory after execution")
    wr.add_argument("--read-len", "-l", type=int, default=64,
                    help="Bytes to read for result (default: 64)")
    wr.set_defaults(func=cmd_wasm_run)

    # chat
    chat = subparsers.add_parser("chat", help="AI-assisted substrate control")
    chat.add_argument("prompt", nargs="?", help="Prompt for single-shot mode")
    chat.add_argument("-i", "--interactive", action="store_true", help="Interactive REPL mode")
    chat.set_defaults(func=cmd_chat)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
