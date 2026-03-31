// sync/publish/ssh-server.js
// SSH server that serves the ASCII World CMS to connected terminals.
// Uses ssh2 package for SSH protocol.
// User connects via: ssh site.com -p 2222
// Renders the homepage, keyboard navigation works over SSH.
// Multiple simultaneous connections, each with their own session.

import ssh2 from 'ssh2';
import { EventEmitter } from 'events';

const { Server: SSHServer } = ssh2;

/**
 * @typedef {Object} SSHSession
 * @property {object} channel - SSH channel stream
 * @property {string} currentSlug - Currently viewed page slug
 * @property {string[]} history - Navigation history
 * @property {number} historyIndex - Current position in history
 */

/**
 * ASCII art frames for the welcome screen.
 */
const WELCOME_ART = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    ╔╗╔╔═╗╦  ╦╔═╗╦═╗╔╦╗                                                     ║
║    ║║║║ ║╚╗╔╝║╣ ╠╦╝ ║                                                      ║
║    ╝╚╝╚═╝ ╚╝ ╚═╝╩╚═ ╩    World CMS                                         ║
║                                                                              ║
║    Terminal Access                                                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

export class CMSSSHServer extends EventEmitter {
    /**
     * @param {Object} options
     * @param {import('../router.js').Router} options.router - CMS Router
     * @param {import('../content-store.js').ContentStore} options.contentStore - Content store
     * @param {Object} [options.theme] - Theme for ANSI rendering
     * @param {number} [options.port=2222] - SSH port
     * @param {string} [options.host='0.0.0.0'] - SSH host
     * @param {string} [options.hostKey] - SSH host key (PEM format)
     * @param {boolean} [options.public=true] - Allow connections without auth
     * @param {Function} [options.authenticate] - Custom auth handler (username, password) => boolean
     */
    constructor(options = {}) {
        super();
        this.router = options.router;
        this.contentStore = options.contentStore;
        this.theme = options.theme || null;
        this.port = options.port || 2222;
        this.host = options.host || '0.0.0.0';
        this.hostKey = options.hostKey || null;
        this.public = options.public !== false;
        this.authenticate = options.authenticate || null;

        /** @type {Map<object, SSHSession>} */
        this.sessions = new Map();

        /** @type {object|null} */
        this.sshServer = null;

        /** @type {boolean} */
        this.running = false;
    }

    /**
     * Start the SSH server.
     * @returns {Promise<void>}
     */
    async start() {
        if (this.running) return;

        const serverOptions = {};
        if (this.hostKey) {
            serverOptions.hostKeys = [this.hostKey];
        } else {
            // Generate a minimal host key for development/testing
            const { generateKeyPairSync } = await import('crypto');
            const { privateKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
            });
            serverOptions.hostKeys = [privateKey.export({ type: 'pkcs1', format: 'pem' })];
        }

        this.sshServer = new SSHServer(serverOptions, (client) => {
            this._handleClient(client);
        });

