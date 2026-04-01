# Learnings: 020-agent-task-queue

## SEC-1: Task Data Model
- Followed the Agent model pattern (agent-model.js) exactly — constructor, static validate(), toJSON(), fromJSON(). This made the implementation very mechanical.
- Added `isExpired(timeoutMs)` which only applies to `running` tasks with a `startedAt`. Tasks in other states or without `startedAt` return false, which avoids false positives.
- Validate checks that payload is serializable to JSON via `JSON.stringify()` — catches circular references.
- Default priority is 1 (normal), not 0. This felt right since 0=low is the exception.
- 30 tests added, 1792 -> 1822 total. All green.

## pattern

- **[pattern]** (from SEC-1) [added] sync/task-model.js

- **[pattern]** (from SEC-1) [added] tests/task-model.test.js

- **[pattern]** (from SEC-1) [modified] data/cms-content.json

- **[pattern]** (from SEC-1) [modified] data/audit.jsonl

- **[pattern]** (from SEC-1) [modified] data/dashboards.json

## discovery

- **[discovery]** (from SEC-1) Agent strategy: created 3 files, modified 4 files, added tests

- **[discovery]** (from SEC-1) Tests improved by 30 (1792 -> 1822)

## SEC-2: Task Store

- TaskStore uses a Map internally, keyed by task.id. Simple and fast.
- `claim()` reuses `list({ status: 'pending' })` which already sorts by priority desc / createdAt asc, then takes the first element. Keeps claim logic trivial.
- `persist()` / `load()` use async fs operations with a configurable dataPath. load() catches all errors (missing file, bad JSON) and starts empty -- fail-open philosophy.
- persist() auto-creates parent directories via `mkdir({ recursive: true })`.
- `fail()` coerces non-string errors with `String()` so callers don't need to pre-format.
- 28 tests added, 1822 -> 1850 total. All green.
- Created: sync/task-store.js, tests/task-store.test.js. No existing files modified.
