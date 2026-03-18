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
