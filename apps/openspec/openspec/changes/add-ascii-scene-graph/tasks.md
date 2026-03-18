# ASCII Scene Graph Expansion - Implementation Tasks

## Prerequisites
- [x] Design document created and committed
- [x] RISC-V GPU VM hooks implemented (reference implementation)

## 1. Neural City Hooks

### 1.1 Hook Trait Definition
- [ ] Create `NeuralCityHook` trait in `systems/visual_shell/swarm/consciousness/hooks.py`
- [ ] Define `on_district_update(name, pos, load, agent_count)`
- [ ] Define `on_camera_move(pos, zoom)`
- [ ] Define `on_agent_relocation(agent_id, from_district, to_district)`
- [ ] Define `on_city_health(pas_score, entropy)`

### 1.2 ASCII Renderer
- [ ] Create `NeuralCityAsciiRenderer` class
- [ ] Implement camera-follow viewport (80x24 fixed grid)
- [ ] Render `neural_city_map.ascii` with district layout
- [ ] Render `district_focus.ascii` with active district details
- [ ] Render `city_health.ascii` with PAS and entropy metrics

### 1.3 Testing
- [ ] Write unit tests for NeuralCityHook trait
- [ ] Write unit tests for ASCII renderer
- [ ] Verify camera-follow viewport bounds

## 2. Visual Shell Hooks

### 2.1 Hook Trait Definition
- [ ] Create `VisualShellHook` trait in `systems/visual_shell/ascii_scene/hooks.py`
- [ ] Define `on_window_create(id, title, pos, size)`
- [ ] Define `on_window_focus(id)`
- [ ] Define `on_window_close(id)`
- [ ] Define `on_fragment_update(fragment_count, memory_mb)`

### 2.2 ASCII Renderer
- [ ] Create `VisualShellAsciiRenderer` class
- [ ] Implement tree-based YAML-like structure
- [ ] Render `shell_fragments.ascii` with window tree
- [ ] Render `shell_focus.ascii` with input state
- [ ] Render `shell_state.ascii` with global metrics

### 2.3 Testing
- [ ] Write unit tests for VisualShellHook trait
- [ ] Write unit tests for ASCII renderer
- [ ] Verify spatial query parsing

## 3. Evolution Pipeline Hooks

### 3.1 Hook Trait Definition
- [ ] Create `EvolutionHook` abstract class in `systems/evolution_daemon/hooks.py`
- [ ] Define `on_pas_change(old_score, new_score)`
- [ ] Define `on_pipeline_stage(stage, status)`
- [ ] Define `on_self_correction(trigger, action, result)`

### 3.2 ASCII Renderer
- [ ] Create `EvolutionAsciiRenderer` class
- [ ] Render `evolution_pas.ascii` with PAS meter
- [ ] Render `evolution_pipeline.ascii` with stage progress
- [ ] Render `evolution_log.ascii` with self-correction history

### 3.3 Testing
- [ ] Write unit tests for EvolutionHook trait
- [ ] Write unit tests for ASCII renderer
- [ ] Verify PAS threshold triggering

## 4. Hook Broadcasters

### 4.1 Broadcaster Implementation
- [ ] Create `NeuralCityHookBroadcaster` for multi-hook dispatch
- [ ] Create `VisualShellHookBroadcaster` for multi-hook dispatch
- [ ] Create `EvolutionHookBroadcaster` for multi-hook dispatch

### 4.2 Testing
- [ ] Write unit tests for each broadcaster
- [ ] Verify all hooks receive events

## 5. Integration

### 5.1 Wire Hooks to Subsystems
- [ ] Integrate NeuralCityHook into NeuralCityRenderer
- [ ] Integrate VisualShellHook into compositor
- [ ] Integrate EvolutionHook into evolution daemon

### 5.2 WebSocket Streaming
- [ ] Add NeuralCityHook to Visual Bridge
- [ ] Add VisualShellHook to Visual Bridge
- [ ] Add EvolutionHook to Visual Bridge

### 5.3 HUD Display
- [ ] Add ASCII Scene Graph section to visual_debug_overlay.js
- [ ] Display live .ascii file contents in HUD
- [ ] Add navigation controls for AI testing

## 6. Verification

### 6.1 End-to-End Test
- [ ] Test AI can read all .ascii files
- [ ] Test Ouroboros loop: read → reason → write VASM → materialize
- [ ] Test self-healing with PAS drop simulation

### 6.2 Performance Test
- [ ] Verify ASCII read latency <1ms
- [ ] Verify no performance degradation in subsystems
- [ ] Verify memory usage is bounded

## Completion Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Commit with conventional message
- [ ] Archive change in OpenSpec
