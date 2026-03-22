#!/usr/bin/env python3
"""AutoResearch Experiment Runner for pxOS

Runs experiments on pxOS codebase and publishes results to pxOS dashboard.
"""

import subprocess
import re
import requests
from dataclasses import dataclass
from enum import Enum


class Status(Enum):
    KEEP = "KEEP ✓"
    REVERT = "REVERT ↩"
    CRASH = "CRASH ✗"


@dataclass
class ExperimentResult:
    hypothesis: str
    metric_value: float
    status: Status
    commit_id: str

    def visualize(self) -> str:
        return f"""
┌───────────────────────────────────────┐
│ {self.hypothesis[:40]} │
├───────────────────────────────────────┤
│ STATUS: {self.status.value:<15} │
│ METRIC: {self.metric_value:>8.2f} tests passing  │
│ COMMIT: {self.commit_id[:7]:<7} │
└───────────────────────────────────────┘
"""


def get_baseline_metric() -> float:
    """Run npm test and extract passing count"""
    result = subprocess.run(
        ["npm", "test"],
        capture_output=True,
        text=True,
        cwd="/home/jericho/zion/projects/ascii_world/ascii_world",
    )
    # Count ✔ symbols as test pass metric
    return float(result.stdout.count("✔"))


def get_commit_id() -> str:
    """Get current commit hash"""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"], capture_output=True, text=True
    )
    return result.stdout.strip()


def publish_to_pxos(result: ExperimentResult):
    """Publish experiment result to pxOS cells"""
    try:
        requests.post(
            "http://localhost:3839/api/v1/cells",
            json={
                "exp_metric": result.metric_value,
                "exp_status": result.status.value,
                "exp_commit": result.commit_id,
                "exp_hypothesis": result.hypothesis[:50],
            },
        )
        print("✓ Published to pxOS dashboard")
    except Exception as e:
        print(f"✗ Failed to publish: {e}")


def run_experiment():
    """Run one experiment iteration"""
    hypothesis = "Add SPARKLINE formula support"

    # Get baseline
    baseline = get_baseline_metric()
    print(f"Baseline: {baseline} tests passing")

    # TODO: Apply code change here (modify pixel-formula-engine.js)
    # For now, just re-run tests

    # Run tests again
    new_metric = get_baseline_metric()
    print(f"After change: {new_metric} tests passing")

    # Decide keep or revert
    status = Status.KEEP if new_metric >= baseline else Status.REVERT

    result = ExperimentResult(
        hypothesis=hypothesis,
        metric_value=new_metric,
        status=status,
        commit_id=get_commit_id(),
    )

    print(result.visualize())
    publish_to_pxos(result)
    return result


if __name__ == "__main__":
    run_experiment()
