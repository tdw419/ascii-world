# Design: Alerting System

## Architecture

```
┌─────────────────────┐
│  Cell Update        │
│  {cpu: 0.85}        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Alert Engine       │
│                     │
│  Rules:             │
│  - cpu > 0.8        │
│  - mem > 0.9        │
└──────────┬──────────┘
           │ triggers
           ▼
┌─────────────────────┐
│  Notifier           │
│  - Webhook          │
│  - Console          │
│  - WebSocket        │
└─────────────────────┘
```

## Alert Rule Format

```json
{
  "name": "high_cpu",
  "cell": "cpu",
  "operator": ">",
  "threshold": 0.8,
  "severity": "critical",
  "message": "CPU usage above 80%",
  "cooldown": 60,
  "webhook": "https://hooks.slack.com/..."
}
```

## Operators

| Operator | Meaning |
|----------|---------|
| `>` | Greater than |
| `>=` | Greater than or equal |
| `<` | Less than |
| `<=` | Less than or equal |
| `==` | Equal to |
| `!=` | Not equal to |

## Severities

| Severity | Color | Priority |
|----------|-------|----------|
| `info` | Blue | 1 |
| `warning` | Yellow | 2 |
| `critical` | Red | 3 |

## API

### POST /api/v1/alerts
Set alert rules.

```bash
curl -X POST http://localhost:3839/api/v1/alerts \
  -d '[{"name":"high_cpu","cell":"cpu","operator":">","threshold":0.8}]'
```

### GET /api/v1/alerts
Get current alert rules.

### GET /api/v1/alerts/history
Get alert history.

## File Structure

```
sync/
├── alert-engine.js  — NEW
└── server.js        — MODIFY

tests/
└── alert-engine.test.js — NEW
```
