# Learnings: Route Table Refactor

## SEC-1 Phase 1 (route-table.js + tests)

- The test file (tests/route-table.test.js) already existed with 26 tests. The implementation file (sync/route-table.js) was the missing piece. Check for pre-existing test files before writing new ones.
- The existing CMS Router (sync/router.js) already had _patternToRegex and _extractParamNames helpers. The RouteTable reimplements these independently since it's a standalone HTTP dispatch concern, not a CMS concern. This is intentional -- the CMS router has content-store coupling that would be wrong here.
- Pattern normalization (leading/trailing slashes) matters for both registration and matching. Tests verify this thoroughly.
- Precedence design: exact matches stored in a Map keyed by method+pattern for O(1) lookup, parametric routes scanned linearly. For ~94 routes this is more than fast enough. Exact routes are checked first to ensure /api/agents/me beats /api/agents/:agentId.
- Full test suite: 1890 tests, 1889 pass, 1 cancelled (pre-existing timeout). The 26 new route-table tests all pass cleanly.

## pattern

- **[pattern]** (from SEC-1) [added] sync/route-table.js

- **[pattern]** (from SEC-1) [added] .test-fixtures/task-store/deep-1775060560710/sub/tasks.json

- **[pattern]** (from SEC-1) [added] .test-fixtures/task-store/deep-1775061194369/sub/tasks.json

- **[pattern]** (from SEC-1) [added] .test-fixtures/task-store/deep-1775060884000/sub/tasks.json

- **[pattern]** (from SEC-1) [added] .test-fixtures/task-store/deep-1775062410611/sub/tasks.json

## discovery

- **[discovery]** (from SEC-1) Agent strategy: created 6 files, modified 5 files, refactored, added tests

## SEC-2 Phase 2 (migrate routes from handleHTTPRequest)

- Handler calling conventions are inconsistent: some take `(req, res)`, some `(req, res, url)`, some `(req, res, pathname)`, some `(req, res, pathname, url)`. The YouTube stream handlers even take a 4th arg `(url, 'audio'|'video')`. Solution: thin wrapper closures per registration that pass the right args, so no handler logic changes.
- The if/else chain had 3 paths returning 405 Method Not Allowed (cells, template, alerts). The RouteTable dispatch now uses `hasPath()` to detect "path exists but wrong method" and return 405 instead of 404. This preserves exact observable behavior.
- Some routes accepted ANY HTTP method (viewer, health, status, youtube feed, etc.) while others were method-specific. Added wildcard method (`*`) support to RouteTable to handle this. The match() tries exact method first, then falls back to `*`.
- `startsWith` prefix routes (render/:format, dashboards/:name, etc.) were converted to `:param` patterns. All prefix-matched routes in the original code only matched a single trailing segment, so `:param` is equivalent. The handlers still extract values from `url.pathname` using `.replace()`, so the `url` arg must be passed through.
- Route count: 98 registered entries (original had ~94 if/else branches; some branches handled multiple methods for the same path, and the viewer path matched 3 patterns in one branch).
- Full test suite: 1890 tests, 1889 pass, 0 fail, 1 cancelled (pre-existing server.test.js timeout). Zero test changes needed.
- The `return await match.handler(...)` pattern is important — without `return`, execution would fall through to the 404/405 check after a handler already sent a response.

- **[pattern]** (from SEC-2) [modified] sync/route-table.js

- **[pattern]** (from SEC-2) [modified] sync/server.js

- **[pattern]** (from SEC-2) [added] .test-fixtures/task-store/deep-1775064818883/sub/tasks.json

- **[pattern]** (from SEC-2) [added] .test-fixtures/task-store/deep-1775064950720/sub/tasks.json

- **[pattern]** (from SEC-2) [added] .test-fixtures/task-store/deep-1775064657383/sub/tasks.json

- **[discovery]** (from SEC-2) Agent strategy: created 3 files, modified 8 files, refactored, added tests, fix attempt
