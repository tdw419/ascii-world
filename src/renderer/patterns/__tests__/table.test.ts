// src/renderer/patterns/__tests__/table.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectTables } from '../detectors/table';

describe('Table Detector', () => {
  it('detects simple table with headers', () => {
    const ascii = `│ Name    │ Status │
│ App 1   │ ●      │
│ App 2   │ ○      │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables).toHaveLength(1);
    expect(tables[0].type).toBe('table');
    expect(tables[0].headers).toContain('Name');
    expect(tables[0].headers).toContain('Status');
  });

  it('detects table rows with cells', () => {
    const ascii = `│ Name  │ Port │
│ App 1 │ 3000 │
│ App 2 │ 3001 │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0].cells).toContain('App 1');
  });

  it('detects row labels', () => {
    const ascii = `│ [A] App 1 │ ● │
│ [B] App 2 │ ○ │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables[0].rows[0].label).toBe('A');
    expect(tables[0].rows[1].label).toBe('B');
  });

  it('handles divider rows', () => {
    const ascii = `│ Name  │ Port │
├───────┼──────┤
│ App 1 │ 3000 │`;
    const lexer = new AsciiLexer(ascii);
    const tables = detectTables(lexer);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(1);
  });
});
