# Requirements: Dashboard Templates

## Functional Requirements

### FR1: Save Dashboard
- MUST save current template + alerts as named dashboard
- MUST include timestamp

### FR2: Load Dashboard
- MUST restore template and alerts
- MUST return 404 if not found

### FR3: List Dashboards
- MUST return all saved dashboards
- MUST include summary info

### FR4: Delete Dashboard
- MUST remove dashboard by name

## Test Criteria

```bash
npm test
# Expected: 88 tests passing
```

## Acceptance Criteria

- [x] 8 new tests pass
- [x] All API endpoints work
- [x] Documentation updated
