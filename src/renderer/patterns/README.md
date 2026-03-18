# Pattern Recognition System

The Pattern Recognition System automatically detects and parses visual elements in ASCII templates, transforming them into React components for rich GUI rendering.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Pattern Recognition Pipeline                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ASCII Input                                                   │
│       │                                                         │
│       ▼                                                         │
│   ┌───────────┐                                                 │
│   │  Lexer    │  Tokenizes ASCII into lines and characters      │
│   └─────┬─────┘                                                 │
│         │                                                       │
│         ▼                                                       │
│   ┌───────────────────────────────────────────────────────┐    │
│   │              Pattern Detectors (parallel)              │    │
│   │  ┌─────────┐ ┌───────────┐ ┌────────┐ ┌───────────┐  │    │
│   │  │ Button  │ │ Container │ │ Status │ │   Table   │  │    │
│   │  └─────────┘ └───────────┘ └────────┘ └───────────┘  │    │
│   └────────────────────────┬──────────────────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│                    ┌──────────────┐                            │
│                    │    Parser    │  Unifies all patterns              │
│                    └──────┬───────┘                            │
│                           │                                     │
│                           ▼                                     │
│                   ParsedPatterns                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Patterns

### 1. Buttons (`[X] label`)

Buttons are detected using the pattern `[X] label` where X is a single uppercase letter.

```
[A] Tasks  [B] Settings  [X] Quit
```

**Properties:**
- `label`: The control label (e.g., 'A', 'B', 'X')
- `text`: The display text (e.g., 'Tasks', 'Settings')

**Component:** `PatternButton`

### 2. Containers (Box Drawing)

Containers are detected using Unicode box-drawing characters.

```
╔══════════════════════════════════════╗
║  Title                                 ║
╠══════════════════════════════════════╣
║  Content                               ║
╚══════════════════════════════════════╝
```

**Supported characters:**
- Corners: `╔ ╗ ╚ ╝ ┌ ┐ └ ┘`
- Horizontal: `═ ─ ─`
- Vertical: `║ │`
- T-junctions: `╠ ╣ ┤ ├`

**Properties:**
- `bounds`: `{ startLine, endLine, startCol, endCol }`
- `title`: Extracted title (if present)

**Component:** `PatternCard`

### 3. Status Indicators

Status indicators use Unicode geometric shapes to represent state.

```
● running    ○ stopped
◐ warning    ◑ paused
◉ error      ◐ unknown
```

**Status mapping:**
| Symbol | Status   | Color   |
|--------|----------|---------|
| ●      | running  | green   |
| ○      | stopped  | gray    |
| ◐      | warning  | yellow  |
| ◑      | paused  | blue    |
| ◉      | error    | red     |

**Properties:**
- `status`: The status value (running/stopped/warning/paused/error/unknown)
- `symbol`: The original ASCII symbol

**Component:** `StatusIcon`

### 4. Tables
Tables are detected using pipe (`│`) column separators.
```
│ Name        │ Port │ Status │
│ My App      │ 3000 │ ●      │
│ API Server  │ 3001 │ ○      │
```

**Properties:**
- `headers`: Column header names
- `rows`: Array of row data
- `label`: Optional row label (e.g., `[1]`)

**Component:** `PatternTable`

## Usage

### Basic Parsing

```typescript
import { parseAscii } from './patterns';

const ascii = `
╔══════════════════════════════════════════════════════════════════════════════╗
║  Dashboard           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ [A] Start  [B] Stop  ║
║ Status: ● running    ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

const result = parseAscii(ascii);
console.log(result.patterns);
// [
//   { type: 'container', bounds: {...} },
//   { type: 'button', label: 'A', text: 'Start' },
//   { type: 'button', label: 'B', text: 'Stop' },
//   { type: 'status-indicator', status: 'running' }
// ]
```

### AutoRenderer Component

```tsx
import { AutoRenderer } from './components/AutoRenderer';

function Dashboard({ ascii, onControl }) {
  return (
    <AutoRenderer
      ascii={ascii}
      onControl={onControl}
      showRawFallback={true}
    />
  );
}
```

### Individual Pattern Components

```tsx
import { PatternButton, StatusIcon, PatternCard } from './components/patterns';

