# Ouroboros V2 Roadmap

This roadmap guides the autonomous AI agent through strategic phases of codebase improvement.

---

## Current Goal
**Target:** 500+ tests passing with >50% coverage on all core modules

---

## Phases

### Phase 1: Test Coverage Foundation ✅
**Status:** COMPLETE
**Milestones:**
- [x] Achieve 212+ tests passing
- [x] Add tests for all sync/*.js modules
- [x] Establish continuous loop infrastructure

**Completed:** 2026-03-23
**Result:** 301 tests passing, 22 modules tested

---

### Phase 2: Code Quality Hardening ✅
**Status:** COMPLETE
**Milestones:**
- [x] Increase coverage to 50% on all core modules
- [x] Add JSDoc documentation to all public functions
- [x] Remove dead code and unused dependencies
- [x] Standardize error handling patterns

**Completed:** 2026-03-23
**Result:** 500+ tests passing, Phase 2 Hardening cycle finished.

---

### Phase 3: Feature Enhancement 🔄
**Status:** IN PROGRESS
**Milestones:**
- [ ] Implement RGB animation mode in console
- [ ] Add mouse input support for framebuffer
- [ ] Create window/panel system in ScreenManager
- [ ] Add formula history and recall

**Current Focus:** RGB animation mode
**Next Action:** Extend software-shader.js with time-based parameters

---

### Phase 4: Visual Intelligence & Training 🔄
**Status:** IN PROGRESS
**Milestones:**
- [x] Implement VisualScorer bridge to vision model
- [x] Create bin/collect-training-samples.js for data collection
- [ ] Integrate visual scoring into Ouroboros V2 loop
- [ ] Achieve baseline scores (>25/40) for all built-in shaders
- [ ] Use visual feedback to generate new "evolutionary" shaders

**Current Focus:** Vision loop integration
**Next Action:** Update continuous_loop_v2.js to use VisualScorer

---

### Phase 5: Performance Optimization
**Status:** PENDING
**Milestones:**
- [ ] Profile render loop performance
- [ ] Implement dirty-rect optimization for ScreenManager
- [ ] Add caching for GlyphAtlas lookups
- [ ] Benchmark PixelVM execution speed

**Dependencies:** Phase 3 complete

---

### Phase 5: Documentation & Polish
**Status:** PENDING
**Milestones:**
- [ ] Complete API documentation
- [ ] Add usage examples to all modules
- [ ] Create integration test suite
- [ ] Update README with final metrics

**Dependencies:** Phase 4 complete

---

## Active Decisions

### Decision Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-23 | Use continuous loop for test generation | Proven effective: 212→301 tests |
| 2026-03-23 | Target 500 tests as next milestone | Natural progression from 301 |
| 2026-03-23 | Transition to Phase 3: Features | Hardening complete, core stability reached 500 tests |

### Blocked Items
*None currently*

---

## Metrics Tracking

| Metric | Start | Current | Target |
|--------|-------|---------|--------|
| Tests Passing | 212 | 500 | 500+ |
| Coverage | 5% | ~55% | 50%+ |
| Modules Tested | 17 | 40 | 100% |
| Documentation | 0% | 40% | 80% |

---

## How to Update

The AI agent should:
1. Read this file at the start of each iteration
2. Check off completed milestones with `[x]`
3. Update status emojis: ✅ (complete), 🔄 (in progress), ⏸️ (paused), ❌ (blocked)
4. Add new decisions to the Decision Log
5. Update metrics after each iteration

---

## Roadmap Version
- **Version:** 1.1
- **Created:** 2026-03-23
- **Last Updated:** 2026-03-23
- **Total Phases:** 5
- **Completion:** 40% (2/5 phases)
