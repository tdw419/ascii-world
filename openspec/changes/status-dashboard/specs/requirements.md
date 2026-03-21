# Requirements: Status Dashboard

## Functional Requirements

### FR1: Metrics Display
- MUST show uptime
- MUST show connected clients
- MUST show cell count
- MUST show alert count
- MUST show memory usage
- MUST show request rate

### FR2: Endpoint
- MUST provide GET /status
- MUST return PNG image

## Test Criteria

```bash
npm test
# Expected: 91 tests passing
```

## Acceptance Criteria

- [x] /status endpoint works
- [x] Metrics tracked correctly
- [x] PNG rendered
