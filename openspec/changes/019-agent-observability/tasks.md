# Tasks: Agent Observability

## 1. Agent Metric Ingestion
- [ ] 1.1 Add POST /api/v1/agents/:id/metrics endpoint: accepts {key, value}, stores as agent:{id}:{key} in TimeSeriesStore
- [ ] 1.2 Add GET /api/v1/agents/:id/metrics endpoint: returns latest values for all agent metrics
- [ ] 1.3 Add GET /api/v1/agents/:id/metrics/:key/history endpoint: returns time-series data for specific metric
- [ ] 1.4 Add automatic metric scraping from agent config (if agent reports system metrics)

## 2. Agent Log Aggregation
- [ ] 2.1 Create sync/agent-log-store.js: in-memory ring buffer per agent (max 1000 entries), stores {timestamp, level, message}
- [ ] 2.2 Add POST /api/v1/agents/:id/logs endpoint: appends log entry to agent's buffer
- [ ] 2.3 Add GET /api/v1/agents/:id/logs endpoint: returns last N log entries (default 50, param ?limit=N)
- [ ] 2.4 Add WebSocket broadcast on new log entries: emit 'agent:log' event with {agentId, entry}
- [ ] 2.5 Add log level filtering on GET endpoint (param ?level=error|warn|info)

## 3. Agent Alert Rules
- [ ] 3.1 Add built-in rule: agent-down triggers when agent status transitions to offline or error
- [ ] 3.2 Add built-in rule: agent-heartbeat-miss triggers when lastHeartbeat exceeds configurable threshold
- [ ] 3.3 Add built-in rule: agent-error-spike triggers when error log count in last 5 min exceeds threshold
- [ ] 3.4 Add built-in rule: agent-timeout triggers when a running task exceeds max duration
- [ ] 3.5 Register these rules in alert-engine.js with agent scope

## 4. Audit Trail
- [ ] 4.1 Create sync/audit-trail.js: append-only JSONL writer to data/audit.jsonl
- [ ] 4.2 Log event: agent.registered with {agentId, name, capabilities}
- [ ] 4.3 Log event: agent.heartbeat-lost with {agentId, lastSeen}
- [ ] 4.4 Log event: agent.status-change with {agentId, from, to}
- [ ] 4.5 Log event: agent.task-assigned with {agentId, taskId}
- [ ] 4.6 Add GET /api/v1/audit endpoint: returns recent audit entries (param ?agentId=X for filtering)

## 5. Tests
- [ ] 5.1 Add tests/agent-metrics.test.js: test metric ingestion, retrieval, and history endpoints
- [ ] 5.2 Add tests/agent-logs.test.js: test log posting, retrieval, level filtering, WebSocket broadcast
- [ ] 5.3 Add tests/agent-alerts.test.js: test agent-down, heartbeat-miss, error-spike rules
- [ ] 5.4 Add tests/audit-trail.test.js: test event logging and retrieval

## 6. Documentation
- [ ] 6.1 Update README with agent observability API reference
- [ ] 6.2 Document built-in agent alert rules
- [ ] 6.3 Document audit trail format and query endpoint
- [ ] 6.4 Commit and push
