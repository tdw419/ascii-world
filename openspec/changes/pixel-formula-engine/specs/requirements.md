# Requirements: Pixel Formula Engine

## Functional Requirements

### FR1: Cell Value Resolution
- MUST resolve cell references (string keys) from cell store
- MUST pass through literal values unchanged
- MUST handle missing cell references gracefully

### FR2: BAR Formula
- MUST draw progress bar at specified cell position
- MUST clamp values to 0-1 range
- MUST use semantic colors (green fill, dark empty)

### FR3: TEXT Formula
- MUST render text at cell coordinates
- MUST use GlyphAtlas for character rendering
- MUST convert numeric values to strings

### FR4: STATUS Formula
- MUST support threshold-based status display
- MUST apply semantic colors based on indicator character
- MUST support default fallback text

### FR5: BOX Formula
- MUST draw rectangular outline at cell position
- MUST use border color
- MUST handle arbitrary dimensions

### FR6: SPARKLINE Formula
- MUST render array data as mini bar chart
- MUST normalize to min/max range
- MUST draw bars from bottom of cell row

### FR7: Template Rendering
- MUST clear buffer before rendering
- MUST evaluate formula operations in sequence
- MUST return PixelBuffer for chaining

## Non-Functional Requirements

### NFR1: Performance
- MUST render 480×240 buffer in <10ms
- MUST support 60 FPS refresh rate

### NFR2: Compatibility
- MUST use ES module syntax (type: module)
- MUST work with Node.js test runner

### NFR3: Test Coverage
- MUST have 11 passing tests
- MUST cover all formula functions
- MUST test edge cases (empty arrays, missing values)

## Test Criteria

```bash
# All tests must pass
node --test tests/pixel-formula-engine.test.js

# Expected output
✔ creates buffer with correct dimensions
✔ clear fills buffer with dark color
✔ setCells stores cell values
✔ resolveValue returns literal values
✔ resolveValue looks up cell references
✔ BAR draws progress bar
✔ TEXT draws text at cell coordinates
✔ STATUS draws status indicator
✔ BOX draws a box outline
✔ SPARKLINE draws sparkline from history
✔ renderTemplate evaluates a pixel template
✔ toPNG produces valid PNG buffer

ℹ tests 11
ℹ pass 11
```

## Acceptance Criteria

- [ ] All 11 tests pass
- [ ] Documentation updated to reflect 27 total tests
- [ ] No Node.js warnings
- [ ] Clean git status after implementation
