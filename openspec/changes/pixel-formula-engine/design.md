# Design: Pixel Formula Engine

## Overview
The PixelFormulaEngine takes reactive cell values (like `{"cpu": 0.67}`) and evaluates pixel-formula templates directly into PixelBuffer draw calls.

## Architecture

```
┌─────────────────┐
│  Cell Store     │  {"cpu": 0.67, "mem": 28.1}
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PixelFormula    │
│ Engine          │
│                 │
│ =BAR(cpu,40)    │──► buffer.drawProgressBar(...)
│ =TEXT(label)    │──► atlas.drawTextCell(...)
│ =STATUS(state)  │──► atlas.drawTextCell(..., color)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PixelBuffer    │  480×240 RGBA
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PNG Output     │  GET /api/v1/ui/pixels/{file}
└─────────────────┘
```

## Semantic Colors

| Name | RGB | Hex | Usage |
|------|-----|-----|-------|
| active | 63, 185, 80 | #3fb950 | ● healthy status |
| idle | 72, 79, 88 | #484f58 | ○ inactive status |
| critical | 248, 81, 73 | #f85149 | ◉ error/done |
| barFill | 35, 134, 54 | #238636 | Progress bar filled |
| barEmpty | 22, 27, 34 | #161b22 | Progress bar empty |
| border | 48, 54, 61 | #30363d | Box outlines |
| text | 201, 209, 217 | #c9d1d9 | Default text |

## Formula Functions

### BAR(col, row, cellValue, widthCells)
Progress bar at cell position.
- Resolves cellValue from cells store
- Clamps to 0-1 range
- Calls `buffer.drawProgressBar(px, py, w, h, fraction, barFill, barEmpty)`

### TEXT(col, row, cellValue)
Text label at cell position.
- Resolves cellValue (can be number or string)
- Calls `atlas.drawTextCell(buffer, col, row, text, text)`

### STATUS(col, row, cellValue, ...thresholds)
Status indicator with semantic coloring.
- Parses threshold pairs: `(level, displayText)*, defaultText`
- Chooses color based on indicator character:
  - `◉` → critical (red)
  - `●` → active (green)
  - `○` → idle (gray)

### BOX(col, row, widthCells, heightCells)
Box outline using pixel drawing.
- Draws four sides with border color
- Uses `buffer.setPixel()` directly

### SPARKLINE(col, row, cellValue, widthCells)
Mini bar chart from array values.
- Resolves cellValue as array
- Normalizes to min/max range
- Draws vertical bars from bottom

### renderTemplate(template)
Evaluate a pixel template (array of formula calls).
- Clears buffer first
- Iterates through operations
- Calls appropriate formula function

## Dependencies

- `PixelBuffer` from `./pixel-buffer.js` — RGBA buffer with drawing primitives
- `GlyphAtlas` from `./glyph-atlas.js` — 6×10 bitmap font

## File Structure

```
sync/
├── pixel-buffer.js        — EXISTS (16 tests)
├── glyph-atlas.js         — EXISTS (tests)
├── pixel-formula-engine.js — NEW (this design)
└── pixel-renderer.js      — EXISTS

tests/
├── pixel-buffer.test.js   — EXISTS
├── glyph-atlas.test.js    — EXISTS
└── pixel-formula-engine.test.js — NEW (11 tests)
```

## Implementation Order

1. Fix documentation (incorrect test count)
2. Create PixelFormulaEngine class
3. Implement formula functions
4. Create comprehensive tests
5. Update documentation
6. Final verification
