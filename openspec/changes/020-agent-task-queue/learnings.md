# Learnings: Agent Task Queue

## SEC-3: REST API Endpoints
- Server is at `sync/server.js`, not root `server.js`. Uses raw `http.createServer` with manual routing (no express).
- CORS headers only allowed GET/POST/OPTIONS -- had to add PUT for claim/complete/fail endpoints.
- Route ordering matters: `/api/v1/tasks/stats` must match before `/api/v1/tasks/:id` or "stats" gets captured as an ID.
- The claim handler does inline mutation (set status/agentId/startedAt) rather than delegating to `store.claim()` because the spec says `PUT /tasks/:id/claim` targets a specific task, not the store's "claim next available" logic. Store.claim() picks the highest-priority pending task automatically -- different from per-ID claiming.
- TaskStore was not yet instantiated in the server constructor -- added it.
- Tests follow the `agent-api.test.js` pattern: raw http.request helper, PxOSServer on a test port, override stores with temp paths.
- All 21 new tests pass, total suite 1871/1871.
