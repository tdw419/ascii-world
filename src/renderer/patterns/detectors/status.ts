// src/renderer/patterns/detectors/status.ts

import type { AsciiLexer } from '../lexer';
import type { StatusPattern } from '../types';

const STATUS_SYMBOLS: Record<string, StatusPattern['status']> = {
  '●': 'running',
  '○': 'stopped',
  '◐': 'warning',
  '◑': 'warning',
  '◉': 'error',
  '◎': 'unknown',
  '⬤': 'running',
  '◯': 'stopped',
};

export function detectStatusIndicators(lexer: AsciiLexer): StatusPattern[] {
  const statuses: StatusPattern[] = [];

  lexer.lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (STATUS_SYMBOLS[char]) {
        statuses.push({
          type: 'status-indicator',
          position: { row, col },
          content: char,
          status: STATUS_SYMBOLS[char],
          symbol: char,
        });
      }
    }
  });

  return statuses;
}
