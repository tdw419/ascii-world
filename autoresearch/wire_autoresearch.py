#!/usr/bin/env python3
"""
AutoResearch → pxOS Wiring Script

Connects the AutoResearch experiment loop to pxOS development.
AI outputs ASCII specs → AutoResearch executes → pxOS visualizes results.

Usage:
    python wire_autoresearch.py run experiment.ascii
    python wire_autoresearch.py status
"""

import subprocess
import sys
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
import re

# Add openspec+autoresearch to path
AUTORESEARCH_PATH = Path.home() / "zion/projects/openspec+autoresearch/openspec+autoresearch/src"
sys.path.insert(0, str(AUTORESEARCH_PATH))

try:
    from openspec_autoresearch.ascii_spec import (
        ASCIIExperimentSpec,
        ASCIISpecParser,
        ASCIIResult,
    )
except ImportError:
    print("Warning: openspec_autoresearch not found, using local implementation")
    ASCIISpecParser = None


@dataclass
class SimpleSpec:
    """Simple spec for when full parser isn't available."""
    hypothesis: str
    target: str
    metric: str
    budget: str
    experiment_id: Optional[str] = None

    @classmethod
    def parse(cls, content: str) -> "SimpleSpec":
        fields = {}
        for line in content.split("\n"):
            match = re.search(r"([HTMB]):\s*(.+)", line)
            if match:
                fields[match.group(1)] = match.group(2).strip()
        return cls(
            hypothesis=fields.get("H", ""),
            target=fields.get("T", ""),
            metric=fields.get("M", ""),
            budget=fields.get("B", "5m"),
        )


