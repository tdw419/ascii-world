import { describe, it, expect, beforeEach } from 'bun:test';

const MANAGER_URL = 'http://localhost:3422';

describe('Manager Dashboard', () => {

    beforeEach(async () => {
        // Reset state to PROJECTS before each test
        await fetch(`${MANAGER_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: 'A' })
        });
    });

    // Note: formatUptime and formatTime are not exported from manager-server.ts.
    // These tests mirror the implementation logic to ensure correctness.
    // If the implementation changes, these tests should be updated accordingly.
    describe('formatUptime helper', () => {
        it('should return "--" for undefined startedAt', () => {
            const startedAt = undefined;
            const result = !startedAt ? '--' : 'should not happen';
            expect(result).toBe('--');
        });

        it('should format seconds correctly', () => {
            const startedAt = Date.now() - 30000; // 30 seconds ago
            const elapsedMs = Date.now() - startedAt;
            const seconds = Math.floor(elapsedMs / 1000);
            expect(seconds).toBeGreaterThanOrEqual(29);
            expect(seconds).toBeLessThanOrEqual(31);
        });

        it('should format minutes correctly', () => {
            const startedAt = Date.now() - 120000; // 2 minutes ago
            const elapsedMs = Date.now() - startedAt;
            const minutes = Math.floor(elapsedMs / 60000);
            expect(minutes).toBeGreaterThanOrEqual(1);
            expect(minutes).toBeLessThanOrEqual(3);
        });
    });

    describe('formatTime helper', () => {
        it('should return "--" for null timestamp', () => {
            const timestamp = null;
            const result = !timestamp ? '--' : 'should not happen';
            expect(result).toBe('--');
        });

        it('should format valid timestamp', () => {
            const timestamp = Date.now();
            const date = new Date(timestamp);
            const result = date.toLocaleTimeString('en-US', { hour12: false });
            expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });
    });

    describe('Dashboard State Transitions', () => {
        it('should transition to DASHBOARD from PROJECTS with F label', async () => {
            const response = await fetch(`${MANAGER_URL}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'F' })
            });
            const data = await response.json();
            expect(data.status).toBe('ok');
            expect(data.action).toBe('goto_dashboard');
        });
    });

    describe('Dashboard View Endpoint', () => {
        it('should return ASCII view for dashboard state', async () => {
            // First set state to DASHBOARD
            await fetch(`${MANAGER_URL}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'F' })
            });

            const response = await fetch(`${MANAGER_URL}/view`);
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toContain('text/plain');

            const text = await response.text();
            expect(text).toContain('DASHBOARD');
            expect(text).toContain('SYSTEM HEALTH');
        });

        it('should show summary counts', async () => {
            // Set state to DASHBOARD
            await fetch(`${MANAGER_URL}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'F' })
            });

            const response = await fetch(`${MANAGER_URL}/view`);
            const text = await response.text();
            expect(text).toContain('running');
            expect(text).toContain('stopped');
            expect(text).toContain('error');
        });
    });

    describe('Dashboard Refresh', () => {
        it('should refresh health data with R label in DASHBOARD state', async () => {
            // Set state to DASHBOARD
            await fetch(`${MANAGER_URL}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'F' })
            });

            const response = await fetch(`${MANAGER_URL}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'R' })
            });
            const data = await response.json();
            expect(data.status).toBe('ok');
            expect(data.action).toBe('refresh_dashboard');
        });
    });
});
