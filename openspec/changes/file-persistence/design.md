# Design: File Persistence

## File Structure

```
data/
├── dashboards.json    - Saved dashboards
├── alerts.json        - Alert rules
└── config.json        - Server configuration
```

## Dashboard Format

```json
{
  "version": 1,
  "dashboards": {
    "system-monitor": {
      "name": "system-monitor",
      "template": [...],
      "alerts": [...],
      "created": 1711050000000
    }
  }
}
```

## API Changes

### Server Options

```javascript
new PxOSServer(3839, {
  dataDir: './data',      // Directory for persistence
  autoSave: true,         // Auto-save on changes
  saveInterval: 5000      // Debounce saves (ms)
})
```

## Implementation

### DashboardStore Changes

```javascript
class DashboardStore {
  constructor(options = {}) {
    this.filePath = options.filePath;
    if (this.filePath) {
      this.loadFromFile();
    }
  }
  
  saveToFile() { ... }
  loadFromFile() { ... }
}
```

## Behavior

- On startup: Load from `data/dashboards.json` if exists
- On save/delete: Write to file (debounced)
- On error: Log, continue with in-memory
