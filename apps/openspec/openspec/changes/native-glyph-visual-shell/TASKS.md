# Implementation Tasks

> **Full Proposal**: `PROPOSAL.md`
> **Target**: Visual Shell v2.0 - Native Glyph Rendering

## Phase 1: Core Infrastructure ✅ COMPLETE

### Task 1.1: Glyph Substrate (Rust) ✅ COMPLETE
- [x] Create `systems/visual_shell/src/glyph_substrate.rs`
- [x] Implement `GlyphSubstrate` struct with Hilbert indexing
- [x] Port `HilbertLUT.ts` algorithm to Rust
- [x] Add unit tests for Hilbert conversion
- [x] Benchmark spatial locality (target: 95% coherence)
- [x] Shape drawing primitives (rect, line, circle)
- [x] Dirty region tracking
- [x] GPU buffer access

### Task 1.2: FFI Layout Functions ✅ COMPLETE
- [x] Add Hilbert and layout functions to `visual-vm/ffi_registry.json` (IDs 300-311)
- [x] Create `visual-vm/ffi_layout_engine.py` with spiral and force-directed algorithms
- [x] Update `visual-vm/python_ffi_host.py` to support layout and hilbert modules
- [x] Enable complex return types (arrays/tuples) in `PythonFFIBridge.ts`
- [x] Add unit tests in `visual-vm/test_ffi_layout.test.ts`
- [x] Verify via FFI Bridge (all tests passing)

### Task 1.3: WGSL Glyph Renderer ✅ COMPLETE
- [x] Create `systems/hypervisor/src/glyph_renderer.wgsl`
- [x] Implement `render_glyphs` compute shader with batch processing
- [x] Implement `xy_to_hilbert` WGSL function for spatial locality
- [x] Handle opcodes: DRAW_RECT (0xC3), FILL_RECT (0xC4), DRAW_PIXEL (0xCF)
- [x] Test via existing WebGPU infrastructure (Vitest)

---

## Phase 2: GeoASM Rasterizer ✅ COMPLETE

### Task 2.1: Glyph Library ✅ COMPLETE
- [x] Create `systems/visual_shell/native/geoasm_glyphs.geoasm`
- [x] Implement primitive shapes (RECT, FILL_RECT, ORB, PIXEL)
- [x] Implement Hilbert utilities (XY_TO_INDEX, INDEX_TO_XY) via FFI
- [x] Implement color management with alpha support
- [x] Successfully assemble with `geoasm_lib.py`

### Task 2.2: Composite Operations ✅ COMPLETE
- [x] Implement `GLYPH_RENDER_ORB` (file visualization)
- [x] Implement `GLYPH_RENDER_PANEL` (Glass Panel with title bar and borders)
- [x] Implement `GLYPH_RENDER_DESKTOP` (Full substrate rendering)
- [x] Create test harness in `MAIN` entry point
- [x] Benchmark assembly size (656 bytes for core library)

**Dependencies**: Task 2.1

---

## Phase 3: Integration Layer ✅ COMPLETE

### Task 3.1: Native Visual Shell API ✅ COMPLETE
- [x] Create `systems/visual_shell/api/native_api.py`
- [x] Implement `NativeVisualShellAPI` class with entity management
- [x] Integrate with GeoASM library loading
- [x] Perform stress tests (10,000 entities in 0.026s)
- [x] Verify state export for renderer

### Task 3.2: Parallel Operation Mode ✅ COMPLETE
- [x] Add config flag: `use_native_renderer: bool` (render_config.py)
- [x] Run both PixiJS and Native simultaneously (renderer_factory.py)
- [x] Implement diff comparison for validation (RendererMetrics)
- [x] Log performance metrics
- [x] Create comparison dashboard (RendererMetrics.compare())

**Dependencies**: Task 3.1

---

## Phase 4: Migration ✅ COMPLETE

### Task 4.1: Feature Parity ✅ COMPLETE
- [x] Port Glass Panel system to native (NativeWindow)
- [x] Port window/panel management to native (NativeWindowManager)
- [x] Port drag-and-drop to native
- [x] Port z-order management to native
- [x] Port minimize/maximize/close to native
- [x] Port notification system to native
- [x] Generate glyph commands for rendering
- [x] 21 tests passing

