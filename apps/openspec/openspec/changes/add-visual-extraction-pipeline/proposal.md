# Visual Extraction Pipeline

## Why

Geometry OS needs the ability to "read" any GUI application and reconstruct its structure as an ASCII Scene Graph. This closes the Ouroboros loop, making the "Screen is the Hard Drive" thesis bidirectional:

- **Write**: Visual Bridge injects input into VMs (Stage 3 ✅)
- **Read**: Visual Extraction reads structure from screenshots (Stage 4 ✅ baseline)

Now we need to enhance the extraction pipeline with semantic understanding.

## What Changes

- **ADDED** Semantic clustering to group raw OCR elements into logical UI components
- **ADDED** Widget recognition to detect buttons, inputs, menus by visual patterns
- **ADDED** Bidirectional sync to keep ASCII scene graph synchronized with VM state
- **ADDED** Unified extraction pipeline combining all components

### Components

| Component | Purpose | File |
|-----------|---------|------|
| SemanticClusterer | Group OCR elements by proximity | `semantic_clusterer.py` |
| WidgetDetector | Classify UI widgets | `widget_detector.py` |
| SceneSyncService | WebSocket-based state sync | `scene_sync.py` |
| ExtractionPipeline | Unified API | `extraction_pipeline.py` |

## Impact

- Affected specs: `shotcut-on-the-map`, `ascii-scene-graph`
- Affected code:
  - `conductor/tracks/shotcut-on-the-map/gui_structure_analyzer.py` (extend)
  - `conductor/tracks/shotcut-on-the-map/semantic_clusterer.py` (new)
  - `conductor/tracks/shotcut-on-the-map/widget_detector.py` (new)
  - `conductor/tracks/shotcut-on-the-map/scene_sync.py` (new)
  - `conductor/tracks/shotcut-on-the-map/extraction_pipeline.py` (new)

## Success Criteria

| Criterion | Metric | Target |
|-----------|--------|--------|
| Semantic Clustering | Elements grouped correctly | >90% |
| Widget Detection | Buttons/inputs identified | >85% |
| Sync Latency | State update time | <100ms |
| Full Pipeline | End-to-end extraction | <2s |

## References

- Design Document: `docs/plans/2026-02-19-visual-extraction-pipeline-design.md`
- Implementation Plan: `docs/plans/2026-02-19-visual-extraction-enhancements.md`
- Baseline: `conductor/tracks/shotcut-on-the-map/gui_structure_analyzer.py`
