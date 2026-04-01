# Tasks: Declarative Route Table for PxOSServer

## 1. Phase 1: Route Table Core
- [x] 1.1 Create sync/route-table.js: a RouteTable class that registers entries as [{ method, pattern, handler }] where pattern supports exact strings and :param segments (e.g. '/api/v1/agents/:agentId/logs'). Include a match(pathname, method) -> { handler, params } lookup.
- [x] 1.2 Add unit tests for RouteTable: exact match, param extraction, method filtering, 404 fallback, precedence (exact before parametric). Target ~20 tests.

## 2. Phase 2: Migrate Routes from handleHTTPRequest
- [x] 2.1 In PxOSServer constructor, instantiate this.routeTable = new RouteTable() and register all 94 current routes as table entries pointing to their existing handler methods (no handler logic changes).
- [x] 2.2 Replace the 500-line if/else-if chain in handleHTTPRequest with: const match = this.routeTable.match(pathname, req.method); if (match) return match.handler(req, res, match.params, url); else this.sendError(res, 404, 'Not found');
- [x] 2.3 Keep the CORS, OPTIONS, request tracking, and error-wrapping logic in handleHTTPRequest as-is -- only the dispatch changes.

## 3. Phase 3: Validation and Cleanup
- [ ] 3.1 Run full test suite (86 test files) and confirm all pass with zero changes to test files.
- [ ] 3.2 Remove the regex-based pathname.match() calls that were needed for parametric routes (agents/:id/logs, agents/:id/metrics/:name/history, tasks/:id/claim, etc.) -- the RouteTable handles param extraction now.
- [ ] 3.3 Update server.js doc comment to reflect the new routing architecture and add a comment block listing the route groups (cells, render, alerts, agents, tasks, cms, gpu, youtube, etc.) with their approximate route counts.
