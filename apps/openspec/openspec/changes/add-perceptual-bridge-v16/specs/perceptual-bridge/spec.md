# Spec: Perceptual Bridge V16

## Overview

The Perceptual Bridge V16 provides visual anomaly detection for Geometry OS, enabling autonomous binary generation with a safety net.

## Components

### AnomalyDetector

```python
class AnomalyDetector:
    """Scans text for anomaly patterns (panics, errors, bugs)."""

    CRITICAL_PATTERNS: List[str]  # kernel panic, segfault, etc.
    WARNING_PATTERNS: List[str]   # error, fail, bug, etc.

    def scan(text: str) -> AnomalyResult:
        """Scan text and return status + matched pattern."""
```

### AnomalyResult

```python
@dataclass
class AnomalyResult:
    status: DiagnosticStatus  # HEALTHY | WARNING | CRITICAL
    matched_pattern: str      # The regex match that triggered
    detected_text: str        # Truncated source text
    timestamp: float          # When scanned
```

### PerceptualBridge

```python
class PerceptualBridge:
    """Background daemon monitoring Silicon District."""

    def __init__(
        ws_url: str,           # WebSocket URL for VisualBridge
        district_id: str,      # "silicon"
        scan_interval: float,  # 2.0 seconds
        freeze_threshold: float # 5.0 seconds
    ): ...

    async def start() -> None:  """Begin monitoring loop."""
    def stop() -> None:         """Stop monitoring."""
```

### DIAGNOSTIC_PULSE Event

```json
{
  "type": "DIAGNOSTIC_PULSE",
  "district_id": "silicon",
  "status": "HEALTHY" | "WARNING" | "CRITICAL",
  "matched_pattern": "kernel panic",
  "detected_text": "Kernel panic - not syncing...",
  "timestamp": 1708364400.0
}
```

### QUARANTINE_DISTRICT Event

```json
{
  "type": "QUARANTINE_DISTRICT",
  "district_id": "silicon",
  "reason": "kernel panic",
  "severity": "CRITICAL",
  "timestamp": 1708364400.0
}
```

## Pattern Definitions

### CRITICAL Patterns
- `kernel\s+panic`
- `call\s+trace`
- `segfault`
- `segmentation\s+fault`
- `general\s+protection\s+fault`
- `not\s+syncing`
- `unable\s+to\s+mount`

### WARNING Patterns
- `error\s*:`
- `failed`
- `failure`
- `bug\s*:`
- `warning\s*:`
- `exception`

## HUD Display

```
┌──────────────────────────────────┐
│ 🔮 PERCEPTUAL BRIDGE V16         │
├──────────────────────────────────┤
│ Status: ✓ HEALTHY                │
│ Last Scan: 2.1s ago              │
│ PC: 0x80001234                   │
│ Anomalies: 0                     │
└──────────────────────────────────┘
```

On CRITICAL:
```
┌──────────────────────────────────┐
│ 🔮 PERCEPTUAL BRIDGE V16         │
├──────────────────────────────────┤
│ Status: ✗ CRITICAL               │
│ ⚠ KERNEL PANIC DETECTED          │
│ PC: 0x80000000 (frozen 12s)      │
│ Action: QUARANTINED              │
└──────────────────────────────────┘
```

## File Locations

| Component | File |
|-----------|------|
| AnomalyDetector | `systems/neural_city/perceptual_bridge.py` |
| PerceptualBridge | `systems/neural_city/perceptual_bridge.py` |
| VisualBridge Handler | `systems/visual_shell/api/visual_bridge.py` |
| HUD Display | `systems/visual_shell/web/visual_debug_overlay.js` |
| Unit Tests | `systems/neural_city/tests/test_perceptual_bridge.py` |
| Integration Tests | `systems/visual_shell/api/tests/test_perceptual_integration.py` |
| E2E Tests | `systems/neural_city/tests/test_perceptual_e2e.py` |

## Test Coverage

| Test | File | Purpose |
|------|------|---------|
| test_detect_kernel_panic_text | test_perceptual_bridge.py | CRITICAL detection |
| test_detect_error_text | test_perceptual_bridge.py | WARNING detection |
| test_healthy_text_returns_healthy | test_perceptual_bridge.py | Healthy flow |
| test_multiple_anomalies_returns_highest_severity | test_perceptual_bridge.py | Priority |
| test_empty_text_returns_healthy | test_perceptual_bridge.py | Edge case |
| test_case_insensitive_detection | test_perceptual_bridge.py | Case handling |
| test_diagnostic_pulse_broadcasts_to_clients | test_perceptual_integration.py | Broadcast |
| test_quarantine_trigger_on_critical | test_perceptual_integration.py | Quarantine |
| test_panic_detection_to_quarantine_flow | test_perceptual_e2e.py | E2E flow |
| test_healthy_execution_no_quarantine | test_perceptual_e2e.py | Healthy E2E |
| test_warning_logs_but_no_quarantine | test_perceptual_e2e.py | Warning E2E |
| test_pulse_format_for_websocket | test_perceptual_e2e.py | JSON format |

**Total: 12 tests**
