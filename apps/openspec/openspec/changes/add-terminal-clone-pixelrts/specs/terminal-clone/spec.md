# Spec: Terminal Clone

## Overview

Terminal Clone provides GPU-accelerated terminal emulation for Geometry OS, enabling:

1. **PTY Shells**: Native bash/zsh sessions via nix::pty
2. **GPU Rendering**: Compute-shader based text rendering
3. **VAT Integration**: Spatial placement on infinite map
4. **VM Extraction**: Auto-detect terminal windows in VMs

## Data Structures

### PtyEngine (Rust)

```rust
pub struct PtyEngine {
    master_fd: OwnedFd,
    reader: File,
    writer: File,
    rows: u16,
    cols: u16,
}

impl PtyEngine {
    pub fn new(rows: usize, cols: usize, shell: &str) -> Result<Self>;
    pub fn write(&mut self, data: &[u8]) -> Result<(), std::io::Error>;
    pub fn read(&mut self) -> Result<Vec<u8>, std::io::Error>;
    pub fn resize(&mut self, rows: usize, cols: usize) -> Result<(), std::io::Error>;
    pub fn get_size(&self) -> (usize, usize);
}
```

### TerminalCloneManager (Rust)

```rust
pub struct TerminalTile {
    pub pty: PtyEngine,
    pub emulator: TerminalEmulator,
    pub tile_id: i64,
    pub position: (i32, i32),
}

pub struct TerminalCloneManager {
    terminals: HashMap<i64, TerminalTile>,
    next_id: i64,
}
```

### TerminalVatBridge (Python)

```python
@dataclass
class TerminalTileConfig:
    rows: int = 36
    cols: int = 120
    shell: str = "/bin/bash"
    district: str = "terminal"
    near_center: bool = True

class TerminalVatBridge:
    def spawn_terminal(self, config: TerminalTileConfig) -> int;
    def get_tile_position(self, tile_id: int) -> Optional[Tuple[int, int]];
    def move_tile(self, tile_id: int, x: int, y: int) -> bool;
    def destroy_terminal(self, tile_id: int) -> bool;
```

## WGSL Shader

```wgsl
struct TerminalUniforms {
    grid_size: vec2<u32>,     // cols, rows (120, 36)
    char_size: vec2<u32>,     // width, height (8, 16)
    cursor_pos: vec2<u32>,
    cursor_visible: u32,
    time: f32,
}

struct CellData {
    char_code: u32,
    fg_color: u32,
    bg_color: u32,
    attrs: u32,
}

@compute @workgroup_size(8, 8)
fn render_terminal(@builtin(global_invocation_id) id: vec3<u32>);
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `rows` | 36 | Terminal grid rows |
| `cols` | 120 | Terminal grid columns |
| `shell` | `/bin/bash` | Default shell |
| `max_scrollback` | 1000 | Scrollback buffer lines |
| `max_terminals` | 10 | Concurrent terminals |

## Integration Points

| System | Interface | Purpose |
|--------|-----------|---------|
| VATManager | `set_tile_position()` | Spatial placement |
| ExtractionPipeline | `extract()` | VM terminal detection |
| VisualBridge | WebSocket | HUD streaming |
| Tile system | `Tile.species` | "terminal" type |

## Feature Flags

```toml
[features]
hypervisor = ["vte", "nix/term", "nix/pty"]
```