class PxOSExperimentRunner:
    """Run experiments against pxOS codebase."""

    def __init__(self, project_path: str = "."):
        self.project_path = Path(project_path)
        self.results_dir = self.project_path / ".autoresearch"
        self.results_dir.mkdir(exist_ok=True)

    def run_benchmark(self) -> float:
        """Run the VM benchmark and extract ops/sec metric."""
        benchmark_path = self.project_path / "sync" / "benchmark-vm.js"

        if not benchmark_path.exists():
            raise FileNotFoundError(f"Benchmark not found: {benchmark_path}")

        result = subprocess.run(
            ["node", str(benchmark_path)],
            capture_output=True,
            text=True,
            cwd=self.project_path,
            timeout=60,
        )

        # Extract ops/sec from output
        match = re.search(r"ops/sec=(\d+)", result.stdout + result.stderr)
        if match:
            return float(match.group(1))

        raise ValueError(f"Could not extract ops/sec from benchmark output")

    def run_tests(self) -> bool:
        """Run the pxOS test suite."""
        result = subprocess.run(
            ["npm", "test"],
            capture_output=True,
            text=True,
            cwd=self.project_path,
            timeout=120,
        )
        return result.returncode == 0

    def run_spec(self, spec_content: str, code_changes: Optional[dict] = None) -> dict:
        """Run an ASCII spec experiment."""
        # Parse spec
        if ASCIISpecParser:
            spec = ASCIISpecParser.parse(spec_content)
        else:
            spec = SimpleSpec.parse(spec_content)

        print(f"┌{'─' * 50}┐")
        print(f"│ {'EXPERIMENT':<48} │")
        print(f"├{'─' * 50}┤")
        print(f"│ H: {spec.hypothesis[:44]:<44} │")
        print(f"│ T: {spec.target[:44]:<44} │")
        print(f"│ M: {spec.metric[:44]:<44} │")
        print(f"│ B: {spec.budget:<48} │")
        print(f"└{'─' * 50}┘")

        # Get baseline
        print("\n▶ Running baseline benchmark...")
        try:
            baseline_metric = self.run_benchmark()
            print(f"  Baseline: {baseline_metric:.0f} ops/sec")
        except Exception as e:
            print(f"  Baseline failed: {e}")
            return {"status": "CRASH", "error": str(e)}

        # Apply code changes if provided
        if code_changes:
            print("\n▶ Applying code changes...")
            for file_path, new_content in code_changes.items():
                path = self.project_path / file_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(new_content)
                print(f"  Modified: {file_path}")

        # Run tests first
        print("\n▶ Running test suite...")
        tests_pass = self.run_tests()
        if not tests_pass:
            print("  Tests FAILED - reverting changes")
            self._revert_changes()
            return {
                "status": "TESTS_FAILED",
                "baseline": baseline_metric,
                "metric": 0,
            }
        print("  Tests passed ✓")

        # Run experiment benchmark
        print("\n▶ Running experiment benchmark...")
        try:
            experiment_metric = self.run_benchmark()
            print(f"  Result: {experiment_metric:.0f} ops/sec")
        except Exception as e:
            print(f"  Benchmark failed: {e}")
            self._revert_changes()
            return {"status": "CRASH", "error": str(e)}

        # Calculate improvement
        improvement_pct = ((experiment_metric - baseline_metric) / baseline_metric) * 100
        is_improvement = improvement_pct > 0

        print(f"\n▶ Improvement: {improvement_pct:+.1f}%")

        if is_improvement:
            print("  Decision: KEEP ✓")
            self._commit_change(spec.hypothesis, experiment_metric, improvement_pct)
            status = "KEEP"
        else:
            print("  Decision: REVERT ✗")
            self._revert_changes()
            status = "REVERT"

        # Log result
        self._log_result(spec, baseline_metric, experiment_metric, status)

        return {
            "status": status,
            "baseline": baseline_metric,
            "metric": experiment_metric,
            "improvement_pct": improvement_pct,
        }

    def _revert_changes(self):
        """Revert uncommitted changes."""
        subprocess.run(
            ["git", "checkout", "."],
            capture_output=True,
            cwd=self.project_path,
        )

    def _commit_change(self, hypothesis: str, metric: float, improvement: float):
        """Commit successful experiment."""
        subprocess.run(
            ["git", "add", "-A"],
            capture_output=True,
            cwd=self.project_path,
        )
        subprocess.run(
            ["git", "commit", "-m", f"perf(vm): {improvement:+.1f}% ops/sec - {hypothesis[:50]}"],
            capture_output=True,
            cwd=self.project_path,
        )

    def _log_result(self, spec, baseline: float, metric: float, status: str):
        """Log result to TSV file."""
        log_path = self.results_dir / "results.tsv"

        if not log_path.exists():
            log_path.write_text("timestamp\thypothesis\tbaseline\tmetric\tstatus\n")

        with open(log_path, "a") as f:
            f.write(f"{time.time()}\t{spec.hypothesis[:50]}\t{baseline}\t{metric}\t{status}\n")

    def get_status(self) -> str:
        """Get current AutoResearch status."""
        log_path = self.results_dir / "results.tsv"

        lines = [
            "┌" + "─" * 50 + "┐",
            "│ " + "AUTORESEARCH STATUS".ljust(48) + " │",
            "├" + "─" * 50 + "┤",
            f"│ Project: {str(self.project_path)[:40]:<40} │",
            f"│ Results: {str(log_path)[:40]:<40} │",
        ]

        if log_path.exists():
            with open(log_path) as f:
                results = f.readlines()[1:]  # Skip header
            lines.append(f"│ Experiments: {len(results):<36} │")

            # Find best result
            best_metric = 0
            best_hypothesis = ""
            for line in results:
                parts = line.strip().split("\t")
                if len(parts) >= 4:
                    try:
                        metric = float(parts[3])
                        if metric > best_metric:
                            best_metric = metric
                            best_hypothesis = parts[1][:30]
                    except ValueError:
                        pass

            if best_metric > 0:
                lines.append(f"│ Best: {best_metric:.0f} ops/sec".ljust(50) + " │")
                lines.append(f"│   ({best_hypothesis})".ljust(50) + " │")

        lines.append("└" + "─" * 50 + "┘")
        return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nCommands:")
        print("  run <spec.ascii>  - Run an ASCII experiment spec")
        print("  status            - Show AutoResearch status")
        print("  bench             - Run benchmark only")
        sys.exit(1)

    command = sys.argv[1]
    runner = PxOSExperimentRunner()

    if command == "run":
        if len(sys.argv) < 3:
            print("Usage: python wire_autoresearch.py run <spec.ascii>")
            sys.exit(1)

        spec_path = Path(sys.argv[2])
        spec_content = spec_path.read_text()
        result = runner.run_spec(spec_content)
        print(f"\nResult: {result}")

    elif command == "status":
        print(runner.get_status())

    elif command == "bench":
        metric = runner.run_benchmark()
        print(f"ops/sec={metric:.0f}")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
