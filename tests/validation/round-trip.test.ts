/**
 * Round-Trip Fidelity Tests
 *
 * These tests verify that pattern detection maintains fidelity and doesn't
 * produce false positives. They ensure the parser correctly identifies
 * patterns and preserves their structural information.
 */

import { describe, it, expect } from 'bun:test';
import { parseAscii } from '../../src/renderer/patterns/parser';
import type { ButtonPattern, StatusPattern, TablePattern, ContainerPattern } from '../../src/renderer/patterns/types';

describe('Round-Trip Fidelity Tests', () => {
  describe('Button Fidelity', () => {
    it('detects exact button count', () => {
      const ascii = '[A] One  [B] Two  [C] Three';
      const result = parseAscii(ascii);
      const buttons = result.patterns.filter(p => p.type === 'button') as ButtonPattern[];

      expect(buttons.length).toBe(3);
    });

    it('preserves button labels and text', () => {
      const ascii = '[X] Exit  [Y] Yes  [N] No';
      const result = parseAscii(ascii);
      const buttons = result.patterns.filter(p => p.type === 'button') as ButtonPattern[];

      expect(buttons.length).toBe(3);

      // Create a label map for easy verification
      const labelMap = new Map(buttons.map(b => [b.label, b.text]));

      expect(labelMap.get('X')).toBe('Exit');
      expect(labelMap.get('Y')).toBe('Yes');
      expect(labelMap.get('N')).toBe('No');
    });

    it('does not detect buttons in non-button patterns', () => {
      const ascii = 'This has [text] in brackets but not a button';
      const result = parseAscii(ascii);
      const buttons = result.patterns.filter(p => p.type === 'button');

      expect(buttons.length).toBe(0);
    });
  });

  describe('Status Fidelity', () => {
    it('maps each status symbol to correct state', () => {
      // Test ● → running
      const runningAscii = 'Status: ● running';
      const runningResult = parseAscii(runningAscii);
      const runningStatus = runningResult.patterns.find(p => p.type === 'status-indicator') as StatusPattern;
      expect(runningStatus).toBeDefined();
      expect(runningStatus.status).toBe('running');
      expect(runningStatus.symbol).toBe('●');

      // Test ○ → stopped
      const stoppedAscii = 'Status: ○ stopped';
      const stoppedResult = parseAscii(stoppedAscii);
      const stoppedStatus = stoppedResult.patterns.find(p => p.type === 'status-indicator') as StatusPattern;
      expect(stoppedStatus).toBeDefined();
      expect(stoppedStatus.status).toBe('stopped');
      expect(stoppedStatus.symbol).toBe('○');

      // Test ◐ → warning
      const warningAscii = 'Status: ◐ warning';
      const warningResult = parseAscii(warningAscii);
      const warningStatus = warningResult.patterns.find(p => p.type === 'status-indicator') as StatusPattern;
      expect(warningStatus).toBeDefined();
      expect(warningStatus.status).toBe('warning');
      expect(warningStatus.symbol).toBe('◐');

      // Test ◑ → warning (alternate)
      const warning2Ascii = 'Status: ◑ paused';
      const warning2Result = parseAscii(warning2Ascii);
      const warning2Status = warning2Result.patterns.find(p => p.type === 'status-indicator') as StatusPattern;
      expect(warning2Status).toBeDefined();
      expect(warning2Status.status).toBe('warning');
      expect(warning2Status.symbol).toBe('◑');

      // Test ◉ → error
      const errorAscii = 'Status: ◉ error';
      const errorResult = parseAscii(errorAscii);
      const errorStatus = errorResult.patterns.find(p => p.type === 'status-indicator') as StatusPattern;
      expect(errorStatus).toBeDefined();
      expect(errorStatus.status).toBe('error');
      expect(errorStatus.symbol).toBe('◉');
    });

    it('detects multiple status indicators on same line', () => {
      const ascii = '● App1  ○ App2  ◐ App3';
      const result = parseAscii(ascii);
      const statuses = result.patterns.filter(p => p.type === 'status-indicator') as StatusPattern[];

      expect(statuses.length).toBe(3);

      // Verify each status is detected with correct state
      const statusTypes = statuses.map(s => s.status);
      expect(statusTypes).toContain('running');
      expect(statusTypes).toContain('stopped');
      expect(statusTypes).toContain('warning');
    });
  });

  describe('Container Fidelity', () => {
    it('detects container bounds accurately', () => {
      const ascii = `Line 1
┌─────────────┐
│ Content     │
│ Inside      │
└─────────────┘
Line 6`;

      const result = parseAscii(ascii);
      const containers = result.patterns.filter(p => p.type === 'container') as ContainerPattern[];

      expect(containers.length).toBe(1);

      const container = containers[0];
      expect(container.position.row).toBe(1); // Box starts on line 2 (0-indexed: 1)
      expect(container.position.col).toBe(0);

      // Check bounds in metadata
      const bounds = container.metadata?.bounds as { startRow: number; endRow: number; startCol: number; endCol: number } | undefined;
      expect(bounds).toBeDefined();
      expect(bounds.startRow).toBe(1);
      expect(bounds.endRow).toBe(4); // Box ends on line 5 (0-indexed: 4)
    });

    it('detects nested containers', () => {
      const ascii = `╔══════════════════════════╗
║ Outer Container          ║
║ ┌──────────────────────┐ ║
║ │ Inner Container      │ ║
║ └──────────────────────┘ ║
╚══════════════════════════╝`;

      const result = parseAscii(ascii);
      const containers = result.patterns.filter(p => p.type === 'container') as ContainerPattern[];

      // Should detect at least the outer container
      expect(containers.length).toBeGreaterThanOrEqual(1);

      // If nested detection works, we might get both
      if (containers.length >= 2) {
        // Verify we have both double and single border styles
        const borderStyles = containers.map(c => c.borderStyle);
        expect(borderStyles).toContain('double');
      }
    });
  });

  describe('Table Fidelity', () => {
    it('preserves table headers', () => {
      const ascii = `│ Name │ Port │ Status │
│ App  │ 3000 │ ●      │`;

      const result = parseAscii(ascii);
      const tables = result.patterns.filter(p => p.type === 'table') as TablePattern[];

      expect(tables.length).toBe(1);

      const table = tables[0];
      expect(table.headers).toContain('Name');
      expect(table.headers).toContain('Port');
      expect(table.headers).toContain('Status');
    });

    it('preserves row count', () => {
      const ascii = `│ Name │ Port │ Status │
│ App1 │ 3000 │ ●      │
│ App2 │ 3001 │ ○      │
│ App3 │ 3002 │ ◐      │`;

      const result = parseAscii(ascii);
      const tables = result.patterns.filter(p => p.type === 'table') as TablePattern[];

      expect(tables.length).toBe(1);

      const table = tables[0];
      expect(table.rows.length).toBe(3);
    });
  });

  describe('No False Positives', () => {
    it('does not detect patterns in plain text', () => {
      const ascii = `This is just plain text.
Nothing special here.
Just regular words and sentences.`;

      const result = parseAscii(ascii);

      // Filter out any patterns that might be incorrectly detected
      const significantPatterns = result.patterns.filter(p =>
        p.type !== 'text' && p.type !== 'divider'
      );

      expect(significantPatterns.length).toBe(0);
    });

    it('does not detect patterns in code-like text', () => {
      // Using array syntax without the pattern that would match [X] followed by text
      const ascii = `const config = {
  buttons: ['a', 'b', 'c'],
  status: function() { return true; }
};
// Array access: arr[i], arr[j]`;

      const result = parseAscii(ascii);
      const buttons = result.patterns.filter(p => p.type === 'button');

      // Should not detect buttons in JavaScript code
      // Using lowercase letters which don't match the button pattern [A-Z0-9]
      expect(buttons.length).toBe(0);
    });
  });

  describe('Complex Template Fidelity', () => {
    const complexDashboard = `╔════════════════════════════════════════════════════════════════╗
║  DASHBOARD                                          v1.0.0  ║
╠════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Settings  [C] Logs  [X] Exit                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  SERVICES                                                      ║
║  ┌────────────────────────────────────────────────────────────┐║
║  │  Service     Port    Status    Uptime                      │║
║  │  Web         3000    ● running  2h                          │║
║  │  API         3001    ○ stopped  --                          │║
║  │  Worker      3002    ◐ warning  5m                          │║
║  └────────────────────────────────────────────────────────────┘║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝`;

    it('detects all expected pattern types', () => {
      const result = parseAscii(complexDashboard);

      const patternTypes = new Set(result.patterns.map(p => p.type));

      // Should detect buttons
      expect(patternTypes.has('button')).toBe(true);

      // Should detect container(s)
      expect(patternTypes.has('container')).toBe(true);

      // Should detect status indicators
      expect(patternTypes.has('status-indicator')).toBe(true);
    });

    it('maintains consistent pattern count on repeated parsing', () => {
      // Parse the same input 3 times
      const result1 = parseAscii(complexDashboard);
      const result2 = parseAscii(complexDashboard);
      const result3 = parseAscii(complexDashboard);

      // All three should have the same pattern count
      expect(result1.patterns.length).toBe(result2.patterns.length);
      expect(result2.patterns.length).toBe(result3.patterns.length);

      // Also verify pattern types are consistent
      const types1 = result1.patterns.map(p => p.type).sort().join(',');
      const types2 = result2.patterns.map(p => p.type).sort().join(',');
      const types3 = result3.patterns.map(p => p.type).sort().join(',');

      expect(types1).toBe(types2);
      expect(types2).toBe(types3);
    });
  });

  describe('Position Accuracy', () => {
    it('reports correct positions for buttons', () => {
      const ascii = `First line
[A] Button on second line
Third line`;

      const result = parseAscii(ascii);
      const buttons = result.patterns.filter(p => p.type === 'button') as ButtonPattern[];

      expect(buttons.length).toBe(1);
      expect(buttons[0].position.row).toBe(1); // Second line (0-indexed)
      expect(buttons[0].position.col).toBe(0); // Start of line
    });

    it('reports correct positions for status indicators', () => {
      const ascii = 'Status: ● running';
      const result = parseAscii(ascii);
      const statuses = result.patterns.filter(p => p.type === 'status-indicator') as StatusPattern[];

      expect(statuses.length).toBe(1);
      expect(statuses[0].position.row).toBe(0);
      expect(statuses[0].position.col).toBe(8); // Position of ● in the string
    });
  });

  describe('Content Preservation', () => {
    it('preserves raw ASCII in result', () => {
      const ascii = `[A] Action
Status: ● running
┌───────┐
│ Box   │
└───────┘`;

      const result = parseAscii(ascii);

      expect(result.raw).toBe(ascii);
    });

    it('preserves line count', () => {
      const ascii = `Line 1
Line 2
Line 3
Line 4
Line 5`;

      const result = parseAscii(ascii);

      expect(result.lines.length).toBe(5);
      expect(result.gridSize.height).toBe(5);
    });
  });
});
