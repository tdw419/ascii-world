// tests/server.test.js
import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { PxOSServer } from '../sync/server.js';

describe('PxOSServer', () => {
    let server;

    beforeEach(async () => {
        server = new PxOSServer(3840); // Use different port for tests
        // Clear CMS content store so tests don't leak across runs
        server.cmsContentStore.items.clear();
        server.cmsContentStore.manifests.clear();
        await server.start();
        // Stop VCC bridge to prevent it from populating cells during tests
        server.vccBridge.stop();
        // Clear any cells written by VCC bridge or other subsystems during start
        server.cellStore.cells = {};
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

    describe('Multi-Renderer API', () => {
        const sampleASCII = '╔════════╗\n║ TEST   ║\n╚════════╝';

        it('GET /api/v1/render/html returns default state as HTML', async () => {
            const res = await fetch('http://localhost:3840/api/v1/render/html');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get('content-type'), 'text/html');
            const html = await res.text();
            assert.ok(html.includes('<pre class="ascii-world'));
        });

        it('POST /api/v1/render/python renders provided ASCII', async () => {
            const res = await fetch('http://localhost:3840/api/v1/render/python', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: sampleASCII })
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get('content-type'), 'text/x-python');
            const code = await res.text();
            assert.ok(code.includes('class ASCIIWorld:'));
            assert.ok(code.includes('TEST'));
        });

        it('POST /api/v1/render/svg renders provided ASCII', async () => {
            const res = await fetch('http://localhost:3840/api/v1/render/svg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: sampleASCII })
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get('content-type'), 'image/svg+xml');
            const svg = await res.text();
            assert.ok(svg.includes('<svg'));
        });

        it('returns 400 for unknown format', async () => {
            const res = await fetch('http://localhost:3840/api/v1/render/unknown');
            assert.strictEqual(res.status, 400);
            const data = await res.json();
            assert.ok(data.error.includes('Unknown format'));
        });
    });

    // ── CMS Navigation & Routing API ────────────────────────────

    describe('CMS Navigation API', () => {
        it('GET /api/cms/nav returns navigation tree and history', async () => {
            const res = await fetch('http://localhost:3840/api/cms/nav');
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.ok(Array.isArray(data.tree));
            assert.ok(data.history);
            assert.ok('history' in data.history);
            assert.ok('index' in data.history);
        });

        it('GET /api/cms/nav reflects manifests added to content store', async () => {
            server.cmsContentStore.createManifest({ title: 'Test Page', slug: 'test-page' });
            const res = await fetch('http://localhost:3840/api/cms/nav');
            const data = await res.json();
            assert.strictEqual(data.tree.length, 1);
            assert.strictEqual(data.tree[0].title, 'Test Page');
            assert.strictEqual(data.tree[0].path, '/test-page');
        });

        it('GET /api/cms/nav reflects nested page hierarchy', async () => {
            server.cmsContentStore.createManifest({ title: 'Blog', slug: 'blog' });
            server.cmsContentStore.createManifest({ title: 'Blog Post', slug: 'blog/post-1' });
            const res = await fetch('http://localhost:3840/api/cms/nav');
            const data = await res.json();
            assert.strictEqual(data.tree.length, 1);
            assert.strictEqual(data.tree[0].title, 'Blog');
            assert.strictEqual(data.tree[0].children.length, 1);
            assert.strictEqual(data.tree[0].children[0].title, 'Blog Post');
        });

        it('GET /api/cms/page resolves an existing slug', async () => {
            const m = server.cmsContentStore.createManifest({ title: 'About', slug: 'about' });
            const res = await fetch('http://localhost:3840/api/cms/page?slug=about');
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.slug, 'about');
            assert.strictEqual(data.is404, false);
            assert.ok(data.manifest);
            assert.strictEqual(data.manifest.id, m.id);
        });

        it('GET /api/cms/page returns 404 for unknown slug', async () => {
            const res = await fetch('http://localhost:3840/api/cms/page?slug=no-such-page');
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.is404, true);
            assert.strictEqual(data.manifest, null);
        });

        it('GET /api/cms/page resolves with leading slash normalization', async () => {
            server.cmsContentStore.createManifest({ title: 'Home', slug: 'home' });
            const res = await fetch('http://localhost:3840/api/cms/page?slug=/home');
            const data = await res.json();
            assert.strictEqual(data.slug, 'home');
            assert.strictEqual(data.is404, false);
        });

        it('GET /api/cms/page with empty slug returns 404', async () => {
            const res = await fetch('http://localhost:3840/api/cms/page?slug=');
            const data = await res.json();
            assert.strictEqual(data.is404, true);
        });

        it('CMS router navigate updates history reflected in /api/cms/nav', async () => {
            server.cmsContentStore.createManifest({ title: 'Page A', slug: 'page-a' });
            server.cmsContentStore.createManifest({ title: 'Page B', slug: 'page-b' });
            server.cmsRouter.navigate('page-a');
            server.cmsRouter.navigate('page-b');

            const res = await fetch('http://localhost:3840/api/cms/nav');
            const data = await res.json();
            assert.deepStrictEqual(data.history.history, ['page-a', 'page-b']);
            assert.strictEqual(data.history.index, 1);
            assert.strictEqual(data.history.current, 'page-b');
        });
    });

    // ── CMS WebSocket Navigation ────────────────────────────────

    describe('CMS WebSocket Navigation', () => {
        let WebSocket;
        before(async () => {
            const mod = await import('ws');
            WebSocket = mod.default;
        });

        function connectWS() {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:3840`);
                ws.on('open', () => resolve(ws));
                ws.on('error', reject);
            });
        }

        function waitForMessage(ws, type, timeout = 2000) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
                ws.on('message', (raw) => {
                    const msg = JSON.parse(raw.toString());
                    if (msg.type === type) {
                        clearTimeout(timer);
                        resolve(msg);
                    }
                });
            });
        }

        it('cms:navigate sends cms:page-change response', async () => {
            server.cmsContentStore.createManifest({ title: 'WS Page', slug: 'ws-page' });
            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:page-change');
                ws.send(JSON.stringify({ type: 'cms:navigate', slug: 'ws-page' }));
                const msg = await msgPromise;
                assert.strictEqual(msg.slug, 'ws-page');
                assert.strictEqual(msg.is404, false);
                assert.ok(msg.manifest);
            } finally {
                ws.close();
            }
        });

        it('cms:navigate to 404 returns is404 true', async () => {
            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:page-change');
                ws.send(JSON.stringify({ type: 'cms:navigate', slug: 'nonexistent' }));
                const msg = await msgPromise;
                assert.strictEqual(msg.is404, true);
                assert.strictEqual(msg.manifest, null);
            } finally {
                ws.close();
            }
        });

        it('cms:back sends navigation response', async () => {
            server.cmsContentStore.createManifest({ title: 'Back A', slug: 'back-a' });
            server.cmsContentStore.createManifest({ title: 'Back B', slug: 'back-b' });
            server.cmsRouter.navigate('back-a');
            server.cmsRouter.navigate('back-b');

            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:navigation');
                ws.send(JSON.stringify({ type: 'cms:back' }));
                const msg = await msgPromise;
                assert.strictEqual(msg.action, 'back');
                assert.ok(msg.result);
                assert.strictEqual(msg.result.slug, 'back-a');
            } finally {
                ws.close();
            }
        });

        it('cms:forward sends navigation response', async () => {
            server.cmsContentStore.createManifest({ title: 'Fwd A', slug: 'fwd-a' });
            server.cmsContentStore.createManifest({ title: 'Fwd B', slug: 'fwd-b' });
            server.cmsRouter.navigate('fwd-a');
            server.cmsRouter.navigate('fwd-b');
            server.cmsRouter.back();

            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:navigation');
                ws.send(JSON.stringify({ type: 'cms:forward' }));
                const msg = await msgPromise;
                assert.strictEqual(msg.action, 'forward');
                assert.ok(msg.result);
                assert.strictEqual(msg.result.slug, 'fwd-b');
            } finally {
                ws.close();
            }
        });
    });

    // ── CMS Theme Editor HTTP API ────────────────────────────────

    describe('CMS Theme Editor API', () => {
        it('GET /api/cms/theme returns current theme', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme');
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.ok(data.theme);
            assert.strictEqual(data.theme.name, 'default');
        });

        it('GET /api/cms/theme/preview returns text/plain preview', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/preview');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get('content-type'), 'text/plain');
            const text = await res.text();
            assert.ok(text.includes('Theme Preview'));
        });

        it('POST /api/cms/theme/save persists theme', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'test-save', fg: [255, 0, 0, 255] }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.ok, true);
            assert.ok(data.theme);
            assert.deepStrictEqual(data.theme.fg, [255, 0, 0, 255]);
        });

        it('POST /api/cms/theme/save with theme object', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: { name: 'wrapped', bg: [0, 0, 0, 255] } }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.ok, true);
            assert.strictEqual(data.theme.name, 'wrapped');
        });

        it('POST /api/cms/theme/reset resets to saved state', async () => {
            // First save a theme
            await fetch('http://localhost:3840/api/cms/theme/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'before-reset', fg: [100, 100, 100, 255] }),
            });
            // Modify via save again
            await fetch('http://localhost:3840/api/cms/theme/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'modified', fg: [50, 50, 50, 255] }),
            });
            // Reset
            const res = await fetch('http://localhost:3840/api/cms/theme/reset', {
                method: 'POST',
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.ok, true);
            assert.ok(data.theme);
        });

        it('GET /api/cms/theme/preset lists presets', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/preset');
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.ok(data.presets);
            assert.ok(data.presets.default);
            assert.ok(data.presets.terminal);
            assert.ok(data.presets.amber);
        });

        it('GET /api/cms/theme/preset?name=terminal applies preset', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/preset?name=terminal');
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.ok, true);
            assert.deepStrictEqual(data.theme.fg, [0, 255, 0, 255]);
        });

        it('GET /api/cms/theme/preset?name=nonexistent returns 404', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/preset?name=nonexistent');
            assert.strictEqual(res.status, 404);
            const data = await res.json();
            assert.ok(data.error.includes('Unknown preset'));
        });

        it('POST /api/cms/theme/generate creates theme from description', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: 'dark blue ocean with glow' }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.ok, true);
            assert.ok(data.theme);
            assert.ok(data.theme.name.startsWith('ai-'));
            assert.deepStrictEqual(data.theme.effects.glow, true);
        });

        it('POST /api/cms/theme/generate returns 400 without description', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            assert.strictEqual(res.status, 400);
            const data = await res.json();
            assert.ok(data.error.includes('description'));
        });

        it('POST /api/cms/theme/generate handles sunset theme', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: 'sunset with rounded borders' }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.theme.borderStyle, 'rounded');
            assert.deepStrictEqual(data.theme.fg, [255, 200, 100, 255]);
        });

        it('POST /api/cms/theme/generate handles retro terminal', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: 'retro terminal with scanlines' }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.deepStrictEqual(data.theme.fg, [0, 255, 0, 255]);
            assert.strictEqual(data.theme.effects.scanlines, true);
        });

        it('POST /api/cms/theme/generate handles light pink theme', async () => {
            const res = await fetch('http://localhost:3840/api/cms/theme/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: 'light pink theme' }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.deepStrictEqual(data.theme.bg, [245, 245, 245, 255]);
            assert.deepStrictEqual(data.theme.fg, [255, 105, 180, 255]);
        });
    });

    // ── CMS Theme Editor WebSocket ────────────────────────────────

    describe('CMS Theme Editor WebSocket', () => {
        let WebSocket;
        before(async () => {
            const mod = await import('ws');
            WebSocket = mod.default;
        });

        function connectWS() {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:3840`);
                ws.on('open', () => resolve(ws));
                ws.on('error', reject);
            });
        }

        function waitForMessage(ws, type, timeout = 2000) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
                ws.on('message', (raw) => {
                    const msg = JSON.parse(raw.toString());
                    if (msg.type === type) {
                        clearTimeout(timer);
                        resolve(msg);
                    }
                });
            });
        }

        it('cms:theme:edit handles key press', async () => {
            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:theme:updated');
                ws.send(JSON.stringify({ type: 'cms:theme:edit', key: { name: 'tab' } }));
                const msg = await msgPromise;
                assert.strictEqual(msg.action.action, 'section-changed');
                assert.ok(msg.theme);
            } finally {
                ws.close();
            }
        });

        it('cms:theme:edit adjusts color', async () => {
            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:theme:updated');
                ws.send(JSON.stringify({ type: 'cms:theme:edit', key: { name: 'right' } }));
                const msg = await msgPromise;
                assert.strictEqual(msg.action.action, 'color-adjusted');
                assert.ok(msg.theme);
            } finally {
                ws.close();
            }
        });

        it('cms:theme:set sets a property', async () => {
            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:theme:updated');
                ws.send(JSON.stringify({ type: 'cms:theme:set', prop: 'fg', value: [255, 0, 0, 255] }));
                const msg = await msgPromise;
                assert.strictEqual(msg.action, 'set');
                assert.deepStrictEqual(msg.theme.fg, [255, 0, 0, 255]);
            } finally {
                ws.close();
            }
        });

        it('cms:theme:set invalid prop returns error', async () => {
            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:theme:error');
                ws.send(JSON.stringify({ type: 'cms:theme:set', prop: 'fg', value: [999, 0, 0] }));
                const msg = await msgPromise;
                assert.ok(msg.error);
            } finally {
                ws.close();
            }
        });

        it('cms:theme:edit toggles effect', async () => {
            const ws = await connectWS();
            try {
                // Tab to effects section
                const tabPromise1 = waitForMessage(ws, 'cms:theme:updated');
                ws.send(JSON.stringify({ type: 'cms:theme:edit', key: { name: 'tab' } }));
                await tabPromise1;
                const tabPromise2 = waitForMessage(ws, 'cms:theme:updated');
                ws.send(JSON.stringify({ type: 'cms:theme:edit', key: { name: 'tab' } }));
                await tabPromise2;

                const msgPromise = waitForMessage(ws, 'cms:theme:updated');
                ws.send(JSON.stringify({ type: 'cms:theme:edit', key: { name: 'enter' } }));
                const msg = await msgPromise;
                assert.strictEqual(msg.action.action, 'effect-toggled');
            } finally {
                ws.close();
            }
        });

        it('cms:theme:edit escape returns cancel', async () => {
            const ws = await connectWS();
            try {
                const msgPromise = waitForMessage(ws, 'cms:theme:updated');
                ws.send(JSON.stringify({ type: 'cms:theme:edit', key: { name: 'escape' } }));
                const msg = await msgPromise;
                assert.strictEqual(msg.action.action, 'cancel');
            } finally {
                ws.close();
            }
        });
    });
});
