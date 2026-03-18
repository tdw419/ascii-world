# Glass Box Attention Specification

## Overview

Implement real-time attention visualization that streams attention weights from the PixelBrain pipeline to the frontend for rendering as a heatmap overlay.

## Interface

### VisualBridge API

```python
# systems/visual_shell/api/visual_bridge.py

def emit_attention_update(self, layer: int, head: int, weights: list):
    """
    Emit attention weights for visualization.

    Args:
        layer: Transformer layer index (0-7)
        head: Attention head index (0-7)
        weights: List of attention weights (one per sequence position)

    Broadcasts ATTENTION_UPDATE message to all WebSocket clients.
    """
    pass

def _calculate_attention_entropy(self, weights: list) -> float:
    """
    Calculate entropy of attention distribution.

    Returns:
        Entropy in bits (0 = focused, log2(n) = uniform)
    """
    pass
```

### WebSocket Message Format

```json
{
  "type": "ATTENTION_UPDATE",
  "timestamp": 1709123456.789,
  "layer": 0,
  "head": 3,
  "weights": [0.1, 0.05, 0.8, 0.02, 0.03],
  "max_weight": 0.8,
  "entropy": 1.2
}
```

### Frontend API

```javascript
// systems/visual_shell/web/attention_visualizer.js

class AttentionVisualizer {
    constructor(pixiApp, atlasSprite);

    handleAttentionUpdate(message: object): void;
    renderHeatmap(layer: number, head: number): void;
    plasmaColor(t: number): number;
}
```

## Behavior

### Attention Weight Storage

The PixelBrain attention shader stores softmax-normalized attention weights in a GPU buffer:

```wgsl
// Layout: [head_0_weights, head_1_weights, ..., head_7_weights]
// Each head has MAX_SEQ_LEN weights (one per sequence position)
attention_out.weights[head * MAX_SEQ_LEN + position] = normalized_score;
```

### Streaming Pipeline

1. Attention shader computes weights → GPU buffer
2. Pipeline reads weights via `read_mapped()`
3. VisualBridge emits ATTENTION_UPDATE
4. Frontend receives via WebSocket
5. AttentionVisualizer renders heatmap

### Visualization Modes

| Mode | Description | Color |
|------|-------------|-------|
| Grayscale | Intensity = weight | Gray |
| Plasma | Heatmap colormap | Blue→Purple→Orange→Yellow |
| Attention-Focus | Highlight high attention | Orange glow |

## Tests

```python
def test_attention_weights_emit_to_bridge():
    """Test that attention weights are emitted to VisualBridge."""
    pass
```

## Dependencies

- VisualBridge (existing)
- PixelBrainPipeline (existing, modified)
- PixiJS (existing)

## Status

- [ ] Specification reviewed
- [ ] VisualBridge emit_attention_update implemented
- [ ] WGSL attention output buffer integrated
- [ ] Frontend visualizer implemented
- [ ] Tests passing
