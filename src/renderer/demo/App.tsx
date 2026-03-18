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
