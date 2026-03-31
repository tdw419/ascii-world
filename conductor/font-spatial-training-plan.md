# Plan: Font-Centric Spatial Training

This plan focuses on bridging the **Vision-to-Code Loop** with the **GlyphAtlas** to enable the AI to generate documents, ideas, and structured UI elements on the spatial map.

## Objective
Train the Framebuffer AI (Ouroboros) to use fonts (6x10 bitmap glyphs) as first-class citizens in its spatial generation, moving beyond pure abstract shaders to structured "Idea Documents".

## Phase 1: Infrastructure
- [x] Create `bin/test-font-rendering.js` to verify baseline GlyphAtlas performance.
- [x] Create `bin/generate-doc-ai.js` to seed the training data with high-harmony document templates.
- [x] Implement `bin/train-fonts-ai.js` to focus Z.ai generation on `atlas.drawText()` patterns.

## Phase 2: Loop Integration
- [ ] Update `ROADMAP.md` to include **Phase 4.5: Spatial Typography**.
- [ ] Add `score_typography` action to `continuous_loop_v2.js` to evaluate text readability and layout.
- [ ] Bridge current best documents to the VCC (Visual Consistency Contract).

## Phase 3: Evolutionary Growth
- [ ] Use Z.ai to evolve the baseline "Cybernetic Manifest" templates into fully reactive spatial UIs.
- [ ] Integrate font-based data visualizations (histograms, heatmaps with labels).
- [ ] Port the most "coherent" document structures to the Infinite Map Compositor as "Window Particles".

## Target Metric
Achieve a **Document Score > 30/40** on the Visual Scorer for complex text-based layouts.
