# Requirements: File Persistence

## Functional Requirements

### FR1: Save to File
- MUST save dashboards to JSON file
- MUST create data/ directory if needed
- MUST debounce rapid saves

### FR2: Load from File
- MUST load dashboards on startup
- MUST handle missing file gracefully
- MUST handle corrupted file gracefully

## Test Criteria

```bash
npm test
# Expected: 91 tests passing
```

## Acceptance Criteria

- [x] 3 new tests pass
- [x] File persistence works
- [x] Auto-save on changes
- [x] Auto-load on startup
