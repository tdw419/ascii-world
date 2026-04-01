# Tasks: Agent Dashboard UI

## 1. Agent Formula Functions
- [x] 1.1 Add AGENT_STATUS(agentId) to formula engine: looks up agent in registry, returns status string or "unknown"
- [x] 1.2 Add AGENT_LIST() to formula engine: returns comma-separated list of all registered agent IDs
- [x] 1.3 Add AGENT_METRIC(agentId, metricName) to formula engine: queries time-series for agent:{id}:{metric}, returns latest value
- [x] 1.4 Add AGENT_COUNT() to formula engine: returns number of registered agents
- [x] 1.5 Add AGENT_NAME(agentId) to formula engine: returns agent name string

## 2. Agent Card Component
- [x] 2.1 Create ui/agent-card.js: renders a single agent as a pixel block with name, status badge, last activity
- [x] 2.2 Status badge rendering: green (online), yellow (offline), red (error), gray (unknown)
- [x] 2.3 Capability tags rendered as small text below agent name
- [x] 2.4 Timestamp rendering for lastHeartbeat (relative: "2m ago", "5s ago")

## 3. Agent Grid View
- [ ] 3.1 Create ui/agent-grid.js: fetches GET /api/v1/agents, renders Agent Card for each in a grid layout
- [ ] 3.2 Add auto-refresh interval (poll every 5s)
- [ ] 3.3 Add sorting options: by name, by status, by last heartbeat
- [ ] 3.4 Register grid as a dashboard template: templates/agent-grid.json

## 4. Agent Detail View
- [ ] 4.1 Create ui/agent-detail.js: renders full detail page for one agent using GET /api/v1/agents/:id
- [ ] 4.2 Metrics sparkline section: render last 20 values of key metrics as mini bar charts
- [ ] 4.3 Recent logs section: show last 10 log entries from agent log endpoint
- [ ] 4.4 Task history section: show last 10 tasks assigned to this agent
- [ ] 4.5 Register detail view route in dashboard template system

## 5. Integration and Tests
- [ ] 5.1 Add tests/agent-formulas.test.js: test all AGENT_* formula functions with mock registry
- [ ] 5.2 Add test that agent grid template renders correctly with mock agent data
- [ ] 5.3 Add test that agent detail view fetches and displays agent data

## 6. Documentation
- [ ] 6.1 Update README with agent formula functions reference
- [ ] 6.2 Add agent dashboard templates section to README
- [ ] 6.3 Commit and push
