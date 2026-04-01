# Tasks: Agent Registry

## 1. Agent Data Model
- [x] 1.1 Create sync/agent-model.js with Agent class containing fields: id (uuid), name, status (online|offline|error), capabilities (string[]), lastHeartbeat (timestamp), config (object), createdAt (timestamp)
- [x] 1.2 Add Agent.validate(data) static method that returns errors for missing required fields
- [x] 1.3 Add Agent.toJSON() and Agent.fromJSON(row) serialization methods

## 2. Agent Registry Store
- [x] 2.1 Create sync/agent-registry.js with AgentRegistry class using Map for in-memory storage
- [x] 2.2 Add register(data) method: creates Agent, stores in map, persists to data/agents.json
- [x] 2.3 Add get(id) method: returns agent or null
- [x] 2.4 Add list() method: returns all agents as array
- [x] 2.5 Add heartbeat(id) method: updates lastHeartbeat, sets status to online
- [x] 2.6 Add update(id, changes) method: patches agent fields
- [x] 2.7 Add remove(id) method: deletes agent from map and persists
- [x] 2.8 Add load() method: reads data/agents.json on startup
- [x] 2.9 Add persist() private method: writes map to data/agents.json

## 3. Heartbeat Liveness Check
- [x] 3.1 Add startLivenessCheck(intervalMs=30000) method to AgentRegistry
- [x] 3.2 In liveness loop: mark agents with lastHeartbeat older than 60s as offline, older than 120s as error
- [x] 3.3 Emit 'agent:offline' and 'agent:error' events on status transitions

## 4. REST API Endpoints
- [x] 4.1 Add POST /api/v1/agents endpoint to server.js: calls registry.register(body), returns 201 with agent
- [x] 4.2 Add GET /api/v1/agents endpoint: returns registry.list() as JSON array
- [x] 4.3 Add GET /api/v1/agents/:id endpoint: returns agent or 404
- [x] 4.4 Add PUT /api/v1/agents/:id/heartbeat endpoint: calls registry.heartbeat(id), returns 200
- [x] 4.5 Add DELETE /api/v1/agents/:id endpoint: calls registry.remove(id), returns 204
- [x] 4.6 Wire AgentRegistry into server startup (create, load, start liveness)

## 5. Python SDK Updates
- [x] 5.1 Add register(name, capabilities, config) method to agents/sdk.py that POSTs to /api/v1/agents
- [x] 5.2 Add heartbeat() method that PUTs to /api/v1/agents/:id/heartbeat on interval
- [x] 5.3 Add reportMetric(key, value) method that POSTs metric to time-series with agent-scoped key
- [x] 5.4 Update agents/system_monitor.py to use register() on startup and heartbeat loop

## 6. Tests
- [x] 6.1 Add tests/agent-model.test.js: validate, serialize, deserialize
- [x] 6.2 Add tests/agent-registry.test.js: register, get, list, heartbeat, remove, persist, load
- [x] 6.3 Add tests/agent-api.test.js: POST/GET/PUT/DELETE agent endpoints via supertest
- [x] 6.4 Add test for liveness check marking agents offline

## 7. Documentation
- [ ] 7.1 Update README with Agent Registry section (API endpoints, data model)
- [ ] 7.2 Update README with Python SDK register/heartbeat/reportMetric usage
- [ ] 7.3 Commit and push
