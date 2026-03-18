# Pattern Recognition Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a pattern recognition system that automatically parses ASCII templates and generates React components, eliminating the need for manual component mapping.

**Architecture:** The renderer uses a three-stage pipeline: (1) Lexer tokenizes ASCII into structured elements, (2) Pattern Detector identifies UI patterns (buttons, containers, tables), (3) Component Generator maps patterns to React components. The existing StateView becomes a thin wrapper around this pipeline.

**Tech Stack:** TypeScript, React, Bun (runtime), Vitest (testing)

---

## Task 1: Create Pattern Types and Interfaces

**Files:**
- Create: `src/renderer/patterns/types.ts`

**Step 1: Write the types file**

```typescript
// src/renderer/patterns/types.ts

/**
 * Pattern types for ASCII-to-Component recognition
 */

export type PatternType =
  | 'button'
  | 'container'
  | 'table'
  | 'table-row'
  | 'status-indicator'
  | 'text'
  | 'divider'
  | 'header'
  | 'template-variable'
  | 'template-block';

export interface Position {
  row: number;
  col: number;
}

export interface DetectedPattern {
  type: PatternType;
  position: Position;
  content: string;
  label?: string; // For buttons: 'A', 'B', etc.
  children?: DetectedPattern[];
  metadata?: Record<string, unknown>;
}

export interface ButtonPattern extends DetectedPattern {
  type: 'button';
  label: string;
  text: string;
}

export interface ContainerPattern extends DetectedPattern {
  type: 'container';
  title?: string;
  children: DetectedPattern[];
  borderStyle: 'double' | 'single' | 'rounded';
}

export interface TablePattern extends DetectedPattern {
  type: 'table';
  headers: string[];
  rows: TableRowPattern[];
}

export interface TableRowPattern extends DetectedPattern {
  type: 'table-row';
  cells: string[];
  label?: string;
}

export interface StatusPattern extends DetectedPattern {
  type: 'status-indicator';
  status: 'running' | 'stopped' | 'warning' | 'error' | 'unknown';
  symbol: string;
}

export interface HeaderPattern extends DetectedPattern {
  type: 'header';
  text: string;
  level: 1 | 2 | 3;
}

export interface TemplateVariablePattern extends DetectedPattern {
  type: 'template-variable';
  variable: string;
}

export interface TemplateBlockPattern extends DetectedPattern {
  type: 'template-block';
  blockType: 'each' | 'if' | 'with';
  variable: string;
  content: string;
}

export type AnyPattern =
  | ButtonPattern
  | ContainerPattern
  | TablePattern
  | TableRowPattern
  | StatusPattern
  | HeaderPattern
  | TemplateVariablePattern
  | TemplateBlockPattern;

export interface ParsedAscii {
  raw: string;
  lines: string[];
  patterns: DetectedPattern[];
  gridSize: { width: number; height: number };
}
```

**Step 2: Commit**

```bash
git add src/renderer/patterns/types.ts
git commit -m "feat(renderer): add pattern recognition types"
```

---

## Task 2: Create ASCII Lexer

**Files:**
- Create: `src/renderer/patterns/lexer.ts`
- Create: `src/renderer/patterns/__tests__/lexer.test.ts`

**Step 1: Write the lexer test**

```typescript
// src/renderer/patterns/__tests__/lexer.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';

describe('AsciiLexer', () => {
  it('splits ASCII into lines', () => {
    const ascii = `Line 1
Line 2
Line 3`;
    const lexer = new AsciiLexer(ascii);
    expect(lexer.lines).toHaveLength(3);
    expect(lexer.lines[0]).toBe('Line 1');
  });

  it('calculates grid dimensions', () => {
    const ascii = '12345\n1234567890\n123';
    const lexer = new AsciiLexer(ascii);
    expect(lexer.gridSize).toEqual({ width: 10, height: 3 });
  });

  it('gets character at position', () => {
    const ascii = 'ABC\nDEF';
    const lexer = new AsciiLexer(ascii);
    expect(lexer.getChar(0, 0)).toBe('A');
    expect(lexer.getChar(1, 1)).toBe('E');
    expect(lexer.getChar(5, 0)).toBe('');
  });

  it('finds all occurrences of a pattern', () => {
    const ascii = '[A] Task 1\n[B] Task 2\nNo button here';
    const lexer = new AsciiLexer(ascii);
    const matches = lexer.findAll(/\[([A-Z])\]/g);
    expect(matches).toHaveLength(2);
    expect(matches[0].label).toBe('A');
    expect(matches[1].label).toBe('B');
  });

  it('detects box borders', () => {
    const ascii = `┌─────┐
│ Hi  │
└─────┘`;
    const lexer = new AsciiLexer(ascii);
    expect(lexer.isBoxCorner(0, 0)).toBe(true);
    expect(lexer.isBoxCorner(0, 6)).toBe(true);
    expect(lexer.isVerticalBorder(1, 0)).toBe(true);
    expect(lexer.isHorizontalBorder(0, 1)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/lexer.test.ts`
Expected: FAIL with "Cannot find module '../lexer'"

**Step 3: Implement the lexer**

