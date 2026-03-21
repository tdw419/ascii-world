# Requirements: Alerting System

## Functional Requirements

### FR1: Rule Evaluation
- MUST support comparison operators (>, >=, <, <=, ==, !=)
- MUST evaluate rules on cell updates
- MUST trigger alerts when conditions met

### FR2: Cooldown
- MUST prevent alert spam
- MUST support configurable cooldown period
- MUST track last trigger time per rule

### FR3: Notifications
- MUST broadcast alerts via WebSocket
- MUST log alerts to console
- MUST support custom notifiers

### FR4: API
- MUST provide GET /api/v1/alerts
- MUST provide POST /api/v1/alerts
- MUST provide GET /api/v1/alerts/history

## Test Criteria

```bash
npm test
# Expected: 68 tests passing
```

## Acceptance Criteria

- [x] 10 new tests pass
- [x] Alert engine works
- [x] Server integration complete
- [x] Documentation updated
