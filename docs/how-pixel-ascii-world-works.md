# How Pixel ASCII World Works

## The One-Sentence Version

An AI agent posts `{"cpu": 0.67}` — two hundred bytes. A formula engine evaluates that into a pixel grid. The pixel grid is the substrate. Text is a debug view.

## The Honest Framing

The system has a text layer that shouldn't exist.

```
  =BAR(cpu, 40) → "████████████████████████████░░░░░░░░░░░░" → pixel renderer decodes back to a green rectangle
```

That middle step — the string of `█` and `░` characters — is a lossy encoding of pixel intent that gets immediately decoded. The `█` character doesn't carry color, position, or semantic meaning beyond "filled." The pixel renderer has to re-infer all of that from context.

The text layer exists because LLMs output tokens, and tokens are text. If an AI could call `write_rect(x, y, w, h, #238636, #161b22)` directly, you'd skip the text entirely. The formula engine would think in `(col, row, r, g, b, a)` tuples instead of UTF-8 strings.

```
  Current flow:  agent → cells → text formulas → text string → pixel renderer → PNG
  Direct flow:   agent → cells → pixel formulas → pixel buffer → PNG
```

The `.ascii` file is training wheels. The pixel grid was always the destination.

This document describes the system as it exists today — with the text layer still in place — while being explicit about what's scaffolding and what's architecture.

## Why It Exists

AI agents produce text. Humans consume pixels. GPUs execute neither — they run shader programs on framebuffers. To get from AI output to a visual interface, you need a pipeline that preserves meaning across all three media without the AI needing to know about pixels, and without the human needing to read raw text.

ASCII World is that pipeline. The text layer is the part that works with current LLMs. The pixel layer is the part that works with humans. The cartridge format is the part that works with GPUs. The text layer is the one that gets discarded.

## The Architecture

```
  AI Agent                    Server                      Viewers
  ────────                    ──────                      ───────

  {"cpu": 0.67}     POST     ┌──────────────────┐
  {"mem_pct": 0.45} ──────►  │  Cell Store       │
  {"disk_pct": 0.92}         │  (key → value)    │
                             └────────┬─────────┘
                                      │
                              ┌───────▼─────────┐
                              │  Formula Engine   │
                              │                   │
                              │  =BAR(cpu, 40)    │──► "████████████████████████████░░░░░░░░░░░░"
                              │  =STATUS(state,   │
                              │    1, "● active", │──► "● active"
                              │    "○ idle")      │
                              │  =SPARKLINE(      │
                              │    cpu_history,50) │──► "▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▅▇█"
                              └───────┬──────────┘
                                      │
                              ┌───────▼──────────┐
                              │  .ascii file       │   Text viewer
                              │  (source of truth) │──► ascii_world_template.html
                              │                    │   (WebSocket, live text)
                              └───────┬───────────┘
                                      │
                              ┌───────▼──────────┐
                              │  Pixel Renderer    │   Pixel viewer
                              │  char → 6×10 glyph │──► pixel_world_viewer.html
                              │  + semantic color   │   (canvas, crosshair cursor)
                              └───────┬───────────┘
                                      │
                              ┌───────▼──────────┐
                              │  GeosASCII         │   GPU viewer
                              │  Compiler          │──► geos-viewer.html
                              │  .ascii → .rts.png  │   (cartridge player)
                              └────────────────────┘
```

## The Components

### 1. Cell Store

A key-value map. Nothing more. The AI agent writes to it via HTTP:

```
POST /api/v1/ui/cells
{"cpu": 0.67, "mem_pct": 0.45, "boot_state": 2}
```

The cell store holds the current values. It doesn't know about rendering, formulas, or pixels. It's just state.

### 2. Formula Engine (`sync/formula-engine.js`)

A template evaluator that turns `.ascii.tpl` files into rendered `.ascii` output. Templates look like this:

```
║  CPU   [{{=BAR(cpu, 40)}}] {{=PAD(cpu_display, 4, "right")}}%  ║
```

