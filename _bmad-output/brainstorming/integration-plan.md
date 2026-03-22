# ASCII Spec Integration Plan for AutoResearch

## Executive Summary

**Core Insight**: AIs output text natively. Instead of writing Python code to run experiments, AI writes ASCII specs that a fixed runtime executes.

**What We Built**:
1. `ascii_spec_parser.py` - Parses H/T/M/B format into structured spec
2. `ascii_spec_runtime.py` - Fixed interpreter that executes specs
3. Working demo with mock training script

## The Format (Minimal Viable)

```
┌─────────────────────────────────────────┐
│ EXPERIMENT 001                          │
├─────────────────────────────────────────┤
│ H: Use AdamW optimizer                  │
│ T: train.py                             │
│ M: val_bpb < 0.7                        │
│ B: 5m                                   │
└─────────────────────────────────────────┘
```

**Fields**:
- `H`: Hypothesis (what to test)
- `T`: Target file (what to run)
- `M`: Metric threshold (success criteria)
- `B`: Budget in minutes (timeout)

## Integration Path with AutoResearch

### Current Flow (OpenSpec+AutoResearch)
```
AI → writes markdown spec → Python parses → Pydantic model → executes code → logs results.tsv
```

### New Flow (ASCII Spec)
```
AI → writes ASCII spec → fixed parser → ExperimentSpec → runtime executes → visualizes result
```

### Concrete Integration Steps

#### Step 1: Add Parser to AutoResearch
```python
# In openspec+autoresearch/loop/
from ascii_world._bmad_output.brainstorming.ascii_spec_parser import ASCIISpecParser

class Loop:
    def run_from_ascii(self, ascii_text: str):
        parser = ASCIISpecParser()
        spec = parser.parse(ascii_text)
        return self.run(spec.hypothesis, spec.target)
```

#### Step 2: Replace Markdown Spec with ASCII Output
**Current (markdown)**:
```markdown
# Experiment: Use AdamW optimizer

## Hypothesis
AdamW converges faster than SGD.

## Target File
src/train.py
```

**New (ASCII)**:
```
┌──────────────────────────────┐
│ H: AdamW > SGD for speed    │
│ T: src/train.py             │
│ M: val_bpb < 0.7            │
│ B: 5m                       │
└──────────────────────────────┘
```

#### Step 3: Add Runtime Visualization
**Current**: Results logged to `results.tsv` (human reads later)

**New**: ASCII visualization printed immediately:
```
┌───────────────────────────────────────┐
│ EXP 001      ✓                        │
├───────────────────────────────────────┤
│ METRIC: 0.6161                        │
│ ELAPSED: 32s                          │
└───────────────────────────────────────┘
```

## Why This Helps

### 1. AI-Native Format
- **Problem**: AIs write text, but current spec is markdown + Python objects
- **Solution**: ASCII IS the program, no translation layer needed

### 2. Visual Debugging
- **Problem**: AI can't "see" its reasoning process
- **Solution**: Experiment state visualized as ASCII boxes/flowcharts

### 3. Self-Describing Experiments
- **Problem**: Separate logging layer (results.tsv) from execution
- **Solution**: Result visualization IS the experiment output

### 4. Minimal Runtime
- **Problem**: Complex Python infrastructure to run experiments
- **Solution**: Fixed parser + executor = ASCII interpreter

## Next Steps

1. **Test with real AutoResearch loop**
   - Replace one markdown spec with ASCII format
   - Verify parser extracts fields correctly
   - Confirm runtime executes same as current flow

2. **Add state machine visualization (IDEA 6)**
   ```
   ┌────────┐     ┌────────┐     ┌────────┐
   │ HYPOTH │────▶│ RUN    │────▶│ EVAL   │
   │ AdamW  │     │train.py│     │val_bpb │
   └────────┘     └────────┘     └───┬────┘
                                    │
                      ┌─────────────┴─────────────┐
                      ▼                           ▼n
                ┌──────────┐               ┌──────────┐
                │ < 0.7    │               │ >= 0.7   │
                │ KEEP ✓   │               │ REVERT ↩ │
                └──────────┘               └──────────┘
   ```

3. **Add experiment history table (IDEA 27)**
   - Track all runs in ASCII grid format
   - AI can "see" past experiments visually

4. **Explore parallel execution (IDEA 14)**
   - Multiple ASCII specs → orchestrated as flowchart
   - Runtime executes in parallel, merges results

## Files Created

- `_bmad-output/brainstorming/ascii_spec_parser.py` - Parser implementation
- `_bmad-output/brainstorming/ascii_spec_runtime.py` - Runtime executor  
- `_bmad-output/brainstorming/train.py` - Mock training script for testing
- `_bmad-output/brainstorming/integration-plan.md` - This document

## Demo Output

```
Parsed spec: Exp(001): Use AdamW optimizer...

🚀 Starting experiment: Use AdamW optimizer...
   ▶ Running: train.py
   ▶ Extracting metric from output...
   ✓ DECISION: KEEP (metric=0.6161)

┌───────────────────────────────────────┐
│ EXP 001      ✓                        │
├───────────────────────────────────────┤
│ METRIC: 0.6161                        │
│ ELAPSED: 0s                           │
└───────────────────────────────────────┘

╔═══════════════════════════════════════════════╗
║ EXPERIMENT HISTORY (1 runs)           ║
╠═══════════════════════════════════════════════╣
║   1. [✓] 001         metric=  0.6161     0s ║
╚═══════════════════════════════════════════════╝
```

---

**Status**: Prototype complete, ready for integration testing with AutoResearch.
