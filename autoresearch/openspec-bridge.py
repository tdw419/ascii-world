#!/usr/bin/env python3
"""
OpenSpec → pxOS Bridge

Converts OpenSpec ASCIIExperimentSpecs to pxOS experiment format
and runs them through the pxOS AutoResearch runner.

Usage:
    python3 openspec-bridge.py run spec.ascii
    python3 openspec-bridge.py convert spec.ascii
"""

import sys
import json
from pathlib import Path

# Add openspec+autoresearch to path
sys.path.insert(0, '/home/jericho/zion/projects/openspec+autoresearch/openspec+autoresearch/src')

from openspec_autoresearch.ascii_spec import ASCIISpecParser, ASCIIExperimentSpec

PXOS_PATH = Path(__file__).parent.parent


def convert_spec(spec: ASCIIExperimentSpec) -> dict:
    """Convert OpenSpec to pxOS format."""
    return {
        "hypothesis": spec.hypothesis,
        "target": spec.target,
        "metric": spec.metric,
        "budget": spec.budget,
        "layer": getattr(spec, 'layer', 2),
    }


def parse_openspec(spec_path: str) -> ASCIIExperimentSpec:
    """Parse an OpenSpec ASCII file."""
    parser = ASCIISpecParser()
    content = Path(spec_path).read_text()
    return parser.parse(content)


def run_openspec_experiment(spec_path: str) -> dict:
    """Run an OpenSpec experiment via pxOS runner."""
    spec = parse_openspec(spec_path)

    print("┌" + "─" * 50 + "┐")
    print("│ " + "OPENSPEC → pxOS EXPERIMENT".ljust(48) + " │")
    print("├" + "─" * 50 + "┤")
    print(f"│ H: {spec.hypothesis[:44]:<44} │")
    print(f"│ T: {spec.target[:44]:<44} │")
    print(f"│ M: {spec.metric[:44]:<44} │")
    print(f"│ B: {spec.budget:<48} │")
    print("└" + "─" * 50 + "┘")

    # Write temp spec file in pxOS format
    temp_spec_path = PXOS_PATH / ".autoresearch" / "temp_openspec.ascii"
    temp_spec_path.parent.mkdir(exist_ok=True)
    temp_spec_path.write_text(
        f"H: {spec.hypothesis}\n"
        f"T: {spec.target}\n"
        f"M: {spec.metric}\n"
        f"B: {spec.budget}\n"
    )

    # Run pxOS experiment via subprocess
    import subprocess
    result = subprocess.run(
        ["python3", str(PXOS_PATH / "autoresearch" / "pxos-experiment-runner.py"),
         "run", str(temp_spec_path)],
        capture_output=True,
        text=True,
        timeout=120,
    )

    print(result.stdout)

    return {
        "openspec": convert_spec(spec),
        "returncode": result.returncode,
        "stdout": result.stdout[-500:] if result.stdout else "",
    }


def show_bridge_status():
    """Show bridge status."""
    print("┌" + "─" * 50 + "┐")
    print("│ " + "OPENSPEC → pxOS BRIDGE".ljust(48) + " │")
    print("├" + "─" * 50 + "┤")
    print(f"│ OpenSpec: /openspec+autoresearch/...{'':<24} │")
    print(f"│ pxOS: {str(PXOS_PATH)[:42]:<42} │")
    print("│ Status: READY".ljust(51) + "│")
    print("└" + "─" * 50 + "┘")


def main():
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        print("\nCommands:")
        print("  run <spec.ascii>    - Run OpenSpec via pxOS")
        print("  convert <spec.ascii> - Convert spec format")
        print("  status              - Show bridge status")
        sys.exit(1)

    command = args[0]

    if command == "run":
        if len(args) < 2:
            print("Usage: python3 openspec-bridge.py run <spec.ascii>")
            sys.exit(1)

        result = run_openspec_experiment(args[1])
        print(f"\nResult: {json.dumps(result, indent=2)}")

    elif command == "convert":
        if len(args) < 2:
            print("Usage: python3 openspec-bridge.py convert <spec.ascii>")
            sys.exit(1)

        spec = parse_openspec(args[1])
        converted = convert_spec(spec)
        print(json.dumps(converted, indent=2))

    elif command == "status":
        show_bridge_status()

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
