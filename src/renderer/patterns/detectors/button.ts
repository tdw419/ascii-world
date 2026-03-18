// src/renderer/patterns/detectors/button.ts

import type { AsciiLexer } from '../lexer';
import type { ButtonPattern } from '../types';

export function detectButtons(lexer: AsciiLexer): ButtonPattern[] {
  const buttons: ButtonPattern[] = [];
  const pattern = /\[([A-Z0-9])\]\s*([^\s\[\]]+(?:\s+[^\s\[\]]+)*)/g;

  lexer.lines.forEach((line, row) => {
    let match: RegExpExecArray | null;
    const linePattern = new RegExp(pattern.source, pattern.flags);

    while ((match = linePattern.exec(line)) !== null) {
      buttons.push({
        type: 'button',
        position: { row, col: match.index },
        content: match[0],
        label: match[1],
        text: match[2].trim(),
      });
    }
  });

  return buttons;
}
