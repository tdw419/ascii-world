# Learnings: 020-agent-task-queue

## SEC-1: Task Data Model
- Followed the Agent model pattern (agent-model.js) exactly — constructor, static validate(), toJSON(), fromJSON(). This made the implementation very mechanical.
- Added `isExpired(timeoutMs)` which only applies to `running` tasks with a `startedAt`. Tasks in other states or without `startedAt` return false, which avoids false positives.
- Validate checks that payload is serializable to JSON via `JSON.stringify()` — catches circular references.
- Default priority is 1 (normal), not 0. This felt right since 0=low is the exception.
- 30 tests added, 1792 -> 1822 total. All green.
