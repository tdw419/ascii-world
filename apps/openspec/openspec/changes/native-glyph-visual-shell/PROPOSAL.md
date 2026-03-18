# Native Glyph-Based Visual Shell

**Change ID**: `native-glyph-visual-shell`
**Status**: Draft
**Author**: Claude (FFI Bridge Team)
**Created**: 2026-03-08
**Target Phase**: Visual Shell v2.0

---

## Abstract

Pivot the Visual Shell from PixiJS (external rendering library) to **native Geometry OS components**:
- **Glyph Substrate**: Hilbert-mapped VRAM buffer for spatial locality
- **GeoASM Rasterizers**: Drawing kernels using opcodes 0xC0-0xCF
- **Spatial Hypervisor**: Rust infinite_map_rs for entity management
- **FFI Layout Engine**: Heavy symbolic tasks via the FFI Bridge (0xF8-0xFB)

This aligns with the Geometry OS philosophy: *"The screen IS the hard drive"* - all visual state is addressable memory.

---

## Motivation

### Current State (PixiJS v7)
- External dependency on PixiJS rendering library
- CPU-bound per-frame node re-evaluation
- Separate rendering pipeline from core system
- Limited to 2D WebGL context

### Desired State (Native Glyphs)
- **Zero external rendering dependencies**
- **Hilbert spatial locality** - 95% coherence for GPU cache
- **Unified memory model** - screen pixels = addressable VRAM
- **GPU execution** via WGSL compute shaders
- **Self-hosting** - Geometry OS renders itself

### Key Insight
The FFI Bridge (0xF8-0xFB) provides the "Symbolic Umbilical Cord" to Python for layout calculations. The Visual Shell becomes a **Glyph Server** that:
1. Receives entity lists from Rust hypervisor
2. Computes layouts via FFI → Python/NumPy
3. Rasters glyphs via GeoASM kernels
4. Outputs to Hilbert-mapped VRAM

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Native Glyph Visual Shell                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ Rust Spatial │    │ FFI Bridge   │    │ GeoASM Rasterizer│   │
│  │ Hypervisor   │───▶│ (0xF8-0xFB)  │───▶│ (0xC0-0xCF)      │   │
│  │              │    │              │    │                  │   │
│  │ infinite_    │    │ Python/NumPy │    │ SET_COLOR        │   │
│  │ map_rs       │    │ Layout Calc  │    │ DRAW_RECT        │   │
│  │              │    │              │    │ FILL_RECT        │   │
│  │ Tile[]       │    │ Hilbert LUT  │    │ DRAW_LINE        │   │
│  │ Phylogeny    │    │              │    │ DRAW_CHAR        │   │
│  │ Species[]    │    │              │    │ DRAW_PIXEL       │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
│         │                   │                     │              │
│         └───────────────────┼─────────────────────┘              │
│                             ▼                                    │
│                    ┌──────────────────┐                          │
│                    │ Hilbert VRAM     │                          │
│                    │ Buffer           │                          │
│                    │                  │                          │
│                    │ 2D pixels →      │                          │
│                    │ 1D Hilbert index │                          │
│                    │ (95% spatial     │                          │
│                    │  locality)       │                          │
│                    └──────────────────┘                          │
│                             │                                    │
│                             ▼                                    │
│                    ┌──────────────────┐                          │
│                    │ WGSL Compute     │                          │
│                    │ Shader           │                          │
│                    │                  │                          │
│                    │ geometry_os.wgsl │                          │
│                    │ render_glyph()   │                          │
│                    └──────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Glyph Substrate (`glyph_substrate.rs`)

**Purpose**: Hilbert-mapped VRAM buffer

