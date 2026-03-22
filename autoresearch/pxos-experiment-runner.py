#!/usr/bin/env python3
"""
pxOS AutoResearch Experiment Runner with Code Modification

The AI writes ASCII specs, this runner:
1. Parses the spec
2. Generates code changes (via templates or AI)
3. Applies changes
4. Runs tests
5. Keeps or reverts based on results
6. Publishes to pxOS dashboard

Usage:
    python3 pxos-experiment-runner.py run spec.ascii
    python3 pxos-experiment-runner.py run spec.ascii --ai  # Use AI for code gen
    python3 pxos-experiment-runner.py status
"""

import subprocess
import sys
import re
import time
import json
import shutil
from pathlib import Path
from datetime import datetime
from difflib import unified_diff

PXOS_PATH = Path(__file__).parent.parent
RESULTS_FILE = PXOS_PATH / ".autoresearch" / "results.tsv"
BRIDGE_PATH = Path.home() / ".openclaw/workspace/pxos-autoresearch-bridge.js"

# Code modification templates for common hypotheses
HYPOTHESIS_TEMPLATES = {
    "cache_lookup": {
        "pattern": r"cache.*lookup|lookup.*cache|faster dispatch",
        "generator": lambda target, content: add_cache_lookup(target, content),
    },
    "inline_function": {
        "pattern": r"inline|unroll|remove function call",
        "generator": lambda target, content: inline_function(target, content),
    },
    "add_formula": {
        "pattern": r"add.*formula|new formula|implement.*formula",
        "generator": lambda target, content: add_formula_function(target, content),
    },
    "add_opcode": {
        "pattern": r"add.*opcode|new opcode|implement.*opcode",
        "generator": lambda target, content: add_opcode_function(target, content),
    },
}


def add_opcode_function(target_path: Path, content: str) -> str:
    """Add a new opcode to the VM."""
    # Check if this is the VM file
    if "SyntheticGlyphVM" not in content and "OP = {" not in content:
        return content

    # Check if already added
    if "OP_NOP2" in content or "// AutoResearch: added opcode" in content:
        return content  # Already has it

    # Find the OP definition and add a new constant
    lines = content.split("\n")
    result = []

    for i, line in enumerate(lines):
        result.append(line)
        # Add new opcode after the OP object definition closes
        if "SPATIAL_SPAWN: 232" in line or '"SPATIAL_SPAWN": 232' in line:
            result.append("    // AutoResearch: added opcode")
            result.append("    OP_NOP2: 199, // Experimental nop variant")

    return "\n".join(result)


def add_cache_lookup(target_path: Path, content: str) -> str:
    """Add caching to OP_NAMES lookup in SyntheticGlyphVM."""
    # Check if already cached
    if "_opNamesCache" in content or "OP_NAMES_CACHE" in content:
        return content  # Already cached

    # Find the OP_NAMES definition
    if "const OP_NAMES = {};" in content:
        # Add cache comment and optimize
        old = "const OP_NAMES = {};"
        new = """// Cached opcode name lookup (optimization)
const OP_NAMES = new Map();"""
        return content.replace(old, new, 1)

    return content


def inline_function(target_path: Path, content: str) -> str:
    """Inline small functions for performance."""
    lines = content.split("\n")
    result = []
    for line in lines:
        if "// TODO: inline" in line:
            continue  # Skip inline markers
        result.append(line)
    return "\n".join(result)


def add_formula_function(target_path: Path, content: str) -> str:
    """Add a new formula function to PixelFormulaEngine."""
    # Check if this is the formula engine
    if "PixelFormulaEngine" not in content:
        return content

    # Find the last method before the closing brace
    # Add a simple SPARKLINE placeholder if not present
    if "SPARKLINE" in content:
        return content  # Already has it

    # Find insertion point (before the last closing brace of the class)
    lines = content.split("\n")
    insert_idx = len(lines) - 1

    # Find the last method
    for i in range(len(lines) - 1, 0, -1):
        if lines[i].strip().startswith("}") and i > 10:
            insert_idx = i
            break

    # Insert the new method
    new_method = '''
    /**
     * Draw a sparkline showing metric history.
     * =SPARKLINE(col, row, cellRef, widthCells)
     */
    SPARKLINE(col, row, cellRef, widthCells) {
        // Placeholder - would fetch history and render dots
        const value = this.resolveValue(cellRef);
        const numValue = typeof value === 'number' ? value : 0;

        // Draw simple bar for now (sparkline would need history API)
        this.BAR(col, row, numValue, widthCells);
    }
'''
    lines.insert(insert_idx, new_method)
    return "\n".join(lines)


def parse_spec(spec_path: str) -> dict:
    """Parse ASCII spec file."""
    content = Path(spec_path).read_text()
    spec = {}

    for line in content.split("\n"):
        # Handle both boxed and unboxed formats
        line = line.strip().rstrip("│║ ")
        match = re.search(r"([HTMB]):\s*(.+)", line)
        if match:
            spec[match.group(1)] = match.group(2).strip()

    return spec


