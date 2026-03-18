# ASCII Render Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable renderer that converts ASCII state (state name + data + bindings) into React components, proving the "same ASCII becomes GUI" promise.

**Architecture:** The renderer takes the JSON state from `/state` endpoint and `bindings.json` as input, then generates React components. It doesn't parse ASCII text directly—instead, it uses the same data that feeds the ASCII generator. This ensures GUI and ASCII are always in sync since they share the same source of truth.

**Tech Stack:** TypeScript, React, Vite (for dev server), Bun (runtime)

---

## Task 1: Create Renderer Package Structure

**Files:**
- Create: `src/renderer/index.ts`
- Create: `src/renderer/types.ts`
- Create: `src/renderer/package.json`
- Create: `src/renderer/tsconfig.json`

**Step 1: Create package directory and types**

```typescript
// src/renderer/types.ts

/**
 * Core types for the ASCII Render Layer
 */

export interface AsciiBinding {
  label: string;
  action: string;
  target: string | null;
  description: string;
}

export interface AsciiBindings {
  version: string;
  description: string;
  bindings: AsciiBinding[];
  stateTransitions: Record<string, Record<string, string>>;
  metadata: {
    appName: string;
    version: string;
    gridSize: { width: number; height: number };
    labelFormat: string;
  };
}

export interface AsciiState {
  state: string;
  [key: string]: unknown;
}

export interface RenderContext {
  state: AsciiState;
  bindings: AsciiBindings;
  onControl: (label: string) => void;
}

export interface ComponentRenderer {
  (context: RenderContext): React.ReactNode;
}
```

**Step 2: Create package.json**

```json
{
  "name": "@ascii-world/renderer",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "vite dev"
  },
  "dependencies": {
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create index.ts barrel**

```typescript
// src/renderer/index.ts

export * from './types';
export * from './components/AsciiView';
export * from './components/LabelButton';
export * from './components/StateView';
export * from './hooks/useAsciiState';
```

**Step 5: Commit**

```bash
git add src/renderer/
git commit -m "feat(renderer): create package structure and types"
```

---

## Task 2: Implement Core Components

**Files:**
- Create: `src/renderer/components/LabelButton.tsx`
- Create: `src/renderer/components/AsciiView.tsx`
- Create: `src/renderer/components/StateView.tsx`

**Step 1: Write LabelButton component test**

```typescript
// src/renderer/components/__tests__/LabelButton.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelButton } from '../LabelButton';

