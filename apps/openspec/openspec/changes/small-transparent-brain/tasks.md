# Small Transparent Brain - Task Breakdown

## Phase 1: 4-bit Quantization Infrastructure

### Task 1.1: GGUF Quantization Format Research
- [ ] Write test for Q4 dequantization (`tests/test_q4_dequant.py`)
- [ ] Implement Q4 dequantization in Python (`systems/visual_shell/wgsl/quantization/q4_utils.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(quantization): add Q4_0 dequantization utility`

### Task 1.2: WGSL Q4 Dequantization Shader
- [ ] Write WGSL dequantization function (`systems/visual_shell/wgsl/quantization/q4_dequant.wgsl`)
- [ ] Write test for WGSL shader compilation (`tests/test_q4_wgsl.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(wgsl): add Q4_0 dequantization shader`

### Task 1.3: Quantized Weight Converter
- [ ] Write test for quantized model conversion (`tests/test_quant_converter.py`)
- [ ] Implement FP32→Q4 quantization (`systems/visual_shell/wgsl/quantization/quant_converter.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(quantization): add FP32 to Q4_0 conversion`

## Phase 2: Expanded Brain Atlas (125M Parameters)

### Task 2.1: Atlas Size Calculator
- [ ] Write test for atlas sizing (`tests/test_atlas_calculator.py`)
- [ ] Implement calculator (`systems/visual_shell/wgsl/atlas_calculator.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(atlas): add size calculator for quantized models`

### Task 2.2: Model Weight Extraction for 125M
- [ ] Write test for weight extraction (`tests/test_model_extractor.py`)
- [ ] Implement extractor (`systems/visual_shell/wgsl/model_extractor.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(extraction): add model weight extractor for atlas packing`

## Phase 3: Glass Box Attention Visualization

### Task 3.1: Attention Output Buffer Integration
- [ ] Write test for attention output streaming (`tests/test_attention_visualization.py`)
- [ ] Add `emit_attention_update` to VisualBridge (`systems/visual_shell/api/visual_bridge.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(visualization): add attention weight streaming to VisualBridge`

### Task 3.2: Frontend Attention Heatmap Renderer
- [ ] Write WGSL attention heatmap shader (`systems/visual_shell/web/shaders/attention_heatmap.wgsl`)
- [ ] Write JavaScript visualizer (`systems/visual_shell/web/attention_visualizer.js`)
- [ ] Commit: `feat(visualization): add attention heatmap renderer for frontend`

## Phase 4: Evolution Daemon Weight Mutation

### Task 4.1: Weight Sector Mutation API
- [ ] Write test for weight mutation (`tests/test_weight_mutator.py`)
- [ ] Implement WeightMutator (`systems/evolution_daemon/weight_mutator.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(evolution): add weight sector mutation API for brain evolution`

### Task 4.2: Evolution Daemon Integration
- [ ] Write integration test (`tests/test_evolution_weight_integration.py`)
- [ ] Add weight mutation hook to EvolutionDaemon (`systems/evolution_daemon/evolution_daemon.py`)
- [ ] Verify tests pass
- [ ] Commit: `feat(evolution): integrate weight mutation into EvolutionDaemon`

## Phase 5: End-to-End Glass Box Inference

### Task 5.1: Full Pipeline Integration Test
- [ ] Write end-to-end test (`tests/test_glass_box_e2e.py`)
- [ ] Verify all integration points work
- [ ] Commit: `test(glass-box): add end-to-end integration tests`

## Execution Order

Tasks can be parallelized within phases:
- **Phase 1**: Tasks 1.1, 1.2, 1.3 can run in parallel (independent)
- **Phase 2**: Tasks 2.1, 2.2 can run in parallel
- **Phase 3**: Tasks 3.1, 3.2 can run in parallel
- **Phase 4**: Tasks 4.1, 4.2 must run sequentially (4.2 depends on 4.1)
- **Phase 5**: Must wait for all phases complete

## Agent Assignment

| Agent Type | Assigned Tasks |
|------------|----------------|
| **Test-Driven Developer** | All Phase 1 tasks (TDD workflow) |
| **WGSL Specialist** | Task 1.2, Task 3.2 |
| **Python Engineer** | Task 1.1, 1.3, 2.1, 2.2, 4.1, 4.2 |
| **Integration Specialist** | Task 3.1, 5.1 |
