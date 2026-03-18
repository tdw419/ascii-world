// src/renderer/patterns/lexer.ts

import type { Position, ParsedAscii } from './types';

export interface LexerMatch {
  position: Position;
  match: RegExpMatchArray;
  label?: string;
}

export class AsciiLexer {
  public readonly lines: string[];
  public readonly gridSize: { width: number; height: number };

  constructor(private readonly ascii: string) {
    this.lines = ascii.split('\n');
    this.gridSize = {
      width: Math.max(...this.lines.map(l => l.length)),
      height: this.lines.length,
    };
  }

  getChar(row: number, col: number): string {
    if (row < 0 || row >= this.lines.length) return '';
    const line = this.lines[row];
    if (col < 0 || col >= line.length) return '';
    return line[col];
  }

  getLine(row: number): string {
    if (row < 0 || row >= this.lines.length) return '';
    return this.lines[row];
  }

  findAll(pattern: RegExp): LexerMatch[] {
    const matches: LexerMatch[] = [];
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
    );

    this.lines.forEach((line, row) => {
      let match: RegExpExecArray | null;
      const linePattern = new RegExp(globalPattern.source, globalPattern.flags);
      while ((match = linePattern.exec(line)) !== null) {
        matches.push({
          position: { row, col: match.index },
          match,
          label: match[1] || undefined,
        });
      }
    });

    return matches;
  }

  // Box drawing character detection
  isBoxCorner(row: number, col: number): boolean {
    const char = this.getChar(row, col);
    return [
      '┌',
      '┐',
      '└',
      '┘',
      '╔',
      '╗',
      '╚',
      '╝',
      '╠',
      '╣',
      '╬',
      '├',
      '┤',
      '┬',
      '┴',
      '╦',
      '╩',
    ].includes(char);
  }

  isHorizontalBorder(row: number, col: number): boolean {
    const char = this.getChar(row, col);
    return ['─', '═', '━'].includes(char);
  }

  isVerticalBorder(row: number, col: number): boolean {
    const char = this.getChar(row, col);
    return ['│', '║', '┃'].includes(char);
  }

  isBorder(row: number, col: number): boolean {
    return (
      this.isBoxCorner(row, col) ||
      this.isHorizontalBorder(row, col) ||
      this.isVerticalBorder(row, col)
    );
  }

  // Status indicator detection
  isStatusIndicator(char: string): boolean {
    return [
      '●',
      '○',
      '◐',
      '◑',
      '◉',
      '◎',
      '⬤',
      '◯',
      '◠',
      '◡',
    ].includes(char);
  }

  getStatusMeaning(
    char: string
  ): 'running' | 'stopped' | 'warning' | 'error' | 'unknown' {
    const statusMap: Record<string, 'running' | 'stopped' | 'warning' | 'error' | 'unknown'> = {
      '●': 'running',
      '○': 'stopped',
      '◐': 'warning',
      '◑': 'warning',
      '◉': 'error',
      '◎': 'unknown',
    };
    return statusMap[char] || 'unknown';
  }

  // Template variable detection
  findTemplateVariables(): LexerMatch[] {
    return this.findAll(/\{\{([^}]+)\}\}/g);
  }

  // Template block detection ({{#each}}, {{/each}}, etc.)
  findTemplateBlocks(): LexerMatch[] {
    return this.findAll(/\{\{(#|\/)(\w+)(?:\s+(\w+))?\}\}/g);
  }

  // Button detection
  findButtons(): LexerMatch[] {
    return this.findAll(/\[([A-Z0-9])\]\s*(\S.*?)(?=\s*\[|\s*$|\s{2,})/g);
  }

  toParsedAscii(): ParsedAscii {
    return {
      raw: this.ascii,
      lines: this.lines,
      patterns: [],
      gridSize: this.gridSize,
    };
  }
}
