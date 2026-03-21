// sync-server.js - Bidirectional ASCII-GUI sync server
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { contentHash, extractHash, computeContentHash, updateHash, verifyHash } from './hash-utils.js';
import { actionHandlers } from './action-handlers.js';

const PORT = process.env.SYNC_PORT || 3839;
const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, '../data');

class AsciiSyncServer {
    constructor() {
        this.clients = new Set();
        this.fileContents = new Map();
        this.watcher = null;
    }

    async start() {
        // Start WebSocket server
        this.wss = new WebSocketServer({ port: PORT });
        console.log(`ASCII Sync Server listening on ws://localhost:${PORT}`);

        this.wss.on('connection', (ws) => {
            this.handleConnection(ws);
        });

        // Start file watcher
        this.watcher = chokidar.watch(`${DATA_DIR}/*.ascii`, {
            persistent: true,
            ignoreInitial: false
        });

        this.watcher
            .on('add', (filepath) => this.handleFileChange(filepath, 'add'))
            .on('change', (filepath) => this.handleFileChange(filepath, 'change'))
            .on('error', (error) => console.error('Watcher error:', error));

        console.log(`Watching ${DATA_DIR} for .ascii files`);
    }

    handleConnection(ws) {
        this.clients.add(ws);
        console.log(`Client connected. Total: ${this.clients.size}`);

        // Send current state
        this.sendCurrentState(ws);

        ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                await this.handleMessage(ws, msg);
            } catch (err) {
                console.error('Message parse error:', err);
            }
        });

        ws.on('close', () => {
            this.clients.delete(ws);
            console.log(`Client disconnected. Total: ${this.clients.size}`);
        });
    }

    async sendCurrentState(ws) {
        // Send all known file states
        for (const [filepath, content] of this.fileContents) {
            const hash = extractHash(content) || computeContentHash(content);
            ws.send(JSON.stringify({
                type: 'file_update',
                filepath: path.basename(filepath),
                content,
                hash,
                timestamp: Date.now()
            }));
        }
    }

    async handleFileChange(filepath, event) {
        console.log(`File ${event}: ${filepath}`);

        try {
            const content = await fs.readFile(filepath, 'utf-8');
            this.fileContents.set(filepath, content);

            const hash = extractHash(content) || computeContentHash(content);
            const verification = verifyHash(content);

            const msg = {
                type: 'file_update',
                filepath: path.basename(filepath),
                content,
                hash,
                valid: verification.valid,
                timestamp: Date.now()
            };

            // Broadcast to all clients
            this.broadcast(msg);
        } catch (err) {
            console.error(`Error reading ${filepath}:`, err);
        }
    }

    async handleMessage(ws, msg) {
        console.log('Received:', msg.type);

        switch (msg.type) {
            case 'get_state':
                await this.sendCurrentState(ws);
                break;

            case 'gui_action':
                await this.handleGuiAction(ws, msg);
                break;

            case 'update_content':
                await this.handleUpdateContent(ws, msg);
                break;

            case 'verify_sync':
                this.handleVerifySync(ws, msg);
                break;

            case 'parse_report':
                this.handleParseReport(ws, msg);
                break;
        }
    }

    // Store intended elements when AI writes file
    intendedElements = new Map();

    handleParseReport(ws, msg) {
        // GUI is reporting what it parsed
        const filepath = msg.title || 'unknown';
        console.log(`\n=== Parse Report for ${filepath} ===`);
        console.log('Hash:', msg.hash);
        console.log('Buttons:', msg.elements?.buttons?.length || 0);
        console.log('Statuses:', msg.elements?.statuses?.length || 0);
        console.log('Tables:', msg.elements?.tables?.length || 0);
        console.log('Cards:', msg.elements?.cards?.length || 0);
        console.log('Text lines:', msg.elements?.textCount || 0);

        // Compare with intended elements (if we have them)
        const intended = this.intendedElements.get(msg.hash);
        if (intended) {
            const comparison = this.compareElements(intended, msg.elements);
            console.log('\nCompliance Check:', comparison.match ? '✓ PASS' : '✗ FAIL');
            if (!comparison.match) {
                console.log('Differences:', comparison.differences);
            }

            // Send verification result back
            ws.send(JSON.stringify({
                type: 'compliance_result',
                match: comparison.match,
                differences: comparison.differences,
                hash: msg.hash
            }));
        }
        console.log('================================\n');
    }

    compareElements(intended, actual) {
        const differences = [];

        if (intended.buttons?.length !== actual?.buttons?.length) {
            differences.push(`Buttons: intended ${intended.buttons?.length}, got ${actual?.buttons?.length}`);
        }
        if (intended.statuses?.length !== actual?.statuses?.length) {
            differences.push(`Statuses: intended ${intended.statuses?.length}, got ${actual?.statuses?.length}`);
        }
        if (intended.tables?.length !== actual?.tables?.length) {
            differences.push(`Tables: intended ${intended.tables?.length}, got ${actual?.tables?.length}`);
        }
        if (intended.cards?.length !== actual?.cards?.length) {
            differences.push(`Cards: intended ${intended.cards?.length}, got ${actual?.cards?.length}`);
        }

        return {
            match: differences.length === 0,
            differences
        };
    }

    async handleGuiAction(ws, msg) {
        console.log(`GUI Action: ${msg.action} on [${msg.key}] ${msg.label}`);

        // Find the file this action applies to
        const filepath = this.findFileForAction(msg);
        if (!filepath) {
            ws.send(JSON.stringify({
                type: 'action_error',
                error: 'No matching file found',
                action: msg
            }));
            return;
        }

        // Get current content
        const content = this.fileContents.get(filepath);
        if (!content) {
            ws.send(JSON.stringify({
                type: 'action_error',
                error: 'File not loaded',
                action: msg
            }));
            return;
        }

        // Process the action
        const handler = actionHandlers[msg.action];
        if (!handler) {
            ws.send(JSON.stringify({
                type: 'action_error',
                error: `Unknown action type: ${msg.action}`,
                action: msg
            }));
            return;
        }

        const result = handler(content, msg);

        // Write updated content
        try {
            await fs.writeFile(filepath, result.content, 'utf-8');

            // Broadcast action result
            this.broadcast({
                type: 'action_processed',
                action: msg,
                changes: result.changes,
                newHash: result.newHash,
                timestamp: Date.now()
            });

            console.log(`Action processed: ${result.changes.join(', ')}`);
        } catch (err) {
            console.error('Action write error:', err);
            ws.send(JSON.stringify({
                type: 'action_error',
                error: err.message,
                action: msg
            }));
        }
    }

    findFileForAction(msg) {
        // For now, return the first .ascii file
        // In production, this would use msg.context or active file tracking
        for (const filepath of this.fileContents.keys()) {
            if (filepath.endsWith('.ascii')) {
                return filepath;
            }
        }
        return null;
    }

    async handleUpdateContent(ws, msg) {
        // Update file with new content from GUI
        const filepath = path.join(DATA_DIR, msg.filepath);

        try {
            // Add/update hash before writing
            const contentWithHash = updateHash(msg.content);
            await fs.writeFile(filepath, contentWithHash, 'utf-8');

            const hash = extractHash(contentWithHash);

            ws.send(JSON.stringify({
                type: 'update_ack',
                success: true,
                hash,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.error('Update error:', err);
            ws.send(JSON.stringify({
                type: 'update_ack',
                success: false,
                error: err.message
            }));
        }
    }

    handleVerifySync(ws, msg) {
        // Client wants to verify its hash matches file
        const filepath = path.join(DATA_DIR, msg.filepath);
        const content = this.fileContents.get(filepath);

        if (!content) {
            ws.send(JSON.stringify({
                type: 'verify_result',
                success: false,
                error: 'File not found'
            }));
            return;
        }

        const fileHash = extractHash(content) || computeContentHash(content);
        const match = fileHash === msg.clientHash;

        ws.send(JSON.stringify({
            type: 'verify_result',
            success: true,
            match,
            fileHash,
            clientHash: msg.clientHash,
            timestamp: Date.now()
        }));
    }

    broadcast(msg) {
        const data = JSON.stringify(msg);
        for (const client of this.clients) {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(data);
            }
        }
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
        }
        if (this.wss) {
            this.wss.close();
        }
    }
}

// Start server
const server = new AsciiSyncServer();
server.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.stop();
    process.exit(0);
});
