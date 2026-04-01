# Learnings: Route Table Refactor

## SEC-1 Phase 1 (route-table.js + tests)

- The test file (tests/route-table.test.js) already existed with 26 tests. The implementation file (sync/route-table.js) was the missing piece. Check for pre-existing test files before writing new ones.
- The existing CMS Router (sync/router.js) already had _patternToRegex and _extractParamNames helpers. The RouteTable reimplements these independently since it's a standalone HTTP dispatch concern, not a CMS concern. This is intentional -- the CMS router has content-store coupling that would be wrong here.
- Pattern normalization (leading/trailing slashes) matters for both registration and matching. Tests verify this thoroughly.
- Precedence design: exact matches stored in a Map keyed by method+pattern for O(1) lookup, parametric routes scanned linearly. For ~94 routes this is more than fast enough. Exact routes are checked first to ensure /api/agents/me beats /api/agents/:agentId.
- Full test suite: 1890 tests, 1889 pass, 1 cancelled (pre-existing timeout). The 26 new route-table tests all pass cleanly.
