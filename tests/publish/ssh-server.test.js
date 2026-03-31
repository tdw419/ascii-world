// tests/publish/ssh-server.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ContentStore } from '../../sync/content-store.js';
import { Router } from '../../sync/router.js';
import { CMSSSHServer, MockSSHServer } from '../../sync/publish/ssh-server.js';

describe('CMS SSH Server', () => {
    let store, router, server;

    beforeEach(() => {
        store = new ContentStore();
        router = new Router(store);

        // Create test pages
        store.createManifest({
            title: 'Home',
            slug: 'home',
            layout: [
                { region: 'header', contentId: null, inline: 'Welcome Home' },
                { region: 'body', contentId: null, inline: 'This is the homepage.' },
            ],
        });

        store.createManifest({
            title: 'About',
            slug: 'about',
            layout: [
                { region: 'body', contentId: null, inline: 'About us page content.' },
            ],
        });

        router = new Router(store);
    });

    describe('CMSSSHServer', () => {
        it('constructs with required options', () => {
            server = new CMSSSHServer({ router, contentStore: store, port: 2223 });
            assert.strictEqual(server.port, 2223);
            assert.strictEqual(server.running, false);
            assert.strictEqual(server.connectionCount, 0);
        });

        it('starts and stops', async () => {
            server = new CMSSSHServer({ router, contentStore: store, port: 2223 });
            await server.start();
            assert.strictEqual(server.running, true);
            await server.stop();
            assert.strictEqual(server.running, false);
        });

        it('emits listening event on start', async () => {
            server = new CMSSSHServer({ router, contentStore: store, port: 2224 });
            let listened = false;
            server.on('listening', () => { listened = true; });
            await server.start();
            assert.strictEqual(listened, true);
            await server.stop();
        });

        it('defaults to public mode', () => {
            server = new CMSSSHServer({ router, contentStore: store });
            assert.strictEqual(server.public, true);
        });

        it('supports custom authenticate function', () => {
            const auth = (user, pass) => user === 'admin' && pass === 'secret';
            server = new CMSSSHServer({
                router,
                contentStore: store,
                public: false,
                authenticate: auth,
            });
            assert.strictEqual(server.public, false);
            assert.strictEqual(server.authenticate, auth);
        });

        it('starts on custom port', async () => {
            server = new CMSSSHServer({ router, contentStore: store, port: 2225 });
            await server.start();
            assert.strictEqual(server.port, 2225);
            await server.stop();
        });

        it('does not error on double stop', async () => {
            server = new CMSSSHServer({ router, contentStore: store, port: 2226 });
            await server.start();
            await server.stop();
            await server.stop(); // Should not throw
            assert.strictEqual(server.running, false);
        });
    });

    describe('MockSSHServer', () => {
        it('creates mock session', () => {
            server = new MockSSHServer({ router, contentStore: store });
            const { channel, session, output } = server.createMockSession();

            assert.ok(channel, 'Should return channel');
            assert.ok(session, 'Should return session');
            assert.ok(Array.isArray(output), 'Should return output array');
        });

        it('tracks connection count', () => {
            server = new MockSSHServer({ router, contentStore: store });
            assert.strictEqual(server.connectionCount, 0);

            server.createMockSession();
            assert.strictEqual(server.connectionCount, 1);

            server.createMockSession();
            assert.strictEqual(server.connectionCount, 2);
        });

        it('starts and stops', async () => {
            server = new MockSSHServer({ router, contentStore: store });
            await server.start();
            assert.strictEqual(server.running, true);
            await server.stop();
            assert.strictEqual(server.running, false);
        });

        it('clears sessions on stop', async () => {
            server = new MockSSHServer({ router, contentStore: store });
            await server.start();
            server.createMockSession();
            assert.strictEqual(server.connectionCount, 1);
            await server.stop();
            assert.strictEqual(server.connectionCount, 0);
        });
    });
});
