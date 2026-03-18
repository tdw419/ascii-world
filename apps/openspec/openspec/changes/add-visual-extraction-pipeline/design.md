# Visual Extraction Pipeline - Technical Design

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     VISUAL EXTRACTION PIPELINE                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: VISUAL CAPTURE          PHASE 2: STRUCTURE RECOGNITION        │
│  ┌─────────────────────┐          ┌─────────────────────────┐           │
│  │ shotcut_vm_bridge   │          │ gui_structure_analyzer  │           │
│  │ ─────────────────── │          │ ─────────────────────── │           │
│  │ • screenshot()      │─────────▶│ • OCR (tesseract)       │           │
│  │ • click(x,y)        │          │ • Element detection     │           │
│  │ • type(text)        │          │ • Layout inference      │           │
│  └─────────────────────┘          └───────────┬─────────────┘           │
│                                               │                          │
│                                               ▼                          │
│  PHASE 3: SEMANTIC ANALYSIS       ┌─────────────────────────┐           │
│  ┌─────────────────────┐          │ semantic_clusterer      │           │
│  │ widget_detector     │◀────────▶│ ─────────────────────── │           │
│  │ ─────────────────── │          │ • Spatial proximity     │           │
│  │ • Button detection  │          │ • Label inference       │           │
│  │ • Input detection   │          │ • Cluster merging       │           │
│  │ • Menu detection    │          └───────────┬─────────────┘           │
│  └─────────────────────┘                      │                          │
│                                               ▼                          │
│                                   ┌─────────────────────────┐           │
│                                   │ ASCII Scene Graph       │           │
│                                   │ ─────────────────────── │           │
│                                   │ views/*.ascii           │           │
│                                   │ bindings.json           │           │
│                                   │ state.json              │           │
│                                   └───────────┬─────────────┘           │
│                                               │                          │
│  PHASE 4: BIDIRECTIONAL SYNC                  ▼                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐           │
│  │ scene_sync                  │◀─│ extraction_pipeline     │           │
│  │ ─────────────────────────── │  │ ─────────────────────── │           │
│  │ • WebSocket state stream    │  │ • Unified API           │           │
│  │ • Poll-based change detect  │  │ • Error handling        │           │
│  │ • Callback dispatch         │  │ • Result aggregation    │           │
│  └─────────────────────────────┘  └─────────────────────────┘           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. SemanticClusterer

**Purpose**: Group raw OCR elements into logical UI components.

**Input**: `List[OCRElement]` with text, position, dimensions
**Output**: `List[UICluster]` with grouped elements and inferred labels

**Algorithm**:
1. Sort elements by (y, x) for row-major processing
2. For each element, find adjacent elements within threshold
3. Merge adjacent elements into clusters
4. Infer cluster labels from element content (menu_bar, button, content)

**Data Structures**:
```python
@dataclass
class OCRElement:
    text: str
    x: int
    y: int
    width: int
    height: int

@dataclass
class UICluster:
    label: str  # menu_bar, button, content, header, footer
    elements: List[OCRElement]
```

### 2. WidgetDetector

**Purpose**: Classify UI widgets by visual patterns and keywords.

**Input**: `List[Dict]` from OCR output
**Output**: `List[Widget]` with type, text, bounds, action

**Classification Rules**:
| Pattern | Widget Type | Example |
|---------|-------------|---------|
| Keyword in BUTTON_KEYWORDS | BUTTON | "OK", "Cancel", "Save" |
| Keyword in MENU_KEYWORDS | MENU | "File", "Edit", "View" |
| Ends with ":" | LABEL | "Filename:" |
| Empty text + adjacent to label | INPUT | (empty input field) |

### 3. SceneSyncService

**Purpose**: Keep ASCII scene graph synchronized with VM state.

**Mechanism**:
- Polling loop with configurable interval (default: 1s)
- Screenshot hash comparison for change detection
- WebSocket broadcast on state change
- Callback dispatch for subscribers

**State Management**:
```python
@dataclass
class SyncState:
    current_view: str
    last_screenshot_hash: str
    changes_detected: int
```

### 4. ExtractionPipeline

**Purpose**: Unified API for full extraction workflow.

**Flow**:
```
screenshot → OCR → clustering → widget detection → scene graph
```

**Error Handling**:
- Tesseract not installed: Return error with installation instructions
- Invalid image: Return error with format requirements
- Scene graph write failure: Return error with path info

## Testing Strategy

### Unit Tests
- `test_semantic_clusterer.py`: Clustering logic
- `test_widget_detector.py`: Classification rules
- `test_scene_sync.py`: State synchronization
- `test_extraction_pipeline.py`: Integration

### Integration Tests
- Full pipeline with real screenshot
- Scene graph persistence
- WebSocket connectivity

### Test Data
- `screenshots/final_proof.png`: Boot console
- `screenshots/shotcut_gui.png`: Shotcut main window