```typescript
// src/renderer/patterns/lexer.ts

import type { Position, ParsedAscii } from './types';

export interface LexerMatch {
  position: Position;
  match: RegExpMatchArray;
  label?: string;
}

export class AsciiLexer {
  public readonly lines: string[];
  public readonly gridSize: { width: number; height: number };

  constructor(private readonly ascii: string) {
    this.lines = ascii.split('\n');
    this.gridSize = {
      width: Math.max(...this.lines.map(l => l.length)),
      height: this.lines.length,
    };
  }

  getChar(row: number, col: number): string {
    if (row < 0 || row >= this.lines.length) return '';
    const line = this.lines[row];
    if (col < 0 || col >= line.length) return '';
    return line[col];
  }

  getLine(row: number): string {
    if (row < 0 || row >= this.lines.length) return '';
    return this.lines[row];
  }

  findAll(pattern: RegExp): LexerMatch[] {
    const matches: LexerMatch[] = [];
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

    this.lines.forEach((line, row) => {
      let match: RegExpExecArray | null;
      const linePattern = new RegExp(globalPattern.source, globalPattern.flags);
      while ((match = linePattern.exec(line)) !== null) {
        matches.push({
          position: { row, col: match.index },
          match,
          label: match[1] || undefined,
        });
      }
    });

    return matches;
  }

  // Box drawing character detection
  isBoxCorner(row: number, col: number): boolean {
    const char = this.getChar(row, col);
    return ['┌', '┐', '└', '┘', '╔', '╗', '╚', '╝', '╠', '╣', '╬', '├', '┤', '┬', '┴', '╦', '╩', '╠', '╣'].includes(char);
  }

  isHorizontalBorder(row: number, col: number): boolean {
    const char = this.getChar(row, col);
    return ['─', '═', '━'].includes(char);
  }

  isVerticalBorder(row: number, col: number): boolean {
    const char = this.getChar(row, col);
    return ['│', '║', '┃'].includes(char);
  }

  isBorder(row: number, col: number): boolean {
    return this.isBoxCorner(row, col) || this.isHorizontalBorder(row, col) || this.isVerticalBorder(row, col);
  }

  // Status indicator detection
  isStatusIndicator(char: string): boolean {
    return ['●', '○', '◐', '◑', '◉', '◎', '⬤', '◯', '◠', '◡'].includes(char);
  }

  getStatusMeaning(char: string): 'running' | 'stopped' | 'warning' | 'error' | 'unknown' {
    const statusMap: Record<string, 'running' | 'stopped' | 'warning' | 'error' | 'unknown'> = {
      '●': 'running',
      '○': 'stopped',
      '◐': 'warning',
      '◑': 'warning',
      '◉': 'error',
      '◎': 'unknown',
    };
    return statusMap[char] || 'unknown';
  }

  // Template variable detection
  findTemplateVariables(): LexerMatch[] {
    return this.findAll(/\{\{([^}]+)\}\}/g);
  }

  // Template block detection ({{#each}}, {{/each}}, etc.)
  findTemplateBlocks(): LexerMatch[] {
    return this.findAll(/\{\{(#|\/)(\w+)(?:\s+(\w+))?\}\}/g);
  }

  // Button detection
  findButtons(): LexerMatch[] {
    return this.findAll(/\[([A-Z0-9])\]\s*(\S.*?)(?=\s*\[|\s*$|\s{2,})/g);
  }

  toParsedAscii(): ParsedAscii {
    return {
      raw: this.ascii,
      lines: this.lines,
      patterns: [],
      gridSize: this.gridSize,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/lexer.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/renderer/patterns/lexer.ts src/renderer/patterns/__tests__/lexer.test.ts
git commit -m "feat(renderer): add ASCII lexer for pattern detection"
```

---

## Task 3: Create Button Pattern Detector

**Files:**
- Create: `src/renderer/patterns/detectors/button.ts`
- Create: `src/renderer/patterns/__tests__/button.test.ts`

**Step 1: Write the button detector test**

```typescript
// src/renderer/patterns/__tests__/button.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectButtons } from '../detectors/button';

describe('Button Detector', () => {
  it('detects single button', () => {
    const ascii = '[A] Tasks';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].type).toBe('button');
    expect(buttons[0].label).toBe('A');
    expect(buttons[0].text).toBe('Tasks');
  });

  it('detects multiple buttons on same line', () => {
    const ascii = '[A] Tasks  [B] Settings  [X] Quit';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(3);
    expect(buttons[0].label).toBe('A');
    expect(buttons[1].label).toBe('B');
    expect(buttons[2].label).toBe('X');
  });

  it('detects numeric labels', () => {
    const ascii = '[1] Option 1  [2] Option 2';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(2);
    expect(buttons[0].label).toBe('1');
    expect(buttons[1].label).toBe('2');
  });

  it('ignores text without button pattern', () => {
    const ascii = 'Regular text [not a button] more text';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(0);
  });

  it('extracts button position', () => {
    const ascii = '  [A] Tasks';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons[0].position).toEqual({ row: 0, col: 2 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/button.test.ts`
Expected: FAIL with "Cannot find module '../detectors/button'"

**Step 3: Implement button detector**

