// tests/server.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { PxOSServer } from '../sync/server.js';

describe('PxOSServer', () => {
    let server;

    beforeEach(async () => {
        server = new PxOSServer(3840); // Use different port for tests
        await server.start();
        // Small delay to ensure server is fully ready
        await new Promise(r => setTimeout(r, 100));
    });

    afterEach(async () => {
        await server.stop();
    });

    it('starts and stops', () => {
        assert.ok(server.httpServer);
    });

    it('GET /health returns ok', async () => {
        const res = await fetch('http://localhost:3840/health');
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, 'ok');
    });

    it('GET /api/v1/cells returns empty object initially', async () => {
        const res = await fetch('http://localhost:3840/api/v1/cells');
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.deepStrictEqual(data, {});
    });

    it('POST /api/v1/cells stores values', async () => {
        const res1 = await fetch('http://localhost:3840/api/v1/cells', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpu: 0.67, mem: 28 })
        });
        assert.strictEqual(res1.status, 200);
        const data1 = await res1.json();
        assert.strictEqual(data1.ok, true);

        const res2 = await fetch('http://localhost:3840/api/v1/cells');
        const data2 = await res2.json();
        assert.strictEqual(data2.cpu, 0.67);
        assert.strictEqual(data2.mem, 28);
    });

    it('GET /api/v1/render returns PNG', async () => {
        // Set template first
        const templateRes = await fetch('http://localhost:3840/api/v1/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ fn: 'BAR', args: [0, 0, 'cpu', 40] }])
        });
        assert.strictEqual(templateRes.status, 200);

        const cellsRes = await fetch('http://localhost:3840/api/v1/cells', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpu: 0.5 })
        });
        assert.strictEqual(cellsRes.status, 200);

        // Small delay to ensure server is ready
        await new Promise(r => setTimeout(r, 50));

        const res = await fetch('http://localhost:3840/api/v1/render');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('content-type'), 'image/png');

        const buffer = await res.arrayBuffer();
        // Check PNG magic bytes
        const view = new Uint8Array(buffer);
        assert.strictEqual(view[0], 0x89);
        assert.strictEqual(view[1], 0x50); // 'P'
        assert.strictEqual(view[2], 0x4E); // 'N'
        assert.strictEqual(view[3], 0x47); // 'G'
    });

    it('POST /api/v1/template sets render template', async () => {
        const template = [
            { fn: 'BAR', args: [0, 0, 'cpu', 40] },
            { fn: 'TEXT', args: [42, 0, 'cpu'] }
        ];
        const res = await fetch('http://localhost:3840/api/v1/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(template)
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.ok, true);
        assert.strictEqual(data.templateSize, 2);
    });

    it('returns 404 for unknown routes', async () => {
        const res = await fetch('http://localhost:3840/unknown');
        assert.strictEqual(res.status, 404);
    });
});
