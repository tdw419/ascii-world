# Pixel Formula Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a pixel-native formula engine that evaluates formulas directly to RGBA pixel buffers, skipping the text intermediary.

**Architecture:** The PixelFormulaEngine takes reactive cell values (like `{"cpu": 0.67}`) and evaluates pixel-formula templates (like `=BAR(cpu, 40)`) directly into PixelBuffer draw calls. Each formula maps to a specific pixel operation (drawRect, drawProgressBar, drawText, etc.) with semantic colors.

**Tech Stack:** Node.js ES modules, PixelBuffer class, GlyphAtlas class

---

## Context

### Current State (Incorrect Documentation)

The docs claim 27 tests passing but only 16 exist:
- `sync/pixel-buffer.js` — ✅ exists (16 tests)
- `sync/glyph-atlas.js` — ✅ exists (tests)
- `sync/pixel-formula-engine.js` — ❌ MISSING
- `tests/pixel-formula-engine.test.js` — ❌ MISSING

### Target State

After this plan:
- `sync/pixel-formula-engine.js` — NEW, evaluates formulas → pixel calls
- `tests/pixel-formula-engine.test.js` — NEW, 11 tests
- Total: 27+ tests passing

---

## File Structure

```
ascii_world/
├── sync/
│   ├── pixel-buffer.js        — EXISTS (no changes)
│   ├── glyph-atlas.js         — EXISTS (no changes)
│   ├── pixel-formula-engine.js  — CREATE (this plan)
│   └── pixel-renderer.js      — EXISTS (no changes)
└── tests/
    ├── pixel-buffer.test.js   — EXISTS (16 tests)
    ├── glyph-atlas.test.js    — EXISTS
    └── pixel-formula-engine.test.js — CREATE (11 tests)
```

---

## Task 1: Fix Documentation

**Files:**
- Modify: `docs/how-pixel-ascii-world-works.md:302-313`

- [ ] **Step 1: Read current status section**

Run: `head -320 docs/how-pixel-ascii-world-works.md | tail -30`

Expected: See incorrect "27 tests passing" claim

- [ ] **Step 2: Update to reflect current reality**

Replace the implementation status section with:

```markdown
## Implementation Status (Mar 2026)

**Phase 2 In Progress:**
- `sync/pixel-buffer.js` — RGBA buffer, 16 tests passing ✅
- `sync/glyph-atlas.js` — 6×10 bitmap font, tests passing ✅
- `sync/pixel-formula-engine.js` — NOT YET IMPLEMENTED
- `sync/pixel-renderer.js` — ASCII → PNG bridge ✅
- API: `GET /api/v1/ui/pixels/{file}` returns 480×240 PNG

**Current Tests:** 16 (PixelBuffer + GlyphAtlas)

**Phase 3: Not started**
- Waiting for PixelFormulaEngine implementation
```

- [ ] **Step 3: Commit**

```bash
git add docs/how-pixel-ascii-world-works.md
git commit -m "docs: fix incorrect test count (16 not 27)"
```

---

## Task 2: Create PixelFormulaEngine Module

**Files:**
- Create: `sync/pixel-formula-engine.js`
- Test: `tests/pixel-formula-engine.test.js`

### Design

The PixelFormulaEngine evaluates pixel formulas:

| Formula | Pixel Operation | Example |
|---------|-----------------|---------|
| `=BAR(val, width)` | `drawProgressBar()` | Green/red bar |
| `=TEXT(val)` | `drawTextCell()` | Label text |
| `=STATUS(val, ...)` | `drawTextCell()` with color | ●/○/◉ indicator |
| `=BOX(w, h)` | `drawRect()` outline | Border |
| `=SPARKLINE(arr, w)` | `drawRect()` series | Mini chart |
| `=FILL(color)` | `fill()` | Background |

### Semantic Colors

```javascript
const COLORS = {
    // Status indicators
    active: [0x3f, 0xb9, 0x50],    // Green #3fb950
    idle: [0x48, 0x4f, 0x58],      // Dim gray #484f58
    critical: [0xf8, 0x51, 0x49],  // Red #f85149
    
    // Progress bars
    barFill: [0x23, 0x86, 0x36],   // Dark green #238636
    barEmpty: [0x16, 0x1b, 0x22],  // Near black #161b22
    
    // Borders
    border: [0x30, 0x36, 0x3d],    // Gray #30363d
    borderHighlight: [0x00, 0xd4, 0xff], // Cyan #00d4ff
    
    // Text
    text: [0xc9, 0xd1, 0xd9],      // Light gray #c9d1d9
    textMuted: [0x8b, 0x94, 0x9e], // Muted #8b949e
};
```

- [ ] **Step 1: Create the module skeleton**

