// tests/youtube-routes.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { PxOSServer } from '../sync/server.js';

describe('YouTube API Routes', () => {
  let server;
  const port = 3999;

  beforeEach(async () => {
    server = new PxOSServer(port);
    await server.start();
    // Small delay to ensure server is fully ready
    await new Promise(r => setTimeout(r, 100));
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should serve YouTube viewer page at /youtube', async () => {
    const res = await fetch(`http://localhost:${port}/youtube`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/html'));
    const html = await res.text();
    assert.ok(html.includes('ASCII YouTube'));
  });

  it('should return feed at /api/youtube/feed', async () => {
    const res = await fetch(`http://localhost:${port}/api/youtube/feed`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.hasOwnProperty('videos'));
    assert.ok(data.hasOwnProperty('fetched'));
    assert.ok(Array.isArray(data.videos));
  });

  it('should return channels list at /api/youtube/channels', async () => {
    const res = await fetch(`http://localhost:${port}/api/youtube/channels`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.hasOwnProperty('channels'));
    assert.ok(Array.isArray(data.channels));
  });
});
