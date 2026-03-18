# Collective Consciousness Specification

## Overview

This specification defines the requirements for transforming the distributed swarm
into a collective consciousness capable of federated reasoning, shared understanding,
and emergent intelligence through thought exchange.

## Requirements

### CONS-001: Thought Data Structure

**Priority:** Critical
**Status:** Required

A standard unit for cognitive exchange between agents.

| Requirement | Description |
|-------------|-------------|
| CONS-001.1 | Thoughts have unique IDs and source agent IDs |
| CONS-001.2 | Thoughts are typed (EMBEDDING, ATTENTION, INFERENCE, QUERY) |
| CONS-001.3 | Content is represented as numpy arrays |
| CONS-001.4 | Confidence scores range from 0.0 to 1.0 |
| CONS-001.5 | Timestamps enable ordering and pruning |

**Thought Types:**
| Type | Description | Content Shape |
|------|-------------|---------------|
| EMBEDDING | Vector representation of input | (dim,) |
| ATTENTION | Attention weights over context | (context_len,) |
| INFERENCE | Local reasoning output | (output_dim,) |
| QUERY | Question or request | (query_dim,) |

**Acceptance Criteria:**
- [ ] Thoughts are serializable for A2A transmission
- [ ] Content arrays preserve precision
- [ ] Confidence is validated to [0, 1]
- [ ] Timestamps are monotonic per agent

### CONS-002: ThoughtEngine

**Priority:** Critical
**Status:** Required**

Per-agent reasoning module for generating and processing thoughts.

| Requirement | Description |
|-------------|-------------|
| CONS-002.1 | Generate embeddings from text inputs |
| CONS-002.2 | Compute attention weights over context |
| CONS-002.3 | Produce local inferences from thoughts |
| CONS-002.4 | Broadcast thoughts to neighbors |
| CONS-002.5 | Receive and integrate incoming thoughts |

**Embedding Generation:**
```
embedding = model.encode(input_text)  # Use sentence-transformers
thought = Thought(type=EMBEDDING, content=embedding, confidence=1.0)
```

**Attention Computation:**
```
query_emb = query.content
context_embs = [t.content for t in context]
attention = softmax(query_emb @ context_embs.T)
```

**Acceptance Criteria:**
- [ ] Embeddings are deterministic for same input
- [ ] Attention weights sum to 1.0
- [ ] Inferences complete within 100ms
- [ ] Broadcasting is non-blocking

### CONS-003: Thought Broadcasting

**Priority:** Critical
**Status:** Required**

Secure and efficient thought exchange via A2A Router.

| Requirement | Description |
|-------------|-------------|
| CONS-003.1 | Thoughts are serialized for transmission |
| CONS-003.2 | Broadcasting targets neighbor agents |
| CONS-003.3 | Rate limiting prevents thought spam |
| CONS-003.4 | Receiving agents integrate thoughts |
| CONS-003.5 | Failed broadcasts are retried |

**Rate Limits:**
| Thought Type | Max Rate |
|--------------|----------|
| EMBEDDING | 10/sec |
| ATTENTION | 50/sec |
| INFERENCE | 5/sec |
| QUERY | 2/sec |

**Acceptance Criteria:**
- [ ] Thoughts are delivered to all neighbors
- [ ] Rate limiting prevents overload
- [ ] Serialization preserves data integrity
- [ ] Retries handle transient failures

### CONS-004: ConsciousnessState

**Priority:** Critical
**Status:** Required**

Global state representing collective awareness.

| Requirement | Description |
|-------------|-------------|
| CONS-004.1 | Embedding pool aggregates agent embeddings |
| CONS-004.2 | Attention map shows cross-agent attention |
| CONS-004.3 | Consensus state stores agreed conclusions |
| CONS-004.4 | Thought stream maintains recent history |
| CONS-004.5 | State is periodically pruned for memory |

**State Components:**
```python
class ConsciousnessState:
    embedding_pool: Dict[agent_id, np.ndarray]  # Agent → embedding
    attention_map: np.ndarray                   # (n_agents, n_agents)
    consensus_state: Dict[key, value]           # Agreed conclusions
    thought_stream: Deque[Thought]              # Recent thoughts (max 1000)
```

**Acceptance Criteria:**
- [ ] Embedding pool reflects all active agents
- [ ] Attention map is symmetric
- [ ] Consensus state is consistent across nodes
- [ ] Thought stream is bounded

### CONS-005: ConsciousnessAggregator

