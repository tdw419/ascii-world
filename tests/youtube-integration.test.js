// tests/youtube-integration.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { PxOSServer } from '../sync/server.js';
import { execSync } from 'child_process';

describe('YouTube Integration', () => {
    let server;
    const port = 3998;

    beforeEach(async () => {
        server = new PxOSServer(port);
        await server.start();
        // Small delay to ensure server is fully ready
        await new Promise(r => setTimeout(r, 100));
    });

    afterEach(async () => {
        await server.stop();
    });

    it('should have yt-dlp available (or warn)', () => {
        try {
            const version = execSync('yt-dlp --version', { encoding: 'utf-8' }).trim();
            console.log('yt-dlp version:', version);
            assert.ok(version);
        } catch (err) {
            console.log('yt-dlp not installed - audio tests will be skipped');
            // Don't fail - just warn
            assert.ok(true);
        }
    });

    it('should handle empty feed gracefully', async () => {
        const res = await fetch(`http://localhost:${port}/api/youtube/feed`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.hasOwnProperty('videos'));
        assert.ok(Array.isArray(data.videos));
    });

    it('should validate channel URLs on add', async () => {
        const res = await fetch(`http://localhost:${port}/api/youtube/channels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://evil.com/@fake' })
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error.includes('Invalid'));
    });

    it('should list channels', async () => {
        const res = await fetch(`http://localhost:${port}/api/youtube/channels`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.hasOwnProperty('channels'));
        assert.ok(Array.isArray(data.channels));
    });

    it('should reject missing URL on add', async () => {
        const res = await fetch(`http://localhost:${port}/api/youtube/channels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'test' })
        });
        assert.strictEqual(res.status, 400);
    });

    it('should require URL parameter for audio endpoint', async () => {
        const res = await fetch(`http://localhost:${port}/api/youtube/audio`);
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error.includes('Missing'));
    });
});
