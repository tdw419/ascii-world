# Design: Time-Series Storage

## Architecture

```
┌─────────────────────┐
│  Cell Update        │
│  {cpu: 0.85}        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  TimeSeriesStore    │
│                     │
│  cpu: [             │
│    {t: 1711050, v: 0.75},
│    {t: 1711049, v: 0.72},
│    ...              │
│  ]                  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  API                 │
│  GET /api/v1/history │
│  GET /api/v1/history │
│      /cpu?points=100 │
└─────────────────────┘
```

## Storage Format

```javascript
{
  "cpu": [
    { "t": 1711050000000, "v": 0.75 },
    { "t": 1711049999000, "v": 0.72 },
    // ... max 1000 points
  ],
  "mem": [...]
}
```

## Configuration

- `maxPoints`: Maximum points per cell (default: 1000)
- `interval`: Minimum interval between recordings (default: 1000ms)

## API

### GET /api/v1/history/:cell
Get history for a specific cell.

```bash
curl http://localhost:3839/api/v1/history/cpu?points=100
# [{"t":1711050000000,"v":0.75},...]
```

### GET /api/v1/history
Get history for all cells.

```bash
curl http://localhost:3839/api/v1/history
# {"cpu":[...],"mem":[...]}
```

## Use Cases

1. **Sparklines**: `SPARKLINE(0, 0, 'cpu_history', 50)` uses stored history
2. **Trend alerts**: Alert when value increases/decreases over time
3. **Charts**: `CHART(0, 2, 'cpu_history', 40, 3, 'barFill')`
4. **Export**: Download historical data as JSON/CSV

## File Structure

```
sync/
├── time-series-store.js  — NEW
└── server.js             — MODIFY
```
