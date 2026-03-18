import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

describe('Project Proxy Integration', () => {

    describe('Proxy View Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch('http://localhost:3422/projects/non-existent/view');
            expect(response.status).toBe(404);
        });

        it('should return 503 for stopped project', async () => {
            // First register a project
            await fetch('http://localhost:3422/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: '/tmp/test-project',
                    port: 9999
                })
            });

            const response = await fetch('http://localhost:3422/projects/test-project/view');
            expect(response.status).toBe(503);
        });
    });

    describe('Proxy Control Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch('http://localhost:3422/projects/non-existent/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'A' })
            });
            expect(response.status).toBe(404);
        });

        it('should validate label format', async () => {
            const response = await fetch('http://localhost:3422/projects/some-project/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: 'INVALID' })
            });
            expect(response.status).toBe(400);
        });
    });

    describe('Project Bindings Endpoint', () => {
        it('should return 404 for non-existent project', async () => {
            const response = await fetch('http://localhost:3422/projects/non-existent/bindings');
            expect(response.status).toBe(404);
        });
    });
});
