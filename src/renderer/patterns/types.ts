// src/renderer/patterns/types.ts

/**
 * Pattern types for ASCII-to-Component recognition
 */

export type PatternType =
  | 'button'
  | 'container'
  | 'table'
  | 'table-row'
  | 'status-indicator'
  | 'text'
  | 'divider'
  | 'header'
  | 'template-variable'
  | 'template-block';

export interface Position {
  row: number;
  col: number;
}

export interface DetectedPattern {
  type: PatternType;
  position: Position;
  content: string;
  label?: string; // For buttons: 'A', 'B', etc.
  children?: DetectedPattern[];
  metadata?: Record<string, unknown>;
}

export interface ButtonPattern extends DetectedPattern {
  type: 'button';
  label: string;
  text: string;
}

export interface ContainerPattern extends DetectedPattern {
  type: 'container';
  title?: string;
  children: DetectedPattern[];
  borderStyle: 'double' | 'single' | 'rounded';
}

export interface TablePattern extends DetectedPattern {
  type: 'table';
  headers: string[];
  rows: TableRowPattern[];
}

export interface TableRowPattern extends DetectedPattern {
  type: 'table-row';
  cells: string[];
  label?: string;
}

export interface StatusPattern extends DetectedPattern {
  type: 'status-indicator';
  status: 'running' | 'stopped' | 'warning' | 'error' | 'unknown';
  symbol: string;
}

export interface HeaderPattern extends DetectedPattern {
  type: 'header';
  text: string;
  level: 1 | 2 | 3;
}

export interface TemplateVariablePattern extends DetectedPattern {
  type: 'template-variable';
  variable: string;
}

export interface TemplateBlockPattern extends DetectedPattern {
  type: 'template-block';
  blockType: 'each' | 'if' | 'with';
  variable: string;
  content: string;
}

export type AnyPattern =
  | ButtonPattern
  | ContainerPattern
  | TablePattern
  | TableRowPattern
  | StatusPattern
  | HeaderPattern
  | TemplateVariablePattern
  | TemplateBlockPattern;

export interface ParsedAscii {
  raw: string;
  lines: string[];
  patterns: DetectedPattern[];
  gridSize: { width: number; height: number };
}
