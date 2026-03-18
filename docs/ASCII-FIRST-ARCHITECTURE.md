# ASCII-First Interface Architecture

## Overview

The ASCII-First Interface is a design pattern that makes applications controllable by AI agents through a text-based interface. Instead of AI agents trying to parse complex GUIs or APIs, they interact with a simple 80x24 character grid with labeled interactive elements.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐              │
│   │   AI Agent   │────▶│  MCP Bridge  │────▶│  ASCII API   │              │
│   │  (Claude)    │     │              │     │              │              │
│   └──────────────┘     └──────────────┘     └──────────────┘              │
│          │                    │                    │                       │
│          │                    │                    ▼                       │
│          │                    │           ┌──────────────┐                │
│          │                    │           │   Session    │                │
│          │                    └──────────▶│  Analyzer    │                │
│          │                                │     App      │                │
│          │                                └──────────────┘                │
│          │                                       │                         │
│          ▼                                       ▼                         │
│   ┌──────────────┐                       ┌──────────────┐                │
│   │    Human     │◀──────────────────────│     GUI      │                │
│   │    User      │     Visual Labels     │   (React)    │                │
│   └──────────────┘     [A] [B] [C]        └──────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Screen as Source of Truth

The ASCII representation is the authoritative state of the application. Both humans and AI agents see the same information, just rendered differently:

- **Humans**: See a GUI with buttons, forms, and visual styling
- **AI Agents**: See an 80x24 text grid with labeled elements

### 2. Label-Based Control

Every interactive element has a unique label (`[A]`, `[B]`, `[C]`, etc.). To interact with an element, you send its label - not coordinates, not CSS selectors, not XPath.

```
┌─[A] Dashboard───┬─[B] Sources────┬─[C] Config─────┬─[D] History────┐
│                 │                │                │                │
│  Status: READY  │  [E] Add       │  [1] Project   │  Total: 42     │
│  Runs: 5        │  [F] Export    │  [2] Schedule  │  Success: 95%  │
│                 │                │  [3] Model     │                │
│  [E] Run Now    │                │  [W] Save      │  [E] Refresh   │
│                 │                │  [Z] Reset     │                │
└─────────────────┴────────────────┴────────────────┴────────────────┘
```

### 3. GUI-ASCII Symmetry

The GUI displays the same labels that appear in the ASCII view. This creates a shared vocabulary between humans and AI:

```
GUI Button:  [E] Run Now    ←→    ASCII:  [E] Run Now
GUI Tab:     [C] Config     ←→    ASCII:  [C] Config
```

## Architecture Components

### 1. ASCII Templates

Located in `src/ascii/states/`, these define the layout for each application state:

```
src/ascii/states/
├── dashboard.ascii    # Main dashboard view
├── sources.ascii      # Source management
├── config.ascii       # Configuration panel
└── history.ascii      # Run history
```

Template format uses Mustache-style variables:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  SESSION ANALYZER                                          v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Dashboard  [B] Sources  [C] Config  [D] History        [X] Quit         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Status: {{app_status}}      Last Run: {{last_run}}                          ║
║  Path: {{project_path}}                                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 2. Bindings Configuration

`src/ascii/bindings.json` maps labels to actions:

```json
{
  "bindings": [
    { "label": "A", "action": "goto_dashboard", "target": "DASHBOARD" },
    { "label": "E", "action": "primary_action", "target": null },
    { "label": "W", "action": "save_config", "target": null }
  ],
  "stateTransitions": {
    "DASHBOARD": { "A": "DASHBOARD", "B": "SOURCES", "C": "CONFIG" }
  },
  "rpcMapping": {
    "goto_dashboard": { "method": "ui.setState", "params": { "state": "DASHBOARD" } },
    "primary_action": { "method": "action.executePrimary", "params": {} }
  }
}
```

### 3. ASCII Generator

`src/bun/ascii-generator.ts` renders templates with data:

```typescript
class AsciiGenerator {
  render(viewData: ViewData): string {
    // 1. Load template for current state
    // 2. Substitute {{variables}}
    // 3. Process {{#each}} loops
    // 4. Process {{#if}} conditionals
    // 5. Return rendered ASCII
  }
}
```

### 4. Control API

