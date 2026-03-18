# ASCII Reference App

A reference Electrobun application demonstrating **ASCII-first design** for AI agent control.

## Concept

Traditional apps: `Code → GUI → Hope AI can figure it out`
This app: `ASCII Spec → Code → GUI is just a renderer`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ASCII-First Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                           │
│   │ ASCII State │───┐                                       │
│   │  Templates  │   │                                       │
│   └─────────────┘   │                                       │
│                     ▼                                       │
│   ┌─────────────────────────────────────────────────────┐ │
│   │              State Manager (Core Logic)              │ │
│   │   - Handles label commands (A, B, C...)             │ │
│   │   - Manages state transitions                        │ │
│   │   - Exposes Control API                              │ │
│   └─────────────────────────────────────────────────────┘ │
│                     │                                       │
│         ┌──────────┴──────────┐                            │
│         ▼                     ▼                            │
│   ┌───────────┐        ┌───────────┐                      │
│   │ ASCII View│        │  GUI View │                      │
│   │  (AI)     │        │  (Human)  │                      │
│   └───────────┘        └───────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
ascii-ref-app/
├── src/
│   ├── ascii/
│   │   ├── states/
│   │   │   ├── home.ascii      # Main dashboard
│   │   │   ├── tasks.ascii     # Task list view
│   │   │   └── settings.ascii  # Settings panel
│   │   └── bindings.json       # Label → Action mappings
│   ├── bun/
│   │   ├── index.ts            # Electrobun main process
│   │   └── state-manager.ts    # State machine logic
│   └── mainview/
│       ├── index.html          # GUI mirroring ASCII state
│       ├── index.ts
│       └── index.css
├── package.json
└── electrobun.config.ts
```

## States

| State | Description | Key Bindings |
|-------|-------------|--------------|
| HOME | Main dashboard | [A] Tasks, [B] Settings, [D] Run |
| TASKS | Task management | [N] New, [T] Toggle, [D] Delete |
| SETTINGS | Configuration | [E] Toggle, [K] Save, [L] Reset |

## Control API

```bash
# Get current ASCII view
GET /ascii

# Get bindings for current state
GET /bindings

# Execute a labeled action
POST /control { "label": "A" }
```

## AI Usage

The AI agent can:
1. Fetch the ASCII view (`GET /ascii`)
2. Read the bindings (`GET /bindings`)
3. Execute actions by label (`POST /control { "label": "A" }`)
4. Observe state changes in the next ASCII view

This eliminates:
- Screenshot capture overhead
- Image-to-text conversion
- Pixel coordinate calculations

## Development

```bash
# Install dependencies
bun install

# Run in development
bun dev

# Build for production
bun build
```

## ASCII-First Principles

1. **State as Text** - Every state has an ASCII representation
2. **Labels as Handles** - Every interactive element has a label [A-Z]
3. **Bindings as Contract** - Labels map to semantic actions
4. **GUI as Renderer** - The GUI is just one way to visualize state
