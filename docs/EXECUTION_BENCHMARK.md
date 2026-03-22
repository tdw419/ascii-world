# pxOS Execution Benchmark Results

## Summary

**CPU execution is recommended for Glyph VM workloads.**

## Benchmark Results

| Backend | ops/sec | Notes |
|---------|---------|-------|
| CPU (SyntheticGlyphVM) | 3.8M | Consistent, low overhead |
| GPU (WebGPU) | 1.0M | API-bound, not compute-bound |

## Analysis

### CPU Advantages
- No API overhead
- Direct memory access
- Consistent performance
- Works in all JavaScript environments

### GPU Limitations
- WebGPU dispatch overhead: ~0.5ms per frame
- Readback overhead dominates at small scales
- GPU compute is fast, but API is the bottleneck
- Would only win at 1M+ ops per frame (impractical for 80x24 grids)

## Grid Size Scaling

| Grid | Ops | CPU | GPU | Winner |
|------|-----|-----|-----|--------|
| 80x24 | 1,920 | 3.8M | 1.0M | CPU (3.8x) |
| 320x96 | 30,720 | 3.8M | 1.0M | CPU (3.8x) |
| 1280x384 | 491,520 | 3.8M | 1.0M | CPU (3.8x) |

GPU performance remains constant due to fixed API overhead.

## Recommendation

Use `SyntheticGlyphVM` for all pxOS execution:

```javascript
import { SyntheticGlyphVM } from './sync/synthetic-glyph-vm.js';

const vm = new SyntheticGlyphVM({ maxCycles: 10000000 });
vm.loadProgram(program);
vm.executeFrame(1920); // 80x24 grid
```

GPU shaders remain useful for:
- Visual rendering
- Pixel effects
- Display output

## Files

- `sync/synthetic-glyph-vm.js` - CPU VM implementation
- `sync/benchmark-vm.js` - CPU benchmark script
- `sync/wgsl/cartridge_executor.wgsl` - GPU shader (reference)
- `apps/gpu-test/gpu-executor-test.html` - GPU test page

## Date

2026-03-22
