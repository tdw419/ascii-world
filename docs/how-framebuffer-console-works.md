# How the Framebuffer Console Works

## The One-Sentence Version

JavaScript writes text into an RGBA byte array using bitmap font lookups, then writes those bytes directly to `/dev/fb0` — no terminal emulator, no X11, no Wayland. You type on stdin, you see pixels on screen.

---

## Why This Exists

A normal terminal works like this:

```
your program → stdout (text) → terminal emulator → font renderer → compositor → GPU → screen
```

That's 6 layers between your code and the pixels. We bypassed all of them:

```
your program → RGBA bytes → /dev/fb0 → screen
```

`/dev/fb0` is the Linux framebuffer device. Writing bytes to it puts pixels on the screen. No display server required. The kernel maps it directly to video memory.

---

## The Stack

```
┌──────────────────────────────────────────────────────┐
│  bin/console.js         ScreenConsole                │  Application
│  Commands: help, eval, echo, clear, color, fill      │
├──────────────────────────────────────────────────────┤
│  bin/keyboard.js        KeyboardInput + InputLine    │  Input
│  Raw stdin → key events → editable line buffer       │
├──────────────────────────────────────────────────────┤
│  bin/text-to-fb.js      TextWriter                   │  Text → Pixels
│  print("hello", x, y, 0xFFFFFF) → glyph rendering   │
├──────────────────────────────────────────────────────┤
│  sync/glyph-atlas.js    GlyphAtlas                   │  Font
│  6×10 bitmap font, ASCII + box-drawing + blocks      │
├──────────────────────────────────────────────────────┤
│  sync/pixel-buffer.js   PixelBuffer                  │  Memory
│  Uint8ClampedArray, 1920×1080×4 = 8,294,400 bytes   │
├──────────────────────────────────────────────────────┤
│  /dev/fb0               Linux framebuffer            │  Hardware
│  Write bytes → pixels on screen                      │
└──────────────────────────────────────────────────────┘
```

Six files. ~1,475 lines total.

---

## How Each Layer Works

### Layer 1: PixelBuffer (`sync/pixel-buffer.js`)

A flat array of bytes. Every pixel is 4 bytes: Red, Green, Blue, Alpha.

```
Pixel at (x, y):
  index = (y × width + x) × 4
  data[index + 0] = Red     (0-255)
  data[index + 1] = Green   (0-255)
  data[index + 2] = Blue    (0-255)
  data[index + 3] = Alpha   (0-255)
```

For a 1920×1080 screen, that's `1920 × 1080 × 4 = 8,294,400 bytes` (~8 MB).

The buffer provides:
- `setPixel(x, y, r, g, b, a)` — write one pixel
- `drawRect(x, y, w, h, r, g, b, a)` — fill a rectangle
- `clear(color)` — fill entire buffer
- `toPNG()` — export for debugging

That's it. No abstraction beyond "here are some bytes, write to them."

### Layer 2: GlyphAtlas (`sync/glyph-atlas.js`)

A bitmap font. Each character is a 6-pixel-wide, 10-pixel-tall grid. Each row of a glyph is stored as a single byte where bits represent pixels:

```
Letter "A" (6×10):

  Bitmap: [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11, 0, 0, 0]

  0x0E = 001110      ··███·
  0x11 = 010001      ·█···█
  0x11 = 010001      ·█···█
  0x1F = 011111      ·█████
  0x11 = 010001      ·█···█
  0x11 = 010001      ·█···█
  0x11 = 010001      ·█···█
  0x00 = 000000      ······
  0x00 = 000000      ······
  0x00 = 000000      ······
```

To render a character, the atlas reads each bit. If the bit is 1, it calls `setPixel` with the foreground color. If 0, it skips (background shows through).

The atlas includes:
- Printable ASCII (space through `z`)
- Box-drawing characters (`─│┌┐└┘├┤┬┴┼` and double-line variants)
- Block elements (`█▓▒░▁▂▃▄▅▆▇▀`)
- A few symbols (`●○◉◐✗`)

Unknown characters render as a dotted rectangle.

### Layer 3: TextWriter (`bin/text-to-fb.js`)

Wraps PixelBuffer + GlyphAtlas into a simple API:

