// src/renderer/patterns/__tests__/lexer.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';

describe('AsciiLexer', () => {
  describe('constructor and basic properties', () => {
    it('splits ASCII into lines', () => {
      const ascii = `Line 1
Line 2
Line 3`;
      const lexer = new AsciiLexer(ascii);
      expect(lexer.lines).toHaveLength(3);
      expect(lexer.lines[0]).toBe('Line 1');
    });

    it('calculates grid dimensions', () => {
      const ascii = '12345\n1234567890\n123';
      const lexer = new AsciiLexer(ascii);
      expect(lexer.gridSize).toEqual({ width: 10, height: 3 });
    });

    it('handles empty string', () => {
      const lexer = new AsciiLexer('');
      expect(lexer.lines).toHaveLength(1);
      expect(lexer.lines[0]).toBe('');
      expect(lexer.gridSize).toEqual({ width: 0, height: 1 });
    });

    it('handles single line', () => {
      const lexer = new AsciiLexer('Hello World');
      expect(lexer.lines).toHaveLength(1);
      expect(lexer.gridSize).toEqual({ width: 11, height: 1 });
    });
  });

  describe('getChar', () => {
    it('gets character at position', () => {
      const ascii = 'ABC\nDEF';
      const lexer = new AsciiLexer(ascii);
      expect(lexer.getChar(0, 0)).toBe('A');
      expect(lexer.getChar(1, 1)).toBe('E');
    });

    it('returns empty string for out of bounds row', () => {
      const lexer = new AsciiLexer('ABC');
      expect(lexer.getChar(5, 0)).toBe('');
      expect(lexer.getChar(-1, 0)).toBe('');
    });

    it('returns empty string for out of bounds col', () => {
      const lexer = new AsciiLexer('ABC');
      expect(lexer.getChar(0, 10)).toBe('');
      expect(lexer.getChar(0, -1)).toBe('');
    });
  });

  describe('getLine', () => {
    it('gets line at valid row', () => {
      const ascii = 'Line 1\nLine 2\nLine 3';
      const lexer = new AsciiLexer(ascii);
      expect(lexer.getLine(0)).toBe('Line 1');
      expect(lexer.getLine(1)).toBe('Line 2');
    });

    it('returns empty string for invalid row', () => {
      const lexer = new AsciiLexer('ABC');
      expect(lexer.getLine(-1)).toBe('');
      expect(lexer.getLine(10)).toBe('');
    });
  });

  describe('findAll', () => {
    it('finds all occurrences of a pattern', () => {
      const ascii = '[A] Task 1\n[B] Task 2\nNo button here';
      const lexer = new AsciiLexer(ascii);
      const matches = lexer.findAll(/\[([A-Z])\]/g);
      expect(matches).toHaveLength(2);
      expect(matches[0].label).toBe('A');
      expect(matches[1].label).toBe('B');
    });

    it('includes correct positions', () => {
      const ascii = 'XX\nYY XX\nXX';
      const lexer = new AsciiLexer(ascii);
      const matches = lexer.findAll(/XX/g);
      expect(matches).toHaveLength(3);
      expect(matches[0].position).toEqual({ row: 0, col: 0 });
      expect(matches[1].position).toEqual({ row: 1, col: 3 });
      expect(matches[2].position).toEqual({ row: 2, col: 0 });
    });

    it('handles no matches', () => {
      const lexer = new AsciiLexer('Hello World');
      const matches = lexer.findAll(/\d+/g);
      expect(matches).toHaveLength(0);
    });

    it('adds global flag if missing', () => {
      const ascii = 'aa aa aa';
      const lexer = new AsciiLexer(ascii);
      const matches = lexer.findAll(/aa/);
      expect(matches).toHaveLength(3);
    });
  });

  describe('box border detection', () => {
    it('detects box corners', () => {
      const ascii = `┌─────┐
│ Hi  │
└─────┘`;
      const lexer = new AsciiLexer(ascii);
      expect(lexer.isBoxCorner(0, 0)).toBe(true);
      expect(lexer.isBoxCorner(0, 6)).toBe(true);
      expect(lexer.isBoxCorner(2, 0)).toBe(true);
      expect(lexer.isBoxCorner(2, 6)).toBe(true);
    });

    it('detects vertical borders', () => {
      const ascii = `┌─────┐
│ Hi  │
└─────┘`;
      const lexer = new AsciiLexer(ascii);
      expect(lexer.isVerticalBorder(1, 0)).toBe(true);
      expect(lexer.isVerticalBorder(1, 6)).toBe(true);
    });

    it('detects horizontal borders', () => {
      const ascii = `┌─────┐
│ Hi  │
└─────┘`;
      const lexer = new AsciiLexer(ascii);
      expect(lexer.isHorizontalBorder(0, 1)).toBe(true);
      expect(lexer.isHorizontalBorder(2, 1)).toBe(true);
    });

    it('isBorder returns true for any border character', () => {
      const ascii = `┌─│`;
      const lexer = new AsciiLexer(ascii);
      expect(lexer.isBorder(0, 0)).toBe(true);
      expect(lexer.isBorder(0, 1)).toBe(true);
      expect(lexer.isBorder(0, 2)).toBe(true);
    });

    it('detects double-line box corners', () => {
      const ascii = `╔═════╗
║ Hi  ║
╚═════╝`;
      const lexer = new AsciiLexer(ascii);
      expect(lexer.isBoxCorner(0, 0)).toBe(true);
      expect(lexer.isBoxCorner(0, 6)).toBe(true);
      expect(lexer.isBoxCorner(2, 0)).toBe(true);
      expect(lexer.isBoxCorner(2, 6)).toBe(true);
    });

    it('returns false for non-border characters', () => {
      const lexer = new AsciiLexer('ABC 123');
      expect(lexer.isBorder(0, 0)).toBe(false);
      expect(lexer.isBoxCorner(0, 0)).toBe(false);
      expect(lexer.isHorizontalBorder(0, 0)).toBe(false);
      expect(lexer.isVerticalBorder(0, 0)).toBe(false);
    });
  });

  describe('status indicator detection', () => {
    it('detects status indicators', () => {
      const lexer = new AsciiLexer('');
      expect(lexer.isStatusIndicator('●')).toBe(true);
      expect(lexer.isStatusIndicator('○')).toBe(true);
      expect(lexer.isStatusIndicator('◐')).toBe(true);
      expect(lexer.isStatusIndicator('A')).toBe(false);
    });

    it('gets correct status meaning', () => {
      const lexer = new AsciiLexer('');
      expect(lexer.getStatusMeaning('●')).toBe('running');
      expect(lexer.getStatusMeaning('○')).toBe('stopped');
      expect(lexer.getStatusMeaning('◐')).toBe('warning');
      expect(lexer.getStatusMeaning('◑')).toBe('warning');
      expect(lexer.getStatusMeaning('◉')).toBe('error');
      expect(lexer.getStatusMeaning('◎')).toBe('unknown');
      expect(lexer.getStatusMeaning('X')).toBe('unknown');
    });
  });

  describe('template variable detection', () => {
    it('finds template variables', () => {
      const ascii = 'Hello {{name}}, welcome to {{place}}';
      const lexer = new AsciiLexer(ascii);
      const vars = lexer.findTemplateVariables();
      expect(vars).toHaveLength(2);
      expect(vars[0].label).toBe('name');
      expect(vars[1].label).toBe('place');
    });

    it('handles no template variables', () => {
      const lexer = new AsciiLexer('Hello World');
      const vars = lexer.findTemplateVariables();
      expect(vars).toHaveLength(0);
    });
  });

  describe('template block detection', () => {
    it('finds template blocks', () => {
      const ascii = `{{#each items}}
  Item
{{/each}}`;
      const lexer = new AsciiLexer(ascii);
      const blocks = lexer.findTemplateBlocks();
      expect(blocks).toHaveLength(2);
    });
  });

  describe('button detection', () => {
    it('finds buttons', () => {
      const ascii = '[A] Save\n[B] Cancel\n[A] Another';
      const lexer = new AsciiLexer(ascii);
      const buttons = lexer.findButtons();
      expect(buttons).toHaveLength(3);
      expect(buttons[0].match[1]).toBe('A');
      expect(buttons[0].match[2]).toBe('Save');
    });
  });

  describe('toParsedAscii', () => {
    it('converts to ParsedAscii format', () => {
      const ascii = 'Hello\nWorld';
      const lexer = new AsciiLexer(ascii);
      const parsed = lexer.toParsedAscii();
      expect(parsed.raw).toBe(ascii);
      expect(parsed.lines).toEqual(['Hello', 'World']);
      expect(parsed.patterns).toEqual([]);
      expect(parsed.gridSize).toEqual({ width: 5, height: 2 });
    });
  });
});