When `cpu = 0.67`, this renders to:

```
║  CPU   [████████████████████████████░░░░░░░░░░░░]  67%  ║
```

The formula engine tracks dependencies. When `cpu` changes, it knows which templates to re-render. There are 12 built-in functions:

| Function | Purpose | Example Output |
|----------|---------|----------------|
| `BAR(val, width)` | Progress bar | `████████░░░░` |
| `IF(cond, a, b)` | Conditional | `● HIGH` or `○ NORMAL` |
| `STATUS(val, thresholds...)` | Multi-level status | `◉ done` / `● active` / `○ idle` |
| `SPARKLINE(arr, width)` | Inline chart | `▁▂▃▅▇█▇▅▃▂▁` |
| `PAD(val, width, align)` | Alignment | `   67` |
| `RATIO(a, b, decimals)` | Fraction display | `28.1/62.3` |
| `HILBERT(loaded, total, w)` | Hilbert-curve bar | `█▓█▓██░░░` |
| `NOW(format)` | Current time | `14:05` |
| `FMT(val, decimals, suffix)` | Number formatting | `28.1 GB` |
| `PCT(val)` | Percentage | `67%` |
| `CONCAT(a, b, ...)` | String join | `foobar` |
| `MATH(expr)` | Arithmetic | `67` |

The engine processes all formulas and writes the result to a `.ascii` file on disk. This file is the source of truth.

### 3. Pixel Renderer (`sync/pixel-renderer.js`)

Takes a rendered `.ascii` string and produces a 480×240 RGBA pixel buffer. Each character maps to a 6×10 pixel glyph. Characters get semantic colors:

| Character | Color | Meaning |
|-----------|-------|---------|
| `●` | Green `#3fb950` | Active/healthy |
| `○` | Dim `#484f58` | Idle/inactive |
| `◉` | Red `#f85149` | Critical/done |
| `█▓` | Green `#238636` | Bar fill |
| `░` | Dark `#161b22` | Bar empty |
| `─│┌┐└┘├┤┬┴┼` | Gray `#30363d` | Box borders |
| `═║╔╗╚╝` | Cyan `#00d4ff` | Double borders |
| `[]` | Cyan `#00d4ff` | Action brackets |
| Everything else | Light `#c9d1d9` | Default text |

The renderer includes a minimal bitmap font (procedurally generated for ASCII, hand-coded for Unicode specials like box drawing and block elements).

Output is served as PNG via the HTTP API:

```
GET /api/v1/ui/pixels/dashboard.ascii  →  PNG image (480×240, ~6KB)
```

### 4. Sync Server (`sync/sync-server.js`)

The hub. Runs two servers:
- **WebSocket** on port 3839 — live bidirectional sync with browser viewers
- **HTTP REST** on port 3840 — API for agents and pixel rendering

When a cell updates:
1. Cell store receives the new values
2. Formula engine re-evaluates affected templates
3. New `.ascii` content is written to disk
4. WebSocket broadcasts the update to all connected viewers
5. Pixel renders are available on demand via the HTTP API

### 5. The Viewers

Three ways to see the same state:

**Text viewer** (`ascii_world_template.html`) — Connects via WebSocket, renders the `.ascii` content as styled monospace text in the browser. Has a "Show Formulas" toggle that reveals the raw `=BAR(cpu, 40)` expressions.

**Pixel viewer** (`pixel_world_viewer.html`) — Connects via WebSocket, renders each character as a colored 6×10 pixel glyph on an HTML canvas. Tracks mouse position in three coordinate systems simultaneously: pixel `(px, py)`, cell `(col, row)`, and SIT index. Sends spatial clicks back to the server.

**GPU viewer** (`apps/geos-ascii/viewer/geos-viewer.html`) — Loads compiled `.rts.png` cartridges and renders them on a canvas. Handles click-to-SIT-opcode lookup. This is the Stratum 2 viewer.

## The Coordinate System

