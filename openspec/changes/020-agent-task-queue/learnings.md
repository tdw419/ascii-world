# Learnings: SEC-6 Tests

## What happened
Steps 6.1, 6.2, 6.3 were already implemented (test files existed with comprehensive coverage) but weren't checked off in tasks.md. Previous agent (SEC-5) likely created these files but missed marking the tasks complete.

## Test coverage
- task-model.test.js: 26 tests covering constructor defaults, validate(), toJSON(), fromJSON(), isExpired()
- task-store.test.js: 26 tests covering create, get, list (sorting, filtering), claim, complete, fail, getStats, persist/load
- task-api.test.js: 22 tests covering all REST endpoints via raw http (not supertest - project uses node:http directly)
- task-formulas.test.js: 24 tests (already checked off from earlier step)

## Notes
- Project doesn't use supertest despite what the task description says -- all API tests use a custom `request()` helper with `node:http`. This works fine.
- API tests start a real PxOSServer on a unique port, override the taskStore with a temp directory, then clean up in `after()`.
- All 1905 tests pass, 0 failures.
