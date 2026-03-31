#!/usr/bin/env python3
"""
Attention-based Ratification Module
Wires OpenMind similarity scores → Sovereign approval levels

Flow:
  OpenMind Inference → bridge.py → neural_paths.json → ratification.py → ratified_decision.json
"""

import json
from pathlib import Path
from enum import Enum

PROJECT_ROOT = Path("/home/jericho/zion/projects/ascii_world/ascii_world")
NEURAL_PATHS = PROJECT_ROOT / ".ouroboros" / "visualizations" / "neural_paths.json"
OUTPUT_PATH = PROJECT_ROOT / ".ouroboros" / "visualizations" / "ratified_decision.json"


class RatificationLevel(Enum):
    AUTO_APPROVED = "auto_approved"  # Green - high confidence
    PENDING = "pending"  # Yellow - needs review
    HUMAN_REVIEW = "human_review"  # Red - low confidence


# Production thresholds (for real trained models)
# THRESHOLD_HIGH = 0.8  # ≥80% similarity = auto-approve
# THRESHOLD_MEDIUM = 0.5  # ≥50% similarity = pending

# Test thresholds (for demo with simplified attention model)
THRESHOLD_HIGH = 0.21  # ≥21% similarity = auto-approve (test mode)
THRESHOLD_MEDIUM = 0.15  # ≥15% similarity = pending (test mode)


def calculate_ratification(paths: list) -> dict:
    """Evaluate attention paths and determine ratification level."""

    if not paths:
        return {
            "level": "no_paths",
            "average_similarity": 0.0,
            "path_count": 0,
            "status": "error",
            "message": "No neural paths to evaluate",
        }

    similarities = [p.get("similarity", 0.0) for p in paths]
    avg_similarity = sum(similarities) / len(similarities)

    high_conf_count = sum(1 for s in similarities if s >= THRESHOLD_HIGH)
    med_conf_count = sum(
        1 for s in similarities if THRESHOLD_MEDIUM <= s < THRESHOLD_HIGH
    )
    low_conf_count = sum(1 for s in similarities if s < THRESHOLD_MEDIUM)

    if avg_similarity >= THRESHOLD_HIGH:
        level = RatificationLevel.AUTO_APPROVED
        status = "approved"
        color = "green"
    elif avg_similarity >= THRESHOLD_MEDIUM:
        level = RatificationLevel.PENDING
        status = "pending"
        color = "yellow"
    else:
        level = RatificationLevel.HUMAN_REVIEW
        status = "review_required"
        color = "red"

    return {
        "level": level.value,
        "average_similarity": round(avg_similarity, 4),
        "path_count": len(paths),
        "status": status,
        "color": color,
        "confidence_breakdown": {
            "high_confidence": high_conf_count,
            "medium_confidence": med_conf_count,
            "low_confidence": low_conf_count,
        },
        "thresholds": {"auto_approve": THRESHOLD_HIGH, "pending": THRESHOLD_MEDIUM},
    }


def run_ratification():
    """Main entry point - evaluate neural paths for ratification."""

    if not NEURAL_PATHS.exists():
        print(f"Error: {NEURAL_PATHS} not found. Run bridge.py first.")
        return None

    print(f"Reading neural paths from {NEURAL_PATHS}...")
    data = json.loads(NEURAL_PATHS.read_text())

    paths = data.get("paths", [])
    input_text = data.get("input_text", "unknown")

    print(f"Evaluating {len(paths)} attention paths...")
    result = calculate_ratification(paths)

    decision = {
        "input_query": input_text,
        "ratification": result,
        "auto_execute": result["level"] == RatificationLevel.AUTO_APPROVED.value,
    }

    OUTPUT_PATH.write_text(json.dumps(decision, indent=2))
    print(f"Ratification decision saved to {OUTPUT_PATH}")

    print(f"\n{'=' * 50}")
    print(f"RATIFICATION RESULT: {result['status'].upper()}")
    print(f"  Average Similarity: {result['average_similarity']:.2%}")
    print(f"  Auto-Execute: {decision['auto_execute']}")
    print(f"{'=' * 50}")

    return decision


if __name__ == "__main__":
    run_ratification()