```javascript
// sync/pixel-formula-engine.js
// Evaluates pixel formulas directly to PixelBuffer operations.
// No text intermediary — formulas write pixels directly.

import { PixelBuffer } from './pixel-buffer.js';
import { GlyphAtlas } from './glyph-atlas.js';

const COLORS = {
    active: [0x3f, 0xb9, 0x50],
    idle: [0x48, 0x4f, 0x58],
    critical: [0xf8, 0x51, 0x49],
    barFill: [0x23, 0x86, 0x36],
    barEmpty: [0x16, 0x1b, 0x22],
    border: [0x30, 0x36, 0x3d],
    borderHighlight: [0x00, 0xd4, 0xff],
    text: [0xc9, 0xd1, 0xd9],
    textMuted: [0x8b, 0x94, 0x9e],
};

export class PixelFormulaEngine {
    constructor(width = 480, height = 240) {
        this.width = width;
        this.height = height;
        this.buffer = new PixelBuffer(width, height);
        this.atlas = new GlyphAtlas();
        this.cells = {}; // Reactive cell values
    }

    // ... implementation
}
```

- [ ] **Step 2: Implement setCells()**

```javascript
    setCells(cells) {
        this.cells = cells;
    }
```

- [ ] **Step 3: Implement BAR formula**

```javascript
    /**
     * Draw a progress bar at cell position.
     * =BAR(cpu, 40) → 40-cell wide progress bar
     */
    BAR(col, row, cellValue, widthCells) {
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const w = widthCells * this.atlas.glyphW;
        const h = this.atlas.glyphH;
        
        const val = this.resolveValue(cellValue);
        const fraction = Math.max(0, Math.min(1, Number(val) || 0));
        
        this.buffer.drawProgressBar(px, py, w, h, fraction, COLORS.barFill, COLORS.barEmpty);
    }
```

- [ ] **Step 4: Implement TEXT formula**

```javascript
    /**
     * Draw text at cell position.
     * =TEXT(cpu_display) → renders the value as text
     */
    TEXT(col, row, cellValue) {
        const text = String(this.resolveValue(cellValue) ?? '');
        this.atlas.drawTextCell(this.buffer, col, row, text, COLORS.text);
    }
```

- [ ] **Step 5: Implement STATUS formula**

```javascript
    /**
     * Draw status indicator with semantic color.
     * =STATUS(state, 2, "◉ done", 1, "● active", "○ idle")
     */
    STATUS(col, row, cellValue, ...thresholds) {
        const val = this.resolveValue(cellValue);
        
        // Parse threshold pairs: level, text, level, text, ..., default
        let displayText = '';
        let color = COLORS.idle;
        
        for (let i = 0; i < thresholds.length - 1; i += 2) {
            const level = thresholds[i];
            const text = thresholds[i + 1];
            if (val === level) {
                displayText = text;
                if (text.includes('◉')) color = COLORS.critical;
                else if (text.includes('●')) color = COLORS.active;
                else color = COLORS.idle;
                break;
            }
        }
        
        // Default is last element if no match
        if (!displayText && thresholds.length > 0) {
            displayText = thresholds[thresholds.length - 1];
        }
        
        this.atlas.drawTextCell(this.buffer, col, row, displayText, color);
    }
```

- [ ] **Step 6: Implement BOX formula**

```javascript
    /**
     * Draw a box outline.
     * =BOX(40, 5) → 40×5 cell box using box-drawing chars
     */
    BOX(col, row, widthCells, heightCells) {
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const w = widthCells * this.atlas.glyphW;
        const h = heightCells * this.atlas.glyphH;
        
        // Draw four sides
        for (let x = px; x < px + w; x++) {
            this.buffer.setPixel(x, py, ...COLORS.border);
            this.buffer.setPixel(x, py + h - 1, ...COLORS.border);
        }
        for (let y = py; y < py + h; y++) {
            this.buffer.setPixel(px, y, ...COLORS.border);
            this.buffer.setPixel(px + w - 1, y, ...COLORS.border);
        }
    }
```

- [ ] **Step 7: Implement SPARKLINE formula**

```javascript
    /**
     * Draw a sparkline from array values.
     * =SPARKLINE(cpu_history, 50) → 50-cell wide sparkline
     */
    SPARKLINE(col, row, cellValue, widthCells) {
        const arr = this.resolveValue(cellValue);
        if (!Array.isArray(arr) || arr.length === 0) return;
        
        const px = col * this.atlas.glyphW;
        const py = row * this.atlas.glyphH;
        const barH = this.atlas.glyphH;
        
        const max = Math.max(...arr);
        const min = Math.min(...arr);
        const range = max - min || 1;
        
        const step = arr.length / widthCells;
        
        for (let i = 0; i < widthCells; i++) {
            const idx = Math.floor(i * step);
            const val = arr[idx] ?? 0;
            const frac = (val - min) / range;
            const barW = this.atlas.glyphW;
            
            // Draw vertical bar from bottom
            const filledH = Math.round(frac * barH);
            this.buffer.drawRect(
                px + i * barW, 
                py + barH - filledH, 
                barW, 
                filledH, 
                ...COLORS.barFill
            );
        }
    }
```

