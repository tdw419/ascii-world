# Frontier G: Visual Ingestion - Tasks

## Phase 1: VisualPerceptionAgent (MVP)

### 1. Agent Infrastructure
- [x] 1.1 Create `systems/visual_shell/swarm/visual_perception_agent.py`
- [x] 1.2 Implement A2A Router connection and registration logic
- [x] 1.3 Implement `PERCEIVE_REGION` message handler
- [x] 1.4 Write unit tests for agent message orchestration

### 2. Pipeline Integration
- [x] 2.1 Wire up `conductor/tracks/shotcut-on-the-map/extraction_pipeline.py` into the agent
- [x] 2.2 Implement `SemanticDiffer` to detect structural UI changes
- [x] 2.3 Implement background polling loop for active "observed" regions
- [x] 2.4 Verify extraction performance within the agent sandbox

### 3. Swarm Consumption
- [x] 3.1 Update `ResearcherAgent` to request visual perception when targeting tiles
- [x] 3.2 Update `ConsensusEngine` to handle visual-grounding votes
- [x] 3.3 Verify end-to-end flow: Screenshot -> Agent -> JSON -> Consensus

## Phase 2: Observability (Future)
- [ ] 4.1 Create HUD Skeleton Overlay (overlay the JSON Scene Graph on the Dashboard)
- [ ] 4.2 Implement click-through from Dashboard to perceived Linux widget