describe('LabelButton', () => {
  it('renders with label and children', () => {
    render(<LabelButton label="A" onClick={() => {}}>View Tasks</LabelButton>);
    expect(screen.getByText('[A]')).toBeInTheDocument();
    expect(screen.getByText('View Tasks')).toBeInTheDocument();
  });

  it('calls onClick with label when clicked', () => {
    const handleClick = vi.fn();
    render(<LabelButton label="B" onClick={handleClick}>Settings</LabelButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith('B');
  });

  it('applies custom className', () => {
    render(<LabelButton label="C" onClick={() => {}} className="custom">Test</LabelButton>);
    expect(screen.getByRole('button')).toHaveClass('custom');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/LabelButton.test.tsx`
Expected: FAIL with "Cannot find module '../LabelButton'"

**Step 3: Implement LabelButton**

```typescript
// src/renderer/components/LabelButton.tsx

import React from 'react';

export interface LabelButtonProps {
  label: string;
  onClick: (label: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function LabelButton({ label, onClick, children, className = '', disabled = false }: LabelButtonProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick(label);
    }
  };

  return (
    <button
      className={`ascii-label-button ${className}`}
      onClick={handleClick}
      disabled={disabled}
      data-label={label}
    >
      <span className="ascii-label-tag">[{label}]</span>
      <span className="ascii-label-text">{children}</span>
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/LabelButton.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/renderer/components/LabelButton.tsx src/renderer/components/__tests__/
git commit -m "feat(renderer): add LabelButton component with tests"
```

---

## Task 3: Implement AsciiView Component

**Files:**
- Create: `src/renderer/components/AsciiView.tsx`
- Create: `src/renderer/components/__tests__/AsciiView.test.tsx`

**Step 1: Write AsciiView component test**

```typescript
// src/renderer/components/__tests__/AsciiView.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AsciiView } from '../AsciiView';

describe('AsciiView', () => {
  it('renders ASCII content in preformatted block', () => {
    const asciiContent = `+------------------+
|  TEST APP        |
+------------------+`;
    render(<AsciiView content={asciiContent} />);
    expect(screen.getByText(/TEST APP/)).toBeInTheDocument();
  });

  it('applies 80x24 grid styling', () => {
    render(<AsciiView content="test" />);
    const pre = screen.getByRole('presentation');
    expect(pre).toHaveClass('ascii-grid');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/AsciiView.test.tsx`
Expected: FAIL with "Cannot find module '../AsciiView'"

**Step 3: Implement AsciiView**

```typescript
// src/renderer/components/AsciiView.tsx

import React from 'react';

export interface AsciiViewProps {
  content: string;
  className?: string;
}

export function AsciiView({ content, className = '' }: AsciiViewProps) {
  return (
    <pre
      className={`ascii-grid ${className}`}
      role="presentation"
      aria-label="ASCII interface view"
    >
      {content}
    </pre>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/AsciiView.test.tsx`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/renderer/components/AsciiView.tsx src/renderer/components/__tests__/AsciiView.test.tsx
git commit -m "feat(renderer): add AsciiView component for displaying ASCII output"
```

---

## Task 4: Implement useAsciiState Hook

**Files:**
- Create: `src/renderer/hooks/useAsciiState.ts`
- Create: `src/renderer/hooks/__tests__/useAsciiState.test.ts`

**Step 1: Write useAsciiState hook test**

```typescript
// src/renderer/hooks/__tests__/useAsciiState.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsciiState } from '../useAsciiState';

describe('useAsciiState', () => {
  const mockApiUrl = 'http://localhost:3421';

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches initial state on mount', async () => {
    const mockState = { state: 'HOME', tasks: [] };
    const mockView = 'ASCII content here';

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockState) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(mockView) });

    const { result } = renderHook(() => useAsciiState(mockApiUrl));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.state).toEqual(mockState);
    expect(result.current.view).toBe(mockView);
  });

  it('sends control command and refreshes state', async () => {
    const mockState = { state: 'HOME', tasks: [] };
    const mockNextState = { state: 'TASKS', tasks: [] };
    const mockView = 'ASCII content';

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockState) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(mockView) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockNextState) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('New ASCII') });

    const { result } = renderHook(() => useAsciiState(mockApiUrl));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.sendControl('A');
    });

    await waitFor(() => expect(result.current.state).toEqual(mockNextState));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/hooks/__tests__/useAsciiState.test.ts`
Expected: FAIL with "Cannot find module '../useAsciiState'"

**Step 3: Implement useAsciiState**

```typescript
// src/renderer/hooks/useAsciiState.ts

import { useState, useEffect, useCallback } from 'react';
import type { AsciiState } from '../types';

export interface UseAsciiStateResult {
  state: AsciiState | null;
  view: string;
  loading: boolean;
  error: string | null;
  sendControl: (label: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAsciiState(apiUrl: string, pollInterval = 1000): UseAsciiStateResult {
  const [state, setState] = useState<AsciiState | null>(null);
  const [view, setView] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const [stateRes, viewRes] = await Promise.all([
        fetch(`${apiUrl}/state`),
        fetch(`${apiUrl}/view`),
      ]);

      if (!stateRes.ok || !viewRes.ok) {
        throw new Error('Failed to fetch state');
      }

      const stateData = await stateRes.json();
      const viewData = await viewRes.text();

      setState(stateData);
      setView(viewData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const sendControl = useCallback(async (label: string) => {
    try {
      const res = await fetch(`${apiUrl}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });

      if (!res.ok) {
        throw new Error(`Control failed: ${res.status}`);
      }

      // Refresh state after control
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Control error');
    }
  }, [apiUrl, fetchState]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchState();
  }, [fetchState]);

  useEffect(() => {
    fetchState();

    if (pollInterval > 0) {
      const interval = setInterval(fetchState, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchState, pollInterval]);

  return { state, view, loading, error, sendControl, refresh };
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/hooks/__tests__/useAsciiState.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/renderer/hooks/
git commit -m "feat(renderer): add useAsciiState hook for state management"
```

---

## Task 5: Implement StateView Auto-Renderer

**Files:**
- Create: `src/renderer/components/StateView.tsx`
- Create: `src/renderer/components/__tests__/StateView.test.tsx`
- Create: `src/renderer/renderers/HomeRenderer.tsx`
- Create: `src/renderer/renderers/TasksRenderer.tsx`
- Create: `src/renderer/renderers/index.ts`

**Step 1: Write StateView component test**

```typescript
// src/renderer/components/__tests__/StateView.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StateView } from '../StateView';
import type { AsciiBindings, AsciiState } from '../../types';

describe('StateView', () => {
  const mockBindings: AsciiBindings = {
    version: '1.0.0',
    description: 'Test app',
    bindings: [
      { label: 'A', action: 'goto_tasks', target: 'TASKS', description: 'View tasks' },
      { label: 'B', action: 'goto_settings', target: 'SETTINGS', description: 'Settings' },
    ],
    stateTransitions: {
      HOME: { A: 'TASKS', B: 'SETTINGS' },
      TASKS: { B: 'HOME' },
      SETTINGS: { B: 'HOME' },
    },
    metadata: {
      appName: 'TestApp',
      version: '1.0.0',
      gridSize: { width: 80, height: 24 },
      labelFormat: '[X]',
    },
  };

  const mockState: AsciiState = {
    state: 'HOME',
    tasks: [],
    settings: { autoSave: true, theme: 'dark' },
  };

  it('renders available labels as buttons for current state', () => {
    const onControl = vi.fn();
    render(
      <StateView
        state={mockState}
        bindings={mockBindings}
        onControl={onControl}
      />
    );

    expect(screen.getByText('[A]')).toBeInTheDocument();
    expect(screen.getByText('[B]')).toBeInTheDocument();
  });

  it('shows state name in header', () => {
    render(
      <StateView
        state={mockState}
        bindings={mockBindings}
        onControl={() => {}}
      />
    );

    expect(screen.getByText('HOME')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/StateView.test.tsx`
Expected: FAIL with "Cannot find module '../StateView'"

**Step 3: Implement StateView**

```typescript
// src/renderer/components/StateView.tsx

import React from 'react';
import { LabelButton } from './LabelButton';
import type { AsciiBindings, AsciiState } from '../types';

export interface StateViewProps {
  state: AsciiState;
  bindings: AsciiBindings;
  onControl: (label: string) => void;
  className?: string;
}

export function StateView({ state, bindings, onControl, className = '' }: StateViewProps) {
  const currentState = state.state;
  const transitions = bindings.stateTransitions[currentState] || {};

  // Get available labels for current state
  const availableLabels = bindings.bindings.filter(
    (b) => transitions[b.label] !== undefined
  );

  return (
    <div className={`ascii-state-view ${className}`}>
      <header className="ascii-state-header">
        <h1>{bindings.metadata.appName}</h1>
        <span className="ascii-state-badge">{currentState}</span>
      </header>

      <nav className="ascii-nav-bar">
        {availableLabels.map((binding) => (
          <LabelButton
            key={binding.label}
            label={binding.label}
            onClick={onControl}
          >
            {binding.description}
          </LabelButton>
        ))}
      </nav>

      <main className="ascii-content">
        {/* Content rendering will be customized per app */}
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </main>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/renderer && bun test src/renderer/components/__tests__/StateView.test.tsx`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/renderer/components/StateView.tsx src/renderer/components/__tests__/StateView.test.tsx
git commit -m "feat(renderer): add StateView auto-renderer component"
```

---

## Task 6: Create Demo App

**Files:**
- Create: `src/renderer/demo/index.html`
- Create: `src/renderer/demo/index.tsx`
- Create: `src/renderer/demo/App.tsx`
- Create: `src/renderer/demo/styles.css`
- Create: `src/renderer/vite.config.ts`

**Step 1: Create Vite config**

```typescript
// src/renderer/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'demo',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3421',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

**Step 2: Create demo HTML**

```html
<!-- src/renderer/demo/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASCII World Renderer Demo</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./index.tsx"></script>
</body>
</html>
```

**Step 3: Create demo styles**

```css
/* src/renderer/demo/styles.css */

:root {
  --ascii-bg: #1a1a2e;
  --ascii-fg: #eaeaea;
  --ascii-accent: #00d9ff;
  --ascii-muted: #6b7280;
  --ascii-border: #374151;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: var(--ascii-bg);
  color: var(--ascii-fg);
  min-height: 100vh;
}

#root {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.ascii-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
}

.ascii-state-view {
  background: #0f0f1a;
  border-radius: 8px;
  padding: 20px;
}

.ascii-state-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ascii-border);
}

.ascii-state-badge {
  background: var(--ascii-accent);
  color: var(--ascii-bg);
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: bold;
}

.ascii-nav-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.ascii-label-button {
  background: #2a2a4a;
  border: 1px solid var(--ascii-border);
  color: var(--ascii-fg);
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.ascii-label-button:hover {
  background: #3a3a5a;
  border-color: var(--ascii-accent);
}

.ascii-label-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ascii-label-tag {
  color: var(--ascii-accent);
  font-weight: bold;
}

.ascii-grid {
  background: #0a0a14;
  border: 1px solid var(--ascii-border);
  border-radius: 4px;
  padding: 16px;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre;
  height: fit-content;
}

.ascii-content pre {
  background: #0a0a14;
  padding: 16px;
  border-radius: 4px;
  font-size: 12px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--ascii-muted);
}

.error {
  background: #2a1a1a;
  border: 1px solid #ff4444;
  color: #ff8888;
  padding: 16px;
  border-radius: 4px;
}
```

**Step 4: Create demo App**

```typescript
// src/renderer/demo/App.tsx

import React from 'react';
import { useAsciiState } from '../hooks/useAsciiState';
import { StateView } from '../components/StateView';
import { AsciiView } from '../components/AsciiView';
import type { AsciiBindings } from '../types';

// Default bindings for demo (will be fetched from API in real use)
const defaultBindings: AsciiBindings = {
  version: '1.0.0',
  description: 'ASCII World Demo',
  bindings: [
    { label: 'A', action: 'goto_tasks', target: 'TASKS', description: 'Tasks' },
    { label: 'B', action: 'goto_settings', target: 'SETTINGS', description: 'Settings' },
    { label: 'H', action: 'goto_home', target: 'HOME', description: 'Home' },
  ],
  stateTransitions: {
    HOME: { A: 'TASKS', B: 'SETTINGS' },
    TASKS: { H: 'HOME', B: 'SETTINGS' },
    SETTINGS: { H: 'HOME', A: 'TASKS' },
  },
  metadata: {
    appName: 'ASCII World Demo',
    version: '1.0.0',
    gridSize: { width: 80, height: 24 },
    labelFormat: '[X]',
  },
};

interface AppProps {
  apiUrl?: string;
}

export function App({ apiUrl = '/api' }: AppProps) {
  const { state, view, loading, error, sendControl } = useAsciiState(apiUrl);

  if (loading) {
    return <div className="loading">Loading ASCII state...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!state) {
    return <div className="loading">No state available</div>;
  }

  return (
    <div className="ascii-layout">
      <div className="gui-pane">
        <StateView
          state={state}
          bindings={defaultBindings}
          onControl={sendControl}
        />
      </div>

      <aside className="ascii-pane">
        <h3>ASCII Source of Truth (80x24)</h3>
        <AsciiView content={view} />
      </aside>
    </div>
  );
}
```

**Step 5: Create entry point**

```typescript
// src/renderer/demo/index.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 6: Commit**

```bash
git add src/renderer/demo/ src/renderer/vite.config.ts
git commit -m "feat(renderer): add demo app with Vite setup"
```

---

## Task 7: Add Renderer Documentation

**Files:**
- Create: `src/renderer/README.md`
- Modify: `docs/AI-BUILDING-SOFTWARE.md`

**Step 1: Create renderer README**

```markdown
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
```

**Step 2: Update AI-BUILDING-SOFTWARE.md to mention renderer**

Add section to `docs/AI-BUILDING-SOFTWARE.md` after "### Step 4: Add GUI Later (Optional)":

```markdown
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
```

**Step 3: Commit**

```bash
git add src/renderer/README.md docs/AI-BUILDING-SOFTWARE.md
git commit -m "docs(renderer): add README and update AI building guide"
```

---

## Task 8: Integration Test with ascii-ref-app

**Files:**
- Create: `tests/renderer/integration.test.ts`

**Step 1: Write integration test**

```typescript
// tests/renderer/integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

describe('Renderer Integration', () => {
  let serverProcess: ChildProcess;
  const API_URL = 'http://localhost:3421';

  beforeAll(async () => {
    // Start the ascii-ref-app server
    serverProcess = spawn('bun', ['run', 'apps/ascii-ref-app/src/bun/index.ts'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(() => {
    serverProcess?.kill();
  });

  it('can fetch state from ascii-ref-app', async () => {
    const res = await fetch(`${API_URL}/state`);
    expect(res.ok).toBe(true);

    const state = await res.json();
    expect(state.state).toBeDefined();
    expect(state.tasks).toBeInstanceOf(Array);
  });

  it('can fetch ASCII view from ascii-ref-app', async () => {
    const res = await fetch(`${API_URL}/view`);
    expect(res.ok).toBe(true);

    const view = await res.text();
    expect(view).toContain('ASCII-REF-APP');
    expect(view).toContain('[A]');
  });

  it('can send control command and see state change', async () => {
    // Get initial state
    const initialRes = await fetch(`${API_URL}/state`);
    const initialState = await initialRes.json();
    expect(initialState.state).toBe('HOME');

    // Send control command
    const controlRes = await fetch(`${API_URL}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'A' }),
    });
    expect(controlRes.ok).toBe(true);

    const controlResult = await controlRes.json();
    expect(controlResult.newState).toBe('TASKS');

    // Verify state changed
    const newStateRes = await fetch(`${API_URL}/state`);
    const newState = await newStateRes.json();
    expect(newState.state).toBe('TASKS');
  });
});
```

**Step 2: Run integration test**

Run: `bun test tests/renderer/integration.test.ts`
Expected: PASS (3 tests)

**Step 3: Commit**

```bash
git add tests/renderer/
git commit -m "test(renderer): add integration tests with ascii-ref-app"
```

---

## Summary

This plan creates a reusable ASCII renderer that:

1. **Uses JSON state, not ASCII text** - GUI and ASCII share the same source of truth
2. **Auto-generates buttons from bindings** - Labels become clickable buttons
3. **Provides React hooks** - `useAsciiState` handles polling and control
4. **Includes a demo app** - Proves the concept works end-to-end

**Total: 8 tasks, ~15 commits**
