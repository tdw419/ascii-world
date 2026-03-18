// src/cli/pattern-cli-types.ts

/**
 * CLI types and commands for pattern recognition
 */

export interface PatternInfo {
  name: string;
  description: string;
  detector: string;
  priority: number;
}

export const PATTERN_TYPES: PatternInfo[] = [
  { name: 'button', description: 'Detect [X] label buttons', detector: 'button', priority: 1 },
  { name: 'status', description: 'Detect status indicators', detector: 'status', priority: 2 },
  { name: 'status-indicator', description: 'Detect status indicators (alias)', detector: 'status', priority: 2 },
  { name: 'container', description: 'Detect box containers', detector: 'container', priority: 3 },
  { name: 'table', description: 'Detect | separated tables', detector: 'table', priority: 4 },
  { name: 'table-row', description: 'Detect table rows', detector: 'table', priority: 5 },
];

export interface CliOptions {
  input?: string;
  output?: string;
  patterns?: string;
  format?: 'json' | 'table' | 'pretty';
  validate?: boolean;
}

export interface PatternGroup {
  type: string;
  patterns: PatternOutput[];
}

export interface PatternOutput {
  id: string;
  type: string;
  position: { row: number; col: number };
  content: string;
  label?: string;
  text?: string;
  status?: string;
  symbol?: string;
  title?: string;
  borderStyle?: string;
  headers?: string[];
  rows?: number;
  bounds?: {
    startLine: number;
    endLine: number;
    startCol: number;
    endCol: number;
  };
}
