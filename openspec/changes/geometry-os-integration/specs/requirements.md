# Requirements: Geometry OS Integration

## Functional Requirements

### FR1: NEB Monitoring
- MUST collect NEB event rate
- MUST show events per second
- MUST show total event count

### FR2: GPU Monitoring
- MUST collect tile count
- MUST show program counter
- MUST calculate tile percentage

### FR3: CTRM Monitoring
- MUST collect fact count
- MUST show verification percentage

### FR4: Swarm Monitoring
- MUST collect agent count
- MUST collect guild count

### FR5: Mock Mode
- MUST work without Geometry OS installation
- MUST use realistic mock data

## Test Criteria

```bash
# Start server
npm start

# Run in mock mode
python agents/geometry_os_monitor.py --mock --once

# Verify cells
curl http://localhost:3839/api/v1/cells
```

## Acceptance Criteria

- [x] Agent runs in mock mode
- [x] Template displays all metrics
- [x] Documentation updated