function CustomRender({ patterns }) {
  return (
    <div>
      {patterns.map(pattern => {
        switch (pattern.type) {
          case 'button':
            return <PatternButton key={pattern.id} pattern={pattern} onClick={handleClick} />;
          case 'status-indicator':
            return <StatusIcon key={pattern.id} status={pattern.status} />;
          case 'container':
            return <PatternCard key={pattern.id} pattern={pattern} />;
        }
      })}
    </div>
  );
}
```

### Individual Detectors

```typescript
import { detectButtons } from './patterns/detectors/button';
import { detectContainers } from './patterns/detectors/container';
import { detectStatusIndicators } from './patterns/detectors/status';
import { detectTables } from './patterns/detectors/table';

const lexer = new AsciiLexer(ascii);

// Detect specific pattern types
const buttons = detectButtons(lexer);
const containers = detectContainers(lexer);
const statuses = detectStatusIndicators(lexer);
const tables = detectTables(lexer);
```

## API Reference

### `parseAscii(ascii: string): ParsedPatterns`

Main entry point for pattern detection.

**Returns:**
```typescript
interface ParsedPatterns {
  patterns: DetectedPattern[];  // All detected patterns
  gridSize: { width: number; height: number; };
  lines: string[];              // Tokenized lines
  raw: string;                  // Original ASCII
}
```

### `AsciiLexer`

Low-level ASCII tokenizer.

```typescript
class AsciiLexer {
  constructor(ascii: string);

  getLine(line: number): string | undefined;
  getChar(line: number, col: number): string;
  findAll(char: string): Position[];
  isBoxCorner(char: string): boolean;
  isBorder(char: string): boolean;
}
```

### Pattern Types

```typescript
type PatternType =
  | 'button'
  | 'container'
  | 'table'
  | 'status-indicator';

interface DetectedPattern {
  type: PatternType;
  id: string;
  position: Position;
}

interface ButtonPattern extends DetectedPattern {
  type: 'button';
  label: string;
  text: string;
}

interface ContainerPattern extends DetectedPattern {
  type: 'container';
  bounds: {
    startLine: number;
    endLine: number;
    startCol: number;
    endCol: number;
  };
}

interface StatusPattern extends DetectedPattern {
  type: 'status-indicator';
  status: 'running' | 'stopped' | 'warning' | 'paused' | 'error' | 'unknown';
  symbol: string;
}

interface TablePattern extends DetectedPattern {
  type: 'table';
  headers: string[];
  rows: TableRow[];
}

interface TableRow {
  cells: string[];
  label?: string;
}
```

## Performance

The Pattern detection system is designed for real-time parsing:

- **Lexer**: O(n) where n is the number of characters
- **Detectors**: Run in parallel, each O(m) where m is pattern occurrences
- **Total**: Typically < 50ms for 80x24 templates

## Extending

To add a new pattern type:

1. Create a detector in `detectors/your-pattern.ts`:

```typescript
export function detectYourPattern(lexer: AsciiLexer): YourPattern[] {
  const patterns: YourPattern[] = [];
  // Detection logic here
  return patterns;
}
```

2. Add the type to `types.ts`:

3. Register in `parser.ts`
4. Create a component in `components/patterns/YourPattern.tsx`
5. Add export to `components/patterns/index.ts` and barrel export

## Validation

The project includes comprehensive validation tests:

- **LLM Cross-Validation**: Compares parser output to expected patterns
- **Manager Integration**: Tests against real ASCII output
- **Round-Trip Fidelity**: Ensures accuracy and consistency

Run validation:
```bash
bun test tests/validation/
```

## Demo

Open the visual demo:
```bash
# Start a local server
cd src/renderer/demo
python3 -m http.server 8080 visual-demo.html
# Or open visual-demo.html in a browser
```

---

## ASCII-First Philosophy

This renderer implements the **ASCII-First** development pattern where:
1. ASCII is the source of truth for UI state
2. GUI is a projection/view of the ASCII
3. Pattern detection enables automatic GUI generation
4. LLMs can control apps via ASCII labels
