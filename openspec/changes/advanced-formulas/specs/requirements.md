# Requirements: Advanced Formulas

## Functional Requirements

### FR1: CHART
- MUST draw bar chart from array
- MUST scale bars to fit width
- MUST use max value for scaling

### FR2: DONUT/PROGRESS
- MUST draw ring chart with percentage
- MUST support custom colors
- MUST show background ring

### FR3: BADGE
- MUST draw text with background
- MUST support custom colors

### FR4: COND
- MUST fill cell with color based on threshold
- MUST support above/below colors

### FR5: HISTORY
- MUST show value with trend arrow
- MUST use ↑↓→ for trends

### FR6: GRID
- MUST display array as grid
- MUST wrap to multiple rows

## Test Criteria

```bash
npm test
# Expected: 58 tests passing
```

## Acceptance Criteria

- [x] 8 new tests pass
- [x] All formulas work
- [x] Documentation updated
