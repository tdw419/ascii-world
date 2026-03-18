# Q4 Quantization Specification

## Overview

Implement GGUF-style Q4_0 quantization for compressing LLM weights by 8x while maintaining inference quality.

## Interface

### Python API

```python
# systems/visual_shell/wgsl/quantization/q4_utils.py

def dequantize_q4_block(scale_bytes: np.ndarray, packed_weights: np.ndarray) -> np.ndarray:
    """
    Dequantize Q4_0 block to float32.

    Args:
        scale_bytes: 2 bytes representing float16 scale
        packed_weights: 16 bytes representing 32 x 4-bit weights

    Returns:
        32 float32 values
    """
    pass

def quantize_q4(weights: np.ndarray) -> bytes:
    """
    Quantize 32 FP32 weights to Q4_0 format.

    Args:
        weights: Array of 32 float32 values

    Returns:
        18 bytes: 2 byte fp16 scale + 16 bytes packed 4-bit weights
    """
    pass

def quantize_model_q4(weights: np.ndarray) -> Tuple[bytes, dict]:
    """
    Quantize full model weights to Q4_0.

    Args:
        weights: Full flattened weight array

    Returns:
        (quantized_bytes, metadata_dict)
    """
    pass
```

### WGSL Shader

```wgsl
// systems/visual_shell/wgsl/quantization/q4_dequant.wgsl

const Q4_BLOCK_SIZE: u32 = 32u;
const Q4_BYTES_PER_BLOCK: u32 = 18u;

fn unpack_nibble(data: array<u32>, byte_idx: u32, is_high: bool) -> u32;
fn dequantize_q4_block(quant_data: array<u32>, block_start: u32, output: ptr<function, array<f32, 32>>);
fn unpackFloat16(bits: u32) -> f32;
```

## Behavior

### Q4_0 Format

- Block size: 32 weights
- Storage per block: 18 bytes (2 for scale + 16 for weights)
- Compression ratio: 32 × 4 bytes → 18 bytes = 7.1x

### Dequantization Formula

```
value = scale × (weight_4bit - 8)
```

Where:
- `scale` is a float16 value
- `weight_4bit` is a 4-bit integer (0-15)
- The range becomes [-8×scale, 7×scale]

## Tests

```python
def test_q4_dequantize_single_block():
    """Test dequantization of a single Q4_0 block."""
    # Scale = 2.0 (fp16: 0x4000)
    # Weights: [8, 9, 10, 11] packed as 0x89, 0xAB
    # Expected: [0.0, 2.0, 4.0, 6.0]
    pass

def test_quantize_weights_q4():
    """Test FP32 to Q4_0 quantization."""
    # Random 32 weights
    # Verify: quantized size = 18 bytes
    # Verify: dequant error < 0.5
    pass

def test_q4_dequant_shader_compiles():
    """Verify Q4 dequant shader is valid WGSL."""
    pass
```

## Dependencies

- NumPy for array operations
- wgpu-py for WGSL execution

## Status

- [ ] Specification reviewed
- [ ] Python implementation complete
- [ ] WGSL implementation complete
- [ ] Tests passing
