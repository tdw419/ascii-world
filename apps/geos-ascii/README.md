# GeosASCII - GPU-Native ASCII Compiler

> Pixels Move Pixels. The Rosetta Stone between ASCII design and GPU execution.

## The Problem

Current UI frameworks have too many layers:

```
ASCII → TypeScript → Bun → HTTP → Python → GPU
         (every frame, every interaction)
```

We write code to move pixels. But pixels should move pixels.

## The Solution

GeosASCII compiles your ASCII templates into GPU-native cartridges (.rts.png):

```
ASCII → GeosASCII Compiler → .rts.png → GPU Viewer
                    (once)            (native)
```

The .rts.png is a self-contained "cartridge" containing:
- **Glyph Grid**: Your ASCII as RGBA pixels
- **SIT (Spatial Instruction Table)**: Action at each coordinate
- **State Buffer**: Mutable state
- **Bootstrap**: Metadata header

## Quick Start

### 1. Install Dependencies

```bash
pip install pillow numpy
```

### 2. Create an ASCII Template

```ascii
┌─────────────────────┐
│  [A] Run  [B] Stop  │
│  [C] Menu [D] Help  │
└─────────────────────┘
```

### 3. Create a Mapping

```json
{
  "run": { "opcode": "JUMP", "target": "main" },
  "stop": { "opcode": "EXIT", "target": "" },
  "menu": { "opcode": "CALL", "target": "show_menu" },
  "help": { "opcode": "CALL", "target": "show_help" }
}
```

### 4. Compile

```bash
python compiler/geos_ascii_compiler.py myui.ascii
```

This creates `myui.rts.png`.

### 5. View

Open `viewer/geos-viewer.html` in a browser and load your cartridge.

## Architecture

### Cartridge Format (.rts.png)

```
┌─────────────────────────────┐
│ Glyph Grid (80x24 RGBA)     │  ← Your ASCII as pixels
├─────────────────────────────┤
│ SIT (256x1 RGBA)            │  ← Spatial Instruction Table
├─────────────────────────────┤
│ State Buffer (1024x1 RGBA)  │  ← Mutable state
├─────────────────────────────┤
│ Bootstrap (16x16 RGBA)      │  ← Metadata
└─────────────────────────────┘
```

### How It Works

1. **Compile Time**: The compiler reads your .ascii file, detects [A], [B], etc. patterns, and encodes them into the SIT
2. **Runtime**: When you click at (x, y), the viewer looks up position y*80+x in the SIT
3. **Execute**: The opcode at that position tells the GPU what to do

### Interaction Flow

```
User clicks at (5, 2)
        ↓
Viewer calculates index = 2*80+5 = 165
        ↓
Reads SIT[165] = {opcode: JUMP, target: "run"}
        ↓
Executes: JUMP to "run" action
```

## OPCODES

| Opcode | Value | Description |
|--------|-------|-------------|
| NOP    | 0     | No operation |
| JUMP   | 1     | Jump to target state |
| CALL   | 2     | Call subroutine |
| TOGGLE | 3     | Toggle state bit |
| INPUT  | 4     | Request input |
| OUTPUT | 5     | Send output |
| EXIT   | 255   | Exit/quit |

## File Structure

```
geos-ascii/
├── compiler/
│   └── geos_ascii_compiler.py   # The compiler
├── viewer/
│   └── geos-viewer.html         # Browser-based cartridge player
├── examples/
│   ├── dashboard.ascii          # Example UI
│   └── dashboard.mapping.json   # Example mapping
└── README.md
```

## Why This Matters

### For AI Agents

LLMs speak ASCII fluently. They can generate:

```
[A] Start  [B] Stop  [X] Quit
```

Far more reliably than React/HTML/CSS. GeosASCII lets AI agents control UIs directly.

### For Geometry OS

This is the "Pixels Move Pixels" implementation. The UI becomes sovereign—the pixels themselves contain the instructions for what happens when clicked.

### For Embedded Systems

The cartridge is a single PNG file. No parsing, no JSON, no virtual DOM. Just pixels and actions.

## Roadmap

- [ ] Compile more complex patterns (tables, containers)
- [ ] WebGL renderer for hardware acceleration
- [ ] State persistence in the cartridge
- [ ] Multi-page navigation support
- [ ] Integration with Glyph VM

## ASCII-First Architecture

ASCII World now supports the full ASCII-First Architecture:

### Components

- **State Store**: Centralized state management via `AsciiStateStore`
- **Templates**: Dynamic rendering with `{{variable}}` substitution
- **HTTP API**: `/view`, `/control`, `/state` endpoints
- **MCP Bridge**: AI agent control via Claude Code

### Quick Start

```bash
# Start the ASCII World server
bun run ascii

# View current screen
curl http://localhost:3421/view

# Navigate via label
curl -X POST http://localhost:3421/control -d '{"label":"B"}'
```

### Integration with GeosASCII

The compiler now supports template variables:

```bash
python3 compiler/geos_ascii_compiler.py template.ascii \
  --variables '{"cpu_percent": 45, "memory": 2048}' \
  -o output.rts.png
```

## License

MIT