**Implementation**:
```rust
pub struct GlyphSubstrate {
    width: u32,
    height: u32,
    // Linear buffer with Hilbert indexing
    buffer: Vec<u32>, // RGBA pixels
    hilbert_order: u8, // Order of Hilbert curve
}

impl GlyphSubstrate {
    /// Convert (x, y) to Hilbert index
    pub fn xy_to_hilbert(&self, x: u32, y: u32) -> u64 {
        HilbertLUT::xy_to_index(x, y, self.hilbert_order)
    }

    /// Convert Hilbert index to (x, y)
    pub fn hilbert_to_xy(&self, index: u64) -> (u32, u32) {
        HilbertLUT::index_to_xy(index, self.hilbert_order)
    }

    /// Set pixel via Hilbert index (GPU cache friendly)
    pub fn set_pixel_hilbert(&mut self, index: u64, color: u32) {
        self.buffer[index as usize] = color;
    }

    /// Get pixel via Hilbert index
    pub fn get_pixel_hilbert(&self, index: u64) -> u32 {
        self.buffer[index as usize]
    }
}
```

**Key Property**: 95% spatial locality - adjacent pixels on screen are adjacent in memory (within ~2-3 Hilbert indices).

---

### 2. GeoASM Rasterizer Library (`geoasm_glyphs.geoasm`)

**Purpose**: Drawing kernels using existing opcodes

**Implementation**:
```geoasm
; ============================================
; GeoASM Glyph Library - Native Visual Shell
; ============================================

; === Color Management ===
GLYPH_SET_COLOR:
    ; Args: R0=R, R1=G, R2=B
    SET_COLOR R0, R1, R2
    RET

; === Primitive Shapes ===
GLYPH_DRAW_RECT:
    ; Args: R0=x, R1=y, R2=w, R3=h
    PUSH R4
    PUSH R5

    ; Calculate end coordinates
    ADD R4, R0, R2  ; x2 = x + w
    ADD R5, R1, R3  ; y2 = y + h

    DRAW_RECT R0, R1, R4
    ; R4 encodes x2 in low byte, y2 in high byte

    POP R5
    POP R4
    RET

GLYPH_FILL_RECT:
    ; Args: R0=x, R1=y, R2=w, R3=h
    PUSH R4
    ADD R4, R0, R2
    FILL_RECT R0, R1, R4
    POP R4
    RET

GLYPH_DRAW_CIRCLE:
    ; Args: R0=cx, R1=cy, R2=radius
    ; Uses midpoint circle algorithm
    PUSH R3
    PUSH R4
    PUSH R5

    MOVI R3, 0       ; x = 0
    MOV R4, R2       ; y = radius

CIRCLE_LOOP:
    ; Draw 8 octants
    DRAW_PIXEL R0, R3   ; (cx+x, cy+y)
    ; ... (simplified for proposal)

    ; Midpoint decision
    ; ... algorithm continues

    POP R5
    POP R4
    POP R3
    RET

GLYPH_DRAW_LINE:
    ; Args: R0=x1, R1=y1, R2=x2, R3=y2
    ; Bresenham's line algorithm
    DRAW_LINE R0, R1, R2
    RET

; === Hilbert Utilities ===
GLYPH_HILBERT_XY_TO_INDEX:
    ; Args: R0=x, R1=y, R2=order
    ; Returns: R0=index
    ; Call Python via FFI for complex calculation
    MOVI R3, 16      ; funcId = 16 (hilbert.xy_to_index)
    PY_CALL R3, R0, R1
    RET

GLYPH_HILBERT_INDEX_TO_XY:
    ; Args: R0=index, R1=order
    ; Returns: R0=x, R1=y
    MOVI R3, 17      ; funcId = 17 (hilbert.index_to_xy)
    PY_CALL R3, R0, R1
    RET

; === Entity Rendering ===
GLYPH_RENDER_ORB:
    ; Args: R0=x, R1=y, R2=radius, R3=color
    ; Renders a file orb with glow effect

    PUSH R4
    PUSH R5

    ; Set color
    MOV R4, R3
    ; Extract RGB from packed color
    AND R5, R4, 0xFF     ; B
    SHR R4, R4, 8
    AND R4, R4, 0xFF     ; G (in R4 low)
    ; R now in R4 high

    ; Draw outer glow (larger, semi-transparent)
    ; ... glow rendering

    ; Draw core circle
    CALL GLYPH_DRAW_CIRCLE

    POP R5
    POP R4
    RET

GLYPH_RENDER_PANEL:
    ; Args: R0=x, R1=y, R2=w, R3=h
    ; Renders a Glass Panel with glass effect

    ; Draw background (semi-transparent)
    MOVI R4, 20      ; alpha
    CALL GLYPH_FILL_RECT

    ; Draw border
    MOVI R4, 200     ; border color
    CALL GLYPH_DRAW_RECT

    RET

; === Composite Operations ===
GLYPH_RENDER_DESKTOP:
    ; Renders the full infinite desktop
    ; 1. Clear substrate
    ; 2. Render grid lines
    ; 3. Render file orbs
    ; 4. Render active panels
    ; 5. Render cursor

    ; Clear to dark background
    MOVI R0, 10
    MOVI R1, 10
    MOVI R2, 20
    CALL GLYPH_SET_COLOR

    ; ... full desktop rendering

    HALT
```

