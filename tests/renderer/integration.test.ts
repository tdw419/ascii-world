/**
 * Integration tests for Renderer with ascii-ref-app
 *
 * These tests verify the renderer works correctly with a real ASCII app.
 * They test:
 * 1. Fetching state from the app
 * 2. Fetching ASCII view from the app
 * 3. Sending control commands and seeing state changes
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, ChildProcess } from 'child_process';

describe('Renderer Integration', () => {
    let serverProcess: ChildProcess | null = null;
    const API_URL = 'http://localhost:3421';

    beforeAll(async () => {
        // Start the test server (standalone version without Electrobun deps)
        serverProcess = spawn('bun', ['run', 'tests/renderer/test-server.ts'], {
            cwd: process.cwd(),
            stdio: 'pipe',
            detached: true,
        });

        // Wait for server to start
        await new Promise((resolve) => setTimeout(resolve, 1500));
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

    it('can fetch state from ascii-ref-app', async () => {
        const res = await fetch(`${API_URL}/state`);
        expect(res.ok).toBe(true);

        const state = await res.json();
        expect(state.state).toBeDefined();
        expect(state.tasks).toBeInstanceOf(Array);
    });

    it('can fetch ASCII view from ascii-ref-app', async () => {
        const res = await fetch(`${API_URL}/view`);
        expect(res.ok).toBe(true);

        const view = await res.text();
        expect(view).toContain('ASCII-REF-APP');
        expect(view).toContain('[A]');
    });

    it('can send control command and see state change', async () => {
        // Get initial state
        const initialRes = await fetch(`${API_URL}/state`);
        const initialState = await initialRes.json();
        expect(initialState.state).toBe('HOME');

        // Send control command
        const controlRes = await fetch(`${API_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: 'A' }),
        });
        expect(controlRes.ok).toBe(true);

        const controlResult = await controlRes.json();
        expect(controlResult.newState).toBe('TASKS');

        // Verify state changed
        const newStateRes = await fetch(`${API_URL}/state`);
        const newState = await newStateRes.json();
        expect(newState.state).toBe('TASKS');
    });
});
