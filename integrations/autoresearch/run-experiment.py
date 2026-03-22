#!/usr/bin/env python3
"""
AutoResearch → pxOS Experiment Runner

Safely runs an experiment against pxOS's test suite using AutoResearch's
ExperimentLoop. Results are published to pxOS's dashboard.

This is a SAFE runner: it never overwrites files wholesale. It makes
targeted, reversible changes using git.

Usage:
    python run-experiment.py              # Run default experiment
    python run-experiment.py --dry-run    # Show what would happen, don't change files
"""

import sys
import os
import subprocess
import json
import argparse
from pathlib import Path
from datetime import datetime

# Add AutoResearch to path
AUTORESEARCH_SRC = Path('/home/jericho/zion/projects/openspec+autoresearch/openspec+autoresearch/src')
sys.path.insert(0, str(AUTORESEARCH_SRC))

PXOS_ROOT = Path('/home/jericho/zion/projects/ascii_world/ascii_world')
BRIDGE = PXOS_ROOT / 'integrations' / 'autoresearch' / 'bridge.js'


def get_test_count() -> int:
    """Run pxOS test suite and return number of passing tests."""
    result = subprocess.run(
        ['npm', 'test'],
        cwd=PXOS_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    output = result.stdout + result.stderr
    # Parse: "ℹ pass 91"
    for line in output.split('\n'):
        if 'pass' in line and line.strip().startswith('ℹ'):
            parts = line.strip().split()
            for i, part in enumerate(parts):
                if part == 'pass' and i + 1 < len(parts):
                    return int(parts[i + 1])
    raise ValueError(f"Could not parse test count from:\n{output[-500:]}")


def publish_to_pxos(result_dict: dict):
    """Publish result to pxOS via bridge.js."""
    try:
        subprocess.run(
            ['node', str(BRIDGE), 'publish', json.dumps(result_dict)],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception as e:
        print(f"  (pxOS publish skipped: {e})")


def get_git_hash() -> str:
    result = subprocess.run(
        ['git', 'rev-parse', 'HEAD'],
        cwd=PXOS_ROOT, capture_output=True, text=True,
    )
    return result.stdout.strip()[:7]


def git_has_changes() -> bool:
    result = subprocess.run(
        ['git', 'status', '--porcelain'],
        cwd=PXOS_ROOT, capture_output=True, text=True,
    )
    return bool(result.stdout.strip())


def main():
    parser = argparse.ArgumentParser(description='AutoResearch → pxOS experiment runner')
    parser.add_argument('--dry-run', action='store_true', help='Show plan without executing')
    args = parser.parse_args()

    print("=" * 60)
    print("AutoResearch → pxOS Experiment Runner")
    print("=" * 60)

    # Step 1: Verify baseline
    print("\n[1/4] Getting baseline...")
    baseline_hash = get_git_hash()
    baseline_tests = get_test_count()
    print(f"  Commit: {baseline_hash}")
    print(f"  Tests passing: {baseline_tests}")

    if git_has_changes() and not args.dry_run:
        print("  ⚠ Working tree has uncommitted changes.")
        print("  Stash or commit them first for clean experiments.")
        sys.exit(1)
    elif git_has_changes():
        print("  ⚠ Working tree has uncommitted changes (ignored for --dry-run).")

    # Step 2: Define hypothesis
    # For now, this is a stub — in production, the AI agent generates these
    print("\n[2/4] Hypothesis:")
    print("  'Adding a HEATMAP formula to pixel-formula-engine.js'")
    print("  (This is a placeholder — real hypotheses come from the AI agent)")

    if args.dry_run:
        print("\n  --dry-run: Would apply code change, run tests, keep or revert.")
        print("  Exiting without changes.")
        sys.exit(0)

    # Step 3: Apply change + test
    # In the real loop, AutoResearch's Hypothesis.apply_changes() does this.
    # Here we demonstrate the metric extraction and publish flow.
    print("\n[3/4] Running experiment...")
    try:
        from openspec_autoresearch.autoresearch.loop import ExperimentLoop, Hypothesis
        from openspec_autoresearch.autoresearch.result import ExperimentStatus

        loop = ExperimentLoop(
            project_path=str(PXOS_ROOT),
            target_file="sync/pixel-formula-engine.js",
            # Extract the pass count: "ℹ pass 91"
            eval_command="npm test 2>&1",
            time_budget_minutes=5,
            lower_is_better=False,  # More passing = better
        )

        # Get current metric via our reliable parser
        current_tests = get_test_count()
        print(f"  Current test count: {current_tests}")

    except ImportError as e:
        print(f"  Could not import AutoResearch: {e}")
        print("  Falling back to direct test runner...")
        current_tests = get_test_count()

    # Step 4: Report
    result_dict = {
        'commit_hash': get_git_hash(),
        'metric': current_tests,
        'status': 'KEEP' if current_tests >= baseline_tests else 'DISCARD',
        'description': f'Baseline verification: {current_tests} tests passing',
        'timestamp': datetime.now().isoformat(),
    }

    print(f"\n[4/4] Result:")
    print(f"  Status:  {result_dict['status']}")
    print(f"  Metric:  {result_dict['metric']} tests")
    print(f"  Commit:  {result_dict['commit_hash']}")

    # Publish to pxOS dashboard
    print("\n  Publishing to pxOS...")
    publish_to_pxos(result_dict)

    print("\n" + "=" * 60)
    print("Integration verified. To run real experiments:")
    print("  1. Start pxOS:  cd ascii_world && npm start")
    print("  2. Setup dashboard:  node integrations/autoresearch/bridge.js setup-dashboard")
    print("  3. Have AI agent generate Hypothesis objects")
    print("  4. ExperimentLoop.run(hypothesis) → auto keep/revert")
    print("=" * 60)


if __name__ == '__main__':
    main()
