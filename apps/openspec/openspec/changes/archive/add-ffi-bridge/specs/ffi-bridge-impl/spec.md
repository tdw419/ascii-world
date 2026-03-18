# FFI Bridge Implementation Specification

## Requirement
The GeoASM VM must have a complete FFI Bridge connecting GPU execution to Python 3.12 symbolic processing via shared memory with Hilbert curve mapping for zero-copy NumPy views.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FFI Bridge Architecture                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  GeoASM GPU                                                                 │
│  ┌─────────────────┐                                                        │
│  │ PY_CALL 0xF8    │────┐                                                    │
│  │ PY_MAP  0xF9    │────┤                                                    │
│  │ PY_REQ  0xFA    │────┤                                                    │
│  │ PY_POLL 0xFB    │────┘                                                    │
│  └─────────────────┘    │                                                    │
│                         ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SyscallManager.ts                                                   │   │
│  │ Routes opcodes 0xF8-0xFB to PythonFFIBridge                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                         │                                                    │
│                         ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PythonFFIBridge.ts                                                  │   │
│  │ - FFIRegistry (whitelist)                                           │   │
│  │ - HilbertLUT (spatial locality)                                     │   │
│  │ - Subprocess IPC to Python                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                         │ stdin/stdout + shared_memory                      │
│                         ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ python_ffi_host.py                                                  │   │
│  │ - FFIMemoryRegion (shared memory with bounds checking)             │   │
│  │ - Zero-copy NumPy views via Hilbert mapping                        │   │
│  │ - Whitelisted function execution (numpy, scipy)                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. HilbertLUT.ts
- **Purpose**: Convert between 1D memory indices and 2D screen coordinates
- **Key Methods**:
  - `indexToXY(index: number): [number, number]`
  - `xyToIndex(x: number, y: number): number`
- **Properties**: 95% spatial coherence (adjacent indices map to nearby 2D points)

### 2. FFIRegistry.ts + ffi_registry.json
- **Purpose**: Security whitelist for callable Python functions
- **Whitelisted Functions**:
  - numpy: sum, mean, std, min, max, argmax, argmin, dot, reshape, zeros, ones
  - scipy: optimize.minimize
- **Security**: Rejects any function not in whitelist

### 3. python_ffi_host.py
- **Purpose**: Python subprocess that executes FFI calls
- **Communication**: JSON over stdin/stdout
- **Memory**: SharedMemorySegment with bounds checking
- **Startup**: Prints "FFI_HOST_READY" when initialized

### 4. PythonFFIBridge.ts (upgraded)
- **Purpose**: TypeScript side of the FFI bridge
- **Subprocess Management**: Spawns and manages python_ffi_host.py
- **IPC**: Sends JSON commands, receives JSON responses
- **Hilbert Integration**: Uses HilbertLUT for memory mapping

## Scenarios

### Scenario 1: PY_CALL Blocking Execution
```
GIVEN a GeoASM program executes PY_CALL with funcId=1 (numpy.sum)
WHEN the SyscallManager handles opcode 0xF8
THEN PythonFFIBridge spawns Python subprocess (if not running)
AND sends {"function": "numpy.sum", "params": {...}}
AND receives {"status": "ok", "result": 42}
AND returns the result to the calling code
```

### Scenario 2: PY_MAP Zero-Copy Memory
```
GIVEN a GeoASM program executes PY_MAP with hilbertStart=1000, size=4096
WHEN the SyscallManager handles opcode 0xF9
THEN PythonFFIBridge converts hilbertStart to 2D coordinates via HilbertLUT
AND creates a shared memory region
AND returns a bufferId for subsequent operations
AND Python can access this region with zero-copy NumPy view
```

### Scenario 3: PY_REQ/PY_POLL Async Pattern
```
GIVEN a GeoASM program needs async Python execution
WHEN it executes PY_REQ with funcId and args
THEN PythonFFIBridge queues the request
AND returns a requestId immediately (GPU continues)
WHEN the program later executes PY_POLL with requestId
THEN PythonFFIBridge checks request status
AND returns {status: 0|1|2, result: number}
WHERE status 0=pending, 1=complete, 2=error
```

### Scenario 4: Security Enforcement
```
GIVEN a GeoASM program attempts PY_CALL with funcId for "os.system"
WHEN the SyscallManager routes to PythonFFIBridge
THEN FFIRegistry.isWhitelisted("os.system") returns false
AND the call is rejected with error
AND no Python code is executed
```

## Performance Targets

| Metric | Target |
|--------|--------|
| FFI call latency | < 1ms for blocking calls |
| Hilbert LUT lookup | < 1μs |
| Memory coherence | 95%+ |
| Max buffer size | 1MB per PY_MAP |
| Startup time | < 5 seconds |

## Files to Create/Modify

### Create
- `visual-vm/HilbertLUT.ts`
- `visual-vm/HilbertLUT.test.ts`
- `visual-vm/FFIRegistry.ts`
- `visual-vm/FFIRegistry.test.ts`
- `visual-vm/ffi_registry.json`
- `visual-vm/python_ffi_host.py`
- `visual-vm/test_python_ffi_host.py`
- `visual-vm/PythonFFIBridge.test.ts`
- `visual-vm/test_ffi_integration.ts`
- `visual-vm/test_ffi_e2e.py`

### Modify
- `visual-vm/PythonFFIBridge.ts` (upgrade from stub to real implementation)
- `visual-vm/SyscallManager.ts` (verify opcode handlers)
