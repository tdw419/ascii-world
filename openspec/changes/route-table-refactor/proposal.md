# Proposal: Declarative Route Table for PxOSServer

## Summary
server.js is 2012 lines with 94 route branches crammed into a single handleHTTPRequest method via a 500-line if/else-if chain. This is the project's worst technical debt: every new API endpoint (50+ have been added across 017-020) requires editing this monolith, test coverage for routing is impossible to isolate, and the file will only keep growing as more features land. The fix is to extract a declarative route table (path pattern -> method -> handler mapping) backed by a lightweight pattern matcher (already proven in the CMS Router's dynamicRoutes). This cuts server.js by ~30%, makes every route independently testable, and unblocks future feature work (compositions, webhooks, agent-to-agent) without touching the dispatch logic.

## Dependencies
None. This is pure internal refactoring -- all existing API contracts and handler methods stay identical. The 86 test files continue to pass unchanged.

## Success Criteria
- All tasks complete and tests pass