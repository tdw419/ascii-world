# Design: Geometry OS Integration

## Architecture

```
┌─────────────────────────────────────────┐
│  Geometry OS                            │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ NEB      │ │ GPU VM   │ │ CTRM    │ │
│  │ 134k/s   │ │ 25 tiles │ │ 32k     │ │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │            │            │      │
│       └────────────┼────────────┘      │
│                    │                   │
│            ┌───────▼───────┐           │
│            │ geometry_os_  │           │
│            │ agent.py      │           │
│            └───────┬───────┘           │
└────────────────────┼───────────────────┘
                     │ POST /api/v1/cells
                     ▼
┌─────────────────────────────────────────┐
│  pxOS Server (localhost:3839)           │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Browser Viewer                         │
│  ┌─────────────────────────────────────┐│
│  │ Geometry OS Monitor                 ││
│  │ NEB     ████████████░░ 134.2k/s    ││
│  │ GPU     ████████░░░░░░ 25/64 tiles ││
│  │ CTRM    ██████████████ 32,847      ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## Geometry OS Agent

Similar to system_monitor.py but reads from Geometry OS internals:

### Data Sources

| Source | Path/Method | Cell Key |
|--------|-------------|----------|
| NEB stats | `/sys/kernel/neb/stats` or API | `neb_rate`, `neb_total` |
| GPU VM | `gpu_vm.status` | `gpu_tiles`, `gpu_pc` |
| CTRM | `ctrm count` | `ctrm_facts`, `ctrm_verified` |
| Processes | `psutil` | `processes`, `threads` |
| Memory | `psutil` | `mem`, `mem_gb` |

### Template

```json
[
  {"fn": "TEXT", "args": [0, 0, "title"]},
  {"fn": "TIME", "args": [70, 0, "HH:mm:ss"]},
  {"fn": "LINE", "args": [0, 1, 80, "h", "borderHighlight"]},
  
  {"fn": "TEXT", "args": [0, 2, "neb_label"]},
  {"fn": "BAR", "args": [10, 2, "neb_pct", 30]},
  {"fn": "NUMBER", "args": [42, 2, "neb_rate", "0k/s"]},
  
  {"fn": "TEXT", "args": [0, 3, "gpu_label"]},
  {"fn": "BAR", "args": [10, 3, "gpu_pct", 30]},
  {"fn": "NUMBER", "args": [42, 3, "gpu_tiles", "0 tiles"]},
  
  {"fn": "TEXT", "args": [0, 4, "ctrm_label"]},
  {"fn": "BAR", "args": [10, 4, "ctrm_pct", 30]},
  {"fn": "NUMBER", "args": [42, 4, "ctrm_facts", "0 facts"]}
]
```

## File Structure

```
pxos/
└── agents/
    └── geometry_os_monitor.py  — Geometry OS agent

geometry_os/
└── monitoring/
    └── pxos-dashboard/  — Optional symlink to pxos
```

## Usage

```bash
# Start pxOS server
cd pxos && npm start

# Start Geometry OS monitor
python agents/geometry_os_monitor.py --geometry-os-path ~/zion/projects/geometry_os

# Open viewer
open viewer/viewer.html
```

## Future Enhancements

1. **Bi-directional** - pxOS can send commands to Geometry OS
2. **Alerts** - Trigger alerts on threshold breaches
3. **History** - Store time-series data for charts
4. **Multi-node** - Monitor multiple Geometry OS instances
