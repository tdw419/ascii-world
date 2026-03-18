# Tasks: Add Perceptual Bridge V16

> **Status**: Ready for Execution
> **Team**: perceptual-bridge-team

## Phase 1: Core Anomaly Detection

### Task 1.1: Create AnomalyDetector with Pattern Matching
- **Assignee**: anomaly-detector-engineer
- **Dependencies**: None
- **Files**:
  - Create: `systems/neural_city/perceptual_bridge.py`
  - Create: `systems/neural_city/tests/test_perceptual_bridge.py`

**Acceptance Criteria**:
- [ ] Detects "kernel panic" → CRITICAL
- [ ] Detects "ERROR:" → WARNING
- [ ] Healthy text → HEALTHY
- [ ] Empty text → HEALTHY
- [ ] Multiple anomalies → highest severity
- [ ] Tests pass: `pytest systems/neural_city/tests/test_perceptual_bridge.py -v`

---

### Task 1.2: Create PerceptualBridge Daemon Class
- **Assignee**: anomaly-detector-engineer
- **Dependencies**: Task 1.1
- **Files**:
  - Modify: `systems/neural_city/perceptual_bridge.py`

**Acceptance Criteria**:
- [ ] PerceptualBridge can be instantiated
- [ ] start() begins async monitoring loop
- [ ] stop() cleanly terminates
- [ ] DIAGNOSTIC_PULSE format is JSON-serializable

---

## Phase 2: VisualBridge Integration

### Task 2.1: Add DIAGNOSTIC_PULSE Handler to VisualBridge
- **Assignee**: visual-bridge-integrator
- **Dependencies**: None
- **Files**:
  - Modify: `systems/visual_shell/api/visual_bridge.py`
  - Create: `systems/visual_shell/api/tests/test_perceptual_integration.py`

**Acceptance Criteria**:
- [ ] diagnostic_pulse message routed correctly
- [ ] DIAGNOSTIC_PULSE broadcast to clients
- [ ] CRITICAL triggers QUARANTINE_DISTRICT
- [ ] Tests pass: `pytest systems/visual_shell/api/tests/test_perceptual_integration.py -v`

---

### Task 2.2: Wire PerceptualBridge Startup with VisualBridge
- **Assignee**: visual-bridge-integrator
- **Dependencies**: Task 1.2, Task 2.1
- **Files**:
  - Modify: `systems/visual_shell/api/visual_bridge.py`

**Acceptance Criteria**:
- [ ] VisualBridge.start() initializes PerceptualBridge
- [ ] Background task starts monitoring
- [ ] Startup log shows "🔮 Perceptual Bridge V16 initialized"

---

## Phase 3: HUD Frontend

### Task 3.1: Create PerceptualBridgeHUD JavaScript Class
- **Assignee**: hud-frontend-engineer
- **Dependencies**: None
- **Files**:
  - Modify: `systems/visual_shell/web/visual_debug_overlay.js`

**Acceptance Criteria**:
- [ ] HUD section appears with 🔮 PERCEPTUAL BRIDGE V16 header
- [ ] Status shows ✓ HEALTHY / ⚠ WARNING / ✗ CRITICAL
- [ ] CRITICAL triggers red pulse animation
- [ ] Anomaly detail shows matched pattern

---

### Task 3.2: Wire DIAGNOSTIC_PULSE Events to HUD
- **Assignee**: hud-frontend-engineer
- **Dependencies**: Task 3.1
- **Files**:
  - Modify: `systems/visual_shell/web/visual_debug_overlay.js`

**Acceptance Criteria**:
- [ ] Browser receives DIAGNOSTIC_PULSE events
- [ ] HUD updates in real-time
- [ ] PC value displays correctly

---

## Phase 4: E2E Testing

### Task 4.1: Create E2E Integration Tests
- **Assignee**: e2e-integration-engineer
- **Dependencies**: Task 1.1, Task 2.1
- **Files**:
  - Create: `systems/neural_city/tests/test_perceptual_e2e.py`

**Acceptance Criteria**:
- [ ] test_panic_detection_to_quarantine_flow passes
- [ ] test_healthy_execution_no_quarantine passes
- [ ] test_warning_logs_but_no_quarantine passes
- [ ] test_pulse_format_for_websocket passes

---

### Task 4.2: Full System Verification
- **Assignee**: e2e-integration-engineer
- **Dependencies**: Task 1.2, Task 2.2, Task 3.2, Task 4.1
- **Files**: None (verification task)

**Acceptance Criteria**:
- [ ] VisualBridge starts without errors
- [ ] Perceptual Bridge initializes
- [ ] HUD shows Perceptual Bridge section (Ctrl+Shift+V)
- [ ] All tests pass: `pytest systems/neural_city/tests/ -v`

---

## Task Graph

```
Task 1.1 ─────► Task 1.2 ─────────────────────────────┐
    │                                                  │
    ▼                                                  ▼
Task 2.1 ─────► Task 2.2 ◄───────────────────────────┘
    │                 │
    │                 │
    ▼                 │
Task 3.1 ─────► Task 3.2
    │
    │
    ▼
Task 4.1 ─────► Task 4.2 ◄── (all tasks)
```

## Parallelization

- **Wave 1**: Task 1.1, Task 2.1, Task 3.1 (no dependencies)
- **Wave 2**: Task 1.2, Task 3.2 (depend on Wave 1)
- **Wave 3**: Task 2.2 (depends on 1.2, 2.1)
- **Wave 4**: Task 4.1 (depends on 1.1, 2.1)
- **Wave 5**: Task 4.2 (all tasks complete)
