// src/renderer/patterns/__tests__/button.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectButtons } from '../detectors/button';

describe('Button Detector', () => {
  it('detects single button', () => {
    const ascii = '[A] Tasks';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].type).toBe('button');
    expect(buttons[0].label).toBe('A');
    expect(buttons[0].text).toBe('Tasks');
  });

  it('detects multiple buttons on same line', () => {
    const ascii = '[A] Tasks  [B] Settings  [X] Quit';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(3);
    expect(buttons[0].label).toBe('A');
    expect(buttons[1].label).toBe('B');
    expect(buttons[2].label).toBe('X');
  });

  it('detects numeric labels', () => {
    const ascii = '[1] Option 1  [2] Option 2';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(2);
    expect(buttons[0].label).toBe('1');
    expect(buttons[1].label).toBe('2');
  });

  it('ignores text without button pattern', () => {
    const ascii = 'Regular text [not a button] more text';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons).toHaveLength(0);
  });

  it('extracts button position', () => {
    const ascii = '  [A] Tasks';
    const lexer = new AsciiLexer(ascii);
    const buttons = detectButtons(lexer);
    expect(buttons[0].position).toEqual({ row: 0, col: 2 });
  });
});