```js
const writer = new TextWriter();
writer.print("Hello", 10, 20, 0x00FF00);  // green text at pixel (10, 20)
writer.println("World");                    // next line, white
writer.flush();                             // write buffer to /dev/fb0
```

`print()` takes a hex color like `0xFFFFFF`, splits it into R/G/B components, and passes them to `GlyphAtlas.drawText()`, which iterates each character and stamps its bitmap into the PixelBuffer.

`flush()` opens `/dev/fb0` and writes the entire buffer:

```js
const fd = fs.openSync('/dev/fb0', 'w');
fs.writeSync(fd, this.toRGBA(), 0, bufferLength, 0);
fs.closeSync(fd);
```

That's the entire framebuffer write. The kernel takes those bytes and puts them on the monitor.

### Layer 4: KeyboardInput (`bin/keyboard.js`)

Reads raw keystrokes from stdin. When you set `stdin.setRawMode(true)`, Node gives you every keystroke immediately — no line buffering, no echo.

Raw input arrives as byte sequences:
- Regular keys: single bytes (`'a'` = `0x61`)
- Enter: `\r` (0x0D)
- Backspace: `\x7f` (0x7F)
- Arrow keys: escape sequences (`\x1b[A` = Up, `\x1b[B` = Down)
- Ctrl+C: `\x03`

`KeyboardInput` parses these into named events:

```js
{ key: 'a', ctrl: false, alt: false, shift: false }
{ key: 'Enter' }
{ key: 'Up', sequence: true }
{ key: 'c', ctrl: true }  // Ctrl+C
```

`InputLine` maintains an editable text buffer with cursor position and command history (Up/Down arrows). When Enter is pressed, it fires the `onEnter` callback with the typed text.

### Layer 5: ScreenConsole (`bin/console.js`)

Combines everything into an interactive terminal:

```
┌─────────────────────────────────────┐
│ GEOMETRY OS | FRAMEBUFFER CONSOLE   │  ← header (cyan)
├─────────────────────────────────────┤  ← separator line
│ Framebuffer Console v0.1            │
│ Type "help" for commands            │
│                                     │
│ > eval 2 + 2                        │  ← command echo (gray)
│ = 4                                 │  ← result (green)
│ > eval Math.PI                      │
│ = 3.141592653589793                 │
│                                     │
│  (scrolling output area)            │  ← 104 rows
│                                     │
├─────────────────────────────────────┤  ← separator line
│> cursor here_                       │  ← input line (bottom)
└─────────────────────────────────────┘
```

The console has a command registry. Built-in commands:

| Command | What it does |
|---------|-------------|
| `help` | List all commands |
| `clear` | Clear the output area |
| `echo <text>` | Print text to output |
| `color <hex>` | Print text in specified color |
| `eval <expr>` | Evaluate a JavaScript expression |
| `calc <expr>` | Alias for eval |
| `formula <fn>` | Render a grayscale pixel formula to a 256×256 region |
| `rgb <fn>` | Render an RGB pixel formula to a 256×256 region |
| `test` | Print 10 colored lines |
| `fill <hex>` | Fill entire screen with a color |

Custom commands are added with:

```js
screen.command('mycommand', (args) => {
    screen.print('Got: ' + args.join(' '), 0x00FF00);
});
```

The `eval` command uses `Function('use strict'; return (expr))()` — a sandboxed evaluator with access to standard JS built-ins (Math, Array, String, etc.) but no access to Node modules, `process`, or `require`.

The `formula` and `rgb` commands take an arrow function and evaluate it for every pixel in a 256×256 region:

```
> formula (x,y) => (x ^ y) & 0xFF

  For each pixel (x, y) in [0..255] × [0..255]:
    value = fn(x, y)            // e.g. (x ^ y) & 0xFF = 170
    clamp to [0, 255]
    setPixel(10+x, 30+y, value, value, value, 255)   // grayscale

> rgb (x,y) => [x & 0xFF, y & 0xFF, (x*y) & 0xFF]

  For each pixel (x, y):
    [r, g, b] = fn(x, y)       // e.g. [128, 64, 32]
    clamp each to [0, 255]
    setPixel(10+x, 30+y, r, g, b, 255)               // full color
```

