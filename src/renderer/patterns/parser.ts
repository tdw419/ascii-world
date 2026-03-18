// src/renderer/patterns/parser.ts

import { AsciiLexer } from './lexer';
import { detectButtons } from './detectors/button';
import { detectContainers } from './detectors/container';
import { detectStatusIndicators } from './detectors/status';
import { detectTables } from './detectors/table';
import type { ParsedAscii, DetectedPattern } from './types';

/**
 * Parse ASCII art and detect all UI patterns.
 * This is the main entry point for pattern detection.
 *
 * @param ascii - The ASCII art string to parse
 * @returns ParsedAscii object with all detected patterns
 */
export function parseAscii(ascii: string): ParsedAscii {
  const lexer = new AsciiLexer(ascii);
  const patterns: DetectedPattern[] = [];

  // Run all detectors
  patterns.push(...detectButtons(lexer));
  patterns.push(...detectContainers(lexer));
  patterns.push(...detectStatusIndicators(lexer));
  patterns.push(...detectTables(lexer));

  return {
    raw: ascii,
    lines: lexer.lines,
    patterns,
    gridSize: lexer.gridSize,
  };
}