HTTP endpoints on port 3421:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/view` | GET | Current ASCII screen |
| `/control` | POST | Execute action by label |
| `/metrics` | GET | Latency statistics |
| `/bindings` | GET | Label-to-action mappings |

### 5. MCP Bridge

Python MCP server that wraps the HTTP API:

```
mcp_ascii_bridge/
├── src/mcp_ascii_bridge/
│   ├── __init__.py
│   └── server.py          # MCP server implementation
├── tests/
│   └── test_server.py     # Unit tests
├── skill/
│   └── mcp-ascii-control.md
├── docs/
│   └── INTEGRATION.md
├── pyproject.toml
└── README.md
```

## Data Flow

### Human User Flow

```
1. User sees GUI with labeled buttons: [E] Run Now
2. User clicks button
3. GUI calls internal handler
4. State changes
5. GUI updates
6. ASCII view updates (in parallel)
```

### AI Agent Flow

```
1. Agent calls ascii_view to get current screen
2. Agent parses screen, sees: [E] Run Now
3. Agent calls ascii_control with label="E"
4. Server looks up label in bindings.json
5. Server executes mapped action
6. State changes
7. Agent calls ascii_view again to verify
```

## Control API Details

### GET /view

Returns the current ASCII representation:

```bash
curl http://localhost:3421/view
```

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  SESSION ANALYZER                                          v1.0.0              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Dashboard  [B] Sources  [C] Config  [D] History        [X] Quit         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Status: READY              Last Run: 2026-03-18 10:30                       ║
║  Path: /home/user/project                                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  METRICS                                                                     ║
║  ┌────────────────┬────────────────┐                                        ║
║  │ Runs Today     │ 5              │                                        ║
║  │ Success Rate   │ 100%           │                                        ║
║  └────────────────┴────────────────┘                                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [E] Run Analysis                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### POST /control

Execute an action by label:

```bash
curl -X POST http://localhost:3421/control \
  -H "Content-Type: application/json" \
  -d '{"label": "C"}'
