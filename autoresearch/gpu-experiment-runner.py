#!/usr/bin/env python3
"""
GPU Experiment Runner for AutoResearch

Compiles ASCII experiment specs to GPU opcodes and executes on WebGPU.
Measures performance and reports results to pxOS dashboard.

Usage:
    python3 gpu-experiment-runner.py run spec.ascii
    python3 gpu-experiment-runner.py benchmark
    python3 gpu-experiment-runner.py compile spec.ascii
"""

import subprocess
import sys
import json
import time
from pathlib import Path

PXOS_PATH = Path(__file__).parent.parent
GPU_TEST_URL = "http://localhost:8081/apps/gpu-test/gpu-executor-test.html"

# Opcode definitions (must match cartridge_executor.wgsl)
OP = {
    "NOP": 140, "DATA": 128, "LD": 204, "ADD": 142, "SUB": 143,
    "TOGGLE": 3, "SET": 6, "CLEAR": 7, "INC": 8, "DEC": 9,
    "AND": 220, "OR": 221, "XOR": 222, "NOT": 223,
    "MOV": 206, "JZ": 209, "JMP": 208, "HALT": 141,
}


def parse_spec(spec_path: str) -> dict:
    """Parse ASCII spec file."""
    import re
    content = Path(spec_path).read_text()
    spec = {}

    for line in content.split("\n"):
        line = line.strip().rstrip("│║ ")
        match = re.search(r"([HTMB]):\s*(.+)", line)
        if match:
            spec[match.group(1)] = match.group(2).strip()

    return spec


def compile_to_gpu_opcodes(spec: dict) -> bytes:
    """
    Compile experiment spec to GPU opcode texture (SIT).

    Returns RGBA bytes where:
    - R = opcode
    - G = target slot
    - B = flags/immediate value
    - A = unused
    """
    # Create 80x24 grid (standard terminal size)
    GRID_W, GRID_H = 80, 24
    sit_data = bytearray(GRID_W * GRID_H * 4)

    hypothesis = spec.get("H", "").lower()
    target = spec.get("T", "")

    # Default: simple INC counter at position (40, 12)
    # This is a placeholder - real implementation would parse the hypothesis
    # and generate appropriate opcodes

    # Place INC opcode at center
    x, y = 40, 12
    idx = (y * GRID_W + x) * 4
    sit_data[idx] = OP["INC"]      # R: opcode
    sit_data[idx + 1] = 0          # G: target slot 0
    sit_data[idx + 2] = 0          # B: flags
    sit_data[idx + 3] = 0          # A: unused

    # Place another INC at (41, 12) for slot 1
    idx2 = (y * GRID_W + 41) * 4
    sit_data[idx2] = OP["INC"]
    sit_data[idx2 + 1] = 1
    sit_data[idx2 + 2] = 0
    sit_data[idx2 + 3] = 0

    return bytes(sit_data)


def run_gpu_benchmark(iterations: int = 100) -> dict:
    """
    Run GPU benchmark via curl to the test page's API endpoint.

    Returns ops/sec measurement.
    """
    # Post to pxOS which triggers GPU benchmark
    # For now, return the last known benchmark result from pxOS
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:3839/api/v1/cells"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        cells = json.loads(result.stdout)
        ops_sec = cells.get("gpu_ops_sec", 0)
        return {
            "ops_sec": ops_sec,
            "backend": "WebGPU",
            "status": "OK" if ops_sec > 0 else "NO_DATA"
        }
    except Exception as e:
        return {
            "ops_sec": 0,
            "backend": "WebGPU",
            "status": "ERROR",
            "error": str(e)
        }


