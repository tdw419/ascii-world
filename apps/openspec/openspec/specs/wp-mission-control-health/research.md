---
spec: wp-mission-control-health
phase: research
created: 2026-02-21T00:00:00Z
generated: auto
---

# Research: wp-mission-control-health

## Executive Summary

Extend WordPress-Map Mission Control integration with MetricsCollector for latency tracking, SystemHealthDashboard for real-time visualization, and stress/resilience testing infrastructure. High feasibility leveraging existing `window.geometryOS` bridge and verification framework patterns.

## Codebase Analysis

### Existing Infrastructure

| Component | Path | Purpose |
|-----------|------|---------|
| window.geometryOS bridge | `systems/visual_shell/web/application.js` | Tile registry, command dispatch, console output events |
| WPIntegrationVerifier | `systems/visual_shell/web/tests/verification_wp_integration.js` | 5 golden path tests pattern |
| PerformanceMonitor | `systems/visual_shell/web/PerformanceMonitor.js` | Rolling window sampling, FPS tracking |

### Existing Patterns

- **Event-driven architecture**: `window.dispatchEvent(new CustomEvent('geometryOS:*', {detail}))`
- **Registry pattern**: `window.geometryOS.tileRegistry` Map for tile tracking
- **Command dispatch**: `window.geometryOS.sendCommand(tileId, cmd)` for tile control
- **Broadcast**: `window.geometryOS.broadcastCommand(cmd)` for swarm control
- **Console output events**: `geometryOS:consoleOutput` for tile responses

### Related Code

```javascript
// verification_wp_integration.js - Existing test pattern
window.geometryOS?.registerTile(testId, { x: 100, y: 100, state: 'running' });
window.addEventListener('geometryOS:consoleOutput', listener);
window.geometryOS?.broadcastCommand("uptime");
```

### Dependencies

| Dependency | Type | Usage |
|------------|------|-------|
| PixiJS | Runtime | Already loaded in application.js |
| performance.now() | Native | High-resolution timing |
| CustomEvent | Native | Event dispatch for metrics updates |
| WordPress PHP | Runtime | Script enqueue (mu-plugin) |

### Constraints

- Browser-native JavaScript (no build step required)
- Backward-compatible with existing `window.geometryOS` bridge
- Must not impact 60 FPS rendering target
- Graceful degradation if MetricsCollector fails to load

## Feasibility Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Technical Viability | High | Extends existing bridge; no new infrastructure |
| Effort Estimate | S | 7 tasks, each ~30min implementation |
| Risk Level | Low | Isolated components; existing test patterns |

## Architecture Context

```
WordPress Mission Control Page
├── geometry_os_bridge.php (mu-plugin)
│   └── Enqueue scripts
├── MetricsCollector.js (NEW)
│   ├── Latency measurement (start/end)
│   ├── Sync count tracking
│   └── Event emission (geometryOS:metricsUpdate)
├── SystemHealthDashboard.js (NEW)
│   ├── Real-time metric table
│   ├── Status indicators (PASS/WARN/FAIL)
│   └── Event listener for updates
└── wp_health_bridge.js (NEW)
    └── DOM injection & initialization
```

## Recommendations

1. Use PerformanceMonitor.js pattern for rolling window metrics
2. Follow verification_wp_integration.js test structure for consistency
3. Leverage existing `geometryOS:*` event namespace for new events
4. Target <100ms latency as healthy threshold (based on plan specs)
