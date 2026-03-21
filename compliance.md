# compliance.md

> ASCII World Compliance Specification
>
> This file defines the authoritative format for ASCII World interfaces.
> AI agents write `.ascii` files following these rules.
> GUI renders ONLY what is specified - nothing more, nothing less.

## Philosophy

```
ASCII is the SPEC.
GUI is the RENDERER.
COMPLIANCE is VERIFIED.
```

The ASCII file is the single source of truth. The GUI does not add, interpret, or assume anything beyond what is explicitly written.

---

## Format Specification

### 1. Header Block

Every ASCII file MUST have a header:

```
╔══════════════════════════════════════════════════════════════╗
║  TITLE                                        ver:HASH      ║
╠══════════════════════════════════════════════════════════════╣
```

- **TITLE**: Application name (max 40 chars)
- **ver:HASH**: SHA-256 hash (first 8 chars) of content excluding this line

### 2. Navigation Bar

Optional. If present, must be immediately after header:

```
║  [A] Label1  [B] Label2  [C] Label3  [X] Exit               ║
╠══════════════════════════════════════════════════════════════╣
```

Pattern: `[KEY] Label` where KEY is single uppercase letter or digit

### 3. Content Section

Between separator lines. Supports:

#### Buttons
```
[A] Button Label
```
- KEY: Single uppercase [A-Z] or digit [0-9]
- Label: Text after key (trimmed)
- Rendered as: `<button><kbd>KEY</kbd> Label</button>`

#### Status Indicators
```
● running    ○ stopped    ◐ warning    ◑ paused    ◉ error
```
- Symbol maps to semantic state
- Context word follows symbol
- Rendered as: `<span class="status-{state}">● context</span>`

#### Tables
```
┌──────────────────────────────────────────────────────────────┐
│  Col1          Col2          Col3          Col4              │
├──────────────────────────────────────────────────────────────┤
│  Row1Cell1     Row1Cell2     Row1Cell3     Row1Cell4         │
│  Row2Cell1     Row2Cell2     Row2Cell3     Row2Cell4         │
└──────────────────────────────────────────────────────────────┘
```
- First row after `┌` is header
- Rows between `├` and `└` are data
- Columns separated by 2+ spaces or `│`

#### Cards/Containers
```
┌──────────────────────────────────────────────────────────────┐
│  Title                                                       │
├──────────────────────────────────────────────────────────────┤
│  Content here...                                             │
│  More content...                                             │
└──────────────────────────────────────────────────────────────┘
```
- First line after `┌` is card title
- Content follows after `├`

#### Text
```
Plain text on a line.
  Indented text (preserved).
```
- Rendered as-is
- Leading whitespace preserved

### 4. Footer

Optional action bar:

```
╠══════════════════════════════════════════════════════════════╣
║  [A] Action1  [B] Action2  [X] Exit                         ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Status Symbol Reference

| Symbol | State | CSS Class | Color |
|--------|-------|-----------|-------|
| ● | running | `status-running` | green |
| ○ | stopped | `status-stopped` | gray |
| ◐ | warning | `status-warning` | yellow |
| ◑ | paused | `status-paused` | blue |
| ◉ | error | `status-error` | red |

---

## Compliance Rules

### Rule 1: Strict Rendering
GUI MUST render only what is parsed from ASCII.
GUI MUST NOT add hardcoded elements.
GUI MUST NOT show placeholder content.

### Rule 2: Parse Report
GUI MUST report parsed elements back to sync server:
```json
{
  "type": "parse_report",
  "elements": {
    "buttons": [{"key": "A", "label": "Start"}, ...],
    "statuses": [{"symbol": "●", "state": "running", "context": "Server"}, ...],
    "tables": [{"rows": 3, "cols": 4}, ...],
    "cards": [{"title": "System Health"}, ...]
  },
  "hash": "abc12345"
}
```

### Rule 3: Verification
AI MUST compare parse report against intended elements.
If mismatch detected, AI MUST report discrepancy.

### Rule 4: Empty State
If ASCII contains no parseable elements, GUI shows empty.
No "No content" messages. No placeholders. Empty = empty.

---

## Verification Protocol

```
┌─────────────────────────────────────────────────────────────┐
│  AI                          GUI                            │
│  ├── Writes ASCII ──────────►│                              │
│  │                           ├── Parses ASCII               │
│  │                           ├── Renders elements           │
│  │   ◄───────────────────────┤── Sends parse_report         │
│  ├── Compares:               │                              │
│  │   intended == parsed ?    │                              │
│  │                           │                              │
│  │   ✓ Match → IN SYNC       │                              │
│  │   ✗ Mismatch → ERROR      │                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Example Compliant File

```
╔══════════════════════════════════════════════════════════════╗
║  SERVICE MANAGER                              ver:a1b2c3d4  ║
╠══════════════════════════════════════════════════════════════╣
║  [A] Start All  [B] Stop All  [R] Refresh  [X] Exit         ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  SERVICES                                                    ║
║  ┌──────────────────────────────────────────────────────────┐║
║  │  Name          Port    Status    Uptime                  │║
║  ├──────────────────────────────────────────────────────────┤║
║  │  web-app       3000    ● running  2h 15m                 │║
║  │  api-server    3001    ● running  45m                    │║
║  │  worker        3002    ○ stopped  --                     │║
║  └──────────────────────────────────────────────────────────┘║
║                                                              ║
║  Summary: 2 running, 1 stopped                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

**Expected parse:**
- 4 buttons: Start All, Stop All, Refresh, Exit
- 1 table: 3 rows, 4 cols
- 3 statuses: 2 running, 1 stopped
- 1 text line: "Summary: 2 running, 1 stopped"

---

## Error Codes

| Code | Meaning |
|------|---------|
| E001 | Hash mismatch - content modified |
| E002 | Parse failed - invalid ASCII |
| E003 | Element count mismatch |
| E004 | Unknown symbol |
| E005 | Malformed table |
| E006 | Missing header |

---

## Version

compliance.md v1.0.0
Last updated: 2026-03-21