```typescript
// src/renderer/patterns/detectors/button.ts

import type { AsciiLexer } from '../lexer';
import type { ButtonPattern } from '../types';

export function detectButtons(lexer: AsciiLexer): ButtonPattern[] {
  const buttons: ButtonPattern[] = [];
  const pattern = /\[([A-Z0-9])\]\s*([^\s\[\]]+(?:\s+[^\s\[\]]+)*)/g;

  lexer.lines.forEach((line, row) => {
    let match: RegExpExecArray | null;
    const linePattern = new RegExp(pattern.source, pattern.flags);

    while ((match = linePattern.exec(line)) !== null) {
      buttons.push({
        type: 'button',
        position: { row, col: match.index },
        content: match[0],
        label: match[1],
        text: match[2].trim(),
      });
    }
  });

  return buttons;
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/button.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/renderer/patterns/detectors/button.ts src/renderer/patterns/__tests__/button.test.ts
git commit -m "feat(renderer): add button pattern detector"
```

---

## Task 4: Create Container Pattern Detector

**Files:**
- Create: `src/renderer/patterns/detectors/container.ts`
- Create: `src/renderer/patterns/__tests__/container.test.ts`

**Step 1: Write the container detector test**

```typescript
// src/renderer/patterns/__tests__/container.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectContainers } from '../detectors/container';

describe('Container Detector', () => {
  it('detects simple box container', () => {
    const ascii = `┌─────┐
│ Hi  │
└─────┘`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers).toHaveLength(1);
    expect(containers[0].type).toBe('container');
    expect(containers[0].borderStyle).toBe('single');
  });

  it('detects double-line container', () => {
    const ascii = `╔═════╗
║ Hi  ║
╚═════╝`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers).toHaveLength(1);
    expect(containers[0].borderStyle).toBe('double');
  });

  it('extracts container title from header line', () => {
    const ascii = `╔══════════════════════╗
║  MY APP       v1.0   ║
╠══════════════════════╣`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers[0].title).toContain('MY APP');
  });

  it('detects nested containers', () => {
    const ascii = `┌─────────────┐
│ ┌───────┐   │
│ │ Inner │   │
│ └───────┘   │
└─────────────┘`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers.length).toBeGreaterThanOrEqual(2);
  });

  it('calculates container bounds', () => {
    const ascii = `┌─────┐
│ Hi  │
└─────┘`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers[0].metadata?.bounds).toEqual({
      startRow: 0,
      endRow: 2,
      startCol: 0,
      endCol: 7,
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/container.test.ts`
Expected: FAIL with "Cannot find module '../detectors/container'"

**Step 3: Implement container detector**

```typescript
// src/renderer/patterns/detectors/container.ts

import type { AsciiLexer } from '../lexer';
import type { ContainerPattern } from '../types';

interface ContainerBounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export function detectContainers(lexer: AsciiLexer): ContainerPattern[] {
  const containers: ContainerPattern[] = [];
  const visited = new Set<string>();

  // Find top-left corners
  for (let row = 0; row < lexer.gridSize.height; row++) {
    for (let col = 0; col < lexer.gridSize.width; col++) {
      const char = lexer.getChar(row, col);
      if ((char === '┌' || char === '╔') && !visited.has(`${row},${col}`)) {
        const container = findContainerBounds(lexer, row, col);
        if (container) {
          visited.add(`${row},${col}`);
          const title = extractTitle(lexer, container);
          const borderStyle = char === '╔' ? 'double' : 'single';

          containers.push({
            type: 'container',
            position: { row, col },
            content: extractContent(lexer, container),
            title,
            children: [],
            borderStyle,
            metadata: {
              bounds: container,
            },
          });
        }
      }
    }
  }

  return containers;
}

function findContainerBounds(lexer: AsciiLexer, startRow: number, startCol: number): ContainerBounds | null {
  const startChar = lexer.getChar(startRow, startCol);
  const isDouble = startChar === '╔';

  // Find right edge of top border
  let endCol = startCol;
  while (endCol < lexer.gridSize.width) {
    const char = lexer.getChar(startRow, endCol);
    if ((isDouble && char === '╗') || (!isDouble && char === '┐')) {
      break;
    }
    endCol++;
  }

  // Find bottom edge
  let endRow = startRow;
  while (endRow < lexer.gridSize.height) {
    const char = lexer.getChar(endRow, startCol);
    if ((isDouble && char === '╚') || (!isDouble && char === '└')) {
      break;
    }
    endRow++;
  }

  // Verify bottom-right corner
  const bottomRight = lexer.getChar(endRow, endCol);
  const expectedCorner = isDouble ? '╝' : '┘';
  if (bottomRight !== expectedCorner) {
    return null;
  }

  return { startRow, endRow, startCol, endCol };
}

function extractTitle(lexer: AsciiLexer, bounds: ContainerBounds): string | undefined {
  // Look for title in the first content row (usually row after top border)
  const titleRow = bounds.startRow + 1;
  if (titleRow > bounds.endRow) return undefined;

  const line = lexer.getLine(titleRow);
  // Extract text between left and right borders
  const content = line.slice(bounds.startCol + 1, bounds.endCol).trim();
  return content || undefined;
}

function extractContent(lexer: AsciiLexer, bounds: ContainerBounds): string {
  const lines: string[] = [];
  for (let row = bounds.startRow + 1; row < bounds.endRow; row++) {
    const line = lexer.getLine(row);
    const content = line.slice(bounds.startCol + 1, bounds.endCol);
    lines.push(content);
  }
  return lines.join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/container.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/renderer/patterns/detectors/container.ts src/renderer/patterns/__tests__/container.test.ts
git commit -m "feat(renderer): add container pattern detector"
```