Everything maps to the same 80×24 grid:

```
  Pixel space:    (0,0) to (479, 239)     — 480×240 pixels
  Cell space:     (0,0) to (79, 23)       — 80×24 characters
  SIT space:      0 to 1919               — 1920 entries (80×24)

  Conversion:
    pixel → cell:   col = floor(px / 6),  row = floor(py / 10)
    cell → pixel:   px = col * 6,         py = row * 10
    cell → SIT:     index = row * 80 + col
```

A click at pixel `(30, 45)` maps to cell `(5, 4)` maps to SIT index `325`. The spatial click API performs this conversion:

```
POST /api/v1/ui/spatial_click
{"x": 30, "y": 45, "filename": "dashboard.ascii"}

Response:
{"pixel": {"x": 30, "y": 45}, "cell": {"col": 5, "row": 4}, "sit_index": 325}
```

## The Data Flow

Here's what happens when the reactive monitor agent runs:

```
1. Agent reads system metrics (Python psutil)
   cpu = 0.67, mem = 28.1/62.3 GB, disk = 32/36 GB

2. Agent posts cells to server (HTTP, 200 bytes)
   POST /api/v1/ui/cells
   {"cpu": 0.67, "mem_pct": 0.45, "disk_pct": 0.92, ...}

3. Cell store updates. Formula engine detects that
   reactive_monitor.ascii.tpl depends on "cpu", "mem_pct", "disk_pct"

4. Template re-evaluates (55 cell dependencies, 12 formula types)
   =BAR(cpu, 40)  →  ████████████████████████████░░░░░░░░░░░░
   =STATUS(boot_state, 2, "◉ done", 1, "● active", "○ idle")  →  ◉ done

5. Rendered .ascii written to disk (6.9 KB)
   data/reactive_monitor.ascii

6. WebSocket broadcasts to connected viewers
   Text viewer: updates styled monospace display
   Pixel viewer: re-renders canvas with colored glyphs

7. Pixel API available on demand
   GET /api/v1/ui/pixels/reactive_monitor.ascii  →  PNG (7.1 KB)
```

The agent never builds an ASCII string. It never thinks about layout. It posts 200 bytes of state. The server turns that into a 7KB rendered screen. The pixel renderer turns that into a 7KB PNG image. The ratio is 1:35 — for every byte the AI sends, the system produces 35 bytes of visual output.

## The Substrates

Six ASCII substrates currently exist:

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard.ascii` | 20 | Service health overview with status indicators |
| `gpu_monitor.ascii` | 58 | GPU execution pipeline with tile loading progress |
| `reactive_monitor.ascii` | 48 | System resources + VCC integrity (formula-driven) |
| `openclaw_profiles.ascii` | 24 | Agent profile display |
| `service_manager.ascii` | 19 | Service start/stop controls |
| `settings_panel.ascii` | 39 | Configuration toggles |

Only `reactive_monitor` uses the formula engine (via `reactive_monitor.ascii.tpl`). The others are static or imperatively updated by agents.

## The API Surface

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/ui/read` | GET | Read all current ASCII substrates |
| `/api/v1/ui/write` | POST | Write a full ASCII substrate (imperative) |
| `/api/v1/ui/cells` | POST | Update reactive cell values |
| `/api/v1/ui/cells` | GET | Read current cell values and template info |
| `/api/v1/ui/pixels` | GET | List substrates with pixel dimensions |
| `/api/v1/ui/pixels/{file}` | GET | Render a substrate as PNG |
| `/api/v1/ui/spatial_click` | POST | Convert pixel coordinates to cell + SIT |
| `ws://localhost:3839` | WS | Live bidirectional sync |

## The Text Layer: What It Is and Why It Goes Away

The pixel renderer produces the exact same information as the text file — just drawn differently. No semantic content is added by rendering characters as pixels. The text layer exists for four reasons, none of which are architectural:

