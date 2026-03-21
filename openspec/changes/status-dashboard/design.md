# Design: Built-in Status Dashboard

## Endpoint: GET /status

Returns a pre-rendered status dashboard as PNG.

```bash
curl -o status.png http://localhost:3839/status
```

## Metrics Displayed

```
┌─────────────────────────────────────────┐
│ pxOS Status              ● 16:54:32     │
├─────────────────────────────────────────┤
│ Uptime     2h 34m 12s                   │
│ Clients    3                            │
│ Cells      12                           │
│ Alerts     2 active                     │
│ Memory     45.2 MB                      │
│ Requests   1,234/min                    │
└─────────────────────────────────────────┘
```

## Metrics Tracked

| Metric | Source |
|--------|--------|
| uptime | `process.uptime()` |
| clients | `this.clients.size` |
| cells | `this.cellStore.getCells()` count |
| alerts | `this.alertEngine.getRules()` count |
| memory | `process.memoryUsage().heapUsed` |
| requests | Counter per minute |

## Template

```javascript
[
  { fn: 'TEXT', args: [0, 0, 'title'] },
  { fn: 'TIME', args: [70, 0, 'HH:mm:ss'] },
  { fn: 'LINE', args: [0, 1, 80, 'h', 'border'] },
  { fn: 'TEXT', args: [0, 2, 'uptime_label'] },
  { fn: 'TEXT', args: [15, 2, 'uptime'] },
  { fn: 'TEXT', args: [0, 3, 'clients_label'] },
  { fn: 'NUMBER', args: [15, 3, 'clients', '0'] },
  ...
]
```

## Implementation

Add to PxOSServer:
- `trackRequest()` - Called on each HTTP request
- `getStatusCells()` - Returns metrics as cells
- `handleStatus(req, res)` - Renders status dashboard
