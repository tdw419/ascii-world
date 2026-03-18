# @ascii-world/renderer

React-based renderer for ASCII World applications.

## Overview

This renderer converts ASCII state into React components. It uses the JSON state from `/state` endpoint (not the ASCII text) to generate GUI components, ensuring GUI and ASCII stay in sync.

## Installation

```bash
bun add @ascii-world/renderer
```

## Usage

```tsx
import { useAsciiState, StateView, AsciiView } from '@ascii-world/renderer';

function App() {
  const { state, view, sendControl } = useAsciiState('http://localhost:3421');

  return (
    <div>
      <StateView
        state={state}
        bindings={bindings}
        onControl={sendControl}
      />
      <AsciiView content={view} />
    </div>
  );
}
```

## Components

### `<StateView />`
Auto-renders state based on bindings.json. Shows available labels as buttons.

### `<AsciiView />`
Displays raw ASCII output in a monospace grid.

### `<LabelButton />`
Individual labeled button that calls `onControl(label)` on click.

## Hooks

### `useAsciiState(apiUrl, pollInterval?)`
Fetches state from API and provides `sendControl` function.

Returns:
- `state` - Current application state
- `view` - Raw ASCII text
- `loading` - Loading state
- `error` - Error message if any
- `sendControl(label)` - Send control command
- `refresh()` - Manually refresh state

## Architecture

```
┌─────────────────┐
│  ASCII Server   │
│  (port 3421)    │
└────────┬────────┘
         │ /state, /view
         ▼
┌─────────────────┐
│  useAsciiState  │
│  (hook)         │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────┐
│StateView│ │AsciiView│
│ (GUI)  │  │ (Text) │
└───────┘  └───────┘
```

## Demo

```bash
cd src/renderer
bun install
bun dev
```

Open http://localhost:5173 (requires an ASCII app running on port 3421).