---

## Task 5: Create Status Indicator Detector

**Files:**
- Create: `src/renderer/patterns/detectors/status.ts`
- Create: `src/renderer/patterns/__tests__/status.test.ts`

**Step 1: Write the status detector test**

```typescript
// src/renderer/patterns/__tests__/status.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectStatusIndicators } from '../detectors/status';

describe('Status Indicator Detector', () => {
  it('detects running status (●)', () => {
    const ascii = 'Status: ● running';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBe('running');
    expect(statuses[0].symbol).toBe('●');
  });

  it('detects stopped status (○)', () => {
    const ascii = 'Status: ○ stopped';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBe('stopped');
  });

  it('detects warning status (◐)', () => {
    const ascii = 'Warning: ◐ partial';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses[0].status).toBe('warning');
  });

  it('detects multiple status indicators', () => {
    const ascii = `● App 1 running
○ App 2 stopped
◐ App 3 warning`;
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses).toHaveLength(3);
    expect(statuses[0].status).toBe('running');
    expect(statuses[1].status).toBe('stopped');
    expect(statuses[2].status).toBe('warning');
  });

  it('provides position for each indicator', () => {
    const ascii = '  ● Status here';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses[0].position).toEqual({ row: 0, col: 2 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/status.test.ts`
Expected: FAIL with "Cannot find module '../detectors/status'"

**Step 3: Implement status detector**

```typescript
// src/renderer/patterns/detectors/status.ts

import type { AsciiLexer } from '../lexer';
import type { StatusPattern } from '../types';

const STATUS_SYMBOLS: Record<string, StatusPattern['status']> = {
  '●': 'running',
  '○': 'stopped',
  '◐': 'warning',
  '◑': 'warning',
  '◉': 'error',
  '◎': 'unknown',
  '⬤': 'running',
  '◯': 'stopped',
};

export function detectStatusIndicators(lexer: AsciiLexer): StatusPattern[] {
  const statuses: StatusPattern[] = [];
  const statusChars = Object.keys(STATUS_SYMBOLS).join('');

  lexer.lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (STATUS_SYMBOLS[char]) {
        statuses.push({
          type: 'status-indicator',
          position: { row, col },
          content: char,
          status: STATUS_SYMBOLS[char],
          symbol: char,
        });
      }
    }
  });

  return statuses;
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/status.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/renderer/patterns/detectors/status.ts src/renderer/patterns/__tests__/status.test.ts
git commit -m "feat(renderer): add status indicator detector"
```

---

## Task 6: Create Table Pattern Detector

**Files:**
- Create: `src/renderer/patterns/detectors/table.ts`
- Create: `src/renderer/patterns/__tests__/table.test.ts`

**Step 1: Write the table detector test**

```typescript
// src/renderer/patterns/__tests__/table.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectTables } from '../detectors/table';

describe('Table Detector', () => {
  it('detects simple table with headers', () => {
    const ascii = `│ Name    │ Status │
