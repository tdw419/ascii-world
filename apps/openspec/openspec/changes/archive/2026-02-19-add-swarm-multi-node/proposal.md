# Swarm Multi-Node Distribution

## Status
PROPOSED

## Summary
Enable the Multi-Agent Swarm to operate across multiple physical or virtual machines with automatic node discovery, distributed coordination, and fault-tolerant task routing.

## Motivation
With the Security Layer complete, the swarm can safely communicate across network boundaries. Multi-node distribution enables:

| Benefit | Impact |
|---------|--------|
| Horizontal Scaling | Scale beyond single-machine limits (100+ agents → 1000+ agents) |
| Fault Tolerance | Survive node failures with automatic failover |
| Geographic Distribution | Deploy agents close to data sources |
| Resource Pooling | Aggregate CPU/memory across machines |

## Goals
1. **Node Discovery** - Automatic detection and registration of swarm nodes
2. **Distributed Coordinator** - Consensus-based task assignment across nodes
3. **Cross-Node Messaging** - Secure A2A communication between nodes
4. **Failure Detection** - Heartbeat-based node health monitoring
5. **Task Migration** - Reassign tasks when nodes fail

## Non-Goals
- Kubernetes orchestration (future enhancement)
- Cloud provider integration (AWS/GCP/Azure)
- Container orchestration (Docker Swarm compatibility)

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Swarm Node Cluster                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   Node A     │     │   Node B     │     │   Node C     │        │
│  │  (Leader)    │◄───►│  (Follower)  │◄───►│  (Follower)  │        │
│  │              │     │              │     │              │        │
│  │ Coordinator  │     │ Coordinator  │     │ Coordinator  │        │
│  │ 50 agents    │     │ 50 agents    │     │ 50 agents    │        │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│        │                    │                    │                  │
│        └────────────────────┼────────────────────┘                  │
│                             │                                       │
│                    ┌────────▼────────┐                             │
│                    │  Node Registry  │                             │
│                    │  (Consensus)    │                             │
│                    └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Distribution Components

### 1. NodeRegistry
- Node registration with metadata (IP, port, capacity)
- Leader election via Raft-style consensus
- Node heartbeat tracking
- Automatic failover on leader failure

### 2. DistributedCoordinator
- Extends single-node CoordinatorAgent
- Cross-node task routing
- Load balancing across nodes
- Task migration on node failure

### 3. CrossNodeRouter
- Secure WebSocket connections between nodes
- Message routing via node registry lookup
- Authentication via existing Security Layer
- Connection pooling and retry logic

### 4. NodeHealthMonitor
- Heartbeat-based liveness detection
- Configurable failure threshold
- Automatic node removal on failure
- Integration with HealthDashboard

### 5. TaskMigrator
- Detect orphaned tasks from failed nodes
- Reassign tasks to healthy nodes
- Preserve task state during migration
- Idempotent migration handling

## Protocol

### Node Join Sequence
```
1. New Node → NodeRegistry: REGISTER(node_id, metadata)
2. NodeRegistry → New Node: WELCOME(leader_id, peer_list)
3. New Node → Leader: SYNC_REQUEST(state_hash)
4. Leader → New Node: SYNC_RESPONSE(coordinator_state)
5. New Node → All: NODE_READY(node_id)
```

### Cross-Node Task Flow
```
1. Client → Any Node: SUBMIT_TASK(task)
2. Local Coordinator → NodeRegistry: FIND_CAPABLE_NODE(capability)
3. NodeRegistry → Local Coordinator: TARGET_NODE(node_id)
4. Local Coordinator → Target Node: ROUTE_TASK(task)
5. Target Node → Agent: ASSIGN_TASK(task)
6. Agent → Target Node: TASK_COMPLETE(result)
7. Target Node → Client: RESULT(result)
```

## Test Coverage Target
- 80%+ coverage for all distribution components
- Integration tests for multi-node scenarios
- Failure mode testing (network partitions, node crashes)

## Dependencies
- Existing Security Layer (AuthManager, TaskSigner)
- Existing CoordinatorAgent (extended)
- Existing A2A Router (extended)
- `asyncio` for async networking

## Risks
| Risk | Mitigation |
|------|------------|
| Network latency | Local-first routing, batch operations |
| Split-brain | Quorum-based decisions, leader election |
| State divergence | Periodic state sync, hash verification |
| Security exposure | All cross-node traffic authenticated/signed |

## Timeline
- Task 1: NodeRegistry with leader election
- Task 2: DistributedCoordinator
- Task 3: CrossNodeRouter
- Task 4: NodeHealthMonitor
- Task 5: TaskMigrator
- Task 6: Integration tests
