# Tasks: add-terminal-clone-pixelrts

## Phase 1: Foundation

- [ ] **Task 1: PTY Engine**
  - Add `term`, `pty`, `unistd`, `fcntl` features to nix crate
  - Create `systems/infinite_map_rs/src/terminal_clone/pty_engine.rs`
  - Implement `PtyEngine::new(rows, cols, shell)`
  - Implement `write()`, `read()`, `resize()`, `get_size()`
  - Tests: `test_pty_engine_spawn`, `test_pty_engine_write_read`, `test_pty_engine_resize`

- [ ] **Task 2: Terminal Clone Manager**
  - Create `systems/infinite_map_rs/src/terminal_clone/terminal_clone_manager.rs`
  - Implement `TerminalCloneManager` with multi-terminal support
  - Wire PTY → TerminalEmulator data flow
  - Tests: `test_manager_create_terminal`, `test_manager_get_terminal`, `test_manager_list_terminals`

## Phase 2: Rendering

- [ ] **Task 3: WGSL Terminal Renderer**
  - Create `systems/infinite_map_rs/src/shaders/terminal_renderer.wgsl`
  - Compute shader for cell-based rendering
  - Font atlas sampling (FONT_8X16)
  - Cursor blink animation
  - Color attribute handling

## Phase 3: Integration

- [ ] **Task 4: VAT Bridge (Python)**
  - Create `systems/visual_shell/api/terminal_vat_bridge.py`
  - Implement `TerminalVatBridge` with focal-point placement
  - IPC stub for Rust communication
  - Tests: `test_bridge_create_terminal`, `test_bridge_get_position`, `test_bridge_near_focal_point`

- [ ] **Task 5: VM Terminal Detector**
  - Create `systems/visual_shell/api/vm_terminal_detector.py`
  - Terminal pattern recognition (regex)
  - ExtractionPipeline integration
  - Grid size estimation
  - Tests: `test_detector_scan_sample`, `test_detector_is_terminal_like`

## Phase 4: Validation

- [ ] **Task 6: E2E Integration Tests**
  - Create `systems/infinite_map_rs/tests/test_terminal_clone_e2e.rs`
  - Test PTY → Emulator → Buffer flow
  - Test multi-terminal management
  - Test resize propagation
  - Tests: `test_e2e_pty_to_emulator`, `test_e2e_multiple_terminals`, `test_e2e_resize_propagation`

## Verification

- [ ] All 14+ tests pass
- [ ] `cargo test --features hypervisor` succeeds
- [ ] `make format-check && make lint` passes
- [ ] Manual test: spawn terminal, type command, see output
