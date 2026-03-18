import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

const BASE_URL = 'http://localhost:3422';

describe('Project Proxy Integration', () => {

    describe('Proxy View Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch(`${BASE_URL}/projects/non-existent/view`);
            expect(response.status).toBe(404);
        });

        it('should return 503 for stopped project', async () => {
            // First register a project
            await fetch(`${BASE_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: '/tmp/test-project',
                    port: 9999
                })
            });

            const response = await fetch(`${BASE_URL}/projects/test-project/view`);
            expect(response.status).toBe(503);
        });

        afterAll(async () => {
            // Clean up the test project
            await fetch(`${BASE_URL}/projects/test-project`, {
                method: 'DELETE'
            });
        });
    });

    describe('Proxy Control Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch(`${BASE_URL}/projects/non-existent/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'A' })
            });
            expect(response.status).toBe(404);
        });

        describe('with registered project', () => {
            beforeAll(async () => {
                // Register a project for label validation test
                await fetch(`${BASE_URL}/projects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: '/tmp/control-test-project',
                        port: 9998
                    })
                });
            });

            afterAll(async () => {
                // Clean up the test project
                await fetch(`${BASE_URL}/projects/control-test-project`, {
                    method: 'DELETE'
                });
            });

            it('should validate label format', async () => {
                const response = await fetch(`${BASE_URL}/projects/control-test-project/control`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label: 'INVALID' })
                });
                expect(response.status).toBe(400);
            });
        });
    });

    describe('Project Bindings Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch(`${BASE_URL}/projects/non-existent/bindings`);
            expect(response.status).toBe(404);
        });
    });
});
