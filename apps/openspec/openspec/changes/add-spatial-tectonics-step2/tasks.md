# Spatial Tectonics Step 2 - Implementation Tasks

## Prerequisites
- [x] Step 1 complete: NeuralPulseSystem → ConsensusEngine
- [x] TectonicSimulator Rust module implemented
- [x] ConsensusEngine Python module implemented

## 1. TectonicWSClient

> **Note**: Implemented as `TectonicBridge` in `spatial_tectonics.py` during Step 1.

### 1.1 Implementation
- [x] ~~Create `systems/evolution_daemon/tectonic_ws_client.py`~~ → Using `TectonicBridge` in `spatial_tectonics.py`
- [x] Implement `format_proposal_message()` for Rust protocol
- [x] Implement async `connect()` to Visual Bridge
- [x] Implement async `submit_proposal()` method
- [x] Implement `close()` for cleanup

### 1.2 Testing
- [x] Test message format structure (via test_tectonics_e2e.py)
- [x] Test connection handling (via TectonicBridge tests)

## 2. TectonicHandler

### 2.1 Implementation
- [x] Create `systems/visual_shell/api/tectonic_handler.py`
- [x] Implement `process_proposal()` method
- [x] Implement `_write_proposal_state()` for Rust communication
- [x] Implement `read_layout_delta()` from Rust
- [x] Create shared state directory `.geometry/tectonic/`

### 2.2 Testing
- [x] Write `tests/test_tectonic_handler.py`
- [x] Test proposal processing
- [x] Test state file I/O

## 3. VATManager

### 3.1 Implementation
- [x] Create `systems/visual_shell/api/vat_manager.py`
- [x] Implement `_load_vat()` from disk
- [x] Implement `_save_vat()` to disk
- [x] Implement `set_tile_position()` and `get_tile_position()`
- [x] Implement `apply_delta()` for layout updates

### 3.2 Testing
- [x] Write `tests/test_vat_manager.py`
- [x] Test position get/set
- [x] Test delta application
- [x] Test persistence

## 4. Visual Bridge Integration

### 4.1 Component Wiring
- [x] Import TectonicHandler in Visual Bridge
- [x] Import VATManager in Visual Bridge
- [x] Initialize in `__init__`
- [x] Update `tectonic_proposal` handler to use components

### 4.2 Testing
- [x] Test end-to-end proposal handling (via test_tectonics_e2e.py)

## 5. HUD Visualization

### 5.1 Implementation
- [x] Add tectonic state to overlay
- [x] Add `_renderTectonicSection()` method
- [x] Add WebSocket handlers for tectonic events
- [x] Display top bond, status, cycle count

### 5.2 Testing
- [ ] Manual test: Open HUD, verify section visible
- [ ] Manual test: Trigger proposal, verify display updates

## 6. End-to-End Testing

### 6.1 Integration Tests
- [x] Create `tests/test_tectonics_e2e.py`
- [x] Test full pulse → proposal → VAT flow
- [x] Test pulse aggregation accuracy
- [x] Test bond strength calculation

### 6.2 Verification
- [x] Run all tests: `pytest tests/test_tectonics*.py -v` → 46 tests pass
- [x] Verify VAT file updates (tested in unit tests)
- [ ] Verify HUD displays correctly (manual testing required)

## Completion Checklist
- [x] All tests pass (46/46)
- [x] Documentation updated (spec.md created)
- [x] Commit with conventional message
- [ ] Archive change in OpenSpec (pending manual testing)
