# Design: Dashboard Templates

## Storage

Templates stored in memory (optionally persisted to file):

```javascript
{
  "system-monitor": {
    "template": [
      {"fn": "BAR", "args": [0, 0, "cpu", 40]},
      {"fn": "TEXT", "args": [42, 0, "cpu"]}
    ],
    "alerts": [
      {"name": "high_cpu", "cell": "cpu", "operator": ">", "threshold": 0.8}
    ],
    "created": 1711050000000
  }
}
```

## API

### POST /api/v1/dashboards
Save current template and alerts as a dashboard.

```bash
curl -X POST http://localhost:3839/api/v1/dashboards \
  -d '{"name": "system-monitor"}'
# {"ok": true, "name": "system-monitor"}
```

### GET /api/v1/dashboards
List all saved dashboards.

```bash
curl http://localhost:3839/api/v1/dashboards
# [{"name": "system-monitor", "created": 1711050000000}]
```

### GET /api/v1/dashboards/:name
Load a dashboard (sets template and alerts).

```bash
curl http://localhost:3839/api/v1/dashboards/system-monitor
# {"ok": true, "template": [...], "alerts": [...]}
```

### DELETE /api/v1/dashboards/:name
Delete a dashboard.

```bash
curl -X DELETE http://localhost:3839/api/v1/dashboards/system-monitor
# {"ok": true}
```

## Use Cases

1. **System Monitor** - CPU, memory, disk visualization
2. **Geometry OS** - NEB, GPU, CTRM metrics
3. **Custom App** - Application-specific dashboard
