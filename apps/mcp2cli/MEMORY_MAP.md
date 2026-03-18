# mcp2cli.py Memory Map Documentation

## Overview
This document describes the memory layout and usage patterns for the mcp2cli.py GPU memory persistence system in Geometry OS.

## GPU Memory Layout (4096×4096 .rts.png substrate)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GPU SUBSTRATE (4096×4096 PIXELS)                 │
├───────────────┬───────────────────┬─────────────────────────────────┤
│ 0x000000-0x0000FF │ 0xFF000000    │ 0x00100000-0x001FFFFF            │
│ BOOT/VM STATE     │ TRAP INTERFACE  │ DEV MEMORY (Development Heap)   │
│ PC, registers     │ shim↔glyph comms │ Scheduler state, MCP index,     │
│                   │                  │   user data storage             │
└───────────────┴───────────────────┴─────────────────────────────────┘
```

## Memory Regions

### 1. Boot/VM State Region (0x000000 - 0x0000FF)
- **Size**: 256 bytes (64 32-bit words)
- **Purpose**: Stores VM state for the Glyph VM Scheduler
- **Contents**:
  - Program counters (PC) for 8 VMs
  - Register files (128 registers × 8 VMs)
  - VM state flags (RUNNING, HALTED, WAITING, INACTIVE)
  - Stack pointers and stack data
  - Scheduler metadata (active count, frame counter)

### 2. Trap Interface Region (0xFF000000)
- **Size**: 1 32-bit word (4 bytes)
- **Purpose**: Communication shim between glyph substrate and trap handlers
- **Usage**:
  - Glyph writes trap requests here
  - Trap shim reads, processes, and writes results
  - Enables syscalls, file I/O, and host interactions
  - Example: `mem_poke "0xFF000000" "0xDEADBEEF"` to trigger trap

### 3. Development Memory Region (0x00100000 - 0x001FFFFF)
- **Size**: 1MB (256K 32-bit words)
- **Purpose**: General-purpose persistent storage for development
- **Sub-division**:
  - **0x00100000 - 0x00100FFF**: Memory Index Table (4KB)
  - **0x00101000 - 0x001FFFFF**: User Data Storage (1020KB)

## Memory Index Table (0x00100000 - 0x00100FFF)

The memory index is a JSON structure stored at the beginning of dev memory that tracks allocated regions:

```json
{
  "scheduler_state": {
    "offset": 0x0000,
    "size": 0x0100,
    "addr": "0x00100000",
    "description": "Glyph VM Scheduler state"
  },
  "meta_circular_scheduler": {
    "offset": 0x0100,
    "size": 0x0080,
    "addr": "0x00100100",
    "description": "Scheduler implementation status"
  },
  "session_context": {
    "offset": 0x0180,
    "size": 0x0040,
    "addr": "0x00100180",
    "description": "Current development session context"
  }
  // ... more entries
}
```

Each index entry contains:
- `offset`: Offset from DEV_MEM_START (0x100000) in 32-bit words
- `size`: Size of the data region in 32-bit words
- `addr`: Absolute address in GPU memory (0x100000 + offset×4)
- `description`: Human-readable description of the data

## mcp2cli.py Memory Tools

### `mem_store`
Store arbitrary data in GPU-backed development memory.

**Usage**:
```
mcp2cli --mcp http://127.0.0.1:8769 mem_store --key scheduler_state --value '{"active_vms":[1,2],"frame":1234}'
```

**Process**:
1. Loads memory index from 0x00100000
2. Finds next free offset after existing allocations
3. Serializes value as JSON with metadata (timestamp)
4. Writes data to GPU memory at calculated address
5. Updates memory index and persists it to GPU

### `mem_retrieve`
Retrieve data from GPU-backed development memory.

**Usage**:
```
mcp2cli --mcp http://127.0.0.1:8769 mem_retrieve --key scheduler_state
```

**Returns**:
```json
{
  "status": "success",
  "action": "GPU_MEM_RETRIEVE",
  "key": "scheduler_state",
  "addr": "0x00100000",
  "data": {
    "active_vms": [1, 2],
    "frame": 1234,
    "_metadata": {
      "key": "scheduler_state",
      "val": {"active_vms":[1,2],"frame":1234},
      "ts": 1234567890.0
    }
  }
}
```

### `mem_peek`
Read raw GPU memory at specified address.

**Usage**:
```
mcp2cli --mcp http://127.0.0.1:8769 mem_peek --addr 0x00100000 --size 64
```

**Returns**:
- Hexadecimal dump of memory contents
- ASCII representation
- Hilbert curve coordinates for the address
- Raw hex words for debugging

### `mem_poke`
Write a single 32-bit value to GPU memory.

**Usage**:
```
mcp2cli --mcp http://127.0.0.1:8769 mem_poke --addr 0xFF000000 --val 0xDEADBEEF
```

## Usage Examples

### Storing Scheduler State
```bash
# Store which VMs are active and their priorities
mcp2cli --mcp http://127.0.0.1:8769 mem_store \
  --key scheduler_state \
  --value '{
    "active_vms": [0, 1, 2, 5],
    "priorities": {0: 10, 1: 8, 2: 5, 5: 12},
    "frame": 1542,
    "cycle_counts": [1024, 1024, 1024, 1024, 0, 1024, 0, 0]
  }'