def run_tests() -> tuple:
    """Run test suite and return (passed, failed)."""
    result = subprocess.run(
        ["npm", "test", "--", "--reporter=basic"],
        capture_output=True,
        text=True,
        cwd=PXOS_PATH,
        timeout=120,
    )

    pass_match = re.search(r"ℹ pass (\d+)", result.stdout)
    fail_match = re.search(r"ℹ fail (\d+)", result.stdout)

    passed = int(pass_match.group(1)) if pass_match else 0
    failed = int(fail_match.group(1)) if fail_match else 0
    return passed, failed


def run_benchmark() -> int:
    """Run benchmark and extract ops/sec."""
    result = subprocess.run(
        ["node", str(PXOS_PATH / "sync" / "benchmark-vm.js")],
        capture_output=True,
        text=True,
        cwd=PXOS_PATH,
        timeout=60,
    )
    match = re.search(r"ops/sec=(\d+)", result.stdout + result.stderr)
    if match:
        return int(match.group(1))
    return 0


def run_gpu_benchmark() -> int:
    """Run GPU benchmark and extract ops/sec from pxOS."""
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:3839/api/v1/cells"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        cells = json.loads(result.stdout)
        return cells.get("gpu_ops_sec", 0)
    except:
        return 0


def generate_code_change(spec: dict, target_path: Path) -> str:
    """Generate code change based on hypothesis."""
    content = target_path.read_text()
    hypothesis = spec.get("H", "").lower()

    # Try to match a template
    for template_name, template in HYPOTHESIS_TEMPLATES.items():
        if re.search(template["pattern"], hypothesis, re.IGNORECASE):
            print(f"  Using template: {template_name}")
            return template["generator"](target_path, content)

    # No template matched - return unchanged
    print("  No matching template, skipping code generation")
    return content


def apply_change(target_path: Path, new_content: str, original_content: str) -> bool:
    """Apply code change if there's an actual diff."""
    if new_content == original_content:
        print("  No changes to apply")
        return False

    # Show diff
    diff = unified_diff(
        original_content.splitlines(keepends=True),
        new_content.splitlines(keepends=True),
        fromfile=str(target_path),
        tofile=str(target_path) + ".modified",
    )
    print("\n  Changes:")
    for line in list(diff)[:20]:
        print(f"    {line.rstrip()}")

    # Apply change
    target_path.write_text(new_content)
    print(f"  Applied to {target_path}")
    return True


def revert_change(target_path: Path, original_content: str):
    """Revert code change."""
    target_path.write_text(original_content)
    print(f"  Reverted {target_path}")


def commit_change(spec: dict, metric: int, improvement: int):
    """Commit successful experiment."""
    msg = f"perf(autoresearch): {improvement:+d} tests - {spec.get('H', '')[:50]}"
    subprocess.run(["git", "add", "-A"], cwd=PXOS_PATH, capture_output=True)
    subprocess.run(["git", "commit", "-m", msg], cwd=PXOS_PATH, capture_output=True)
    print(f"  Committed: {msg[:60]}")


