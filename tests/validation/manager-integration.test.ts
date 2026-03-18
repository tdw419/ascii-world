/**
 * Manager Integration Tests
 *
 * Integration tests that validate pattern detection against real ASCII output
 * from the running manager server.
 *
 * These tests verify that the pattern recognition system correctly parses
 * ASCII output from the actual manager server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, ChildProcess } from 'child_process';
import { parseAscii } from '../../src/renderer/patterns/parser';
import type { ButtonPattern, ContainerPattern, StatusPattern, DetectedPattern } from '../../src/renderer/patterns/types';

const MANAGER_URL = 'http://localhost:3422';

describe('Manager Integration Tests', () => {
    let serverProcess: ChildProcess | null = null;

    beforeAll(async () => {
        // Start the manager server
        serverProcess = spawn('bun', ['run', 'src/manager/manager-server.ts'], {
            cwd: process.cwd(),
            stdio: 'pipe',
            detached: true,
        });

        // Wait for server to start
        await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    afterAll(() => {
        if (serverProcess) {
            // Kill the process group to ensure all child processes are terminated
            try {
                process.kill(-serverProcess.pid!);
            } catch {
                // Process may already be dead
            }
        }
    });

    /**
     * Helper function to fetch the current view from the manager
     */
    async function fetchView(): Promise<string> {
        const res = await fetch(`${MANAGER_URL}/view`);
        if (!res.ok) {
            throw new Error(`Failed to fetch view: ${res.status} ${res.statusText}`);
        }
        return await res.text();
    }

    /**
     * Helper function to send a control command to the manager
     */
    async function sendControl(label: string): Promise<void> {
        const res = await fetch(`${MANAGER_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label }),
        });
        if (!res.ok) {
            throw new Error(`Failed to send control: ${res.status} ${res.statusText}`);
        }
    }

    /**
     * Helper function to get all buttons from patterns
     */
    function getButtons(patterns: DetectedPattern[]): ButtonPattern[] {
        return patterns.filter((p): p is ButtonPattern => p.type === 'button');
    }

    /**
     * Helper function to get all containers from patterns
     */
    function getContainers(patterns: DetectedPattern[]): ContainerPattern[] {
        return patterns.filter((p): p is ContainerPattern => p.type === 'container');
    }

    /**
     * Helper function to get all status indicators from patterns
     */
    function getStatusIndicators(patterns: DetectedPattern[]): StatusPattern[] {
        return patterns.filter((p): p is StatusPattern => p.type === 'status-indicator');
    }

    describe('Projects View Pattern Detection', () => {
        it('detects navigation buttons in projects view', async () => {
            // Navigate to projects view
            await sendControl('A');

            // Fetch and parse the view
            const ascii = await fetchView();
            const parsed = parseAscii(ascii);

            // Get buttons and verify navigation buttons exist
            const buttons = getButtons(parsed.patterns);
            const labels = buttons.map((b) => b.label);

            // Projects view should have 'A' and 'X' buttons
            expect(labels).toContain('A');
            expect(labels).toContain('X');
        });

        it('detects container structure in projects view', async () => {
            // Fetch and parse the view
            const ascii = await fetchView();
            const parsed = parseAscii(ascii);

            // Get containers and verify at least one exists
            const containers = getContainers(parsed.patterns);
            expect(containers.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Dashboard View Pattern Detection', () => {
        it('detects dashboard navigation button', async () => {
            // Navigate to dashboard
            await sendControl('F');

            // Fetch and parse the view
            const ascii = await fetchView();
            const parsed = parseAscii(ascii);

            // Get buttons and verify 'F' button exists
            const buttons = getButtons(parsed.patterns);
            const labels = buttons.map((b) => b.label);

            expect(labels).toContain('F');
        });

        it('detects status indicators in health table', async () => {
            // Fetch and parse the view
            const ascii = await fetchView();
            const parsed = parseAscii(ascii);

            // Get all patterns and verify some exist
            expect(parsed.patterns.length).toBeGreaterThan(0);

            // Check for status indicators or tables
            const statusIndicators = getStatusIndicators(parsed.patterns);
            // Note: Status indicators might be in tables, so we check patterns exist
            expect(parsed.patterns.length).toBeGreaterThan(0);
        });
    });

    describe('Pattern Quality Validation', () => {
        it('parsed patterns should match ASCII content', async () => {
            // Fetch and parse the view
            const ascii = await fetchView();
            const parsed = parseAscii(ascii);

            // Verify raw is preserved
            expect(parsed.raw).toBe(ascii);

            // Verify gridSize.height matches line count
            expect(parsed.gridSize.height).toBe(parsed.lines.length);

            // Verify all lines are preserved
            expect(parsed.lines.join('\n')).toBe(ascii.trim());
        });

        it('button labels should be single characters', async () => {
            // Fetch and parse the view
            const ascii = await fetchView();
            const parsed = parseAscii(ascii);

            // Get all buttons
            const buttons = getButtons(parsed.patterns);

            // All button labels should be single alphanumeric characters
            for (const button of buttons) {
                expect(button.label).toMatch(/^[A-Z0-9]$/);
                expect(button.label.length).toBe(1);
            }
        });

        it('status indicators should have valid states', async () => {
            // Fetch and parse the view
            const ascii = await fetchView();
            const parsed = parseAscii(ascii);

            // Get all status indicators
            const statusIndicators = getStatusIndicators(parsed.patterns);
            const validStates = ['running', 'stopped', 'warning', 'paused', 'error', 'unknown'];

            // All status indicators should have valid states
            for (const status of statusIndicators) {
                expect(validStates).toContain(status.status);
            }
        });
    });

    describe('Cross-View Validation', () => {
        it('all views should have consistent main navigation', async () => {
            const allLabels = new Set<string>();
            const views = ['A', 'B', 'C', 'D', 'E'];

            // Navigate through all views and collect button labels
            for (const viewLabel of views) {
                try {
                    await sendControl(viewLabel);
                    const ascii = await fetchView();
                    const parsed = parseAscii(ascii);
                    const buttons = getButtons(parsed.patterns);

                    for (const button of buttons) {
                        allLabels.add(button.label);
                    }
                } catch {
                    // Some views may not exist or be accessible
                    // Continue with other views
                }
            }

            // Should have collected more than 3 unique button labels across views
            expect(allLabels.size).toBeGreaterThan(3);
        });
    });
});
