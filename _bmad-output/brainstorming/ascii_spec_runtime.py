#!/usr/bin/env python3
"""ASCII Spec Runtime - Execute experiments from ASCII specs"""

import subprocess
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from enum import Enum


class ExperimentStatus(Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVERTED = "REVERTED"


@dataclass
class ExperimentResult:
    """Result of running an experiment"""

    spec_id: str
    status: ExperimentStatus
    metric_value: Optional[float] = None
    elapsed_seconds: int = 0
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    output: str = ""

    def visualize(self) -> str:
        """Return ASCII visualization of result (IDEA 11)"""
        status_symbol = {
            ExperimentStatus.PENDING: "○",
            ExperimentStatus.RUNNING: "●",
            ExperimentStatus.COMPLETED: "✓",
            ExperimentStatus.FAILED: "✗",
            ExperimentStatus.REVERTED: "↩",
        }[self.status]

        lines = [
            f"┌───────────────────────────────────────┐",
            f"│ EXP {self.spec_id} {status_symbol:>6}",
            f"├───────────────────────────────────────┤",
        ]

        if self.metric_value is not None:
            lines.append(f"│ METRIC: {self.metric_value:.4f}")
        else:
            lines.append(f"│ METRIC: N/A")

        lines.append(f"│ ELAPSED: {self.elapsed_seconds}s")
        lines.append(f"└───────────────────────────────────────┘")

        return "\n".join(lines)


class ASCIISpecRuntime:
    """Fixed runtime that executes ASCII experiment specs (IDEA 12)"""

    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir
        self.history: list[ExperimentResult] = []

    def execute(self, spec) -> ExperimentResult:
        """Execute an experiment spec"""
        print(f"\n🚀 Starting experiment: {spec.hypothesis[:50]}...")
        print(spec.visualize() if hasattr(spec, "visualize") else f"   {spec}")

        result = ExperimentResult(
            spec_id=spec.id or "unnamed", status=ExperimentStatus.RUNNING
        )

        try:
            # Step 1: Run the target file (IDEA 12, step 3)
            print(f"\n   ▶ Running: {spec.target}")
            start_time = time.time()

            process = subprocess.run(
                ["python3", spec.target],
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=spec.budget * 60,
            )

            result.elapsed_seconds = int(time.time() - start_time)
            result.output = process.stdout

            # Step 2: Extract metric (IDEA 12, step 4)
            print(f"   ▶ Extracting metric from output...")
            result.metric_value = self._extract_metric(process.stdout, spec.metric)

            if result.metric_value is None:
                # Try stderr too
                result.metric_value = self._extract_metric(process.stderr, spec.metric)

            # Step 3: Compare and decide (IDEA 12, step 5)
            decision = self._evaluate_decision(result.metric_value, spec.metric)

            if decision == "KEEP":
                result.status = ExperimentStatus.COMPLETED
                print(f"   ✓ DECISION: KEEP (metric={result.metric_value})")
            else:
                result.status = ExperimentStatus.REVERTED
                print(f"   ↩ DECISION: REVERT (metric={result.metric_value})")

            result.completed_at = datetime.now()

        except subprocess.TimeoutExpired:
            result.status = ExperimentStatus.FAILED
            result.elapsed_seconds = spec.budget * 60
            print(f"   ✗ TIMEOUT after {spec.budget} minutes")
            result.completed_at = datetime.now()

        except Exception as e:
            result.status = ExperimentStatus.FAILED
            result.output = str(e)
            print(f"   ✗ ERROR: {e}")
            result.completed_at = datetime.now()

        # Step 4: Log to history (IDEA 12, step 7)
        self.history.append(result)

        # Visualize result
        print("\n" + result.visualize())

        return result

    def _extract_metric(self, output: str, metric_spec: str) -> Optional[float]:
        """Extract numeric metric value from output"""
        # Simple heuristic: find last float in output
        import re

        matches = re.findall(r"[\-]?\d+\.\d+", output)
        if matches:
            return float(matches[-1])
        return None

    def _evaluate_decision(
        self, metric_value: Optional[float], metric_spec: str
    ) -> str:
        """Evaluate whether to keep or revert based on metric"""
        if metric_value is None:
            return "REVERT"

        # Parse metric spec like "val_bpb < 0.7"
        import re

        match = re.search(r"<\s*(\d+\.?\d*)", metric_spec)
        if match:
            threshold = float(match.group(1))
            return "KEEP" if metric_value < threshold else "REVERT"

        # Default: keep if positive
        return "KEEP" if metric_value > 0 else "REVERT"

    def visualize_history(self) -> str:
        """Visualize all experiment results as ASCII table (IDEA 27)"""
        if not self.history:
            return "No experiments run yet."

        lines = [
            "╔═══════════════════════════════════════════════╗",
            f"║ EXPERIMENT HISTORY ({len(self.history)} runs)           ║",
            "╠═══════════════════════════════════════════════╣",
        ]

        for i, result in enumerate(self.history, 1):
            status_char = {
                ExperimentStatus.COMPLETED: "✓",
                ExperimentStatus.REVERTED: "↩",
                ExperimentStatus.FAILED: "✗",
                ExperimentStatus.RUNNING: "●",
                ExperimentStatus.PENDING: "○",
            }.get(result.status, "?")

            metric_str = f"{result.metric_value:.4f}" if result.metric_value else "N/A"

            lines.append(
                f"║ {i:3}. [{status_char}] {result.spec_id:<10}  "
                f"metric={metric_str:>8}  "
                f"{result.elapsed_seconds:4}s ║"
            )

        lines.append("╚═══════════════════════════════════════════════╝")
        return "\n".join(lines)


# Demo usage
if __name__ == "__main__":
    from ascii_spec_parser import ASCIISpecParser, ExperimentSpec

    # Parse an ASCII spec
    parser = ASCIISpecParser()
    ascii_spec = """
    ┌─────────────────────────────────────────┐
    │ EXPERIMENT 001                          │
    ├─────────────────────────────────────────┤
    │ H: Use AdamW optimizer                  │
    │ T: train.py                             │
    │ M: val_bpb < 0.7                        │
    │ B: 5m                                   │
    └─────────────────────────────────────────┘
    """

    spec = parser.parse(ascii_spec)
    print(f"Parsed spec: {spec}")

    # Create runtime and execute
    runtime = ASCIISpecRuntime()
    result = runtime.execute(spec)

    # Show history
    print("\n" + runtime.visualize_history())