- [ ] **Step 8: Implement resolveValue() helper**

```javascript
    resolveValue(cellValue) {
        // If it's a cell reference (string), look it up
        if (typeof cellValue === 'string' && cellValue in this.cells) {
            return this.cells[cellValue];
        }
        // Otherwise return as-is (literal)
        return cellValue;
    }
```

- [ ] **Step 9: Implement clear() and toPNG()**

```javascript
    clear() {
        this.buffer.clear(0x0a0a0f);
    }

    async toPNG() {
        return this.buffer.toPNG();
    }
```

- [ ] **Step 10: Implement renderTemplate() for full templates**

```javascript
    /**
     * Evaluate a pixel template (array of formula calls).
     * Each entry: { fn: 'BAR', args: [col, row, 'cpu', 40] }
     */
    renderTemplate(template) {
        this.clear();
        
        for (const op of template) {
            const fn = this[op.fn];
            if (typeof fn === 'function') {
                fn.call(this, ...op.args);
            }
        }
        
        return this.buffer;
    }
```

---

## Task 3: Create Tests

**Files:**
- Create: `tests/pixel-formula-engine.test.js`

- [ ] **Step 1: Create test file with imports**

```javascript
// tests/pixel-formula-engine.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PixelFormulaEngine } from '../sync/pixel-formula-engine.js';

describe('PixelFormulaEngine', () => {
    let engine;
    
    beforeEach(() => {
        engine = new PixelFormulaEngine(480, 240);
    });
```

- [ ] **Step 2: Test constructor and clear**

```javascript
    it('creates buffer with correct dimensions', () => {
        assert.strictEqual(engine.width, 480);
        assert.strictEqual(engine.height, 240);
        assert.strictEqual(engine.buffer.data.length, 480 * 240 * 4);
    });

    it('clear fills buffer with dark color', () => {
        engine.clear();
        const [r, g, b] = engine.buffer.getPixel(0, 0);
        assert.strictEqual(r, 0x0a);
        assert.strictEqual(g, 0x0a);
        assert.strictEqual(b, 0x0f);
    });
```

- [ ] **Step 3: Test setCells and resolveValue**

```javascript
    it('setCells stores cell values', () => {
        engine.setCells({ cpu: 0.67, mem: 28.1 });
        assert.strictEqual(engine.cells.cpu, 0.67);
        assert.strictEqual(engine.cells.mem, 28.1);
    });

    it('resolveValue returns literal values', () => {
        assert.strictEqual(engine.resolveValue(42), 42);
        assert.strictEqual(engine.resolveValue('hello'), 'hello');
    });

    it('resolveValue looks up cell references', () => {
        engine.setCells({ cpu: 0.67 });
        assert.strictEqual(engine.resolveValue('cpu'), 0.67);
    });
```

- [ ] **Step 4: Test BAR formula**

```javascript
    it('BAR draws progress bar', () => {
        engine.setCells({ cpu: 0.5 });
        engine.BAR(0, 0, 'cpu', 10);
        
        // At 50%, first 5 cells should be green, last 5 should be dark
        const filled = engine.buffer.getPixel(0, 5);  // First cell, middle
        const empty = engine.buffer.getPixel(35, 5);  // 6th cell (after 5 filled)
        
        assert.deepStrictEqual(filled.slice(0, 3), [0x23, 0x86, 0x36]); // barFill
        assert.deepStrictEqual(empty.slice(0, 3), [0x16, 0x1b, 0x22]); // barEmpty
    });
```

- [ ] **Step 5: Test TEXT formula**

```javascript
    it('TEXT draws text at cell coordinates', () => {
        engine.setCells({ label: 'CPU' });
        engine.TEXT(0, 0, 'label');
        
        // Check that pixels are non-zero (text was drawn)
        const pixel = engine.buffer.getPixel(0, 5);
        assert.ok(pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0);
    });
```

- [ ] **Step 6: Test STATUS formula**

```javascript
    it('STATUS draws status indicator (0.3ms)', () => {
        engine.setCells({ state: 1 });
        engine.STATUS(0, 0, 'state', 2, '◉ done', 1, '● active', '○ idle');
        
        // Should render '● active' in green
        const pixel = engine.buffer.getPixel(0, 5);
        assert.deepStrictEqual(pixel.slice(0, 3), [0x3f, 0xb9, 0x50]); // active green
    });
```

