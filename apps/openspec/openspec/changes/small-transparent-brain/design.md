# Small Transparent Brain - Technical Design

## 1. Q4_0 Quantization Format

GGUF Q4_0 format provides 8x compression with acceptable quality loss:

```
Block Structure (32 weights → 18 bytes):
┌────────────┬──────────────────────────────┐
│ Scale (f16)│ 32 x 4-bit weights (16 bytes)│
│  2 bytes   │         16 bytes             │
└────────────┴──────────────────────────────┘

Dequantization: value = scale × (weight - 8)
```

### Storage in Atlas

For a 125M parameter model:
- Raw FP16: 250MB
- Q4_0: ~62.5MB (125M × 0.5 bytes)
- Atlas (4096×4096 RGBA8): 64MB ✓

Packing strategy:
- Each RGBA8 pixel = 8 weights (2 nibbles per channel × 4 channels)
- Block scales stored in separate "scale texture" or packed at block boundaries

## 2. Dual-Format Substrate

### Weight Atlas (Hilbert-Mapped)

```
Purpose: Static model weights (DNA)
Format: Hilbert curve mapping
Rationale: Spatial locality for:
  - Evolution mutations (sector = related weights)
  - Visual inspection (nearby pixels = related weights)
  - Cache-friendly attention patterns
```

### KV-Cache (Linear-Mapped)

```
Purpose: Working memory (sequence state)
Format: Linear 2D (X=position, Y=layer/dim)
Rationale: Sequential access pattern:
  - Token generation appends at X=seq_len
  - Attention scans X=0 to X=seq_len-1
  - Single linear memory sweep = cache-friendly
```

## 3. WGSL Shader Pipeline

### Embed Shader (0xD0)

```wgsl
// Input: token_id
// Output: hidden_state[64]

fn embed_token(token_id: u32) -> array<f32, 64> {
    // 1. Calculate Hilbert pixel coordinates for this token
    let pixel_start = token_id * PIXELS_PER_TOKEN;

    // 2. Load 16 pixels (64 floats)
    for (var i = 0u; i < 16u; i++) {
        let coord = hilbert_d2xy(pixel_start + i);
        let pixel = textureLoad(brain_atlas, coord, 0);

        // 3. Dequantize if using Q4 format
        output[i*4 + 0] = dequant_q4(pixel.r);
        output[i*4 + 1] = dequant_q4(pixel.g);
        output[i*4 + 2] = dequant_q4(pixel.b);
        output[i*4 + 3] = dequant_q4(pixel.a);
    }
}
```

### Attention Shader (0xD1) - Glass Box

```wgsl
// Input: hidden_state, position
// Output: attended_hidden, attention_weights (for visualization)

fn compute_attention(hidden: array<f32, 64>, pos: u32) -> AttentionResult {
    // ... attention computation ...

    // GLASS BOX: Store weights for visualization
    for (var head = 0u; head < NUM_HEADS; head++) {
        let weight = compute_attention_score(head, pos);
        attention_out.weights[head * MAX_SEQ_LEN + pos] = weight;
    }

    return result;
}
```

## 4. Weight Mutation API

The Evolution Daemon can physically alter model weights:

```python
class WeightMutator:
    def mutate_sector(self, config: dict) -> MutationRecord:
        """
        Mutate a sector of weights in the Hilbert atlas.

        config:
            - hilbert_start: Starting index
            - hilbert_end: Ending index
            - mutation_type: "radiation" | "crossover" | "noise"
            - intensity: 0.0 - 1.0

        Returns: MutationRecord with checksums for verification
        """
```

### Mutation Types

| Type | Effect | Use Case |
|------|--------|----------|
| `radiation` | Random perturbation | Exploration |
| `crossover` | Copy from another sector | Combining capabilities |
| `noise` | Small Gaussian noise | Fine-tuning |

## 5. Visual Bridge Integration

Attention weights stream to frontend via ATTENTION_UPDATE messages:

```json
{
  "type": "ATTENTION_UPDATE",
  "layer": 0,
  "head": 3,
  "weights": [0.1, 0.05, 0.8, ...],
  "entropy": 2.4,
  "max_weight": 0.8
}
```

Frontend renders as heatmap overlay on the Infinite Map.

## 6. File Structure

```
systems/visual_shell/wgsl/
├── pixel_brain_embed.wgsl      # Token → Hidden (existing)
├── pixel_brain_attention.wgsl  # Self-attention (existing, modified)
├── pixel_brain_project.wgsl    # FFN (existing)
├── pixel_brain_sample.wgsl     # Logits → Token (existing)
├── quantization/
│   ├── q4_dequant.wgsl         # NEW: Q4 dequantization
│   ├── q4_utils.py             # NEW: Python Q4 utilities
│   └── quant_converter.py      # NEW: FP32 → Q4 conversion
├── model_extractor.py          # NEW: Weight extraction
└── atlas_calculator.py         # NEW: Atlas sizing

systems/evolution_daemon/
└── weight_mutator.py           # NEW: Weight mutation API

systems/visual_shell/web/
├── attention_visualizer.js     # NEW: Frontend renderer
└── shaders/
    └── attention_heatmap.wgsl  # NEW: Heatmap shader
```

## 7. Testing Strategy

1. **Unit Tests**: Each component in isolation
2. **Integration Tests**: Pipeline stages together
3. **E2E Tests**: Full inference with visualization
4. **Mutation Tests**: Verify weight changes affect output

## 8. Performance Targets

| Metric | Target |
|--------|--------|
| Inference latency (single token) | < 50ms |
| Attention weight streaming | 60fps |
| Weight mutation | < 10ms per sector |
| Atlas load time | < 2s |
