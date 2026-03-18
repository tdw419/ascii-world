# Collective Consciousness

## Status
PROPOSED

## Summary
Transform the distributed swarm into a "single distributed brain" where agents share "thoughts" (partial inferences, embeddings, attention weights) and collectively reason across the infinite map through federated inference.

## Motivation
A swarm of workers is powerful, but a swarm that *thinks together* is transformative. Collective consciousness enables:

| Capability | Impact |
|------------|--------|
| Federated Reasoning | Complex queries processed across many agents |
| Shared Understanding | Embeddings represent collective knowledge |
| Emergent Intelligence | Higher-order patterns emerge from simple sharing |
| Resilient Cognition | Reasoning survives individual agent failures |

## Goals
1. **Thought Broadcasting** - Agents share partial inferences with neighbors
2. **Embedding Aggregation** - Combine embeddings across agents for collective understanding
3. **Attention Propagation** - Distribute attention weights for multi-agent focus
4. **Consensus Reasoning** - Aggregate conclusions from distributed inference
5. **Consciousness State** - Global state representing collective "awareness"

## Non-Goals
- Full LLM training (use pre-trained models)
- Real-time video processing (focus on text/embeddings)
- Neural network backpropagation (inference only)

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Collective Consciousness Layer                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                 Global Consciousness State                    │   │
│   │                                                               │   │
│   │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │   │
│   │   │Embedding│   │Attention│   │ Consensus│  │  Thought │     │   │
│   │   │  Pool   │   │  Map    │   │  State   │  │  Stream  │     │   │
│   │   └─────────┘   └─────────┘   └─────────┘   └─────────┘     │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              ▲                                       │
│                              │ Thought Exchange                      │
│                              ▼                                       │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│   │  Agent A     │    │  Agent B     │    │  Agent C     │         │
│   │  ┌────────┐  │    │  ┌────────┐  │    │  ┌────────┐  │         │
│   │  │Thought │  │◄──►│  │Thought │  │◄──►│  │Thought │  │         │
│   │  │ Engine │  │    │  │ Engine │  │    │  │ Engine │  │         │
│   │  └────────┘  │    │  └────────┘  │    │  └────────┘  │         │
│   │   Embedding  │    │   Embedding  │    │   Embedding  │         │
│   │   Attention  │    │   Attention  │    │   Attention  │         │
│   └──────────────┘    └──────────────┘    └──────────────┘         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Thought
A unit of cognitive exchange between agents.

```python
@dataclass
class Thought:
    thought_id: str
    agent_id: str
    thought_type: ThoughtType  # EMBEDDING, ATTENTION, INFERENCE, QUERY
    content: np.ndarray         # Vector representation
    confidence: float           # 0.0 - 1.0
    timestamp: float
    metadata: dict
```

### 2. Thought Engine
Per-agent reasoning module that generates and processes thoughts.

```python
class ThoughtEngine:
    async def generate_embedding(self, input: str) -> Thought
    async def compute_attention(self, query: Thought, context: List[Thought]) -> Thought
    async def infer(self, thoughts: List[Thought]) -> Thought
    async def broadcast(self, thought: Thought) -> None
    async def receive(self, thought: Thought) -> None
```

### 3. Global Consciousness State
Shared state representing collective awareness.

```python
class ConsciousnessState:
    embedding_pool: Dict[str, np.ndarray]  # Agent embeddings
    attention_map: np.ndarray              # Cross-agent attention weights
    consensus_state: Dict[str, Any]        # Agreed conclusions
    thought_stream: List[Thought]          # Recent thought history
```

### 4. Thought Broadcasting Protocol

```
1. Agent generates Thought locally
2. Agent broadcasts Thought to neighbors via A2A Router
3. Neighbors receive and integrate Thought into local context
4. Neighbors may generate derivative Thoughts
5. Global state aggregates all Thoughts
```

### 5. Federated Inference Pattern

```
Query ──► Agent A ──► Partial Inference (embedding)
              │
              ├──► Agent B ──► Attention weighting
              │         │
              │         └──► Agent C ──► Final inference
              │                   │
              └───────────────────┴──► Consensus
```

## Agent Types

### 1. ThoughtEngine Agent
- Generates embeddings from inputs
- Computes attention weights
- Produces local inferences
- Broadcasts thoughts to swarm

### 2. ConsciousnessAggregator Agent
- Maintains global consciousness state
- Aggregates embeddings across agents
- Computes consensus from distributed inferences
- Publishes global awareness updates

### 3. AttentionCoordinator Agent
- Coordinates attention across agents
- Routes focus to relevant agents
- Balances attention load
- Detects attention conflicts

### 4. ConsensusEngine Agent
- Aggregates conclusions from multiple agents
- Detects agreement/disagreement
- Resolves conflicting inferences
- Publishes final consensus

## Use Cases

### 1. Distributed Query Answering
```
User Query: "What files were accessed most recently?"
→ Agent A embeds query
→ Agent B computes attention over file embeddings
→ Agent C retrieves relevant files
→ Consensus produces final answer
```

### 2. Emergent Pattern Recognition
```
System: Monitor for anomalies
→ Agents share local anomaly scores
→ Global attention highlights patterns
→ Consensus identifies true anomalies
```

### 3. Collaborative Decision Making
```
Task: Optimize map layout
→ Each agent proposes local improvements
→ Attention weights prioritize high-value regions
→ Consensus selects optimal actions
```

## Test Coverage Target
- 80%+ coverage for all consciousness components
- Integration tests for federated inference
- Performance tests for 100+ concurrent thoughts

## Dependencies
- Existing Swarm infrastructure
- Pre-trained embedding model (sentence-transformers)
- A2A Router for thought broadcasting
- Shared memory for consciousness state

## Risks
| Risk | Mitigation |
|------|------------|
| Thought spam | Rate limiting, confidence thresholds |
| Consensus delays | Timeout-based decisions |
| State divergence | Periodic state sync |
| Memory usage | Thought pruning, embedding compression |

## Timeline
- Task 1: Thought data structures and ThoughtEngine
- Task 2: Thought broadcasting via A2A
- Task 3: ConsciousnessState aggregation
- Task 4: AttentionCoordinator
- Task 5: ConsensusEngine
- Task 6: Visual Dashboard integration
- Task 7: Integration tests and demos
