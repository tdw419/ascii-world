# Proposal: Pixel Formula Engine

## Summary
Implement a pixel-native formula engine that evaluates reactive cell formulas directly to RGBA pixel buffer operations, skipping the text intermediary layer.

## Problem
- Current architecture: AI → cells → text formulas → text string → pixel renderer → PNG
- The text layer (`████████░░░░`) is lossy encoding that gets immediately decoded
- Characters don't carry color, position, or semantic meaning
- Pixel renderer has to re-infer all visual properties from context

## Solution
Direct pixel formulas:
- `=BAR(cpu, 40)` → `drawProgressBar(x, y, w, h, 0.67, green, dark)`
- `=TEXT(label)` → `drawTextCell(col, row, "CPU", lightGray)`
- `=STATUS(state, ...)` → colored status indicator

Target architecture: AI → cells → **pixel formulas** → pixel buffer → PNG

## Impact
- Phase 2 complete with 27 tests passing
- Foundation for Phase 3 (direct pixel templates)
- Cleaner separation of concerns
- No more text intermediary

## Timeline
- Task 1: Fix documentation (5 min)
- Task 2: Create PixelFormulaEngine module (20 min)
- Task 3: Create tests (15 min)
- Task 4: Update docs post-implementation (5 min)
- Task 5: Final verification (5 min)

**Total: ~50 minutes**
