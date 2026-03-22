# AutoResearch ↔ pxOS Integration

Connects [OpenSpec+AutoResearch](../../../openspec+autoresearch/openspec+autoresearch/) with pxOS.

## The Loop

```
AI Agent generates Hypothesis
    ↓
AutoResearch applies code change + runs tests
    ↓
Keep (tests pass, metric improves) or Revert (tests fail)
    ↓
Result published to pxOS cell store
    ↓
pxOS renders experiment dashboard (BAR, SPARKLINE, STATUS formulas)
    ↓
AI sees pixel dashboard → generates next hypothesis
```

## Files

| File | Purpose |
|------|---------|
| `bridge.js` | Publishes results to pxOS API, creates dashboard template |
| `run-experiment.py` | Runs experiment loop against pxOS test suite |

## Quick Start

```bash
# Terminal 1: Start pxOS
cd /home/jericho/zion/projects/ascii_world/ascii_world
npm start

# Terminal 2: Set up dashboard + verify
node integrations/autoresearch/bridge.js check
node integrations/autoresearch/bridge.js setup-dashboard

# Terminal 3: Run baseline experiment
python3 integrations/autoresearch/run-experiment.py --dry-run
python3 integrations/autoresearch/run-experiment.py
```

## pxOS API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Verify server is running |
| `/api/v1/cells` | POST | Push experiment metrics as cells |
| `/api/v1/template` | POST | Set dashboard formula template |
| `/api/v1/dashboards` | POST | Save named dashboard |
| `/api/v1/render` | GET | Render dashboard to PNG |

## Cell Names

| Cell | Type | Description |
|------|------|-------------|
| `exp_commit` | string | Short commit hash |
| `exp_metric` | number | Tests passing (or other metric) |
| `exp_status` | number | 1=KEEP, 0=DISCARD |
| `exp_status_text` | string | "KEEP", "DISCARD", "CRASH" |
| `exp_desc` | string | Experiment description |
| `exp_tests_passed` | number | Number of tests passing |

## Dashboard Formulas

```
=BOX(0, 0, 60, 3)                                    # Header box
=TEXT(2, 1, "AUTORESEARCH EXPERIMENT DASHBOARD")      # Title
=STATUS(14, 7, "exp_status", 1, "● KEEP", "○ DISCARD") # Live status
=BAR(14, 8, "exp_tests_passed", 30)                   # Test pass bar
=SPARKLINE(2, 14, "exp_metric", 56)                   # Metric over time
```
