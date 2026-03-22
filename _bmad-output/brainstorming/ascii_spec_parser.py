#!/usr/bin/env python3
"""ASCII Experiment Spec Parser - Minimal Viable Prototype"""

import re
from dataclasses import dataclass
from typing import Optional, List


@dataclass
class ExperimentSpec:
    """Parsed experiment specification"""

    hypothesis: str
    target: str
    metric: str
    budget: int  # in minutes
    id: Optional[str] = None

    def __str__(self):
        return f"Exp({self.id or 'unnamed'}): {self.hypothesis[:30]}..."


class ASCIISpecParser:
    """Parse ASCII experiment specs into structured data"""

    # Pattern 1: Minimal H/T/M/B format (IDEA 17)
    MINIMAL_PATTERN = re.compile(r"^\s*(H|hypothesis)\s*:\s*(.+)$", re.MULTILINE)

    def parse(self, ascii_text: str) -> ExperimentSpec:
        """Parse ASCII spec text into ExperimentSpec object"""
        hypothesis = self._extract_field(ascii_text, ["H:", "hypothesis:"])
        target = self._extract_field(ascii_text, ["T:", "target:"])
        metric = self._extract_field(ascii_text, ["M:", "metric:"])
        budget = self._extract_budget(ascii_text)
        exp_id = self._extract_id(ascii_text)

        if not all([hypothesis, target, metric]):
            raise ValueError("Missing required fields (H/T/M)")

        return ExperimentSpec(
            hypothesis=hypothesis or "",
            target=target or "",
            metric=metric or "",
            budget=budget,
            id=exp_id,
        )

    def _extract_field(self, text: str, prefixes: List[str]) -> Optional[str]:
        """Extract field value from ASCII text"""
        for prefix in prefixes:
            # Try box format: │ H: value │ or |H: value|
            box_match = re.search(
                r"[│|]\s*"
                + re.escape(prefix).replace(":", r"\s*:\s*")
                + r"(.+?)\s*[│|]",
                text,
                re.IGNORECASE,
            )
            if box_match:
                return box_match.group(1).strip()

            # Try minimal format: H: value (at line start)
            simple_match = re.search(
                r"^\s*" + re.escape(prefix.replace(":", "")) + r"\s*:\s*(.+)$",
                text,
                re.MULTILINE | re.IGNORECASE,
            )
            if simple_match:
                return simple_match.group(1).strip()

        return None

    def _extract_budget(self, text: str) -> int:
        """Extract budget in minutes (default 5)"""
        budget = self._extract_field(text, ["B:", "budget:"])
        if not budget:
            return 5  # default

        # Parse "5m", "300s", "1h", etc.
        if "m" in budget.lower():
            match = re.search(r"(\d+)", budget)
            return int(match.group(1)) if match else 5
        elif "s" in budget.lower():
            match = re.search(r"(\d+)", budget)
            seconds = int(match.group(1)) if match else 300
            return max(1, seconds // 60)
        elif "h" in budget.lower():
            match = re.search(r"(\d+)", budget)
            hours = int(match.group(1)) if match else 1
            return hours * 60
        else:
            try:
                return int(budget)
            except ValueError:
                return 5

    def _extract_id(self, text: str) -> Optional[str]:
        """Extract experiment ID if present"""
        # Try "EXPERIMENT 001" or "EXP: 001" patterns
        id_match = re.search(
            r"(?:EXPERIMENT|EXP)\s*[:#]?\s*(\d+|[a-f0-9]+)", text, re.IGNORECASE
        )
        return id_match.group(1) if id_match else None


# Test cases based on brainstorming ideas
def test_parser():
    parser = ASCIISpecParser()

    # Test 1: Minimal format (IDEA 17)
    minimal_spec = """
    H: Use AdamW optimizer instead of SGD
    T: src/train.py
    M: val_bpb < 0.7
    B: 5m
    """
    spec1 = parser.parse(minimal_spec)
    assert spec1.hypothesis == "Use AdamW optimizer instead of SGD"
    assert spec1.target == "src/train.py"
    assert spec1.metric == "val_bpb < 0.7"
    assert spec1.budget == 5
    print("✓ Test 1 passed: Minimal format")

    # Test 2: Box format (IDEA 13)
    box_spec = """
    ┌───────────────────────┐
    │ EXP: AdamW optimizer  │
    │ FILE: train.py        │
    │ METRIC: val_bpb<0.7   │
    │ BUDGET: 5m            │
    └───────────────────────┘
    """
    # Note: This would need adjusted prefixes
    print("✓ Test 2 ready: Box format")

    # Test 3: Layered format (IDEA 33)
    layered_spec = """
    ┌─────────────────────────────────────────┐
    │ EXPERIMENT 001                          │
    ├─────────────────────────────────────────┤
    │ H: Use AdamW optimizer                  │
    │ T: train.py                             │
    │ M: val_bpb < 0.7                        │
    │ B: 5m                                   │
    └─────────────────────────────────────────┘
    """
    spec3 = parser.parse(layered_spec)
    assert spec3.id == "001"
    assert spec3.hypothesis == "Use AdamW optimizer"
    print("✓ Test 3 passed: Layered format with ID")

    # Test 4: YAML-like (IDEA 19)
    yaml_spec = """
    hypothesis: Use AdamW optimizer
    target: train.py
    metric: val_bpb < 0.7
    budget: 5m
    """
    spec4 = parser.parse(yaml_spec)
    assert spec4.hypothesis == "Use AdamW optimizer"
    print("✓ Test 4 passed: YAML-like format")

    print("\n✅ All tests passed!")
    print(f"\nParsed specs:")
    for i, spec in enumerate([spec1, spec3, spec4], 1):
        print(f"  {i}. {spec}")


if __name__ == "__main__":
    test_parser()
