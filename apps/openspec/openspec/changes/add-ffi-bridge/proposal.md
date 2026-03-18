# Add FFI Bridge - The Symbolic Umbilical Cord

## Problem

GeoASM needs a way to call Python functions for NumPy, CV2, and other data science libraries without leaving the Python ecosystem. The current syscall pattern requires switching to Python for every operation, which is slow and defeats the purpose of "Screen is the Hard Drive."

## Proposed Solution

Add 4 new opcodes in the 0xF8-0xFB range:
- **0xF8 (PY_CALL)** - Blocking Python function call
- **0xF9 (PY_MAP)** - Map Hilbert region to numpy array (zero-copy)
- **0xFA (PY_REQ)** - Async Python request
- **0xFB (PY_POLL)** - Poll async result

## Architecture

The "Symbolic Umbilical Cord" connects:
- **GPU Side**: GeoASM compute shaders (high-performance geometry)
- **CPU Side**: Python 3.12 with NumPy/SciPy (symbolic reasoning)
- **Bridge**: Shared memory with Hilbert curve mapping for spatial locality

## Resources

| Resource | Path |
|----------|------|
| **Full Plan** | `docs/plans/2026-03-07-ffi-bridge-implementation.md` |
| **Team Config** | `~/.claude/teams/ffi-bridge-impl/config.json` |
| **Tasks** | `openspec/changes/add-ffi-bridge/tasks.md` |
| **Specs** | `openspec/changes/add-ffi-bridge/specs/ffi-bridge-impl/spec.md` |

## Success Criteria

- [ ] All 4 opcodes work end-to-end
- [ ] Hilbert mapping preserves 95% spatial locality
- [ ] Security whitelist enforced (rejects non-whitelisted functions)
- [ ] Zero-copy NumPy views via shared memory
- [ ] All tests pass (TypeScript + Python)
- [ ] No opcode collisions (0xF8-0xFB unique range)