1. **LLMs output text** — that's their native medium
2. **git diff works on text** — version control convenience
3. **`cat file.ascii` shows you what's happening** — debugging affordance
4. **vim/nano/any editor can modify it** — human editing convenience

These are properties of current tooling, not properties of the system. The formula engine could evaluate `=BAR(cpu, 40)` and write directly to a pixel buffer — green rectangle at `(col*6, row*10, filled*6, 10)` — without ever producing the string `████████░░░░`. The `.ascii` file would become a debug view generated from the pixel state, inverting the current flow.

That inversion is the path forward:

```
  Today:    .ascii.tpl  →  formula engine  →  .ascii (text)  →  pixel renderer  →  PNG
  Tomorrow: .pixel.tpl  →  formula engine  →  pixel buffer   →  text renderer   →  .ascii (debug)
                                                    ↑                                  ↑
                                              source of truth                    optional export
```

The GeosASCII compiler already produces `.rts.png` cartridges (pixel buffers with a SIT overlay). The formula engine, if it targeted pixel cells instead of text cells, would produce the same output format. The text layer is the bootstrap. The pixel grid is the substrate. The `.ascii` file becomes what `.map` files are to JavaScript — useful for debugging, not required for execution.

The real answer to "why use the ASCII layer if you could skip it": **you shouldn't, once the formula engine can target pixels directly.** The text was always training wheels for LLMs that think in tokens. When the engine flips, the AI still posts `{"cpu": 0.67}`. The only thing that changes is what the formula engine writes to — RGBA values instead of UTF-8 characters.

## File Map

```
ascii_world/
├── sync/
│   ├── sync-server.js          ← The hub (WS + HTTP + file watcher)
│   ├── formula-engine.js       ← Reactive template evaluator
│   ├── pixel-renderer.js       ← ASCII → pixel buffer → PNG
│   ├── hash-utils.js           ← SHA-256 content hashing
│   └── action-handlers.js      ← GUI action dispatch
├── data/
│   ├── *.ascii                 ← Rendered substrates (source of truth)
│   └── *.ascii.tpl             ← Reactive templates with formulas
├── agents/
│   ├── reactive_monitor_agent.py  ← Posts cell data (200B payloads)
│   └── gpu_monitor_agent.py       ← Extracts SIT from .rts.png cartridges
├── apps/geos-ascii/
│   ├── compiler/geos_ascii_compiler.py  ← .ascii → .rts.png compiler
│   └── viewer/geos-viewer.html          ← GPU cartridge viewer
├── ascii_world_template.html    ← Text viewer (WebSocket)
├── pixel_world_viewer.html      ← Pixel viewer (canvas + WebSocket)
└── docs/
    └── how-pixel-ascii-world-works.md   ← This document
```

## Implementation Status (Mar 2026)

**Phase 2 Complete (all tests passing):**
- `sync/pixel-buffer.js` — RGBA buffer, 16 tests passing
- `sync/glyph-atlas.js` — 6×10 bitmap font, tests passing
- `sync/pixel-formula-engine.js` — Pixel formulas, 11 tests passing
- `sync/pixel-renderer.js` — ASCII → PNG bridge
- API: `GET /api/v1/ui/pixels/{file}` returns 480×240 PNG
- Total: 27 tests passing

**Phase 3: Not started**
- Waiting for Phase 2 stabilization

## Running It

```bash
# Start the sync server
cd ascii_world/sync && node sync-server.js

# Open a viewer (either one shows the same state)
# Text:  file:///path/to/ascii_world/ascii_world_template.html
# Pixel: file:///path/to/ascii_world/pixel_world_viewer.html

# Push cell data (simulates an agent)
curl -X POST http://localhost:3840/api/v1/ui/cells \
  -H 'Content-Type: application/json' \
  -d '{"cpu": 0.67, "mem_pct": 0.45}'

# Get a pixel render
curl -o monitor.png http://localhost:3840/api/v1/ui/pixels/reactive_monitor.ascii

# Start the real agent
cd ascii_world/agents && python3 reactive_monitor_agent.py
```
