# ASCII-First Design Pattern

## Overview

The **ASCII-First** pattern is an architectural approach where the text-mode view serves as the single source of truth for application state. The GUI is a reactive mirror of the ASCII representation, not the other way around.

## Core Principles

1. **Screen as the Hard Drive** - The ASCII view defines the complete state space
2. **Label-Based Control** - All interactions use single-character labels [A], [B], [C]...
3. **Unified Control Path** - GUI clicks and API calls trigger identical code paths
4. **Visual Correlation** - GUI elements show their corresponding ASCII labels

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AI / Human                            │
│            (sends labels: "A", "B", "C")                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Control API (Port 3421)                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ GET    │  │ GET     │  │ POST    │  │ GET     │     │
│  │ /view  │  │ /state  │  │ /control│  │ /metrics│     │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  StateManager   │     │ AsciiGenerator  │
│  - currentState │     │  - templates    │
│  - tasks[]      │     │  - render()    │
│  - settings     │     └────────┬────────┘
└────────┬────────┘              │
         │                       │
         └───────────┬───────────┘
                     ▼
          ┌─────────────────────┐
          │  ASCII View (.ascii)│
          │  +----------------+ │
          │  | [A] Action 1   | │
          │  | [B] Action 2   | │
          │  +----------------+ │
          └──────────┬──────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │  GUI Mirror (HTML)   │
          │  ┌────────────────┐  │
          │  │ [A] Button 1   │  │
          │  │ [B] Button 2   │  │
          │  └────────────────┘  │
          └─────────────────────┘
```

## File Structure

```
src/
├── ascii/
│   ├── bindings.json      # Label → Action mappings
│   └── states/
│       ├── home.ascii     # ASCII template
│       ├── tasks.ascii
│       └── settings.ascii
├── bun/
│   ├── state-manager.ts   # Central state machine
│   ├── ascii-generator.ts # Template engine
│   ├── control-api.ts    # HTTP API (port 3421)
│   ├── ai-controller.ts  # AI exploration utility
│   └── index.ts          # App entry point
└── mainview/
    ├── index.html         # GUI mirror
    ├── index.css
    └── index.ts           # GUI logic
```

## Key Components

### bindings.json

Maps labels to actions. Used by both StateManager (runtime) and GUI (label display).

```json
{
  "stateTransitions": {
    "HOME": {
      "A": "TASKS",
      "B": "SETTINGS"
    },
    "TASKS": {
      "H": "HOME"
    }
  }
}
```

### StateManager

- Holds application state (currentState, tasks[], settings)
- `handleAction(label)` → looks up action in bindings.json → executes state machine
- `getData()` → returns state snapshot for rendering

### AsciiGenerator

- Loads .ascii templates
- `render(stateManager)` → replaces `{{variables}}` and `{{#each}}` loops
- Returns pure text for API /view endpoint

### Control API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/view` | GET | Rendered ASCII view |
| `/state` | GET | Raw JSON state |
| `/control` | POST | `{ "label": "A" }` triggers action |
| `/metrics` | GET | Latency & request stats |

## Latency Targets

- **API Response**: < 10ms (local)
- **GUI Sync**: < 100ms (via 1s polling interval)
- **State Transition**: < 50ms end-to-end

## Usage

### Running the App

```bash
cd apps/ascii-ref-app
bun run src/bun/index.ts
```

### AI Control Script

```bash
# Explore the app randomly
bun run src/bun/ai-controller.ts explore

# Measure latency
bun run src/bun/ai-controller.ts latency

# Both
bun run src/bun/ai-controller.ts both
```

### Manual API Testing

```bash
# Get current view
curl http://localhost:3421/view

# Get raw state
curl http://localhost:3421/state

# Trigger action (go to tasks)
curl -X POST http://localhost:3421/control \
  -H "Content-Type: application/json" \
  -d '{"label": "A"}'

# Get metrics
curl http://localhost:3421/metrics
```

## Benefits

1. **AI-Ready** - Any LLM can control the app via simple HTTP calls
2. **Debuggable** - ASCII view is human-readable, easy to log/diff
3. **Deterministic** - State machine is explicit, not buried in UI event handlers
4. **Portable** - ASCII works everywhere; GUI is optional
5. **Testable** - Verify behavior via API without GUI

## Anti-Patterns to Avoid

- ❌ GUI as the source of truth
- ❌ Complex event handlers that bypass state manager
- ❌ Hardcoded labels in GUI that differ from bindings.json
- ❌ State mutations outside StateManager
