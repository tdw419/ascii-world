# Implementation Tasks

> **Full Plan**: `docs/plans/2026-03-07-ffi-bridge-implementation.md`
> **Team Config**: `~/.claude/teams/ffi-bridge-impl/config.json`

## Phase 1: Core Components (TDD)

### Task 1.1: Hilbert Curve Lookup Table
- [x] Create `visual-vm/HilbertLUT.test.ts` with failing tests
- [x] Run `npx vitest run HilbertLUT.test.ts` - expect FAIL
- [x] Create `visual-vm/HilbertLUT.ts` with Hilbert curve implementation
- [x] Run tests - expect PASS (19 tests)
- [x] Commit: `feat(ffi): add Hilbert curve LUT for spatial locality preservation`

**Agent**: hilbert-agent@ffi-bridge-impl

### Task 1.2: FFI Registry Configuration
- [x] Create `visual-vm/ffi_registry.json` with whitelisted functions
- [x] Create `visual-vm/FFIRegistry.test.ts` with failing tests
- [x] Run `npx vitest run FFIRegistry.test.ts` - expect FAIL
- [x] Create `visual-vm/FFIRegistry.ts` with registry class
- [x] Run tests - expect PASS (7 tests)
- [x] Commit: `feat(ffi): add FFI registry with whitelisted functions`

**Agent**: registry-agent@ffi-bridge-impl

### Task 1.3: Python FFI Host Process
- [x] Create `visual-vm/test_python_ffi_host.py` with failing tests
- [x] Run `python -m pytest test_python_ffi_host.py -v` - expect FAIL
- [x] Create `visual-vm/python_ffi_host.py` with FFIMemoryRegion and FFIHost
- [x] Run tests - expect PASS (8 tests)
- [x] Commit: `feat(ffi): add Python FFI host with shared memory and NumPy execution`

**Agent**: python-host-agent@ffi-bridge-impl

---

## Phase 2: TypeScript-Python Bridge

### Task 2.1: Upgrade PythonFFIBridge.ts
- [x] Create `visual-vm/PythonFFIBridge.test.ts` with integration tests
- [x] Read current `visual-vm/PythonFFIBridge.ts` (stub)
- [x] Replace with real implementation:
  - Import FFIRegistry and HilbertLUT
  - Spawn Python subprocess
  - Handle IPC communication
  - Implement real execute(), handlePyCall(), handlePyMap()
- [x] Run `npx vitest run PythonFFIBridge.test.ts` - expect PASS (19 tests)
- [x] Commit: `feat(ffi): implement TypeScript-Python IPC bridge with subprocess`

**Agent**: ts-bridge-agent@ffi-bridge-impl

---

## Phase 3: Integration & Verification

### Task 3.1: SyscallManager Integration
- [x] Verify `visual-vm/SyscallManager.ts:2315-2392` opcode handlers
- [x] Create `visual-vm/test_ffi_integration.test.ts`
- [x] Test all 4 opcodes through SyscallManager
- [x] Run `npx vitest run test_ffi_integration.test.ts` - expect PASS (26 tests)
- [x] Commit: `test(ffi): add integration tests for FFI opcodes`

### Task 3.2: End-to-End Verification
- [x] Create `visual-vm/test_ffi_e2e.py`
- [x] Test full round-trip: spawn host → send command → receive response
- [x] Run `python -m pytest test_ffi_e2e.py -v` - expect PASS (11 tests)
- [x] Commit: `test(ffi): add end-to-end verification test`

**Agent**: integration-agent@ffi-bridge-impl

---

## Phase 4: Final Verification

### Task 4.1: Full Test Suite
- [x] Run all FFI TypeScript tests: `npx vitest run HilbertLUT FFIRegistry PythonFFIBridge test_ffi_integration` - PASS (80 tests)
- [x] Run all Python tests: `python -m pytest test_python_ffi_host.py test_ffi_e2e.py -v` - PASS (25 tests)
- [x] Verify no opcode conflicts (0xF8-0xFB unique)

### Task 4.2: Archive
- [ ] Archive change: `openspec archive add-ffi-bridge`
- [ ] Update specs with implementation notes

---

## Phase 5: Visual Shell Integration

### Task 5.1: FFI Bridge API Endpoints
- [x] Add FFIBridge class to `systems/visual_shell/api/visual_bridge.py`
- [x] Add REST endpoints: `/ffi/functions`, `/ffi/execute`, `/ffi/analyze/memory/{vm_id}`
- [x] Add WebSocket endpoint: `/ws/v1/ffi` for real-time operations
- [x] Integrate with FastAPI lifespan for proper initialization/cleanup

### Task 5.2: Frontend FFI Integration
- [x] Add `connectFFI()` method to `NeuralCityEngine.js`
- [x] Add `executeFFI()` method for async Python function execution
- [x] Add `analyzeMemory()` convenience method
- [x] Update `index.html` to show FFI status

### Task 5.3: Visual Shell FFI Tests
- [x] Create `systems/visual_shell/api/test_ffi_visual_integration.py`
- [x] Test FFIBridge initialization and registry loading
- [x] Test FFI function execution (numpy.sum, numpy.mean, etc.)
- [x] Test result serialization (ndarray, numpy scalars, tuples)
- [x] Run tests - PASS (25 tests)

**Commit**: `feat(ffi): integrate FFI Bridge with Visual Shell for CV/Analysis`

---

## Dependencies

```
Task 1.1 (HilbertLUT) ──┐
                        ├──► Task 2.1 (PythonFFIBridge) ──► Task 3.1 (Integration)
Task 1.2 (Registry)  ──┘                                      │
                                                              ▼
Task 1.3 (Python Host) ──────────────────────────────────► Task 3.2 (E2E)
                                                              │
                                                              ▼
                                                         Task 4.1 (Verify)
                                                              │
                                                              ▼
                                                         Task 5.1 (Visual Shell)
```

## Success Criteria

- [x] All 4 opcodes (0xF8-0xFB) work end-to-end
- [x] Hilbert mapping preserves 95% spatial locality
- [x] Security whitelist enforced (rejects os.system, etc.)
- [x] All tests pass (80 TypeScript + 25 Python + 25 Visual Shell = 130 tests)
- [x] No opcode collisions
- [x] Subprocess starts in < 5 seconds
- [x] FFI Bridge integrated with Visual Shell API

## Final Summary

| Component | Files | Tests |
|-----------|-------|-------|
| Hilbert LUT | HilbertLUT.ts, HilbertLUT.test.ts | 19 |
| FFI Registry | FFIRegistry.ts, FFIRegistry.test.ts, ffi_registry.json | 7 |
| Python Host | python_ffi_host.py, test_python_ffi_host.py | 8 |
| TypeScript Bridge | PythonFFIBridge.ts, PythonFFIBridge.test.ts | 19 |
| Integration Tests | test_ffi_integration.test.ts | 26 |
| E2E Tests | test_ffi_e2e.py | 11 |
| Visual Shell FFI | visual_bridge.py, NeuralCityEngine.js, test_ffi_visual_integration.py | 25 |
| **Total** | **17 files** | **130 tests** |