```

### Retrieving Scheduler State
```bash
mcp2cli --mcp http://127.0.0.1:8769 mem_retrieve --key scheduler_state
```

### Debugging via Peek/Poke
```bash
# Check if VM 0 is running (read state flag)
mcp2cli --mcp http://127.0.0.1:8769 mem_peek --addr 0x00000000 --size 1

# Trigger a trap to print debug info
mcp2cli --mcp http://127.0.0.1:8769 mem_poke --addr 0xFF000000 --val 0x44414255  # "DABU" in ASCII

# Read trap response
mcp2cli --mcp http://127.0.0.1:8769 mem_peek --addr 0xFF000000 --size 1
```

### AI Context Tracking
```bash
# Store implementation progress across sessions
mcp2cli --mcp http://127.0.0.1:8769 mem_store \
  --key meta_circular_scheduler \
  --value '{
    "phase": "Meta-Circular Complete",
    "commits": ["3deff0aa", "1b891e38", "a1b2c3d4"],
    "architecture": "VM 0 = scheduler.glyph, shim = trap handler",
    "next_phase": "API Migration",
    "blockers": [],
    "tests_passing": 559
  }'
```

## Integration with Glyph VM Scheduler

The memory system enables several key capabilities for the Glyph VM Scheduler:

### 1. Persistent Scheduler State
Scheduler can store its state between frames to survive context resets:
- Active VM list
- Priority queues
- Cycle counts
- Frame counters

### 2. Real-time Debugging Interface
External tools can inspect/modify scheduler state:
- Peek at VM registers and PCs
- Poke new instructions into instruction memory
- Watch trap handler activity

### 3. Hot-Patching Capability
Combine `mem_poke` with `glyph_patch` tool:
```bash
# Store new instruction in dev memory
mcp2cli --mcp http://127.0.0.1:8769 mem_store \
  --key patch_instruction \
  --value '{"opcode": 0x23, "stratum": 0, "p1": 0x05, "p2": 0x0A}'

# Apply it to VRAM
mcp2cli --mcp http://127.0.0.1:8769 glyph_patch \
  --address 0x000100 \
  --opcode 0x23 \
  --stratum 0 \
  --p1 0x05 \
  --p2 0x0A
```

### 4. Cross-Session Context
AI agents can remember their progress:
- Store implementation milestones
- Track test results and blockers
- Remember architectural decisions

## Implementation Notes

### Address Translation
The system uses Hilbert curve addressing for GPU texture storage:
- Linear address → (x,y) coordinates via `hilbert_d2xy(4096, addr)`
- Used for memory mapping visualization and debugging

### Persistence Mechanism
- Memory index is loaded from GPU on first access (`_ensure_index_loaded()`)
- All modifications are written back to GPU substrate
- Survives daemon restarts and system reboots

### Concurrency
- Single-writer assumption for simplicity
- In production, would need GPU atomic operations or mutexes
- Current implementation suitable for development/debugging

## Related Files
- `src/geos_mcp_server.py`: Implementation of memory tools
- `systems/infinite_map_rs/src/glyph_vm_scheduler.rs`: GPU scheduler that uses this memory
- `systems/glyph_boot/src/scheduler.rs`: Boot scheduler variant
- `memory.md`: Session context tracking file

## Future Enhancements
1. **Memory Protection**: Add permission bits to index entries
2. **Garbage Collection**: Compact fragmented memory regions
3. **Hardware Acceleration**: Use GPU atomic operations for index updates
4. **Memory Mapping**: Virtual memory spaces for different processes
5. **Backup & Snapshot**: Persistent storage of memory regions to disk