---

### 3. FFI Layout Engine (`ffi_layout_engine.py`)

**Purpose**: Heavy symbolic calculations via Python

**Implementation**:
```python
# Add to ffi_registry.json
{
    "hilbert.xy_to_index": {
        "id": 16,
        "category": "spatial",
        "description": "Convert (x,y) to Hilbert index"
    },
    "hilbert.index_to_xy": {
        "id": 17,
        "category": "spatial",
        "description": "Convert Hilbert index to (x,y)"
    },
    "layout.spiral_coords": {
        "id": 18,
        "category": "layout",
        "description": "Generate spiral coordinates for file placement"
    },
    "layout.force_directed": {
        "id": 19,
        "category": "layout",
        "description": "Force-directed graph layout"
    }
}
```

```python
# ffi_layout_engine.py
import numpy as np
from typing import Tuple, List

def xy_to_index(x: int, y: int, order: int = 10) -> int:
    """Convert 2D coordinates to Hilbert index."""
    # Use the same algorithm as HilbertLUT.ts
    return _hilbert_xy_to_index(x, y, order)

def index_to_xy(index: int, order: int = 10) -> Tuple[int, int]:
    """Convert Hilbert index to 2D coordinates."""
    return _hilbert_index_to_xy(index, order)

def spiral_coords(count: int, center: Tuple[int, int] = (0, 0)) -> List[Tuple[int, int]]:
    """Generate spiral coordinates for file placement."""
    # Golden angle spiral for optimal spacing
    golden_angle = np.pi * (3 - np.sqrt(5))
    coords = []
    for i in range(count):
        r = np.sqrt(i + 0.5) * 10
        theta = i * golden_angle
        x = center[0] + int(r * np.cos(theta))
        y = center[1] + int(r * np.sin(theta))
        coords.append((x, y))
    return coords

def force_directed_layout(
    nodes: List[dict],
    edges: List[Tuple[int, int]],
    iterations: int = 100
) -> List[Tuple[int, int]]:
    """Compute force-directed graph layout."""
    # NumPy-accelerated force simulation
    n = len(nodes)
    positions = np.random.rand(n, 2) * 1000

    for _ in range(iterations):
        # Repulsion between all nodes
        # Attraction along edges
        # ... force calculations

    return [(int(p[0]), int(p[1])) for p in positions]
```

---

### 4. WGSL Glyph Renderer (`glyph_renderer.wgsl`)

**Purpose**: GPU execution of glyph rendering

