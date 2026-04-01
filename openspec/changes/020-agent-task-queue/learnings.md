# Learnings: Agent Task Queue

## SEC-3: REST API Endpoints
- Server is at `sync/server.js`, not root `server.js`. Uses raw `http.createServer` with manual routing (no express).
- CORS headers only allowed GET/POST/OPTIONS -- had to add PUT for claim/complete/fail endpoints.
- Route ordering matters: `/api/v1/tasks/stats` must match before `/api/v1/tasks/:id` or "stats" gets captured as an ID.
- The claim handler does inline mutation (set status/agentId/startedAt) rather than delegating to `store.claim()` because the spec says `PUT /tasks/:id/claim` targets a specific task, not the store's "claim next available" logic. Store.claim() picks the highest-priority pending task automatically -- different from per-ID claiming.
- TaskStore was not yet instantiated in the server constructor -- added it.
- Tests follow the `agent-api.test.js` pattern: raw http.request helper, PxOSServer on a test port, override stores with temp paths.
- All 21 new tests pass, total suite 1871/1871.

## pattern

- **[pattern]** (from SEC-3) [modified] sync/server.js

- **[pattern]** (from SEC-3) [added] tests/task-api.test.js

- **[pattern]** (from SEC-3) [added] .test-fixtures/task-store/deep-1775048244736/sub/tasks.json

- **[pattern]** (from SEC-3) [added] .test-fixtures/task-store/deep-1775047887027/sub/tasks.json

- **[pattern]** (from SEC-3) [modified] data/cms-content.json

## discovery

- **[discovery]** (from SEC-3) Agent strategy: created 3 files, modified 7 files, added tests

- **[discovery]** (from SEC-3) Tests improved by 21 (1850 -> 1871)
