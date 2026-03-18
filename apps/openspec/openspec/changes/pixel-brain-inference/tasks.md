# PixelBrain Inference Tasks

> **Full Plan**: `docs/plans/2026-03-08-pixel-brain-inference.md`
> **Team Config**: `apps/openspec/openspec/teams/pixel-brain-team.yaml`

## Phase 1: Weight Encoding

### Task 1.1: Add float16 weight encoding
- [ ] Create `tests/test_pixel_brain_converter.py` with failing tests
- [ ] Run `pytest tests/test_pixel_brain_converter.py -v` - expect FAIL
- [ ] Add `fold_weights_float16()` method to converter
- [ ] Add `create_brain_atlas_float16()` method to converter
- [ ] Add `_pack_to_atlas_float16()` method to converter
- [ ] Update `convert()` to support `use_float16=True`
- [ ] Run tests - expect PASS
- [ ] Commit: `feat(pixel-brain): add float16 weight encoding for inference`

**Agent**: weight-encoding-engineer@pixel-brain-team

### Task 1.2: Re-generate brain atlas
- [ ] Run converter with float16 encoding
- [ ] Verify tinystories_brain_f16.rts.png exists
- [ ] Verify metadata shows encoding: float16

**Agent**: weight-encoding-engineer@pixel-brain-team

---

## Phase 2: GeoASM Extension

### Task 2.1: Add neural opcodes
- [ ] Create `tests/test_geoasm_neural_opcodes.py` with failing tests
- [ ] Run `pytest tests/test_geoasm_neural_opcodes.py -v` - expect FAIL
- [ ] Add opcodes 0xD0-0xD3, 0xD5-0xD6 to `geoasm_lib.py`
- [ ] Move existing 0xD5-0xD6 to 0xD7-0xD8 (timer opcodes)
- [ ] Run tests - expect PASS
- [ ] Commit: `feat(geoasm): add neural extension opcodes D0-D6 for PixelBrain`

**Agent**: geoasm-extension-engineer@pixel-brain-team

### Task 2.2: Update GeoASM executor
- [ ] Add neural opcode cases to `geoasm_executor.wgsl`
- [ ] Dispatch to correct WGSL shader for each opcode

**Agent**: geoasm-extension-engineer@pixel-brain-team

---

## Phase 3: Pipeline Orchestrator

### Task 3.1: Create PixelBrainPipeline class
- [ ] Create `tests/test_pixel_brain_pipeline.py` with failing tests
- [ ] Run `pytest tests/test_pixel_brain_pipeline.py -v` - expect FAIL
- [ ] Create `systems/visual_shell/wgsl/pixel_brain_pipeline.py`
- [ ] Implement `_load_metadata()`, `_load_atlas()`
- [ ] Implement `embed_token()` with Hilbert lookup
- [ ] Run tests - expect PASS
- [ ] Commit: `feat(pixel-brain): add inference pipeline orchestrator`

**Agent**: pipeline-orchestrator-engineer@pixel-brain-team

### Task 3.2: Implement forward pass
- [ ] Implement `_attention_layer()` method
- [ ] Implement `_ffn_layer()` method
- [ ] Implement `_lm_head()` method
- [ ] Implement `forward()` method
- [ ] Run tests - expect PASS

**Agent**: pipeline-orchestrator-engineer@pixel-brain-team

### Task 3.3: Implement generation
- [ ] Implement `generate()` method with autoregressive loop
- [ ] Use greedy sampling (argmax)
- [ ] Run tests - expect PASS

**Agent**: pipeline-orchestrator-engineer@pixel-brain-team

---

## Phase 4: Visual Feedback

### Task 4.1: Add THOUGHT_PULSE to VisualBridge
- [ ] Create `tests/test_thought_pulse.py` with failing tests
- [ ] Run `pytest tests/test_thought_pulse.py -v` - expect FAIL
- [ ] Add `emit_thought_pulse()` to visual_bridge.py
- [ ] Add `has_active_glyphs()`, `get_active_glyphs()` methods
- [ ] Run tests - expect PASS
- [ ] Commit: `feat(visual-shell): add THOUGHT_PULSE emission for PixelBrain`

**Agent**: visual-feedback-engineer@pixel-brain-team

### Task 4.2: Wire generation to visual feedback
- [ ] Connect generate() to emit_thought_pulse()
- [ ] Position glyphs sequentially
- [ ] Verify visual output

**Agent**: visual-feedback-engineer@pixel-brain-team

---

## Phase 5: E2E Integration

### Task 5.1: Create E2E tests
- [ ] Create `tests/test_pixel_brain_e2e.py`
- [ ] Test token through pipeline
- [ ] Test generation sequence
- [ ] Test visual feedback

**Agent**: e2e-integration-engineer@pixel-brain-team

### Task 5.2: Full system verification
- [ ] Run all pixel_brain tests
- [ ] Run all geoasm tests
- [ ] Run all visual_shell tests
- [ ] Verify no regressions

**Agent**: e2e-integration-engineer@pixel-brain-team

---

## Verification Checklist

- [ ] `tinystories_brain_f16.rts.png` loads with float16 weights
- [ ] GeoASM opcodes D0-D6 defined
- [ ] `PixelBrainPipeline` embeds tokens
- [ ] `THOUGHT_PULSE` emits visible glyphs
- [ ] E2E test passes (or skips gracefully)
- [ ] 15+ tests passing