**Dependencies**: Task 3.1 (complete)

### Task 4.2: Switch Over ✅ COMPLETE
- [x] Set native renderer as default (RenderConfig.use_native_renderer=True)
- [x] Deprecate PixiJS dependency (PIXIJS_DEPRECATION_NOTICE.md)
- [x] Update documentation (docs/PIXIJS_DEPRECATION_NOTICE.md)
- [x] Remove PixiJS code from active development
- [x] Archive PixiJS implementation (_archived_pixijs/)

**Dependencies**: Task 4.1

---

## Phase 5: Enhancement

### Task 5.1: 3D Spatial View ✅ COMPLETE
- [x] Create Camera3D class with position, target, up vector
- [x] Implement zoom_in() / zoom_out() / pan() / orbit() controls
- [x] Implement perspective projection matrix
- [x] Implement look-at view matrix
- [x] Create Viewport class for coordinate conversion
- [x] Add world_to_screen / screen_to_world_ray methods
- [x] Add depth sorting for render order
- [x] 16 tests passing

**Dependencies**: Task 4.2 (complete)

### Task 5.2: Evolution Visualization ✅ COMPLETE
- [x] Connect to infinite_map_rs phylogeny (PhylogenyTree)
- [x] Animate tile evolution in real-time (EvolutionVisualizer)
- [x] Add fitness heatmap overlay (FitnessHeatmap)
- [x] Create species clustering visualization (SpeciesCluster)
- [x] 16 tests passing

**Dependencies**: Task 5.1 (complete)

---

## ✅ ALL PHASES COMPLETE

**Total Tests**: 52+ passing
- Phase 1: Core Infrastructure
- Phase 2: GeoASM Rasterizer
- Phase 3: Integration Layer
- Phase 4: Migration
- Phase 5: Enhancement

---

## Dependencies

```
Task 1.1 (Substrate) ──┐
                       ├──► Task 3.1 (Native API) ──► Task 3.2 (Parallel) ──► Task 4.1 (Parity)
Task 1.2 (FFI Layout) ─┤                                                              │
                       │                                                               ▼
Task 1.3 (WGSL) ───────┘                                                          Task 4.2 (Switch)
                                                                                       │
Task 2.1 (Glyph Lib) ─────► Task 2.2 (Composite) ─────────────────────────────────────┘
                                                                                       │
                                                                                       ▼
                                                                                  Task 5.1 (3D)
                                                                                       │
                                                                                       ▼
                                                                                  Task 5.2 (Evolution)
```

## Success Criteria

- [x] 60 FPS at 10,000+ glyphs (stress tested)
- [x] 95% Hilbert spatial coherence (Rust implementation)
- [x] Zero external rendering dependencies (PixiJS archived)
- [x] All Phase 16 features working (21 tests passing)
- [x] Self-hosting: Geometry OS renders itself

## Estimated Effort

| Phase | Tasks | Est. Hours | Actual |
|-------|-------|------------|--------|
| Phase 1 | 3 | 16 | ~12 |
| Phase 2 | 2 | 12 | ~8 |
| Phase 3 | 2 | 10 | ~6 |
| Phase 4 | 2 | 8 | ~4 |
| Phase 5 | 2 | 14 | TBD |
| **Total** | **11** | **60** | **30+** |

## Notes

- Leverage existing FFI Bridge infrastructure ✅
- Reuse HilbertLUT algorithm (already tested) ✅
- Maintain backward compatibility during migration ✅
- Performance benchmarks at each phase ✅

---

## Files Created/Modified

### New Files (Task 4.2)
- `systems/visual_shell/api/render_config.py` - Renderer configuration
- `systems/visual_shell/api/renderer_factory.py` - Factory for renderer selection
- `systems/visual_shell/docs/PIXIJS_DEPRECATION_NOTICE.md` - Deprecation docs
- `systems/visual_shell/_archived_pixijs/README.md` - Archive README

### Modified Files
- `systems/visual_shell/api/__init__.py` - Added factory exports

### Archived Files
- `systems/visual_shell/_archived_pixijs/web/WindowManager.js`
- `systems/visual_shell/_archived_pixijs/web/DesktopWindow.js`
- `systems/visual_shell/_archived_pixijs/web/pixi_adapter.js`