        return new Promise((resolve, reject) => {
            this.sshServer.listen(this.port, this.host, () => {
                this.running = true;
                this.emit('listening', { port: this.port, host: this.host });
                resolve();
            });
            this.sshServer.on('error', (err) => {
                this.emit('error', err);
                if (!this.running) reject(err);
            });
        });
    }

    /**
     * Stop the SSH server.
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.running) return;

        // Close all sessions
        for (const [channel, session] of this.sessions) {
            try {
                channel.close();
            } catch {}
        }
        this.sessions.clear();

        return new Promise((resolve) => {
            if (this.sshServer) {
                this.sshServer.close(() => {
                    this.running = false;
                    this.emit('stopped');
                    resolve();
                });
            } else {
                this.running = false;
                resolve();
            }
        });
    }

    /**
     * Get the number of active sessions.
     * @returns {number}
     */
    get connectionCount() {
        return this.sessions.size;
    }

    /**
     * Handle a new SSH client connection.
     * @param {object} client - ssh2 Client
     */
    _handleClient(client) {
        let authenticated = this.public; // Auto-auth in public mode

        client.on('authentication', (ctx) => {
            if (this.public) {
                authenticated = true;
                ctx.accept();
                return;
            }

            if (this.authenticate) {
                if (this.authenticate(ctx.username, ctx.password)) {
                    authenticated = true;
                    ctx.accept();
                } else {
                    ctx.reject();
                }
                return;
            }

            // Default: reject if not public and no custom auth
            ctx.reject();
        });

        client.on('ready', () => {
            if (!authenticated) return;
            this.emit('client-connected');
        });

        client.on('session', (accept, reject) => {
            const session = accept();
            session.on('pty', (accept, reject, info) => {
                accept();
            });
            session.on('shell', (accept, reject) => {
                const channel = accept();
                this._setupSession(channel);
            });
            session.on('exec', (accept, reject, info) => {
                const channel = accept();
                this._setupSession(channel);
            });
        });

        client.on('end', () => {
            this.emit('client-disconnected');
        });
    }

    /**
     * Set up a terminal session for a channel.
     * @param {object} channel
     */
    _setupSession(channel) {
        const session = {
            channel,
            currentSlug: '',
            history: [],
            historyIndex: -1,
        };
        this.sessions.set(channel, session);

        // Show welcome screen
        this._send(channel, '\x1b[2J\x1b[H'); // Clear screen, cursor home
        this._send(channel, WELCOME_ART);
        this._send(channel, '\r\n  Press Enter to view the homepage, or type a slug to navigate.\r\n');
        this._send(channel, '  Commands: :nav = navigation, :q = quit, :back = go back\r\n');
        this._send(channel, '\r\n> ');

        let inputBuffer = '';

        channel.on('data', (data) => {
            const str = data.toString('utf-8');

            for (const ch of str) {
                // Handle special keys
                if (ch === '\r' || ch === '\n') {
                    // Enter key — process command
                    this._send(channel, '\r\n');
                    this._processInput(channel, session, inputBuffer.trim());
                    inputBuffer = '';
                    this._send(channel, '> ');
                } else if (ch === '\x7f' || ch === '\b') {
                    // Backspace
                    if (inputBuffer.length > 0) {
                        inputBuffer = inputBuffer.slice(0, -1);
                        this._send(channel, '\b \b');
                    }
                } else if (ch === '\x03') {
                    // Ctrl+C — disconnect
                    this._send(channel, '\r\nGoodbye!\r\n');
                    channel.close();
                } else if (ch.charCodeAt(0) >= 32) {
                    // Printable character
                    inputBuffer += ch;
                    this._send(channel, ch);
                }
                // Ignore other control characters
            }
        });

        channel.on('close', () => {
            this.sessions.delete(channel);
            this.emit('session-ended', { sessions: this.sessions.size });
        });

        channel.on('error', () => {
            this.sessions.delete(channel);
        });
    }

    /**
     * Process user input.
     * @param {object} channel
     * @param {SSHSession} session
     * @param {string} input
     */
    _processInput(channel, session, input) {
        if (!input) {
            // Empty input — show current page or home
            this._renderPage(channel, session, session.currentSlug || '');
            return;
        }

        if (input === ':q' || input === ':quit' || input === 'exit') {
            this._send(channel, 'Goodbye!\r\n');
            channel.close();
            return;
        }

        if (input === ':nav') {
            this._renderNav(channel);
            return;
        }

        if (input === ':back') {
            if (session.historyIndex > 0) {
                session.historyIndex--;
                const slug = session.history[session.historyIndex];
                session.currentSlug = slug;
                this._renderPage(channel, session, slug);
            } else {
                this._send(channel, '  No previous page.\r\n');
            }
            return;
        }

        if (input === ':forward') {
            if (session.historyIndex < session.history.length - 1) {
                session.historyIndex++;
                const slug = session.history[session.historyIndex];
                session.currentSlug = slug;
                this._renderPage(channel, session, slug);
            } else {
                this._send(channel, '  No next page.\r\n');
            }
            return;
        }

        // Treat as a slug to navigate to
        const slug = input.startsWith('/') ? input.slice(1) : input;
        this._navigateTo(channel, session, slug);
    }

    /**
     * Navigate to a page slug.
     */
    _navigateTo(channel, session, slug) {
        if (!this.router) {
            this._send(channel, '  Router not configured.\r\n');
            return;
        }

        const result = this.router.resolve(slug);

        if (result.is404) {
            this._send(channel, `  Page not found: ${slug}\r\n`);
            return;
        }

        // Update history
        if (session.historyIndex < session.history.length - 1) {
            session.history = session.history.slice(0, session.historyIndex + 1);
        }
        session.history.push(slug);
        session.historyIndex = session.history.length - 1;
        session.currentSlug = slug;

        this._renderPage(channel, session, slug);
    }

    /**
     * Render a page to the terminal.
     */
    _renderPage(channel, session, slug) {
        if (!this.router || !this.contentStore) {
            this._send(channel, '  CMS not configured.\r\n');
            return;
        }

        const result = this.router.resolve(slug);

        // Clear screen
        this._send(channel, '\x1b[2J\x1b[H');

        if (result.is404 || !result.manifest) {
            this._send(channel, '  404 — Page Not Found\r\n');
            this._send(channel, `  No page matches: ${slug || '(home)'}\r\n`);
            this._send(channel, '  Type :nav to see available pages.\r\n\r\n');
            return;
        }

        const manifest = result.manifest;
        const layout = manifest.layout || [];

        // Header
        this._send(channel, `\x1b[1;36m${'═'.repeat(60)}\x1b[0m\r\n`);
        this._send(channel, `\x1b[1;33m  ${manifest.title}\x1b[0m\r\n`);
        this._send(channel, `\x1b[1;36m${'═'.repeat(60)}\x1b[0m\r\n\r\n`);

        // Render each layout region
        for (const region of layout) {
            let content = '';
            if (region.contentId) {
                const item = this.contentStore.read(region.contentId);
                content = item ? item.body : `[Missing: ${region.contentId}]`;
            } else if (region.inline) {
                content = region.inline;
            }

            if (content) {
                this._send(channel, content);
                this._send(channel, '\r\n\r\n');
            }
        }

        // Footer navigation hint
        this._send(channel, `\x1b[2m─── Type :nav for pages, :back/:forward to navigate, :q to quit ───\x1b[0m\r\n`);
    }

    /**
     * Render navigation menu to terminal.
     */
    _renderNav(channel) {
        if (!this.router) {
            this._send(channel, '  Router not configured.\r\n');
            return;
        }

        const tree = this.router.getNavigationTree();

        this._send(channel, '\r\n\x1b[1;33m  Available Pages:\x1b[0m\r\n');
        this._send(channel, `\x1b[1;36m  ${'─'.repeat(40)}\x1b[0m\r\n`);

        if (tree.length === 0) {
            this._send(channel, '  (no pages)\r\n');
        }

        const renderItems = (items, indent = '  ') => {
            for (const item of items) {
                this._send(channel, `  ${indent}\x1b[1;34m${item.slug}\x1b[0m — ${item.title}\r\n`);
                if (item.children && item.children.length > 0) {
                    renderItems(item.children, indent + '  ');
                }
            }
        };
        renderItems(tree);

        this._send(channel, '\r\n');
    }

    /**
     * Send data to a channel.
     * @param {object} channel
     * @param {string} data
     */
    _send(channel, data) {
        try {
            channel.write(data);
        } catch {}
    }
}

/**
 * Create a simple SSH server for testing (no real crypto needed).
 * This is a lightweight alternative for tests that just need to
 * verify the session management and navigation logic.
 */
export class MockSSHServer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.router = options.router;
        this.contentStore = options.contentStore;
        this.port = options.port || 2222;
        this.running = false;
        this.sessions = new Map();
    }

    async start() {
        this.running = true;
        this.emit('listening', { port: this.port });
    }

    async stop() {
        this.running = false;
        this.sessions.clear();
        this.emit('stopped');
    }

    get connectionCount() {
        return this.sessions.size;
    }

    /**
     * Simulate a client connection for testing.
     * Returns a mock channel that captures output.
     */
    createMockSession() {
        const output = [];
        const mockChannel = {
            write: (data) => output.push(data),
            close: () => {},
            _output: output,
        };

        const session = {
            channel: mockChannel,
            currentSlug: '',
            history: [],
            historyIndex: -1,
        };

        this.sessions.set(mockChannel, session);
        return { channel: mockChannel, session, output };
    }
}
