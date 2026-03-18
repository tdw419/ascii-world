# Specification: Visual Perception Service

## 1. Requirement: A2A Visual Perception (VP-001)
The swarm SHALL provide a `VisualPerceptionAgent` capable of processing visual regions of the infinite map and returning semantic JSON structure.

## 2. Requirement: Change-Aware Broadcasting (VP-002)
The agent SHALL only broadcast `VISUAL_STATE_UPDATE` messages when the extracted semantic structure (widget types, text, and logical positions) changes significantly from the previous state.

## 3. Requirement: Semantic Mapping (VP-003)
Perception results MUST include:
- `text`: Extracted label or content.
- `type`: Classified widget type (BUTTON, MENU, TEXT_FIELD, etc).
- `bbox`: Normalized coordinates within the observed region.
- `confidence`: OCR/Detection confidence score (0.0 - 1.0).

## 4. Scenario: Request Perception
- **WHEN** an agent sends a `PERCEIVE_REGION` request with tile coordinates `(x, y, w, h)`.
- **THEN** the Perception Agent returns a `PERCEPTION_RESULT` containing the JSON Scene Graph of that region.

## 5. Performance Target
- **Latency**: Semantic extraction of a 512x512 region SHOULD complete in < 1.0 seconds.
- **Accuracy**: Text extraction SHOULD have > 90% accuracy for standard UI fonts.