│ App 1   │ ●      │
│ App 2   │ ○      │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables).toHaveLength(1);
    expect(tables[0].type).toBe('table');
    expect(tables[0].headers).toEqual(['Name', 'Status']);
  });

  it('detects table rows with cells', () => {
    const ascii = `│ Name  │ Port │
│ App 1 │ 3000 │
│ App 2 │ 3001 │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0].cells).toEqual(['App 1', '3000']);
  });

  it('detects row labels', () => {
    const ascii = `│ [A] App 1 │ ● │
│ [B] App 2 │ ○ │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables[0].rows[0].label).toBe('A');
    expect(tables[0].rows[1].label).toBe('B');
  });

  it('handles divider rows', () => {
    const ascii = `│ Name  │ Port │
├───────┼──────┤
│ App 1 │ 3000 │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Name', 'Port']);
    expect(tables[0].rows).toHaveLength(1);
  });

  it('detects table position', () => {
    const ascii = `Some text
│ Name │
│ App  │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables[0].position.row).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/table.test.ts`
Expected: FAIL with "Cannot find module '../detectors/table'"

**Step 3: Implement table detector**

```typescript
// src/renderer/patterns/detectors/table.ts

import type { AsciiLexer } from '../lexer';
import type { TablePattern, TableRowPattern } from '../types';

export function detectTables(lexer: AsciiLexer): TablePattern[] {
  const tables: TablePattern[] = [];
  let currentTable: { startRow: number; headers: string[]; rows: TableRowPattern[] } | null = null;

  for (let row = 0; row < lexer.gridSize.height; row++) {
    const line = lexer.getLine(row);

    // Check if line is a table row (starts/ends with │ or ║)
    const isTableRow = /^[│║]/.test(line) && /[│║]$/.test(line);

    if (isTableRow) {
      const cells = parseTableRow(line);
      const labelMatch = cells[0]?.match(/\[([A-Z0-9])\]/);
      const label = labelMatch ? labelMatch[1] : undefined;

      // Clean first cell of label
      if (label) {
        cells[0] = cells[0].replace(/\[[A-Z0-9]\]\s*/, '').trim();
      }

      if (!currentTable) {
        currentTable = {
          startRow: row,
          headers: cells,
          rows: [],
        };
      } else if (isDividerRow(line)) {
        // Divider row - headers are already set, skip
        continue;
      } else {
        currentTable.rows.push({
          type: 'table-row',
          position: { row, col: 0 },
          content: line,
          cells,
          label,
        });
      }
    } else if (currentTable && currentTable.rows.length > 0) {
      // End of table
      tables.push({
        type: 'table',
        position: { row: currentTable.startRow, col: 0 },
        content: '', // Would need to extract
        headers: currentTable.headers,
        rows: currentTable.rows,
      });
      currentTable = null;
    } else if (currentTable) {
      // Reset if table has no rows
      currentTable = null;
    }
  }

  // Handle table at end of file
  if (currentTable && currentTable.rows.length > 0) {
    tables.push({
      type: 'table',
      position: { row: currentTable.startRow, col: 0 },
      content: '',
      headers: currentTable.headers,
      rows: currentTable.rows,
    });
  }

  return tables;
}

function parseTableRow(line: string): string[] {
  // Remove leading and trailing borders
  const content = line.replace(/^[│║]\s*/, '').replace(/\s*[│║]$/, '');

  // Split by cell borders
  const cells = content.split(/\s*[│║]\s*/);

  return cells.map(cell => cell.trim()).filter(cell => cell.length > 0);
}

function isDividerRow(line: string): boolean {
  // Check if row is all dividers (├─┤ or ╠═╣ patterns)
  return /^[│║╠╠├┤][═─┼╬├┤┌┐└┘┬┴]+[│║╣╣├┤]$/.test(line.trim());
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/table.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/renderer/patterns/detectors/table.ts src/renderer/patterns/__tests__/table.test.ts
git commit -m "feat(renderer): add table pattern detector"
```

---

## Task 7: Create Unified Pattern Parser

**Files:**
- Create: `src/renderer/patterns/parser.ts`
- Create: `src/renderer/patterns/__tests__/parser.test.ts`
- Create: `src/renderer/patterns/index.ts`

**Step 1: Write the parser test**

```typescript
// src/renderer/patterns/__tests__/parser.test.ts

import { describe, it, expect } from 'vitest';
import { parseAscii } from '../parser';

describe('Pattern Parser', () => {
  it('parses all pattern types', () => {
    const ascii = `╔══════════════════╗
║  MY APP          ║
╠══════════════════╣
║ [A] Tasks        ║
║ [B] Settings     ║
╠══════════════════╣
║ │ Name │ Status │ ║
║ │ App  │ ●      │ ║
╚══════════════════╝`;
    const result = parseAscii(ascii);

    expect(result.patterns.length).toBeGreaterThan(0);
  });

  it('returns parsed ASCII with grid info', () => {
    const ascii = 'Test\nLine';
    const result = parseAscii(ascii);

    expect(result.gridSize).toEqual({ width: 4, height: 2 });
    expect(result.lines).toHaveLength(2);
  });

  it('filters patterns by type', () => {
    const ascii = '[A] Task\nStatus: ●';
    const result = parseAscii(ascii);

    const buttons = result.patterns.filter(p => p.type === 'button');
    const statuses = result.patterns.filter(p => p.type === 'status-indicator');

    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(statuses.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty input', () => {
    const result = parseAscii('');
    expect(result.patterns).toHaveLength(0);
    expect(result.gridSize).toEqual({ width: 0, height: 1 });
  });

  it('preserves raw ASCII', () => {
    const ascii = '[A] Test';
    const result = parseAscii(ascii);
    expect(result.raw).toBe(ascii);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/parser.test.ts`
Expected: FAIL with "Cannot find module '../parser'"

**Step 3: Implement the parser**

```typescript
// src/renderer/patterns/parser.ts

import { AsciiLexer } from './lexer';
import { detectButtons } from './detectors/button';
import { detectContainers } from './detectors/container';
import { detectStatusIndicators } from './detectors/status';
import { detectTables } from './detectors/table';
import type { ParsedAscii, DetectedPattern } from './types';

export function parseAscii(ascii: string): ParsedAscii {
  const lexer = new AsciiLexer(ascii);
  const patterns: DetectedPattern[] = [];

  // Run all detectors
  patterns.push(...detectButtons(lexer));
  patterns.push(...detectContainers(lexer));
  patterns.push(...detectStatusIndicators(lexer));
  patterns.push(...detectTables(lexer));

  return {
    raw: ascii,
    lines: lexer.lines,
    patterns,
    gridSize: lexer.gridSize,
  };
}
```

**Step 4: Create barrel export**

```typescript
// src/renderer/patterns/index.ts

export * from './types';
export * from './lexer';
export * from './parser';
export * from './detectors/button';
export * from './detectors/container';
export * from './detectors/status';
export * from './detectors/table';
```

**Step 5: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/patterns/__tests__/parser.test.ts`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add src/renderer/patterns/parser.ts src/renderer/patterns/__tests__/parser.test.ts src/renderer/patterns/index.ts
git commit -m "feat(renderer): add unified pattern parser"
```

---

## Task 8: Create React Components for Patterns

**Files:**
- Create: `src/renderer/components/patterns/StatusIcon.tsx`
- Create: `src/renderer/components/patterns/PatternButton.tsx`
- Create: `src/renderer/components/patterns/PatternTable.tsx`
- Create: `src/renderer/components/patterns/PatternCard.tsx`
- Create: `src/renderer/components/patterns/index.ts`

**Step 1: Create StatusIcon component**

```typescript
// src/renderer/components/patterns/StatusIcon.tsx

import React from 'react';
import type { StatusPattern } from '../../patterns/types';

export interface StatusIconProps {
  status: StatusPattern['status'];
  className?: string;
}

const STATUS_STYLES: Record<StatusPattern['status'], { color: string; bg: string }> = {
  running: { color: '#22c55e', bg: '#dcfce7' },
  stopped: { color: '#6b7280', bg: '#f3f4f6' },
  warning: { color: '#f59e0b', bg: '#fef3c7' },
  error: { color: '#ef4444', bg: '#fee2e2' },
  unknown: { color: '#9ca3af', bg: '#e5e7eb' },
};

export function StatusIcon({ status, className = '' }: StatusIconProps) {
  const style = STATUS_STYLES[status];

  return (
    <span
      className={`ascii-status-icon ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: style.bg,
        color: style.color,
        fontSize: '12px',
        fontWeight: 'bold',
      }}
      title={status}
    >
      {status === 'running' && '●'}
      {status === 'stopped' && '○'}
      {status === 'warning' && '◐'}
      {status === 'error' && '✕'}
      {status === 'unknown' && '?'}
    </span>
  );
}
```

**Step 2: Create PatternButton component**

```typescript
// src/renderer/components/patterns/PatternButton.tsx

import React from 'react';
import type { ButtonPattern } from '../../patterns/types';

export interface PatternButtonProps {
  pattern: ButtonPattern;
  onClick: (label: string) => void;
  className?: string;
}

export function PatternButton({ pattern, onClick, className = '' }: PatternButtonProps) {
  return (
    <button
      className={`ascii-pattern-button ${className}`}
      onClick={() => onClick(pattern.label)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#374151',
        border: '1px solid #4b5563',
        borderRadius: '6px',
        color: '#f9fafb',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <span
        style={{
          backgroundColor: '#00d9ff',
          color: '#111827',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '12px',
        }}
      >
        [{pattern.label}]
      </span>
      <span>{pattern.text}</span>
    </button>
  );
}
```

**Step 3: Create PatternTable component**

```typescript
// src/renderer/components/patterns/PatternTable.tsx

import React from 'react';
import type { TablePattern } from '../../patterns/types';
import { StatusIcon } from './StatusIcon';

export interface PatternTableProps {
  pattern: TablePattern;
  onLabelClick?: (label: string) => void;
  className?: string;
}

export function PatternTable({ pattern, onLabelClick, className = '' }: PatternTableProps) {
  return (
    <div className={`ascii-pattern-table ${className}`}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
        }}
      >
        <thead>
          <tr>
            {pattern.headers.map((header, i) => (
              <th
                key={i}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '2px solid #4b5563',
                  color: '#9ca3af',
                  fontWeight: '600',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pattern.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #374151',
                  }}
                >
                  {cellIndex === 0 && row.label ? (
                    <button
                      onClick={() => onLabelClick?.(row.label!)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#00d9ff',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      [{row.label}] {cell}
                    </button>
                  ) : (
                    renderCell(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(cell: string): React.ReactNode {
  // Check for status indicator
  if (cell === '●') return <StatusIcon status="running" />;
  if (cell === '○') return <StatusIcon status="stopped" />;
  if (cell === '◐' || cell === '◑') return <StatusIcon status="warning" />;
  if (cell === '◉') return <StatusIcon status="error" />;
  return cell;
}
```

**Step 4: Create PatternCard component**

```typescript
// src/renderer/components/patterns/PatternCard.tsx

import React from 'react';
import type { ContainerPattern } from '../../patterns/types';

export interface PatternCardProps {
  pattern: ContainerPattern;
  children?: React.ReactNode;
  className?: string;
}

export function PatternCard({ pattern, children, className = '' }: PatternCardProps) {
  const borderStyle = pattern.borderStyle === 'double' ? '2px solid #4b5563' : '1px solid #374151';

  return (
    <div
      className={`ascii-pattern-card ${className}`}
      style={{
        border: borderStyle,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {pattern.title && (
        <div
          className="ascii-card-header"
          style={{
            padding: '12px 16px',
            backgroundColor: '#1f2937',
            borderBottom: borderStyle,
            fontWeight: '600',
          }}
        >
          {pattern.title}
        </div>
      )}
      <div className="ascii-card-content" style={{ padding: '16px' }}>
        {children || <pre style={{ margin: 0 }}>{pattern.content}</pre>}
      </div>
    </div>
  );
}
```

**Step 5: Create barrel export**

```typescript
// src/renderer/components/patterns/index.ts

export * from './StatusIcon';
export * from './PatternButton';
export * from './PatternTable';
export * from './PatternCard';
```

**Step 6: Commit**

```bash
git add src/renderer/components/patterns/
git commit -m "feat(renderer): add pattern-based React components"
```

---

## Task 9: Create AutoRenderer Component

**Files:**
- Create: `src/renderer/components/AutoRenderer.tsx`
- Create: `src/renderer/components/__tests__/AutoRenderer.test.tsx`

**Step 1: Write the AutoRenderer test**

```typescript
// src/renderer/components/__tests__/AutoRenderer.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutoRenderer } from '../AutoRenderer';

describe('AutoRenderer', () => {
  it('renders buttons from ASCII', () => {
    const ascii = '[A] Tasks  [B] Settings';
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders status indicators', () => {
    const ascii = '● Running  ○ Stopped';
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByTitle('running')).toBeInTheDocument();
    expect(screen.getByTitle('stopped')).toBeInTheDocument();
  });

  it('renders tables', () => {
    const ascii = `│ Name  │ Status │
│ App 1 │ ●      │`;
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('calls onControl when button clicked', async () => {
    const ascii = '[A] Tasks';
    const onControl = vi.fn();
    render(<AutoRenderer ascii={ascii} onControl={onControl} />);

    const button = screen.getByRole('button');
    button.click();

    expect(onControl).toHaveBeenCalledWith('A');
  });

  it('falls back to raw ASCII for unrecognized patterns', () => {
    const ascii = 'Just plain text';
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByText('Just plain text')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/AutoRenderer.test.tsx`
Expected: FAIL with "Cannot find module '../AutoRenderer'"

**Step 3: Implement AutoRenderer**

```typescript
// src/renderer/components/AutoRenderer.tsx

import React from 'react';
import { parseAscii } from '../patterns/parser';
import { PatternButton } from './patterns/PatternButton';
import { PatternTable } from './patterns/PatternTable';
import { PatternCard } from './patterns/PatternCard';
import { AsciiView } from './AsciiView';
import type { DetectedPattern, TablePattern, ContainerPattern, ButtonPattern } from '../patterns/types';

export interface AutoRendererProps {
  ascii: string;
  onControl: (label: string) => void;
  className?: string;
  showRawFallback?: boolean;
}

export function AutoRenderer({
  ascii,
  onControl,
  className = '',
  showRawFallback = true,
}: AutoRendererProps) {
  const parsed = parseAscii(ascii);

  // If no patterns detected, show raw ASCII
  if (parsed.patterns.length === 0 && showRawFallback) {
    return <AsciiView content={ascii} className={className} />;
  }

  // Group patterns by type
  const buttons = parsed.patterns.filter((p): p is ButtonPattern => p.type === 'button');
  const tables = parsed.patterns.filter((p): p is TablePattern => p.type === 'table');
  const containers = parsed.patterns.filter((p): p is ContainerPattern => p.type === 'container');

  return (
    <div className={`ascii-auto-renderer ${className}`}>
      {/* Render containers */}
      {containers.map((container, i) => (
        <PatternCard key={`container-${i}`} pattern={container} />
      ))}

      {/* Render tables */}
      {tables.map((table, i) => (
        <PatternTable
          key={`table-${i}`}
          pattern={table}
          onLabelClick={onControl}
        />
      ))}

      {/* Render button bar */}
      {buttons.length > 0 && (
        <div className="ascii-button-bar" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {buttons.map((button, i) => (
            <PatternButton
              key={`button-${i}`}
              pattern={button}
              onClick={onControl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/AutoRenderer.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/renderer/components/AutoRenderer.tsx src/renderer/components/__tests__/AutoRenderer.test.tsx
git commit -m "feat(renderer): add AutoRenderer component for automatic pattern detection"
```

---

## Task 10: Update Barrel Export and Demo

**Files:**
- Modify: `src/renderer/index.ts`
- Modify: `src/renderer/demo/App.tsx`

**Step 1: Update barrel export**

```typescript
// src/renderer/index.ts

export * from './types';
export * from './components/AsciiView';
export * from './components/LabelButton';
export * from './components/StateView';
export * from './components/AutoRenderer';
export * from './hooks/useAsciiState';
export * from './patterns';
export * from './components/patterns';
```

**Step 2: Update demo App to use AutoRenderer**

```typescript
// src/renderer/demo/App.tsx - add AutoRenderer demo section

// Add this import
import { AutoRenderer } from '../components/AutoRenderer';

// Add this section after the existing split view
/*
Or use AutoRenderer for automatic pattern detection:

<AutoRenderer ascii={view} onControl={sendControl} />
*/
```

**Step 3: Commit**

```bash
git add src/renderer/index.ts src/renderer/demo/App.tsx
git commit -m "feat(renderer): export AutoRenderer and update demo"
```

---

## Task 11: Add Integration Test

**Files:**
- Create: `tests/renderer/pattern-recognition.test.ts`

**Step 1: Write integration test**

```typescript
// tests/renderer/pattern-recognition.test.ts

import { describe, it, expect } from 'vitest';
import { parseAscii } from '../../src/renderer/patterns/parser';

describe('Pattern Recognition Integration', () => {
  it('parses real manager dashboard ASCII', () => {
    const ascii = `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER - DASHBOARD                       v1.0.0           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [F] Dashboard  [X] Quit          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SYSTEM HEALTH                                           Last Check: 12:00  ║
║  ┌──────────────────────────────────────────────────────────────────────────┐║
║  │  Project                    Port    Status    Uptime     Last Check      │║
║  ├──────────────────────────────────────────────────────────────────────────┤║
║  │  [1] session-analyzer-app   3421    ● running  2h 30m     12:00          │║
║  │  [2] zion-monitor           3423    ○ stopped  --         --             │║
║  └──────────────────────────────────────────────────────────────────────────┘║
╚══════════════════════════════════════════════════════════════════════════════╝`;

    const result = parseAscii(ascii);

    // Should detect buttons
    const buttons = result.patterns.filter(p => p.type === 'button');
    expect(buttons.length).toBeGreaterThan(0);

    // Should detect at least one container
    const containers = result.patterns.filter(p => p.type === 'container');
    expect(containers.length).toBeGreaterThan(0);

    // Should detect table
    const tables = result.patterns.filter(p => p.type === 'table');
    expect(tables.length).toBeGreaterThan(0);
  });

  it('parses simple app view', () => {
    const ascii = `┌─────────────────────────┐
│  MY TODO APP            │
├─────────────────────────┤
│ [A] Add Task            │
│ [B] View All            │
│ [X] Exit                │
└─────────────────────────┘`;

    const result = parseAscii(ascii);

    const buttons = result.patterns.filter(p => p.type === 'button');
    expect(buttons.length).toBe(3);

    const containers = result.patterns.filter(p => p.type === 'container');
    expect(containers.length).toBeGreaterThanOrEqual(1);
  });
});
```

**Step 2: Run test**

Run: `bun test tests/renderer/pattern-recognition.test.ts`
Expected: PASS (2 tests)

**Step 3: Commit**

```bash
git add tests/renderer/pattern-recognition.test.ts
git commit -m "test(renderer): add pattern recognition integration tests"
```

---

## Task 12: Add Documentation

**Files:**
- Create: `src/renderer/patterns/README.md`

**Step 1: Create documentation**

```markdown
# ASCII Pattern Recognition

## Overview

The pattern recognition system automatically parses ASCII templates and generates React components. This eliminates the need for manual component mapping.

## Supported Patterns

### Buttons
```
[A] Tasks  [B] Settings  [X] Quit
```
→ `<PatternButton>` components

### Containers
```
┌─────────────┐
│ Content     │
└─────────────┘
```
→ `<PatternCard>` component

### Tables
```
│ Name  │ Status │
│ App 1 │ ●      │
│ App 2 │ ○      │
```
→ `<PatternTable>` component

### Status Indicators
- `●` → running (green)
- `○` → stopped (gray)
- `◐` → warning (yellow)
- `◉` → error (red)

## Usage

```tsx
import { AutoRenderer } from '@ascii-world/renderer';

function App() {
  const { view, sendControl } = useAsciiState('http://localhost:3421');

  return <AutoRenderer ascii={view} onControl={sendControl} />;
}
```

## Architecture

```
ASCII Input
    │
    ▼
┌─────────────┐
│ AsciiLexer  │  Tokenizes into lines, chars
└─────────────┘
    │
    ▼
┌─────────────┐
│ Detectors   │  Button, Container, Table, Status
└─────────────┘
    │
    ▼
┌─────────────┐
│ AutoRenderer│  Maps patterns → React components
└─────────────┘
    │
    ▼
React UI
```

## Adding Custom Patterns

1. Create a detector in `src/renderer/patterns/detectors/`
2. Add pattern type to `types.ts`
3. Create React component in `src/renderer/components/patterns/`
4. Update `AutoRenderer` to use the new pattern
```

**Step 2: Commit**

```bash
git add src/renderer/patterns/README.md
git commit -m "docs(renderer): add pattern recognition documentation"
```

---

## Summary

This plan creates a complete pattern recognition system that:

1. **Tokenizes ASCII** into structured elements (Lexer)
2. **Detects patterns** for buttons, containers, tables, status (Detectors)
3. **Generates React components** automatically (AutoRenderer)
4. **Provides fallback** to raw ASCII when patterns aren't recognized

**Pattern Detection Coverage:**

| Pattern | Detection Rule | Component |
|---------|---------------|-----------|
| `[X] label` | Bracket + single char | PatternButton |
| `┌─┐...└─┘` | Box corners | PatternCard |
| `│...│` table | Vertical bars | PatternTable |
| `● ○ ◐` | Circle chars | StatusIcon |

**Total: 12 tasks, ~18 commits**