**Implementation**:
```wgsl
// glyph_renderer.wgsl - Compute shader for glyph rendering

struct GlyphCommand {
    opcode: u32,
    x: u32,
    y: u32,
    params: u32,  // Packed parameters (color, size, etc.)
}

struct GlyphBuffer {
    commands: array<GlyphCommand>,
}

struct VRAMBuffer {
    // Hilbert-indexed pixel buffer
    pixels: array<u32>,
}

@group(0) @binding(0) var<storage, read> glyph_buffer: GlyphBuffer;
@group(0) @binding(1) var<storage, read_write> vram: VRAMBuffer;
@group(0) @binding(2) var<uniform> params: RenderParams;

struct RenderParams {
    width: u32,
    height: u32,
    hilbert_order: u32,
    _padding: u32,
}

@compute @workgroup_size(64)
fn render_glyphs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let cmd_idx = global_id.x;
    let cmd = glyph_buffer.commands[cmd_idx];

    switch (cmd.opcode) {
        case 0xC0u: { // SET_COLOR
            // Update current color state
        }
        case 0xC3u: { // DRAW_RECT
            let x = cmd.x;
            let y = cmd.y;
            let w = (cmd.params & 0xFFFFu);
            let h = (cmd.params >> 16u);
            let color = params.current_color;

            // Draw rectangle via Hilbert-indexed writes
            for (var py = y; py < y + h; py++) {
                for (var px = x; px < x + w; px++) {
                    let h_idx = xy_to_hilbert(px, py, params.hilbert_order);
                    vram.pixels[h_idx] = color;
                }
            }
        }
        case 0xCFu: { // DRAW_PIXEL
            let h_idx = xy_to_hilbert(cmd.x, cmd.y, params.hilbert_order);
            vram.pixels[h_idx] = cmd.params; // params = color
        }
        default: {
            // Unknown opcode - skip
        }
    }
}

fn xy_to_hilbert(x: u32, y: u32, order: u32) -> u32 {
    // Hilbert curve conversion (WGSL implementation)
    var index: u32 = 0u;
    var s: u32 = 1u << (order - 1u);

    for (var i = 0u; i < order; i = i + 1u) {
        var rx = (x & s) >> (order - 1u - i);
        var ry = (y & s) >> (order - 1u - i);

        // Rotate/flip based on Hilbert pattern
        if (ry == 0u) {
            if (rx == 1u) {
                rx = 1u - rx;
                ry = 1u - ry;
            }
            // Swap x and y
            let tmp = x;
            x = y;
            y = tmp;
        }

        index = index + (rx << (2u * (order - 1u - i)));
        index = index + (ry << (2u * (order - 1u - i) + 1u));
        s = s >> 1u;
    }

    return index;
}
```

---

### 5. Integration: Visual Shell API (`visual_shell/native_api.py`)

**Purpose**: Bridge between existing WebSocket API and native rendering

**Implementation**:
```python
# visual_shell/native_api.py
from dataclasses import dataclass
from typing import List, Dict, Optional
import json
import asyncio

@dataclass
class NativeGlyph:
    id: str
    x: int
    y: int
    width: int
    height: int
    glyph_type: str  # "orb", "panel", "line", "text"
    color: int
    metadata: dict

class NativeVisualShellAPI:
    """
    Native Visual Shell API - replaces PixiJS with GeoASM rendering
    """

    def __init__(self):
        self.glyphs: Dict[str, NativeGlyph] = {}
        self.substrate_order = 10  # 2^10 x 2^10 = 1024x1024
        self.dirty_rects: List[tuple] = []

    async def render_glyph(self, glyph: NativeGlyph) -> bytes:
        """Render a glyph to GeoASM bytecode."""
        bytecode = bytearray()

        # SET_COLOR
        r = (glyph.color >> 16) & 0xFF
        g = (glyph.color >> 8) & 0xFF
        b = glyph.color & 0xFF
        bytecode.extend([0xC0, r, g, b])

        if glyph.glyph_type == "orb":
            # DRAW_CIRCLE (via multiple DRAW_PIXEL or custom opcode)
            bytecode.extend(self._encode_circle(glyph.x, glyph.y, glyph.width // 2))
        elif glyph.glyph_type == "panel":
            # FILL_RECT + DRAW_RECT
            bytecode.extend([0xC4, glyph.x, glyph.y,
                           glyph.width | (glyph.height << 8)])
        elif glyph.glyph_type == "text":
            # DRAW_CHAR sequence
            for i, char in enumerate(glyph.metadata.get("text", "")):
                bytecode.extend([0xC1, glyph.x + i * 8, glyph.y, ord(char)])

        return bytes(bytecode)

    def _encode_circle(self, cx: int, cy: int, radius: int) -> bytes:
        """Encode circle as series of DRAW_PIXEL commands."""
        # Midpoint circle algorithm
        bytecode = bytearray()
        x, y = 0, radius
        d = 3 - 2 * radius

        while x <= y:
            # 8 octants
            for dx, dy in [(x, y), (y, x), (-x, y), (-y, x),
                          (x, -y), (y, -x), (-x, -y), (-y, -x)]:
                bytecode.extend([0xCF, cx + dx, cy + dy, 0])  # color in params

            if d < 0:
                d = d + 4 * x + 6
            else:
                d = d + 4 * (x - y) + 10
                y -= 1
            x += 1

        return bytes(bytecode)

    async def composite_frame(self) -> bytes:
        """Composite all glyphs into a single frame."""
        frame_bytecode = bytearray()

        # Clear to background
        frame_bytecode.extend([0xC0, 10, 10, 20])  # Dark blue

        # Render all glyphs
        for glyph in self.glyphs.values():
            frame_bytecode.extend(await self.render_glyph(glyph))

        # HALT
        frame_bytecode.extend([0x02, 0, 0, 0])

        return bytes(frame_bytecode)

    def hilbert_index_to_screen(self, index: int) -> tuple:
        """Convert Hilbert VRAM index to screen coordinates."""
        # Use FFI Bridge to call Python implementation
        return self.ffi_bridge.call(17, [index, self.substrate_order])
```