The formula is stored and re-applied after every text render (since `render()` clears the buffer). This is handled by `renderWithPixels()` — draw text first, then stamp formula pixels on top.

---

## The Render Loop

There is no render loop. Rendering is event-driven:

```
1. User presses a key
2. stdin emits raw bytes
3. KeyboardInput parses → key event
4. InputLine updates buffer (or fires onEnter → command handler)
5. ScreenConsole marks dirty = true
6. render() redraws the full screen into PixelBuffer
7. flush() writes PixelBuffer to /dev/fb0
```

Every keystroke triggers a full redraw. At 8 MB per frame, this is fine for a text console — the bottleneck is `/dev/fb0` write speed, not rendering.

The `ScreenManager` (in `sync/screen-manager.js`) takes this further with dirty-rect optimization — it tracks which cells changed and only re-renders those. The console doesn't use this yet but could.

---

## The Data Flow

```
              "eval 2+2"
                  │
                  ▼
         ┌──────────────┐
         │  KeyboardInput │  stdin.setRawMode(true)
         │  parse bytes   │  'e','v','a','l',' ','2','+','2', Enter
         └──────┬───────┘
                │ key events
                ▼
         ┌──────────────┐
         │  InputLine    │  buffer: "eval 2+2"
         │  cursor: 8    │  history: [...]
         └──────┬───────┘
                │ onEnter("eval 2+2")
                ▼
         ┌──────────────┐
         │ ScreenConsole │  split → cmd: "eval", args: ["2+2"]
         │ handleCommand │  Function('"use strict"; return (2+2)')() → 4
         │               │  print("= 4", 0x00FF88)
         └──────┬───────┘
                │ dirty = true
                ▼
         ┌──────────────┐
         │  render()     │  For each output line:
         │  TextWriter   │    atlas.drawText(buffer, x, y, text, color)
         │               │      → for each char, stamp 6×10 bitmap
         │               │        → setPixel(x, y, r, g, b, a)
         └──────┬───────┘
                │ 8,294,400 bytes (RGBA)
                ▼
         ┌──────────────┐
         │  flush()      │  fs.writeSync(fd, bytes, 0, len, 0)
         │  /dev/fb0     │  kernel → video memory → monitor
         └──────────────┘
```

---

## Running It

**Demo mode** (saves a PNG screenshot):
```bash
node bin/console.js --demo
# → /tmp/console-demo.png
```

**On the framebuffer** (needs a Linux TTY, not a terminal emulator):
```bash
# Switch to TTY: Ctrl+Alt+F3
cd ~/zion/projects/ascii_world/ascii_world
sudo node bin/console.js --flush
# Type commands. Ctrl+C to exit.
```

**Just write text to the screen:**
```bash
sudo node bin/text-to-fb.js --flush "HELLO WORLD" --x 100 --y 100 --color 00FFFF
```

---

## What's Not Here (Yet)

- **No GPU acceleration.** Every pixel is set by CPU loops. The `PixelFormulaEngine` and WGSL shaders exist in the codebase but aren't wired into the console yet. The `formula` command proves the concept — wire it to WebGPU for real-time rendering.
- **No mouse.** Could read from `/dev/input/event*` the same way we read keyboard.
- **No windows/panels.** The `ScreenManager` has the grid abstraction for this, but the console is currently one full-screen view.
- **No animation.** Formulas render once. Adding a time parameter (`formula (x,y,t) => ...` with a render loop) would enable live shader-like effects.

---

## File Reference

| File | Lines | What |
|------|-------|------|
| `sync/pixel-buffer.js` | 107 | Raw RGBA byte array with setPixel/drawRect |
| `sync/glyph-atlas.js` | 187 | 6×10 bitmap font (ASCII + box-drawing + blocks) |
| `sync/screen-manager.js` | 179 | Cell grid with dirty-rect rendering (used by dashboard) |
| `bin/text-to-fb.js` | 247 | TextWriter: text → glyphs → pixels → /dev/fb0 |
| `bin/keyboard.js` | 317 | Raw stdin reader + editable input line |
| `bin/console.js` | 438 | Interactive console combining all layers |
| **Total** | **1,475** | |