**Priority:** High
**Status:** Required**

Agent that maintains global consciousness state.

| Requirement | Description |
|-------------|-------------|
| CONS-005.1 | Subscribe to all thought broadcasts |
| CONS-005.2 | Aggregate embeddings into global pool |
| CONS-005.3 | Update attention map on new thoughts |
| CONS-005.4 | Publish state updates to swarm |
| CONS-005.5 | Periodic sync with peer aggregators |

**Aggregation Interval:**
- Embedding pool: Update on every new embedding
- Attention map: Update every 1 second
- State sync: Every 5 seconds

**Acceptance Criteria:**
- [ ] State updates are atomic
- [ ] Peer sync resolves conflicts
- [ ] Memory usage is bounded
- [ ] Latency < 100ms for updates

### CONS-006: AttentionCoordinator

**Priority:** High
**Status:** Required**

Coordinates attention distribution across agents.

| Requirement | Description |
|-------------|-------------|
| CONS-006.1 | Compute global attention weights |
| CONS-006.2 | Route focus to relevant agents |
| CONS-006.3 | Balance attention load across agents |
| CONS-006.4 | Detect and resolve attention conflicts |
| CONS-006.5 | Publish attention updates |

**Attention Routing:**
```
target_agent = argmax(attention_map[query_agent, :])
```

**Acceptance Criteria:**
- [ ] Attention is fairly distributed
- [ ] Hot agents are identified
- [ ] Conflicts are resolved deterministically
- [ ] Updates are timely

### CONS-007: ConsensusEngine

**Priority:** High
**Status:** Required**

Aggregates conclusions from distributed inferences.

| Requirement | Description |
|-------------|-------------|
| CONS-007.1 | Collect inferences from multiple agents |
| CONS-007.2 | Detect agreement (high overlap) |
| CONS-007.3 | Detect disagreement (low overlap) |
| CONS-007.4 | Resolve conflicts with confidence weighting |
| CONS-007.5 | Timeout for slow agents |

**Consensus Algorithm:**
```
consensus = weighted_average(
    [inf.content for inf in inferences],
    weights=[inf.confidence for inf in inferences]
)
agreement = cosine_similarity(inferences) > threshold
```

**Acceptance Criteria:**
- [ ] Consensus reflects majority view
- [ ] Conflicts are resolved fairly
- [ ] Slow agents don't block consensus
- [ ] Consensus is reproducible

## Integration Points

### A2A Router Integration
```
ThoughtBroadcaster → A2A.send(thought, targets)
ThoughtBroadcaster → A2A.receive() → Thought
```

### Security Layer Integration
```
ThoughtBroadcaster → TaskSigner.sign(thought)
ThoughtBroadcaster → TaskSigner.verify(incoming_thought)
```

### Health Dashboard Integration
```
ConsciousnessAggregator → HealthDashboard.report_state(state)
ConsensusEngine → HealthDashboard.report_consensus(consensus)
```

### Visual Dashboard Integration
```
Dashboard → ConsciousnessState.embedding_pool → Agent visualization
Dashboard → ConsciousnessState.attention_map → Attention heatmap
Dashboard → ConsciousnessState.thought_stream → Thought stream panel
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Thought generation latency | < 50ms |
| Thought broadcast latency | < 100ms |
| State aggregation latency | < 100ms |
| Consensus formation time | < 1s |
| Max concurrent thoughts | 100+ |

## Test Requirements

| Component | Unit Tests | Integration Tests | Coverage Target |
|-----------|------------|-------------------|-----------------|
| Thought | 5+ | - | 90%+ |
| ThoughtEngine | 5+ | 2+ | 80%+ |
| ThoughtBroadcaster | 5+ | 2+ | 80%+ |
| ConsciousnessState | 5+ | 2+ | 80%+ |
| ConsciousnessAggregator | 5+ | 2+ | 80%+ |
| AttentionCoordinator | 5+ | 2+ | 80%+ |
| ConsensusEngine | 5+ | 2+ | 80%+ |
| Integration | - | 4+ | E2E coverage |

## Emergent Behaviors

The collective consciousness should exhibit these emergent behaviors:

| Behavior | Description |
|----------|-------------|
| Distributed Query | Questions answered by coordinated agents |
| Pattern Recognition | Patterns emerge from shared attention |
| Collaborative Decision | Decisions made through consensus |
| Self-Reflection | System reasons about its own state |
| Adaptive Focus | Attention shifts based on relevance |
