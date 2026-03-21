# Requirements: More Formula Functions

## Functional Requirements

### FR1: RECT Formula
- MUST draw filled rectangle at cell position
- MUST support named colors, RGB arrays, and hex

### FR2: LINE Formula
- MUST draw horizontal or vertical lines
- MUST support 'h' and 'v' direction parameter

### FR3: CIRCLE Formula
- MUST draw circle (filled or outline)
- MUST support radius in cells

### FR4: GAUGE Formula
- MUST draw circular gauge showing percentage
- MUST fill arc from top clockwise

### FR5: NUMBER Formula
- MUST format numbers with patterns like "0%", "0.0 GB"
- MUST resolve cell values

### FR6: TIME Formula
- MUST display current time
- MUST support HH:mm and HH:mm:ss formats

### FR7: Color System
- MUST resolve named colors to RGB
- MUST accept RGB arrays [r,g,b]
- MUST accept hex numbers 0xRRGGBB

## Test Criteria

```bash
npm test
# Expected: 50 tests passing
```

## Acceptance Criteria

- [x] 8 new tests pass
- [x] All existing tests still pass
- [x] resolveColor() helper works
- [x] README updated with new formulas