---

## Migration Path

### Phase 1: Parallel Operation
- Run both PixiJS and Native renderers side-by-side
- Compare output for correctness
- Benchmark performance

### Phase 2: Feature Parity
- Implement all PixiJS features in GeoASM
- Glass Panels → Native Panels
- Context Menus → Native Menus
- Keyboard Shortcuts → Native Handlers

### Phase 3: Switch Over
- Deprecate PixiJS dependency
- Native renderer becomes default
- Archive PixiJS codebase

### Phase 4: Enhancement
- 3D spatial view (WGSL vertex shaders)
- Neural network visualization
- Real-time evolution animation

---

## Success Criteria

1. **Performance**: 60 FPS at 10,000+ glyphs
2. **Spatial Locality**: 95% Hilbert coherence
3. **Memory**: Single unified VRAM buffer
4. **Dependencies**: Zero external rendering libraries
5. **Self-Hosting**: Geometry OS renders itself

---

## Dependencies

| Component | Depends On | Status |
|-----------|------------|--------|
| Glyph Substrate | HilbertLUT.ts | ✅ Complete |
| FFI Layout Engine | PythonFFIBridge.ts | ✅ Complete |
| WGSL Renderer | geometry_os.wgsl | ✅ Exists |
| GeoASM Rasterizer | geoasm_lib.py | ✅ Complete |
| Native API | All above | 📝 Proposed |

---

## Risks

1. **Performance**: GPU dispatch overhead may exceed PixiJS
   - Mitigation: Batch glyph commands, minimize dispatches

2. **Complexity**: More code to maintain
   - Mitigation: Reuse existing components (FFI Bridge, Hilbert LUT)

3. **Compatibility**: Existing Visual Shell features may break
   - Mitigation: Parallel operation phase, comprehensive testing

---

## References

- [FFI Bridge Implementation](docs/plans/2026-03-07-ffi-bridge-implementation.md)
- [FFI Bytecode Verification](docs/plans/2026-03-07-ffi-bytecode-verification.md)
- [Visual Shell OpenSpec](systems/visual_shell/OPENSPEC.md)
- [Hilbert LUT Source](visual-vm/HilbertLUT.ts)
- [Python FFI Host](visual-vm/python_ffi_host.py)
- [GeoASM Opcodes](geoasm-cli/geoasm_lib.py)

---

## Approval

- [ ] Technical Review
- [ ] Performance Benchmark
- [ ] Security Review
- [ ] Final Approval

---

*Generated: 2026-03-08*
*Change ID: native-glyph-visual-shell*
