# FFI Bridge Design
## Architecture
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  GeoASM Bytecode         │  WGSL Shader        │  SyscallManager.ts     │  PythonFFIBridge.ts│
│  (PY_CALL 0xF8)          │  Sets status        │  Routes 0xF8-0xFB      │  Executes calls   │
│                          │  Stores in regs    │  to PythonFFIBridge   │                   │
│                          │  248-250           │                       │                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Opcode Format
All FFI opcodes use 3 operands:
- dst: Primary parameter (function ID, Hilbert start, request ID)
- src1: Secondary parameter (args ptr, size, args ptr)
- src2: Tertiary parameter (return ptr, flags, unused)

## Memory Layout for FFI
- Registers 248-250: Reserved for FFI communication
- Reg 248: Function ID / Hilbert start / Request ID
- Reg 249: Args pointer / Size / Args pointer
- Reg 250: Return pointer / Flags / Status pointer

## Security Model
- Whitelist-based function registry
- No eval() or exec()
- 1MB buffer size limit
- Async request cleanup after completion
