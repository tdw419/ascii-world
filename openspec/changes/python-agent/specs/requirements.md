# Requirements: Python Agent

## Functional Requirements

### FR1: Metric Collection
- MUST collect CPU usage percentage
- MUST collect memory usage
- MUST collect disk usage
- MUST collect network stats

### FR2: API Integration
- MUST POST to /api/v1/cells endpoint
- MUST set template via /api/v1/template
- MUST handle connection errors gracefully

### FR3: Configuration
- MUST support --url argument
- MUST support --interval argument
- MUST support --template argument
- MUST support --once for single update

## Non-Functional Requirements

### NFR1: Dependencies
- MUST only require psutil
- MUST use stdlib for HTTP (urllib)

### NFR2: Usability
- MUST print status on each update
- MUST handle Ctrl+C gracefully

## Test Criteria

```bash
# Start server
npm start

# Run agent
pip install -r agents/requirements.txt
python agents/system_monitor.py --once

# Verify cells updated
curl http://localhost:3839/api/v1/cells
```

## Acceptance Criteria

- [x] Agent runs without errors
- [x] Metrics posted to server
- [x] Template loaded successfully
- [x] Documentation updated
