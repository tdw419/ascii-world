// src/renderer/demo/App.tsx

import React, { useState } from 'react';
import { useAsciiState } from '../hooks/useAsciiState';
import { StateView } from '../components/StateView';
import { AsciiView } from '../components/AsciiView';
import { AutoRenderer } from '../components/AutoRenderer';
import type { AsciiBindings, ControlEvent } from '../types';

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

// Sample ASCII template for AutoRenderer demo
const sampleAscii = `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII WORLD DEMO                                          v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  REGISTERED ASCII PROJECTS                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  [1] My App    (port 3000)  ● running                                    │║
║  │  [2] API Server (port 3001)  ○ stopped                                   │║
║  │  [3] Worker    (port 3002)  ◐ warning                                    │║
║  │  [N] New Project...                                                      │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  Selected: 1                                                                ║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [S] Start  [T] Stop  [R] Refresh  [V] View ASCII  [E] Edit Project         ║
╚══════════════════════════════════════════════════════════════════════════════╝`;

interface AppProps {
  apiUrl?: string;
}

export function App({ apiUrl = '/api' }: AppProps) {
  const { state, view, loading, error, sendControl } = useAsciiState(apiUrl);
  const [renderMode, setRenderMode] = useState<'gui' | 'ascii' | 'auto'>('auto');
  const [demoView, setDemoView] = useState(false);

  const handleControl = (event: ControlEvent) => {
    sendControl(event);
  };

  const handleDemoControl = (event: ControlEvent) => {
    // In demo mode, just log the control events
    console.log('Demo control event:', event);
  };

  if (loading) {
    return <div className="loading">Loading ASCII state...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!state && !demoView) {
    return (
      <div className="demo-container">
        <div className="loading">No state available</div>
        <button onClick={() => setDemoView(true)}>View Demo</button>
      </div>
    );
  }

  const currentView = demoView ? sampleAscii : view;
  const currentBindings = demoView ? defaultBindings : defaultBindings;

  return (
    <div className="ascii-layout">
      <header className="layout-header">
        <h2>ASCII World</h2>
        <div className="view-toggle">
          <button
            className={renderMode === 'gui' ? 'active' : ''}
            onClick={() => setRenderMode('gui')}
          >
            GUI
          </button>
          <button
            className={renderMode === 'ascii' ? 'active' : ''}
            onClick={() => setRenderMode('ascii')}
          >
            ASCII
          </button>
          <button
            className={renderMode === 'auto' ? 'active' : ''}
            onClick={() => setRenderMode('auto')}
          >
            Auto (Pattern)
          </button>
        </div>
        <button onClick={() => setDemoView(!demoView)}>
          {demoView ? 'Live View' : 'Demo Mode'}
        </button>
      </header>

      <div className="main-content">
        {renderMode === 'gui' && (
          <div className="gui-pane">
            <StateView
              state={state || { currentState: 'DEMO' }}
              bindings={currentBindings}
              onControl={handleControl}
            />
          </div>
        )}

        {renderMode === 'ascii' && (
          <aside className="ascii-pane">
            <h3>ASCII Source of Truth (80x24)</h3>
            <AsciiView content={currentView} />
          </aside>
        )}

        {renderMode === 'auto' && (
          <div className="auto-pane">
            <h3>AutoRenderer (Pattern Detection)</h3>
            <AutoRenderer
              ascii={currentView}
              onControl={demoView ? handleDemoControl : handleControl}
              showRawFallback={true}
            />
          </div>
        )}
      </div>

      <footer className="layout-footer">
        <p>
          Mode: {renderMode.toUpperCase()} |
          {demoView ? ' Demo Data' : ' Live Data'}
        </p>
      </footer>
    </div>
  );
}
