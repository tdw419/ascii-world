import { describe, it, expect } from 'vitest';
import { parseAscii } from '../parser';

describe('Pattern Parser', () => {
  it('parses all pattern types', () => {
    const ascii = `╔══════════════════╗
║  MY APP          ║
╠══════════════════╣
║ [A] Tasks        ║
║ [B] Settings     ║
╠══════════════════╣
║ │ Name │ Status │ ║
║ │ App  │ ●      │ ║
╚══════════════════╝`;
    const result = parseAscii(ascii);

    expect(result.patterns.length).toBeGreaterThan(0);
  });

  it('returns parsed ASCII with grid info', () => {
    const ascii = 'Test\nLine';
    const result = parseAscii(ascii);

    expect(result.gridSize).toEqual({ width: 4, height: 2 });
    expect(result.lines).toHaveLength(2);
  });

  it('filters patterns by type', () => {
    const ascii = '[A] Task\nStatus: ●';
    const result = parseAscii(ascii);

    const buttons = result.patterns.filter(p => p.type === 'button');
    const statuses = result.patterns.filter(p => p.type === 'status-indicator');

    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(statuses.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty input', () => {
    const result = parseAscii('');
    expect(result.patterns).toHaveLength(0);
    expect(result.gridSize).toEqual({ width: 0, height: 1 });
  });

  it('preserves raw ASCII', () => {
    const ascii = '[A] Test';
    const result = parseAscii(ascii);
    expect(result.raw).toBe(ascii);
  });
});
