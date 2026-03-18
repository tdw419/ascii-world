# FFI Opcodes Specification
## Requirement
The GeoASM VM must support calling Python functions from bytecode.

### Scenarios
1. **PY_CALL opcode**
   - WHEN a PY_CALL instruction executes
   - THEN the function ID is looked up in the whitelist
   - AND the function is called with the provided arguments
   - AND the result is stored in the return pointer
   - OR an error is returned if function not whitelisted

2. **PY_MAP opcode**
   - WHEN a PY_MAP instruction executes
   - THEN a Hilbert-indexed memory region is mapped
   - AND a buffer ID is returned for subsequent operations
   - AND the mapping respects the 1MB size limit

3. **PY_REQ opcode**
   - WHEN a PY_REQ instruction executes
   - THEN an async request is queued
   - AND a request ID is returned immediately
   - AND the request can be polled later

4. **PY_POLL opcode**
   - WHEN a PY_POLL instruction executes
   - THEN the status of the request is checked
   - AND if complete, the result is returned
   - AND the request is cleaned up after completion
