# Requirements: Time-Series Storage

## Functional Requirements

### FR1: Recording
- MUST record cell values with timestamps
- MUST enforce minimum interval
- MUST trim to max points

### FR2: Querying
- MUST support getHistory(cell, points)
- MUST support getAllHistory(points)
- MUST support getValues(cell)

### FR3: API
- MUST provide GET /api/v1/history/:cell
- MUST provide GET /api/v1/history

## Test Criteria

```bash
npm test
# Expected: 79 tests passing
```

## Acceptance Criteria

- [x] 11 new tests pass
- [x] Server integration complete
- [x] Documentation updated
