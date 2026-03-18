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
