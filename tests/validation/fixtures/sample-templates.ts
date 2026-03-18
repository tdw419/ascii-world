// tests/validation/fixtures/sample-templates.ts

/**
 * Sample templates for LLM cross-validation testing.
 * These templates contain known patterns with expected detection results.
 */

export interface ExpectedPattern {
  type: 'button' | 'container' | 'status-indicator' | 'table';
  description: string;
}

export interface SampleTemplate {
  name: string;
  ascii: string;
  expectedPatterns: ExpectedPattern[];
}

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    name: 'simple-buttons',
    ascii: '[A] Tasks  [B] Settings  [X] Quit',
    expectedPatterns: [
      { type: 'button', description: 'Button A with label "Tasks"' },
      { type: 'button', description: 'Button B with label "Settings"' },
      { type: 'button', description: 'Button X with label "Quit"' },
    ],
  },
  {
    name: 'status-indicators',
    ascii: `● running
○ stopped
◐ warning
◉ error`,
    expectedPatterns: [
      { type: 'status-indicator', description: 'Running status (green dot)' },
      { type: 'status-indicator', description: 'Stopped status (gray circle)' },
      { type: 'status-indicator', description: 'Warning status (half circle)' },
      { type: 'status-indicator', description: 'Error status (bullseye)' },
    ],
  },
  {
    name: 'container',
    ascii: `╔══════════════════╗
║  Dashboard       ║
╠══════════════════╣
║  Content         ║
╚══════════════════╝`,
    expectedPatterns: [
      { type: 'container', description: 'Box container with title "Dashboard"' },
    ],
  },
  {
    name: 'table',
    ascii: `│ Name  │ Status │
│ App   │ ●      │`,
    expectedPatterns: [
      { type: 'table', description: 'Table with columns Name and Status' },
    ],
  },
  {
    name: 'complex-dashboard',
    ascii: `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v1.0.0            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  REGISTERED ASCII PROJECTS                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  [1] My App    (port 3000)  ● running                                    │║
║  │  [2] API Server (port 3001)  ○ stopped                                   ││
║  └─────────────────────────────────────────────────────────────────────────┘║
╚══════════════════════════════════════════════════════════════════════════════╝`,
    expectedPatterns: [
      { type: 'container', description: 'Main outer container' },
      { type: 'button', description: 'Button A with label "Projects"' },
      { type: 'button', description: 'Button B with label "Templates"' },
      { type: 'button', description: 'Button X with label "Quit"' },
      { type: 'status-indicator', description: 'Running status for My App' },
      { type: 'status-indicator', description: 'Stopped status for API Server' },
    ],
  },
];
