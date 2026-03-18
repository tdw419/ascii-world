# AI Building Software with ASCII-First Architecture

## Overview

ASCII-First Architecture enables AI agents to build working software by designing in plain text. The ASCII view is both the specification AND the running application.

## Two Modes of Operation

### 1. ASCII as Architectural Plan

The AI designs the software in ASCII first. This IS the spec—not a mockup, not a diagram—the actual running application.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TODO APP                                                   v1.0.0           │
├─────────────────────────────────────────────────────────────────────────────┤
│  [A] All Tasks  [B] Active  [C] Completed  [D] Settings  [X] Quit          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TASKS (3 total, 1 completed)                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  [1] ☐ Buy groceries                                              [X]  │  │
│  │  [2] ☐ Call mom                                                   [X]  │  │
│  │  [3] ☑ Finish project                                             [X]  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [N] New Task  [E] Edit  [D] Delete  [space] Toggle                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**AI workflow:**
1. Describe what you want → AI generates ASCII template
2. You read it → "Yes, that's the layout I want"
3. AI adds `bindings.json` → Defines what each key does
4. **It runs.** The ASCII view is the app.

### 2. ASCII as GUI Renderer Target

The same ASCII can render to rich GUIs:

```
ASCII Template                    GUI Renderer                    Output
     │                                 │                            │
     │    ┌─────────────┐              │                            │
     └───>│ [A] Tasks   │───React──────┼───> Beautiful buttons     │
          │ [B] Settings│              │     Icons, colors          │
          └─────────────┘              │     Animations             │
                                       │                            │
                                       └───Electron───> Desktop app
                                       └───React Native─> Mobile app
```

**The ASCII is the source of truth.** GUIs are just renderers.

---

## How AI Builds With This

### Step 1: Design in ASCII

AI creates the visual layout as text:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER MANAGEMENT                                             v1.0.0         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [A] List  [B] Add User  [C] Roles  [D] Audit Log  [X] Quit                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USERS (127 total, 12 active now)                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  [1] Alice    alice@example.com      Admin      ● Active              │  │
│  │  [2] Bob      bob@example.com        User       ○ Offline             │  │
│  │  [3] Carol    carol@example.com      Editor     ● Active              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [E] Edit  [D] Delete  [R] Reset Password  [S] Suspend                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 2: Define Bindings

AI creates the interaction logic:

```json
{
  "bindings": [
    { "label": "A", "action": "list_users", "target": "LIST" },
    { "label": "B", "action": "add_user", "target": "ADD_FORM" },
    { "label": "1-9", "action": "select_user", "target": null },
    { "label": "E", "action": "edit_user", "target": "EDIT_FORM" },
    { "label": "D", "action": "delete_user", "target": null }
  ],
  "stateTransitions": {
    "LIST": { "A": "LIST", "B": "ADD_FORM", "X": "QUIT" },
    "ADD_FORM": { "A": "LIST", "X": "LIST" }
  }
}
```

### Step 3: It Works

- The ASCII view renders
- Keys trigger actions
- State machine handles navigation
- **No frontend code written yet**

### Step 4: Add GUI with ASCII World Renderer

Use the `@ascii-world/renderer` package to render ASCII state as React:

```bash
bun add @ascii-world/renderer
```

```tsx
import { useAsciiState, StateView, AsciiView } from '@ascii-world/renderer';

function App() {
  const { state, view, sendControl } = useAsciiState('http://localhost:3421');

  return (
    <div className="split-view">
      <StateView state={state} bindings={bindings} onControl={sendControl} />
      <AsciiView content={view} />
    </div>
  );
}
```

The renderer uses the same JSON state that feeds the ASCII templates, so GUI and ASCII are always in sync.

---

## Why This Is Powerful for AI

| Traditional | ASCII-First |
|-------------|-------------|
| AI writes React code | AI writes text |
| Debug visual issues | Debug text (easy) |
| Stakeholders can't read code | Stakeholders read ASCII |
| Mockups thrown away | Mockups ARE the app |
| Frontend + backend separate | Same artifact for both |

**The killer feature:** AI can iterate on ASCII in seconds, you can review it instantly, and it becomes the running application.

---

## Example: AI Builds a Dashboard

**You:** "Build me a metrics dashboard with CPU, memory, and disk stats"

**AI creates:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SYSTEM METRICS                                             v1.0.0          │
├─────────────────────────────────────────────────────────────────────────────┤
│  [A] Overview  [B] CPU  [C] Memory  [D] Disk  [E] Network  [X] Quit        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CPU USAGE                                          ████████████░░░  78%    │
│  MEMORY                                             ██████████████░  92%    │
│  DISK (/)                                           ████████░░░░░░░  54%    │
│                                                                             │
│  PROCESSES (142 running)                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  PID    NAME              CPU%   MEM%    STATUS                       │  │
│  │  1234   node              12.3   4.2     ● Running                    │  │
│  │  5678   python            8.1    2.1     ● Running                    │  │
│  │  9012   postgres          3.2    8.4     ● Running                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [R] Refresh  [K] Kill Process  [1-9] Select                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**30 seconds later:** It's a working app. No React, no CSS, no HTML. Just ASCII + bindings.

**Later:** Add a React renderer to make it pretty. But the functionality is already there.

---

## Project Structure

```
my-app/
├── src/
│   └── ascii/
│       ├── bindings.json          # Label-to-action mappings
│       └── states/
│           ├── main.ascii         # Main view
│           ├── settings.ascii     # Settings view
│           └── detail.ascii       # Detail view
├── package.json
└── ascii-server.ts                # Serves the ASCII views
```

---

## The Feedback Loop

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   You ask    │────>│  AI designs  │────>│  You review  │
│  "Build X"   │     │  in ASCII    │     │  "Change Y"  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
         ┌──────────────────────────────────────┘
         ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  AI updates  │────>│  It runs     │────>│  Ship it     │
│  the ASCII   │     │  instantly   │     │  (or GUI)    │
└──────────────┘     └──────────────┘     └──────────────┘
```

No compile step. No bundle step. Edit text → see result.

---

## See Also

- [ASCII World](./ASCII-WORLD.md) — Full API reference and platform overview
- [AI Control Guide](./AI-CONTROL-GUIDE.md) — How AI agents control apps
- [ASCII-First Architecture](./ASCII-FIRST-ARCHITECTURE.md) — Design philosophy
