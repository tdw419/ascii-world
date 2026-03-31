# Plan: Visual Training for Framebuffer AI (Ouroboros)

This plan outlines the steps to bridge the **Ouroboros Continuous Loop** with a **Vision Model** to enable visual-first training of the Framebuffer AI. Currently, Ouroboros optimizes for code correctness (test counts); this update enables optimization for visual aesthetics and information density.

## Objective
Enable Ouroboros to use vision-based scoring (via LM Studio/Qwen-VL) as a reward signal for generating pixel formulas and shaders.

## Key Files & Context
- `.ouroboros/continuous_loop_v2.js`: The main self-improvement loop.
- `sync/pixel-buffer.js`: Core pixel manipulation (with `toPNG()` capability).
- `sync/software-shader.js`: The engine that renders formulas/shaders.
- `ROADMAP.md`: Strategic tracking of progress.

## Proposed Changes

### 1. New: `sync/visual-scorer.js`
Create a bridge to LM Studio's vision API.
- **Goal:** Receive a PNG, send it to a vision model, and return a multi-dimensional score.
- **Metrics:** `coherence` (visual integrity), `harmony` (color balance), `complexity` (detail), `density` (utility/information).
- **Endpoint:** `http://localhost:1234/v1/chat/completions`.

### 2. New: `bin/collect-training-samples.js`
A utility to gather training data.
- **Goal:** Render all built-in shaders and current templates to PNGs and score them.
- **Output:** Save results to `.ouroboros/training_data/` (PNG + JSON metadata).
- **Use Case:** Generate a "baseline" for the AI to understand what "good" looks like.

### 3. Update: `ROADMAP.md`
- **Goal:** Align strategic goals with visual intelligence.
- **Change:** Add **Phase 4: Visual Intelligence & Training** or integrate into Phase 3.

### 4. Update: `.ouroboros/continuous_loop_v2.js`
- **Goal:** Close the loop.
- **Change:**
    - Import `VisualScorer`.
    - Add `score_visuals` action to `getStrategicAction`.
    - When implementing features, render the result and score it.
    - If the visual score is higher than the baseline, "KEEP" the change.

## Implementation Steps

### Phase 1: Infrastructure (Visual Scorer)
1. Create `sync/visual-scorer.js`.
2. Test connection to LM Studio with a mock PNG.

### Phase 2: Data Collection
1. Create `bin/collect-training-samples.js`.
2. Run it to populate `.ouroboros/training_data/` with built-in shaders (plasma, xor, mandelbrot).

### Phase 3: Loop Integration
1. Update `ROADMAP.md` to reflect the new visual training phase.
2. Modify `.ouroboros/continuous_loop_v2.js` to import `VisualScorer`.
3. Update the loop logic to handle `implement_feature` by:
    - Rendering the new shader/template.
    - Capturing a PNG.
    - Calling `VisualScorer.score()`.
    - Using the score in the decision-making process.

## Verification & Testing
1. **Unit Test:** Add `tests/visual-scorer.test.js` to verify JSON parsing of vision model responses.
2. **Integration Test:** Run `node bin/collect-training-samples.js --score` and verify `.ouroboros/training_data/` contains valid PNGs and JSON scores.
3. **Loop Verification:** Run `node .ouroboros/continuous_loop_v2.js` and verify logs show "Visual Score: XX/40" for new feature implementations.
