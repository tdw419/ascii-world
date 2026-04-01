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

- **[pattern]** (from SEC-4) [modified] .youtube-cookies.txt

- **[pattern]** (from SEC-4) [modified] sync/pixel-formula-engine.js

- **[pattern]** (from SEC-4) [added] tests/task-formulas.test.js

- **[pattern]** (from SEC-4) [added] templates/task-queue.json

- **[pattern]** (from SEC-4) [added] .test-fixtures/task-store/deep-1775048672693/sub/tasks.json

- **[discovery]** (from SEC-4) Agent strategy: created 3 files, modified 6 files, added tests

- **[discovery]** (from SEC-4) Tests improved by 19 (1871 -> 1890)

## SEC-5: Agent SDK Task Methods
- Python SDK already existed at `agents/sdk.py` with register/heartbeat/metric methods. Added 4 task methods: claimTask, completeTask, failTask, createTask.
- Created new `agents/sdk.js` as the JS equivalent. Uses native `fetch` (Node 18+) with optional injectable fetch for testing.
- `claimTask()` in both SDKs does GET pending tasks then PUT claim on the first (highest priority) result, matching the queue semantics.
- Port conflicts are a real issue: agent-logs.test.js already uses 13842, task-api.test.js uses 13841. Used 13843 for the new SDK test.
- Using `beforeEach` to reset the TaskStore and create a fresh SDK instance per test prevents cross-test contamination from persisted tasks.
- Tests improved by 15 (1890 -> 1905).
- Files: modified agents/sdk.py, created agents/sdk.js, created tests/task-sdk.test.js
