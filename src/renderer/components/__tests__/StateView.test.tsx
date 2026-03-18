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
