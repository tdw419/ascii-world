---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'ASCII-based experiment spec format for AutoResearch framework'
session_goals: 'Design an ASCII spec format where specs ARE executable programs, AI outputs ASCII naturally, fixed runtime executes specs'
selected_approach: 'ai-recommended'
techniques_used: ['First Principles', 'Analogical Thinking', 'Cross-Pollination', 'Reversal Inversion', 'Morphological Analysis', 'Constraint Mapping', 'What If Scenarios', 'Sensory Exploration', 'Pirate Code', 'Zombie Apocalypse', 'Emergent Thinking', 'Dream Fusion']
ideas_generated: 35
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Jericho
**Date:** 2026-03-22

## Session Overview

**Topic:** ASCII-based experiment spec format for AutoResearch framework
**Goals:** Design an ASCII spec format where specs ARE executable programs, AI outputs ASCII naturally, fixed runtime executes specs

### Core Insight
AIs output text naturally → ASCII is their native language → specs should BE programs, not describe programs

---

## SYNTHESIS: The Unified Format

Combining best ideas into a layered spec format:

### Layer 0: Minimal (4 lines)
```
H: Use AdamW optimizer
T: train.py
M: val_bpb < 0.7
B: 5m
```

### Layer 1: Boxed
```
┌───────────────────────────┐
│ H: Use AdamW optimizer    │
│ T: train.py               │
│ M: val_bpb < 0.7          │
│ B: 5m                     │
└───────────────────────────┘
```

### Layer 2: Flow
```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ HYPOTH  │────▶│ RUN     │────▶│ EVAL    │────▶│ DECIDE  │
│ AdamW   │     │ train   │     │ val_bpb │     │ ?       │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### Layer 3: Full (Box + KV + Flow + History)
```
╔═══════════════════════════════════════════════════════════════╗
║ EXPERIMENT: optimizer-search-001                              ║
╠═══════════════════════════════════════════════════════════════╣
║ SPEC                                                          ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ H: Use AdamW optimizer instead of SGD                   │  ║
║ │ T: train.py                                             │  ║
║ │ M: val_bpb < 0.7                                        │  ║
║ │ B: 5m                                                   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
╠═══════════════════════════════════════════════════════════════╣
║ FLOW                                                          ║
║ ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐  ║
║ │ HYPOTH  │────▶│ RUN     │────▶│ EVAL    │────▶│ DECIDE  │  ║
║ │ AdamW   │     │ train   │     │ val_bpb │     │ ?       │  ║
║ └─────────┘     └─────────┘     └─────────┘     └─────────┘  ║
╠═══════════════════════════════════════════════════════════════╣
║ HISTORY                                                       ║
║ ┌───────┬─────────────┬──────────┬────────┬────────────────┐ ║
║ │ RUN   │ HYPOTHESIS  │ METRIC   │ STATUS │ ACTION         │ ║
║ ├───────┼─────────────┼──────────┼────────┼────────────────┤ ║
║ │ 001   │ SGD         │ 0.89     │ DONE   │ BASELINE       │ ║
║ │ 002   │ AdamW 1e-4  │ 0.71     │ DONE   │ KEEP ✓         │ ║
║ │ 003   │ AdamW 1e-5  │ ???      │ RUN    │ -              │ ║
║ └───────┴─────────────┴──────────┴────────┴────────────────┘ ║
╠═══════════════════════════════════════════════════════════════╣
║ VISUAL                                                        ║
║ 1.0 ┤●                                                       ║
║ 0.9 ┤ ●                                                       ║
║ 0.8 ┤  ●                                                      ║
║ 0.7 ┤   ●                                                     ║
║ 0.6 ┤    ● ← CURRENT                                          ║
║     └───────────────                                          ║
║       1   2   3   4   5                                       ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## DESIGN DECISIONS

1. **H/T/M/B keys are sacred** - Always parse these 4 fields
2. **Boxes are optional** - Runtime handles both boxed and unboxed
3. **History is auto-generated** - Runtime maintains, AI reads
4. **Visual is auto-generated** - Runtime renders metric history
5. **AI only writes SPEC section** - Everything else is derived

---

## IMPLEMENTATION

Created in `/home/jericho/zion/projects/openspec+autoresearch/openspec+autoresearch/`:

### Files Created

| File | Purpose |
|------|---------|
| `src/openspec_autoresearch/ascii_spec.py` | Parser + spec models |
| `src/openspec_autoresearch/ascii_runtime.py` | Fixed runtime |
| `tests/test_ascii_spec.py` | 15 passing tests |
| `examples/optimizer-search.ascii` | Layer 2 example |
| `examples/learning-rate-tune.ascii` | Layer 0 example |
| `examples/README.md` | Documentation |

### Key Classes

```python
ASCIIExperimentSpec  # Parsed spec with H/T/M/B fields
ASCIISpecParser      # Parses any layer format
ASCIIResult          # Result formatted as ASCII
ASCIIExperimentRuntime  # Fixed runtime that executes specs
```

### Usage

```python
from openspec_autoresearch.ascii_runtime import ASCIIExperimentRuntime

runtime = ASCIIExperimentRuntime(project_path=".")

# AI outputs this naturally:
spec = """H: Use AdamW optimizer
T: train.py
M: val_bpb < 0.7
B: 5m"""

result = runtime.run_spec(spec)
print(result.to_ascii())
```

### Output

```
╔═══════════════════════════════════════════════════════════════╗
║ RESULT: experiment                                            ║
║ STATUS: COMPLETE ✓                                            ║
║ METRIC: val_bpb=0.6500                                        ║
║ TARGET: val_bpb < 0.7 → KEEP                                  ║
║ ELAPSED: 234.5s                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## THE PARADIGM SHIFT

**Before:**
```
AI → writes Python → Python runs → logs to TSV → human reads
```

**After:**
```
AI → writes ASCII → ASCII IS the program → runtime renders ASCII → AI reads
```

The AI never writes Python. It writes ASCII specs. The runtime is fixed.

This is the same insight as ASCII World:
- AI outputs text naturally
- Text IS the program
- Runtime is fixed and minimal

---
