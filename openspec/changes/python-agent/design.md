# Design: Python Agent

## Architecture

```
┌─────────────────────┐
│  Python Agent       │
│  (system_monitor.py)│
│                     │
│  psutil:            │
│  - cpu_percent()    │
│  - virtual_memory() │
│  - disk_usage()     │
└──────────┬──────────┘
           │ POST /api/v1/cells
           ▼
┌─────────────────────┐
│  pxOS Server        │
│  localhost:3839     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Browser Viewer     │
│  viewer.html        │
└─────────────────────┘
```

## Metrics Collected

| Cell Key | Value | Source |
|----------|-------|--------|
| `cpu` | 0.0-1.0 | `psutil.cpu_percent() / 100` |
| `mem` | 0.0-1.0 | `psutil.virtual_memory().percent / 100` |
| `mem_gb` | GB used | `psutil.virtual_memory().used / 1e9` |
| `disk` | 0.0-1.0 | `psutil.disk_usage('/').percent / 100` |
| `net_sent` | MB | `psutil.net_io_counters().bytes_sent / 1e6` |
| `net_recv` | MB | `psutil.net_io_counters().bytes_recv / 1e6` |

## Template

```json
[
  {"fn": "TEXT", "args": [0, 0, "title"]},
  {"fn": "LINE", "args": [0, 1, 80, "h", "border"]},
  {"fn": "TEXT", "args": [0, 2, "cpu_label"]},
  {"fn": "BAR", "args": [10, 2, "cpu", 30]},
  {"fn": "NUMBER", "args": [42, 2, "cpu", "0%"]},
  {"fn": "TEXT", "args": [0, 3, "mem_label"]},
  {"fn": "BAR", "args": [10, 3, "mem", 30]},
  {"fn": "NUMBER", "args": [42, 3, "mem_gb", "0.0 GB"]},
  {"fn": "TIME", "args": [70, 0, "HH:mm:ss"]}
]
```

## File Structure

```
agents/
├── system_monitor.py    — Main agent script
├── requirements.txt     — Python deps (psutil)
└── template.json        — Example visualization template
```

## Usage

```bash
# Install dependencies
pip install -r agents/requirements.txt

# Run agent
python agents/system_monitor.py

# Or with custom server
python agents/system_monitor.py --url http://localhost:8080

# Or with custom interval
python agents/system_monitor.py --interval 2
```
