// src/renderer/patterns/__tests__/status.test.ts

import { describe, it, expect } from 'vitest';
import { AsciiLexer } from '../lexer';
import { detectStatusIndicators } from '../detectors/status';

describe('Status Indicator Detector', () => {
  it('detects running status (●)', () => {
    const ascii = 'Status: ● running';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBe('running');
    expect(statuses[0].symbol).toBe('●');
  });

  it('detects stopped status (○)', () => {
    const ascii = 'Status: ○ stopped';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBe('stopped');
  });

  it('detects warning status (◐)', () => {
    const ascii = 'Warning: ◐ partial';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses[0].status).toBe('warning');
  });

  it('detects multiple status indicators', () => {
    const ascii = `● App 1 running
○ App 2 stopped
◐ App 3 warning`;
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses).toHaveLength(3);
    expect(statuses[0].status).toBe('running');
    expect(statuses[1].status).toBe('stopped');
    expect(statuses[2].status).toBe('warning');
  });

  it('provides position for each indicator', () => {
    const ascii = '  ● Status here';
    const lexer = new AsciiLexer(ascii);
    const statuses = detectStatusIndicators(lexer);
    expect(statuses[0].position).toEqual({ row: 0, col: 2 });
  });
});
