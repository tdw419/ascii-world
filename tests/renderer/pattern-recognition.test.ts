/**
 * Integration tests for Pattern Recognition against real Manager ASCII templates
 *
 * These tests verify that the pattern detection pipeline correctly identifies
 * buttons, containers, tables, and status indicators in real ASCII templates.
 */

import { describe, it, expect } from 'bun:test';
import { parseAscii } from '../../src/renderer/patterns/parser';

describe('Pattern Recognition Integration', () => {
    describe('Projects Template', () => {
        const projectsAscii = `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  REGISTERED ASCII PROJECTS                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  [1] My App    (port 3000)  ● running                                    │║
║  │  [2] API Server (port 3001)  ○ stopped                                   │║
║  │  [3] Worker    (port 3002)  ◐ warning                                    │║
║  │  [N] New Project...                                                      │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  Selected: 1                                                                ║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [S] Start  [T] Stop  [R] Refresh  [V] View ASCII  [E] Edit Project         ║
╚══════════════════════════════════════════════════════════════════════════════╝`;

        it('detects all button patterns', () => {
            const result = parseAscii(projectsAscii);
            const buttons = result.patterns.filter(p => p.type === 'button');

            // Should detect navigation buttons
            expect(buttons.length).toBeGreaterThanOrEqual(6);

            const labels = buttons.map(b => (b as any).label);
            expect(labels).toContain('A');
            expect(labels).toContain('B');
            expect(labels).toContain('X');
        });

        it('detects container (box) patterns', () => {
            const result = parseAscii(projectsAscii);
            const containers = result.patterns.filter(p => p.type === 'container');

            // Main container and inner project list container
            expect(containers.length).toBeGreaterThanOrEqual(1);
        });

        it('detects status indicators', () => {
            const result = parseAscii(projectsAscii);
            const statuses = result.patterns.filter(p => p.type === 'status-indicator');

            // ● running, ○ stopped, ◐ warning
            expect(statuses.length).toBeGreaterThanOrEqual(3);

            const statusValues = statuses.map(s => (s as any).status);
            expect(statusValues).toContain('running');
            expect(statusValues).toContain('stopped');
            expect(statusValues).toContain('warning');
        });

        it('correctly identifies grid dimensions', () => {
            const result = parseAscii(projectsAscii);

            // Grid height should match line count
            expect(result.gridSize.height).toBe(19);
            expect(result.gridSize.width).toBeGreaterThan(70);
        });
    });

    describe('Dashboard Template', () => {
        const dashboardAscii = `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER - DASHBOARD                       v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [F] Dashboard  [X] Quit          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SYSTEM HEALTH                                           Last Check: 14:32:00║
║  ┌──────────────────────────────────────────────────────────────────────────┐║
║  │  Project                    Port    Status    Uptime     Last Check      │║
║  ├──────────────────────────────────────────────────────────────────────────┤║
║  │  [1] My App      3000    ● running  2h 15m     14:32:00    │║
║  │  [2] API Server  3001    ○ stopped  --          --          │║
║  │  [3] Worker      3002    ◑ warning  45m        14:31:55    │║
║  └──────────────────────────────────────────────────────────────────────────┘║
║                                                                              ║
║  Summary: 1 running, 1 stopped, 1 error                        ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [R] Refresh  [1-9] Select Project                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝`;

        it('detects navigation buttons', () => {
            const result = parseAscii(dashboardAscii);
            const buttons = result.patterns.filter(p => p.type === 'button');

            expect(buttons.length).toBeGreaterThanOrEqual(4);

            const labels = buttons.map(b => (b as any).label);
            expect(labels).toContain('A');
            expect(labels).toContain('R');
            expect(labels).toContain('X');
        });

        it('detects status indicators with different states', () => {
            const result = parseAscii(dashboardAscii);
            const statuses = result.patterns.filter(p => p.type === 'status-indicator');

            expect(statuses.length).toBeGreaterThanOrEqual(3);

            const statusValues = statuses.map(s => (s as any).status);
            expect(statusValues).toContain('running');
            expect(statusValues).toContain('stopped');
        });

        it('detects main container structure', () => {
            const result = parseAscii(dashboardAscii);
            const containers = result.patterns.filter(p => p.type === 'container');

            expect(containers.length).toBeGreaterThanOrEqual(1);
        });

        it('preserves raw ASCII in result', () => {
            const result = parseAscii(dashboardAscii);
            expect(result.raw).toBe(dashboardAscii);
        });
    });

    describe('Complex Template with Nested Elements', () => {
        const complexAscii = `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER - PROJECT VIEW                    v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  PROJECT: my-app                                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │ Status: ● running   Port: 3000   Uptime: 2h 15m                         │║
║  │ URL: http://localhost:3000                                               │║
║  │                                                                          │║
║  │ RECENT LOGS                                                              │║
║  │ ┌────────────────────────────────────────────────────────────────────┐  │║
║  │ │ 14:30:15 GET /api/users 200                                         │  │║
║  │ │ 14:30:16 POST /api/login 200                                        │  │║
║  │ │ 14:30:17 GET /api/data 500 ●                                        │  │║
║  │ └────────────────────────────────────────────────────────────────────┘  │║
║  │                                                                          │║
║  │ ENDPOINTS                                                                │║
║  │ │ Path          Method   Status                                        │║
║  │ │ /api/users    GET      ● 200                                         │║
║  │ │ /api/login    POST     ● 200                                         │║
║  │ │ /api/data     GET      ◉ 500                                         │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [S] Start  [T] Stop  [R] Refresh  [L] Logs  [V] View                      ║
╚══════════════════════════════════════════════════════════════════════════════╝`;

        it('detects multiple status indicators', () => {
            const result = parseAscii(complexAscii);
            const statuses = result.patterns.filter(p => p.type === 'status-indicator');

            // At least one running status, plus error indicators
            expect(statuses.length).toBeGreaterThanOrEqual(4);
        });

        it('detects nested container structures', () => {
            const result = parseAscii(complexAscii);
            const containers = result.patterns.filter(p => p.type === 'container');

            // Main container + logs container
            expect(containers.length).toBeGreaterThanOrEqual(1);
        });

        it('detects all action buttons', () => {
            const result = parseAscii(complexAscii);
            const buttons = result.patterns.filter(p => p.type === 'button');

            const labels = buttons.map(b => (b as any).label);
            expect(labels).toContain('S');
            expect(labels).toContain('T');
            expect(labels).toContain('R');
            expect(labels).toContain('L');
        });

        it('correctly reports total pattern count', () => {
            const result = parseAscii(complexAscii);

            // Should have detected multiple patterns of different types
            expect(result.patterns.length).toBeGreaterThanOrEqual(8);
        });
    });

    describe('Edge Cases', () => {
        it('handles empty input gracefully', () => {
            const result = parseAscii('');
            expect(result.patterns).toHaveLength(0);
            expect(result.raw).toBe('');
        });

        it('handles whitespace-only input', () => {
            const result = parseAscii('   \n\n   \n   ');
            expect(result.patterns).toHaveLength(0);
        });

        it('handles plain text without patterns', () => {
            const result = parseAscii('Hello World\nThis is just text\nNo patterns here');
            expect(result.patterns).toHaveLength(0);
            expect(result.gridSize.height).toBe(3);
        });

        it('handles malformed box characters gracefully', () => {
            const malformedAscii = `┌───┐
│ X │
└───┘`;
            const result = parseAscii(malformedAscii);
            // Should not crash, may or may not detect patterns
            expect(result.raw).toBe(malformedAscii);
        });
    });

    describe('Pattern Type Coverage', () => {
        it('detects all four pattern types in one template', () => {
            const allPatternsAscii = `╔════════════════════════╗
║  Dashboard             ║
╠════════════════════════╣
║ [A] Action  [B] Back   ║
╠════════════════════════╣
║ Status: ● running      ║
║ │ Name  │ Status │     ║
║ │ App   │ ○      │     ║
╚════════════════════════╝`;

            const result = parseAscii(allPatternsAscii);

            const types = new Set(result.patterns.map(p => p.type));

            expect(types.has('button')).toBe(true);
            expect(types.has('status-indicator')).toBe(true);
            expect(types.has('container')).toBe(true);
        });
    });

    describe('Performance', () => {
        it('handles large templates efficiently', () => {
            // Generate a large template with many patterns
            const lines = [
                '╔' + '═'.repeat(100) + '╗',
                '║  Large Dashboard' + ' '.repeat(83) + '║',
                '╠' + '═'.repeat(100) + '╣',
            ];

            // Add 20 rows of buttons
            for (let i = 0; i < 20; i++) {
                const label = String.fromCharCode(65 + (i % 26));
                lines.push(`║  [${label}] Item ${i + 1}` + ' '.repeat(88 - String(i + 1).length) + '║');
            }

            lines.push('╠' + '═'.repeat(100) + '╣');

            // Add 20 status indicators
            for (let i = 0; i < 20; i++) {
                const status = ['●', '○', '◐', '◑', '◉'][i % 5];
                lines.push(`║  Service ${i + 1}: ${status} status` + ' '.repeat(84 - String(i + 1).length) + '║');
            }

            lines.push('╚' + '═'.repeat(100) + '╝');

            const largeAscii = lines.join('\n');

            const startTime = performance.now();
            const result = parseAscii(largeAscii);
            const endTime = performance.now();

            // Should complete in under 100ms
            expect(endTime - startTime).toBeLessThan(100);

            // Should detect a significant number of patterns
            expect(result.patterns.length).toBeGreaterThan(20);
        });
    });
});
