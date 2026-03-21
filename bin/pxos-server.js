#!/usr/bin/env node
// bin/pxos-server.js
// CLI entry point for pxOS server

import { PxOSServer } from '../sync/server.js';

const port = parseInt(process.env.PORT || process.argv[2] || '3839');

const server = new PxOSServer(port);

process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
});

server.start().then(() => {
    console.log(`pxOS server running on http://localhost:${port}`);
    console.log(`WebSocket: ws://localhost:${port}`);
    console.log('Press Ctrl+C to stop');
});