- [ ] **Step 7: Test BOX formula**

```javascript
    it('BOX draws a box outline', () => {
        engine.BOX(0, 0, 10, 5);
        
        // Check corners have border color
        const tl = engine.buffer.getPixel(0, 0);
        const tr = engine.buffer.getPixel(59, 0); // 10 cells * 6 pixels - 1
        const bl = engine.buffer.getPixel(0, 49);  // 5 cells * 10 pixels - 1
        const br = engine.buffer.getPixel(59, 49);
        
        for (const corner of [tl, tr, bl, br]) {
            assert.deepStrictEqual(corner.slice(0, 3), [0x30, 0x36, 0x3d]);
        }
    });
```

- [ ] **Step 8: Test SPARKLINE formula**

```javascript
    it('SPARKLINE draws sparkline from history', () => {
        engine.setCells({ history: [0.2, 0.4, 0.6, 0.8, 1.0] });
        engine.SPARKLINE(0, 0, 'history', 5);
        
        // Last bar should be tallest (value 1.0)
        const lastBarTop = engine.buffer.getPixel(29, 0); // 5th cell, top row
        assert.deepStrictEqual(lastBarTop.slice(0, 3), [0x23, 0x86, 0x36]); // barFill
    });
```

- [ ] **Step 9: Test renderTemplate**

```javascript
    it('renderTemplate evaluates a pixel template', () => {
        engine.setCells({ cpu: 0.75 });
        
        const template = [
            { fn: 'BAR', args: [0, 0, 'cpu', 20] },
            { fn: 'TEXT', args: [22, 0, 'cpu'] },
        ];
        
        const buf = engine.renderTemplate(template);
        
        // Verify buffer was rendered
        assert.ok(buf instanceof engine.buffer.constructor);
    });
```

- [ ] **Step 10: Test toPNG produces valid PNG**

```javascript
    it('toPNG produces valid PNG buffer', async () => {
        engine.BAR(0, 0, 0.5, 10);
        const png = await engine.toPNG();
        
        // PNG magic bytes
        assert.strictEqual(png[0], 0x89);
        assert.strictEqual(png[1], 0x50); // 'P'
        assert.strictEqual(png[2], 0x4E); // 'N'
        assert.strictEqual(png[3], 0x47); // 'G'
    });
```

- [ ] **Step 11: Run tests to verify**

```bash
node --test tests/pixel-formula-engine.test.js
```

Expected: 11 tests pass

---

## Task 4: Update Documentation (Post-Implementation)

**Files:**
- Modify: `docs/how-pixel-ascii-world-works.md:302-313`

- [ ] **Step 1: Update status to reflect completion**

Replace the implementation status section with:

```markdown
## Implementation Status (Mar 2026)

**Phase 2 Complete (all tests passing):**
- `sync/pixel-buffer.js` — RGBA buffer, 16 tests passing ✅
- `sync/glyph-atlas.js` — 6×10 bitmap font, tests passing ✅
- `sync/pixel-formula-engine.js` — Pixel formulas, 11 tests passing ✅
- `sync/pixel-renderer.js` — ASCII → PNG bridge ✅
- API: `GET /api/v1/ui/pixels/{file}` returns 480×240 PNG

**Total: 27 tests passing**

**Phase 3: Not started**
- Direct pixel templates (`.pixel.tpl` files)
- Reactive pixel updates via WebSocket
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(pixel): add PixelFormulaEngine with 11 tests

- BAR: progress bar formula
- TEXT: text rendering formula  
- STATUS: status indicator formula
- BOX: box outline formula
- SPARKLINE: sparkline chart formula
- renderTemplate: evaluate pixel templates

Phase 2 complete: 27 tests passing"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run all tests**

```bash
node --test tests/pixel-buffer.test.js tests/glyph-atlas.test.js tests/pixel-formula-engine.test.js
```

Expected: 27+ tests pass

- [ ] **Step 2: Verify git status**

```bash
git status && git log --oneline -5
```

Expected: Clean working tree, commits show Phase 2 completion

---

## Summary

| Task | Steps | Files Changed |
|------|-------|---------------|
| Fix docs | 3 | 1 file (docs) |
| Create engine | 10 | 1 file (new) |
| Create tests | 11 | 1 file (new) |
| Update docs | 2 | 1 file |
| Verify | 2 | 0 files |
| **Total** | **28** | **4 files** |

**Estimated time:** 30-45 minutes

**Result:** Phase 2 complete with 27 tests passing, ready for Phase 3.