```

Response:
```json
{
  "status": "ok",
  "state": "CONFIG",
  "action": "goto_config",
  "latencyMs": 2.34
}
```

### GET /metrics

Performance statistics:

```bash
curl http://localhost:3421/metrics
```

```json
{
  "requests": 42,
  "totalLatencyMs": 156.7,
  "minLatencyMs": 1.2,
  "maxLatencyMs": 8.9,
  "avgLatencyMs": 3.73,
  "lastAction": "E",
  "lastActionTime": 1710745800000
}
```

## MCP Tools

The MCP bridge exposes 5 tools:

### ascii_view

Get the current ASCII screen. No parameters required.

```json
{
  "name": "ascii_view",
  "description": "Get current ASCII screen (80x24 grid)",
  "inputSchema": { "type": "object", "properties": {} }
}
```

### ascii_control

Execute an action by label:

```json
{
  "name": "ascii_control",
  "inputSchema": {
    "type": "object",
    "properties": {
      "label": {
        "type": "string",
        "description": "Single character label (A-Z or 1-5)",
        "pattern": "^[A-Z1-5]$"
      }
    },
    "required": ["label"]
  }
}
```

### ascii_navigate

Navigate directly to a state:

```json
{
  "name": "ascii_navigate",
  "inputSchema": {
    "type": "object",
    "properties": {
      "target": {
        "type": "string",
        "enum": ["DASHBOARD", "SOURCES", "CONFIG", "HISTORY"]
      }
    },
    "required": ["target"]
  }
}
```

### ascii_metrics

Get API performance metrics.

### ascii_bindings

Get the complete label-to-action reference.

## Label Reference

### Navigation (All States)

| Label | Action | State |
|-------|--------|-------|
| `A` | Dashboard | DASHBOARD |
| `B` | Sources | SOURCES |
| `C` | Config | CONFIG |
| `D` | History | HISTORY |
| `X` | Back/Quit | (context) |

### Dashboard Actions

| Label | Action |
|-------|--------|
| `E` | Run Analysis |
| `F` | Export Report |
| `G` | Open Profile |

### Config Sections

| Label | Section |
|-------|---------|
| `1` | Project |
| `2` | Schedule |
| `3` | Model |
| `4` | Prompts |
| `5` | Notifications |

### Config Actions

| Label | Action |
|-------|--------|
| `W` | Save Config |
| `Y` | Save Profile As |
| `Z` | Reset Defaults |

### Sources Actions

| Label | Action |
|-------|--------|
| `E` | Add Source |
| `L` | Browse |
| `M` | Add Custom Path |

### History Actions

| Label | Action |
|-------|--------|
| `E` | Refresh |
| `H` | Show All |
| `I` | Show Today |
| `K` | Show Errors |

## Configuration

### Claude Code MCP Setup

Add to `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "ascii-control": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/path/to/mcp_ascii_bridge",
        "python",
        "-m",
        "mcp_ascii_bridge.server"
      ],
      "env": {
        "ASCII_API_URL": "http://localhost:3421"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASCII_API_URL` | `http://localhost:3421` | ASCII Control API URL |
| `ASCII_BINDINGS_PATH` | (auto) | Path to bindings.json |

## Performance

The ASCII interface is designed for sub-10ms latency:

| Endpoint | Typical | Max |
|----------|---------|-----|
| `/view` | < 5ms | 10ms |
| `/control` | < 3ms | 10ms |
| `/metrics` | < 1ms | 5ms |

## Benefits

### For AI Agents

1. **Simple Parsing**: 80x24 text grid is trivial to parse
2. **No Coordinate Hell**: Use labels, not pixel positions
3. **State Visibility**: Full application state visible in one view
4. **Low Latency**: Sub-10ms responses
5. **Token Efficient**: ASCII text is compact

### For Human Users

1. **Keyboard Shortcuts**: Labels double as keyboard shortcuts
2. **Accessibility**: Screen readers can read labels
3. **Power User**: Quick navigation without mouse
4. **Debugging**: See exactly what the AI sees

### For Developers

1. **Single Source of Truth**: One state machine
2. **Testable**: Easy to test label-based navigation
3. **Documented**: Labels are self-documenting
4. **Extensible**: Add new states and labels easily

## File Structure

```
session-analyzer-app/
├── src/
│   ├── ascii/
│   │   ├── states/
│   │   │   ├── dashboard.ascii
│   │   │   ├── sources.ascii
│   │   │   ├── config.ascii
│   │   │   └── history.ascii
│   │   └── bindings.json
│   ├── bun/
│   │   ├── ascii-generator.ts
│   │   ├── ascii-state-manager.ts
│   │   └── api.ts
│   └── mainview/
│       ├── index.html      # GUI with data-label attributes
│       ├── index.css       # Label styling
│       └── index.ts        # ASCII panel sync
├── mcp_ascii_bridge/
│   ├── src/mcp_ascii_bridge/
│   │   ├── __init__.py
│   │   └── server.py
│   ├── tests/
│   │   └── test_server.py
│   ├── skill/
│   │   └── mcp-ascii-control.md
│   ├── docs/
│   │   └── INTEGRATION.md
│   ├── pyproject.toml
│   └── README.md
└── README.md
```

## Usage Examples

### Via HTTP API

```bash
# Get current view
curl http://localhost:3421/view

# Navigate to config
curl -X POST http://localhost:3421/control -d '{"label":"C"}'

# Save config
curl -X POST http://localhost:3421/control -d '{"label":"W"}'

# Go back to dashboard
curl -X POST http://localhost:3421/control -d '{"label":"A"}'
```

### Via mcp2cli

```bash
# List tools
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" --list

# Get view
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" ascii-view

# Navigate
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" ascii-navigate --target CONFIG

# Execute action
mcp2cli --mcp-stdio "uv run mcp-ascii-bridge" ascii-control --label E
```

### In Claude Code

Once configured, use natural language:

```
"Show me the current state of the app"
→ Claude calls ascii_view

"Navigate to the Config tab"
→ Claude calls ascii_navigate with target="CONFIG"

"Run the analysis"
→ Claude calls ascii_control with label="E"
```

## Troubleshooting

### Connection Errors

```
Error: Cannot reach ASCII API at http://localhost:3421
```

Solution: Start the session-analyzer-app first.

### Unknown Label

```
Error: Unknown label 'Q'
```

Solution: Check bindings.json for valid labels. Call ascii_bindings to see all available labels.

### MCP Server Not Found

Solution:
1. Verify ~/.claude/.mcp.json exists and is valid JSON
2. Restart Claude Code
3. Check the path in mcpServers configuration

## Future Enhancements

1. **WebSocket Streaming**: Real-time ASCII updates
2. **Multi-App Support**: Control multiple apps from one MCP bridge
3. **ASCII Themes**: Different visual styles for the ASCII output
4. **Recording/Playback**: Record ASCII sessions for debugging
5. **State Snapshots**: Save and restore application states

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-18
**Authors:** Claude Code + Agent Team