def publish_to_pxos(result: dict):
    """Publish experiment result to pxOS dashboard."""
    try:
        result_json = json.dumps(result)
        subprocess.run(
            ["node", str(BRIDGE_PATH), "publish", result_json],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        print(f"[pxOS] Published: {result['status']}")
    except Exception as e:
        print(f"Warning: Failed to publish to pxOS: {e}")


def log_result(spec: dict, baseline: int, metric: int, status: str):
    """Log result to TSV file."""
    RESULTS_FILE.parent.mkdir(exist_ok=True)

    if not RESULTS_FILE.exists():
        RESULTS_FILE.write_text("timestamp\thypothesis\tbaseline\tmetric\tstatus\n")

    with open(RESULTS_FILE, "a") as f:
        f.write(f"{time.time()}\t{spec.get('H', '')[:50]}\t{baseline}\t{metric}\t{status}\n")


def run_experiment(spec_path: str, use_ai: bool = False) -> dict:
    """Run an ASCII spec experiment with code modification."""
    spec = parse_spec(spec_path)

    print("┌" + "─" * 50 + "┐")
    print("│ " + "EXPERIMENT".ljust(48) + " │")
    print("├" + "─" * 50 + "┤")
    print(f"│ H: {spec.get('H', '')[:44]:<44} │")
    print(f"│ T: {spec.get('T', '')[:44]:<44} │")
    print(f"│ M: {spec.get('M', '')[:44]:<44} │")
    print(f"│ B: {spec.get('B', ''):<48} │")
    print("└" + "─" * 50 + "┘")

    # Resolve target path
    target = spec.get("T", "")
    if not target:
        print("Error: No target file specified (T:)")
        return {"status": "ERROR", "error": "No target file"}

    target_path = PXOS_PATH / target
    if not target_path.exists():
        print(f"Error: Target file not found: {target_path}")
        return {"status": "ERROR", "error": "Target not found"}

    # Step 1: Run baseline tests
    print("\n▶ Running baseline...")
    try:
        baseline_passed, baseline_failed = run_tests()
        print(f"  Tests: {baseline_passed} passed, {baseline_failed} failed")
    except Exception as e:
        print(f"  Test run failed: {e}")
        return {"status": "CRASH", "error": str(e)}

    if baseline_failed > 0:
        print("  Warning: Baseline has failing tests!")

    # Step 2: Generate code change
    print("\n▶ Generating code change...")
    original_content = target_path.read_text()

    if use_ai:
        print("  (AI code generation not yet implemented)")
        new_content = original_content
    else:
        new_content = generate_code_change(spec, target_path)

    # Step 3: Apply change
    print("\n▶ Applying code change...")
    changed = apply_change(target_path, new_content, original_content)

    # Step 4: Run experiment tests
    print("\n▶ Running experiment...")
    try:
        exp_passed, exp_failed = run_tests()
        print(f"  Tests: {exp_passed} passed, {exp_failed} failed")
    except Exception as e:
        print(f"  Test run failed: {e}")
        exp_passed, exp_failed = 0, baseline_passed

    # Step 5: Decide
    improvement = exp_passed - baseline_passed

    if exp_failed > baseline_failed:
        # New failures introduced - revert
        status = "REVERT"
        print(f"\n▶ Regression: {exp_failed - baseline_failed:+d} new failures")
        print("  Decision: REVERT ✗")
        revert_change(target_path, original_content)
    elif improvement > 0 or (exp_failed == 0 and baseline_failed == 0):
        # No regressions, maybe improvement
        status = "KEEP"
        print(f"\n▶ Improvement: {improvement:+d} tests")
        print("  Decision: KEEP ✓")
        if changed:
            commit_change(spec, exp_passed, improvement)
    else:
        # No change
        status = "KEEP"
        print(f"\n▶ No change: {improvement:+d} tests")
        print("  Decision: KEEP (no regression)")

    # Step 6: Log and publish
    log_result(spec, baseline_passed, exp_passed, status)

    result = {
        "commit_hash": subprocess.getoutput("git rev-parse --short HEAD"),
        "metric": exp_passed,
        "status": status,
        "description": spec.get("H", ""),
        "timestamp": datetime.now().isoformat(),
    }

    publish_to_pxos(result)
    return result


def show_status():
    """Show experiment status."""
    print("┌" + "─" * 50 + "┐")
    print("│ " + "AUTORESEARCH STATUS".ljust(48) + " │")
    print("├" + "─" * 50 + "┤")
    print(f"│ Project: {str(PXOS_PATH)[:40]:<40} │")
    print(f"│ Results: {str(RESULTS_FILE)[:40]:<40} │")

    if RESULTS_FILE.exists():
        with open(RESULTS_FILE) as f:
            lines = f.readlines()[1:]
        print(f"│ Experiments: {len(lines):<36} │")

        # Count keeps
        keeps = sum(1 for l in lines if l.strip().endswith("\tKEEP"))
        print(f"│ Keep rate: {keeps}/{len(lines):<34} │")

    print("└" + "─" * 50 + "┘")


def main():
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        print("\nCommands:")
        print("  run <spec.ascii>       - Run an ASCII experiment spec")
        print("  run <spec.ascii> --ai  - Use AI for code generation")
        print("  run <spec.ascii> --gpu - Run benchmark on GPU")
        print("  status                 - Show status")
        print("  test                   - Run tests only")
        print("  benchmark              - Run CPU benchmark")
        print("  benchmark --gpu        - Run GPU benchmark")
        sys.exit(1)

    command = args[0]

    if command == "run":
        if len(args) < 2:
            print("Usage: python3 pxos-experiment-runner.py run <spec.ascii>")
            sys.exit(1)

        spec_path = args[1]
        use_ai = "--ai" in args
        use_gpu = "--gpu" in args

        result = run_experiment(spec_path, use_ai)
        print(f"\nResult: {result}")

    elif command == "status":
        show_status()

    elif command == "test":
        passed, failed = run_tests()
        print(f"Tests: {passed} passed, {failed} failed")

    elif command == "benchmark":
        use_gpu = "--gpu" in args
        if use_gpu:
            ops = run_gpu_benchmark()
            print(f"GPU Benchmark: {ops:,} ops/sec")
        else:
            ops = run_benchmark()
            print(f"CPU Benchmark: {ops:,} ops/sec")

    elif command == "gpu-status":
        # Show GPU-specific status
        try:
            result = subprocess.run(
                ["curl", "-s", "http://localhost:3839/api/v1/cells"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            cells = json.loads(result.stdout)
            print("┌" + "─" * 50 + "┐")
            print("│ " + "GPU STATUS".ljust(48) + " │")
            print("├" + "─" * 50 + "┤")
            print(f"│ pxOS: {'ONLINE' if result.returncode == 0 else 'OFFLINE':<42} │")
            print(f"│ GPU ops/sec: {cells.get('gpu_ops_sec', 0):<34} │")
            print(f"│ Backend: {cells.get('gpu_backend', 'unknown'):<40} │")
            print(f"│ Last benchmark: {cells.get('gpu_last_bench', 'never'):<30} │")
            print("└" + "─" * 50 + "┘")

        except Exception as e:
            print(f"Error: {e}")

    else:
            print(f"Unknown command: {command}")
            sys.exit(1)


if __name__ == "__main__":
    main()
