# Requirements: Sync Server

## Functional Requirements

### FR1: CellStore
- MUST store key-value cell data
- MUST notify subscribers when values change
- MUST return only changed keys
- MUST support subscribe/unsubscribe

### FR2: HTTP Server
- MUST serve on configurable port
- MUST support CORS for browser clients
- MUST handle concurrent requests

### FR3: API Endpoints
- MUST implement GET /health
- MUST implement GET /api/v1/cells
- MUST implement POST /api/v1/cells
- MUST implement GET /api/v1/render
- MUST implement POST /api/v1/template

### FR4: WebSocket
- MUST accept WebSocket connections
- MUST send current state on connect
- MUST broadcast changes to all clients

### FR5: PNG Rendering
- MUST render current template with current cells
- MUST return valid PNG image
- MUST use PixelFormulaEngine

## Non-Functional Requirements

### NFR1: Performance
- MUST respond to /health in <10ms
- MUST render PNG in <100ms

### NFR2: Reliability
- MUST handle malformed JSON gracefully
- MUST not crash on client disconnect

## Test Criteria

```bash
npm test
# Expected: 42 tests (28 + 14 new)

# Manual tests
curl http://localhost:3839/health
curl -X POST http://localhost:3839/api/v1/cells -d '{"cpu":0.5}'
curl http://localhost:3839/api/v1/cells
curl -o out.png http://localhost:3839/api/v1/render
```

## Acceptance Criteria

- [ ] 14 new tests pass
- [ ] Server starts and stops cleanly
- [ ] All API endpoints work
- [ ] WebSocket broadcasts changes
- [ ] PNG output is valid
