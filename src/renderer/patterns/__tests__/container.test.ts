import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectContainers } from '../detectors/container';

describe('Container Detector', () => {
  it('detects simple box container', () => {
    const ascii = `┌─────┐
│ Hi  │
└─────┘`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers).toHaveLength(1);
    expect(containers[0].type).toBe('container');
    expect(containers[0].borderStyle).toBe('single');
  });

  it('detects double-line container', () => {
    const ascii = `╔═════╗
║ Hi  ║
╚═════╝`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers).toHaveLength(1);
    expect(containers[0].borderStyle).toBe('double');
  });

  it('extracts container title', () => {
    const ascii = `┌─────────────┐
│ MY APP      │
└─────────────┘`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers[0].title).toContain('MY APP');
  });

  it('calculates container bounds', () => {
    const ascii = `┌─────┐
│ Hi  │
└─────┘`;
    const lexer = new AsciiLexer(ascii);
    const containers = detectContainers(lexer);
    expect(containers[0].metadata?.bounds).toEqual({
      startRow: 0,
      endRow: 2,
      startCol: 0,
      endCol: 6,
    });
  });
});