def trigger_gpu_benchmark_via_pxos() -> dict:
    """
    Trigger a GPU benchmark by posting a command to pxOS.

    This causes the GPU test page to run a benchmark and report results.
    """
    # Post a benchmark trigger to pxOS
    payload = {
        "gpu_benchmark_trigger": True,
        "gpu_benchmark_time": time.time(),
    }

    try:
        result = subprocess.run(
            ["curl", "-s", "-X", "POST",
             "http://localhost:3839/api/v1/cells",
             "-H", "Content-Type: application/json",
             "-d", json.dumps(payload)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return {"status": "triggered", "response": result.stdout}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def run_gpu_experiment(spec_path: str) -> dict:
    """
    Run an experiment on GPU.

    1. Compile spec to GPU opcodes
    2. Execute on GPU
    3. Measure performance
    4. Return results
    """
    spec = parse_spec(spec_path)

    print("┌" + "─" * 50 + "┐")
    print("│ " + "GPU EXPERIMENT".ljust(48) + " │")
    print("├" + "─" * 50 + "┤")
    print(f"│ H: {spec.get('H', '')[:44]:<44} │")
    print(f"│ T: {spec.get('T', '')[:44]:<44} │")
    print(f"│ M: {spec.get('M', '')[:44]:<44} │")
    print(f"│ B: {spec.get('B', ''):<48} │")
    print("└" + "─" * 50 + "┘")

    # Step 1: Compile to GPU opcodes
    print("\n▶ Compiling to GPU opcodes...")
    sit_data = compile_to_gpu_opcodes(spec)
    print(f"  Generated {len(sit_data)} bytes of SIT data (80x24 grid)")

    # Step 2: Save SIT data for GPU test page to load
    sit_path = PXOS_PATH / ".autoresearch" / "current_sit.bin"
    sit_path.parent.mkdir(exist_ok=True)
    sit_path.write_bytes(sit_data)
    print(f"  Saved to {sit_path}")

    # Step 3: Trigger GPU benchmark
    print("\n▶ Triggering GPU execution...")
    trigger_result = trigger_gpu_benchmark_via_pxos()
    print(f"  Trigger status: {trigger_result['status']}")

    # Step 4: Wait for results
    print("\n▶ Waiting for GPU results...")
    time.sleep(2)  # Give GPU time to execute

    # Step 5: Get benchmark results
    print("\n▶ Reading benchmark results...")
    benchmark = run_gpu_benchmark()

    print(f"  GPU ops/sec: {benchmark['ops_sec']:,}")
    print(f"  Backend: {benchmark['backend']}")
    print(f"  Status: {benchmark['status']}")

    return {
        "spec": spec,
        "benchmark": benchmark,
        "sit_path": str(sit_path),
        "timestamp": time.time(),
    }


def show_status():
    """Show GPU experiment status."""
    print("┌" + "─" * 50 + "┐")
    print("│ " + "GPU EXPERIMENT STATUS".ljust(48) + " │")
    print("├" + "─" * 50 + "┤")

    # Check pxOS connection
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:3839/health"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        pxos_status = "ONLINE" if result.returncode == 0 else "OFFLINE"
    except:
        pxos_status = "OFFLINE"

    print(f"│ pxOS: {pxos_status:<42} │")

    # Get current GPU metrics
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:3839/api/v1/cells"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        cells = json.loads(result.stdout)
        ops_sec = cells.get("gpu_ops_sec", 0)
        backend = cells.get("gpu_backend", "unknown")
        last_bench = cells.get("gpu_last_bench", "never")
        print(f"│ GPU ops/sec: {ops_sec:<34} │")
        print(f"│ Backend: {backend:<40} │")
        print(f"│ Last benchmark: {last_bench:<30} │")
    except:
        print("│ GPU: No data available".ljust(51) + "│")

    print("└" + "─" * 50 + "┘")


def main():
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        print("\nCommands:")
        print("  run <spec.ascii>   - Run experiment on GPU")
        print("  benchmark          - Run GPU benchmark only")
        print("  compile <spec>     - Compile spec to GPU opcodes")
        print("  status             - Show GPU status")
        sys.exit(1)

    command = args[0]

    if command == "run":
        if len(args) < 2:
            print("Usage: python3 gpu-experiment-runner.py run <spec.ascii>")
            sys.exit(1)

        result = run_gpu_experiment(args[1])
        print(f"\nResult: {json.dumps(result, indent=2)}")

    elif command == "benchmark":
        result = run_gpu_benchmark()
        print(f"GPU Benchmark: {result}")

    elif command == "compile":
        if len(args) < 2:
            print("Usage: python3 gpu-experiment-runner.py compile <spec.ascii>")
            sys.exit(1)

        spec = parse_spec(args[1])
        sit_data = compile_to_gpu_opcodes(spec)
        print(f"Compiled to {len(sit_data)} bytes of GPU opcodes")

        # Show first few opcodes
        for i in range(0, min(100, len(sit_data)), 4):
            opcode = sit_data[i]
            if opcode != OP["NOP"]:
                target = sit_data[i + 1]
                flags = sit_data[i + 2]
                x = (i // 4) % 80
                y = (i // 4) // 80
                print(f"  ({x}, {y}): opcode={opcode}, target={target}, flags={flags}")

    elif command == "status":
        show_status()

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
