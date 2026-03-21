# pxOS — Pixel Operating System

**AI agents produce data. Humans consume pixels. pxOS bridges the gap.**

An AI posts `{"cpu": 0.67}` — two hundred bytes. A formula engine evaluates that into a pixel grid. The pixel grid is the substrate.

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
                            │ PixelFormula     │
                            │ Engine           │
                            │                  │
                            │ =BAR(cpu, 40)    │──► drawProgressBar()
                            │ =STATUS(state)   │──► drawTextCell()
                            │ =SPARKLINE(...)  │──► drawRect() series
                            └───────┬──────────┘
                                    │
                            ┌───────▼──────────┐
                            │  PixelBuffer      │
                            │  480×240 RGBA     │
                            └───────┬──────────┘
                                    │
                            ┌───────▼──────────┐
                            │  PNG Output       │
                            └──────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Expected: 28 tests passing
```

## Components

| File | Purpose | Tests |
|------|---------|-------|
| `sync/pixel-buffer.js` | RGBA pixel buffer with drawing primitives | 16 |
| `sync/glyph-atlas.js` | 6×10 bitmap font for text rendering | - |
| `sync/pixel-formula-engine.js` | Reactive formula evaluator | 12 |
| `sync/pixel-renderer.js` | ASCII → PNG bridge | - |

**Total: 28 tests**

## Formula Functions

| Function | Pixel Operation | Example |
|----------|-----------------|---------|
| `BAR(col, row, val, w)` | Progress bar | `=BAR(cpu, 40)` |
| `TEXT(col, row, val)` | Text label | `=TEXT(label)` |
| `STATUS(col, row, val, ...)` | Status indicator | `=STATUS(state, 2, "◉ done", "○ idle")` |
| `BOX(col, row, w, h)` | Box outline | `=BOX(0, 0, 40, 5)` |
| `SPARKLINE(col, row, arr, w)` | Mini chart | `=SPARKLINE(history, 50)` |

## Usage

```javascript
import { PixelFormulaEngine } from './sync/pixel-formula-engine.js';

const engine = new PixelFormulaEngine(480, 240);

// Set reactive cell values
engine.setCells({ cpu: 0.67, mem: 28.1 });

// Draw formulas
engine.BAR(0, 0, 'cpu', 40);
engine.TEXT(42, 0, 'cpu');
engine.STATUS(0, 1, 'state', 2, '◉ done', 1, '● active', '○ idle');

// Export as PNG
const png = await engine.toPNG();
```

## Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| active | `#3fb950` | ● healthy status |
| idle | `#484f58` | ○ inactive status |
| critical | `#f85149` | ◉ error/done |
| barFill | `#238636` | Progress bar filled |
| barEmpty | `#161b22` | Progress bar empty |
| border | `#30363d` | Box outlines |
| text | `#c9d1d9` | Default text |

## Coordinate System

```
Pixel space:    (0,0) to (479, 239)     — 480×240 pixels
Cell space:     (0,0) to (79, 23)       — 80×24 characters

Conversion:
  pixel → cell:   col = floor(px / 6),  row = floor(py / 10)
  cell → pixel:   px = col * 6,         py = row * 10
```

## API

```javascript
class PixelFormulaEngine {
  constructor(width = 480, height = 240)
  
  // State
  setCells(cells)
  resolveValue(cellValue)
  
  // Formulas
  BAR(col, row, cellValue, widthCells)
  TEXT(col, row, cellValue)
  STATUS(col, row, cellValue, ...thresholds)
  BOX(col, row, widthCells, heightCells)
  SPARKLINE(col, row, cellValue, widthCells)
  
  // Output
  clear()
  renderTemplate(template)
  toPNG() → Promise<Buffer>
}
```

## License

MIT
