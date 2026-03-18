# Visual Extraction Pipeline - Tasks

## Phase 1: Semantic Clustering

### Task 1.1: Create SemanticClusterer Module

**Assignee**: semantic-engineer
**Dependencies**: None
**Files**:
- Create: `conductor/tracks/shotcut-on-the-map/semantic_clusterer.py`
- Create: `conductor/tracks/shotcut-on-the-map/tests/test_semantic_clusterer.py`

**Acceptance Criteria**:
- [ ] `OCRElement` dataclass with position/dimensions
- [ ] `UICluster` dataclass with label and elements
- [ ] `SemanticClusterer.cluster()` groups adjacent elements
- [ ] Tests pass: `pytest tests/test_semantic_clusterer.py -v`

**TDD Steps**:
1. Write test for `cluster_adjacent_elements()`
2. Write test for `cluster_separate_regions()`
3. Implement `SemanticClusterer`
4. Verify all tests pass

---

### Task 1.2: Integrate Clustering with Analyzer

**Assignee**: semantic-engineer
**Dependencies**: Task 1.1
**Files**:
- Modify: `conductor/tracks/shotcut-on-the-map/gui_structure_analyzer.py`
- Create: `conductor/tracks/shotcut-on-the-map/tests/test_gui_structure_analyzer.py`

**Acceptance Criteria**:
- [ ] `AnalysisResult` includes `clusters` field
- [ ] `analyze_screenshot()` populates clusters
- [ ] Tests pass: `pytest tests/test_gui_structure_analyzer.py -v`

---

## Phase 2: Widget Recognition

### Task 2.1: Create WidgetDetector Module

**Assignee**: widget-engineer
**Dependencies**: None
**Files**:
- Create: `conductor/tracks/shotcut-on-the-map/widget_detector.py`
- Create: `conductor/tracks/shotcut-on-the-map/tests/test_widget_detector.py`

**Acceptance Criteria**:
- [ ] `Widget` dataclass with type, text, bounds, action
- [ ] `WidgetType` enum: BUTTON, INPUT, MENU, LABEL, CHECKBOX, UNKNOWN
- [ ] `WidgetDetector.detect()` classifies elements
- [ ] Tests pass: `pytest tests/test_widget_detector.py -v`

**TDD Steps**:
1. Write test for `detect_button_from_border()`
2. Write test for `detect_input_from_label()`
3. Implement `WidgetDetector`
4. Verify all tests pass

---

## Phase 3: Bidirectional Sync

### Task 3.1: Create SceneSyncService

**Assignee**: sync-engineer
**Dependencies**: Task 1.2
**Files**:
- Create: `conductor/tracks/shotcut-on-the-map/scene_sync.py`
- Create: `conductor/tracks/shotcut-on-the-map/tests/test_scene_sync.py`

**Acceptance Criteria**:
- [ ] `SyncState` dataclass with current_view, hash, changes
- [ ] `SceneSyncService.start()` begins polling loop
- [ ] `SceneSyncService.force_sync()` triggers immediate sync
- [ ] Tests pass: `pytest tests/test_scene_sync.py -v`

**TDD Steps**:
1. Write test for `sync_detects_view_change()`
2. Write test for `sync_updates_scene_graph()`
3. Implement `SceneSyncService`
4. Verify all tests pass

---

## Phase 4: Integration

### Task 4.1: Create Unified ExtractionPipeline

**Assignee**: integration-engineer
**Dependencies**: Task 1.2, Task 2.1, Task 3.1
**Files**:
- Create: `conductor/tracks/shotcut-on-the-map/extraction_pipeline.py`
- Create: `conductor/tracks/shotcut-on-the-map/tests/test_extraction_pipeline.py`

**Acceptance Criteria**:
- [ ] `ExtractionResult` dataclass with all outputs
- [ ] `ExtractionPipeline.extract()` runs full pipeline
- [ ] ASCII view includes `[CLICKABLE]` metadata
- [ ] Tests pass: `pytest tests/test_extraction_pipeline.py -v`

**TDD Steps**:
1. Write test for `full_extraction_pipeline()`
2. Write test for `pipeline_produces_ascii_view()`
3. Implement `ExtractionPipeline`
4. Verify all tests pass

---

### Task 4.2: Integration Testing

**Assignee**: integration-engineer
**Dependencies**: Task 4.1
**Files**:
- Test with: `conductor/tracks/shotcut-on-the-map/screenshots/`

**Acceptance Criteria**:
- [ ] Full pipeline works with real screenshots
- [ ] Scene graph loads in `AsciiSceneGraph.load()`
- [ ] AI context generation works: `graph.get_ai_context()`
- [ ] All tests pass: `pytest conductor/tracks/shotcut-on-the-map/tests/ -v`

---

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| 1. Semantic Clustering | 2 | None |
| 2. Widget Recognition | 1 | None |
| 3. Bidirectional Sync | 1 | Phase 1 |
| 4. Integration | 2 | All phases |

**Total**: 6 tasks, 4 new modules, 4 test files
