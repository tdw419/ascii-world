// sync/server.js
// HTTP + WebSocket server for pxOS

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { CellStore } from './cell-store.js';
import { PixelFormulaEngine } from './pixel-formula-engine.js';
import { AlertEngine } from './alert-engine.js';
import { TimeSeriesStore } from './time-series-store.js';
import { DashboardStore } from './dashboard-store.js';
import { GpuBridge } from './gpu-bridge.js';
import { CartridgeStore } from './cartridge-store.js';
import { ASCIIExperimentSpec } from './ascii-spec-parser.js';
import { ASCIIExperimentRuntime } from './ascii-experiment-runtime.js';
import { ASCIIResultsLogger } from './ascii-results-logger.js';
import { GeometryBridge } from './integrations/openspec/geometry_bridge.js';
import { EvolutionaryAgent } from './evolutionary-agent.js';
import { SyntheticGlyphVM, OP, OP_NAMES } from './synthetic-glyph-vm.js';
import { PixelVMBridge } from './pixelvm-bridge.js';
import { renderers, detectFormat } from './renderers/index.js';
import { runAllVCCTests } from './renderers/vcc-evaluator.js';
import { GPUAgentBridge, GLYPH_TO_OPCODE, OPCODE_COLORS } from './gpu-agent-bridge.js';
import { YouTubeScraper } from './youtube-scraper.js';
import { YouTubeExtractor } from './youtube-extractor.js';
import { readFileSync, writeFileSync, existsSync, readFile } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PxOSServer {
    constructor(port = 3839) {
        this.port = port;
        this.cellStore = new CellStore();
        this.engine = new PixelFormulaEngine(480, 240);
        this.alertEngine = new AlertEngine();
        this.timeSeriesStore = new TimeSeriesStore({ maxPoints: 1000, minInterval: 1000 });
        this.dashboardStore = new DashboardStore({ 
            filePath: './data/dashboards.json',
            saveDelay: 1000 
        });
        this.gpuBridge = new GpuBridge(this.cellStore);
        this.cartridgeStore = new CartridgeStore({
            cartridgesDir: '../apps/geos-ascii/examples'
        });
        this.geometryBridge = new GeometryBridge(this);
        this.evoAgent = new EvolutionaryAgent(this);
        this.vm = new SyntheticGlyphVM({ maxCycles: 100000 });
        this.pixelvm = new PixelVMBridge({ maxCycles: 100000 });
        this.gpuAgentBridge = new GPUAgentBridge({ 
            cellStore: this.cellStore,
            onStats: (stats) => {
                this.broadcast({ type: 'gpu-stats', stats });
            },
            onError: (err) => {
                console.error('[GPU Agent Bridge]', err);
            }
        });
        this.template = [];
        this.httpServer = null;
        this.wss = null;
        this.clients = new Set();
        
        // Metrics tracking
        this.startTime = Date.now();
        this.requestCount = 0;
        this.requestCountPerMinute = 0;
        this.lastMinuteReset = Date.now();

        // YouTube integration
        this.youtubeScraper = new YouTubeScraper();
        this.youtubeExtractor = new YouTubeExtractor();
        this.youtubeChannelsPath = './data/channels.json';
        this.youtubeChannels = this.loadYouTubeChannels();

        // Setup alert notifiers
        this.alertEngine.addNotifier((alert, rule) => {
            console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
            this.broadcast({ type: 'alert', alert });
        });
    }

    async start() {
        // Create HTTP server
        this.httpServer = createServer((req, res) => {
            this.handleHTTPRequest(req, res);
        });

        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.httpServer });
        this.wss.on('connection', (ws) => this.handleWebSocket(ws));

        // Start GPU Bridge
        this.gpuBridge.start(500);

        // Start Evolutionary Agent
        this.evoAgent.start();

        // Auto-load the 'autoresearch' dashboard if it exists
        const defaultDashboard = this.dashboardStore.load('autoresearch');
        if (defaultDashboard) {
            console.log(`[SERVER] Loading persistent dashboard: autoresearch`);
            this.template = [...defaultDashboard.template];
            this.alertEngine.setRules(defaultDashboard.alerts);
        }

        // Load cartridges
        const cartridges = this.cartridgeStore.loadAll();
        console.log(`Loaded ${cartridges.length} cartridges`);

        // Subscribe to cartridge state changes
        this.cartridgeStore.subscribe((event) => {
            this.broadcast({ type: 'cartridge', event });
        });

        // Subscribe to cell changes
        this.cellStore.subscribe((changes, cells) => {
            // Record to time series
            this.timeSeriesStore.recordAll(changes);
            
            // Check alerts
            const alerts = this.alertEngine.check(cells);
            
            // Periodically persist the current state (template + rules)
            if (this.template.length > 0) {
                this.dashboardStore.save('autoresearch', this.template, this.alertEngine.getRules());
            }
            
            // Broadcast cell updates
            this.broadcast({ type: 'cells', changes, cells });
        });

        return new Promise((resolve) => {
            this.httpServer.listen(this.port, () => {
                console.log(`pxOS server listening on http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    async stop() {
        // Stop GPU Bridge
        this.gpuBridge.stop();
        
        // Stop GPU Agent Bridge
        await this.gpuAgentBridge.stop();

        return new Promise((resolve) => {
            if (this.wss) {
                for (const client of this.clients) {
                    client.close();
                }
                this.wss.close();
            }
            if (this.httpServer) {
                this.httpServer.close(() => {
                    console.log('pxOS server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async handleHTTPRequest(req, res) {
        // Track requests
        this.trackRequest();
        
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const pathname = url.pathname;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        try {
            if (pathname === '/' || pathname === '/viewer/' || pathname === '/viewer.html') {
                this.serveViewer(req, res);
            } else if (pathname === '/health') {
                this.handleHealth(req, res);
            } else if (pathname === '/status') {
                await this.handleStatus(req, res);
            } else if (pathname === '/api/v1/cells') {
                if (req.method === 'GET') {
                    this.handleGetCells(req, res);
                } else if (req.method === 'POST') {
                    await this.handlePostCells(req, res);
                } else {
                    this.sendError(res, 405, 'Method not allowed');
                }
            } else if (pathname === '/api/v1/render') {
                if (req.method === 'POST') {
                    await this.handleMultiRender(req, res, url);
                } else {
                    await this.handleRender(req, res);
                }
            } else if (pathname.startsWith('/api/v1/render/')) {
                await this.handleMultiRender(req, res, url);
            } else if (pathname === '/api/v1/template') {
                if (req.method === 'POST') {
                    await this.handlePostTemplate(req, res);
                } else {
                    this.sendError(res, 405, 'Method not allowed');
                }
            } else if (pathname === '/api/v1/alerts') {
                if (req.method === 'GET') {
                    this.handleGetAlerts(req, res);
                } else if (req.method === 'POST') {
                    await this.handlePostAlerts(req, res);
                } else {
                    this.sendError(res, 405, 'Method not allowed');
                }
            } else if (pathname === '/api/v1/alerts/history') {
                this.handleGetAlertHistory(req, res);
            } else if (pathname.startsWith('/api/v1/history/')) {
                this.handleGetCellHistory(req, res, url);
            } else if (pathname === '/api/v1/history') {
                this.handleGetAllHistory(req, res, url);
            } else if (pathname === '/api/v1/dashboards' && req.method === 'GET') {
                this.handleListDashboards(req, res);
            } else if (pathname === '/api/v1/dashboards' && req.method === 'POST') {
                await this.handleSaveDashboard(req, res);
            } else if (pathname.startsWith('/api/v1/dashboards/') && req.method === 'GET') {
                this.handleLoadDashboard(req, res, url);
            } else if (pathname.startsWith('/api/v1/dashboards/') && req.method === 'DELETE') {
                this.handleDeleteDashboard(req, res, url);
            } else if (pathname === '/api/v1/cartridges' && req.method === 'GET') {
                this.handleListCartridges(req, res);
            } else if (pathname.startsWith('/api/v1/cartridges/') && req.method === 'GET') {
                this.handleGetCartridge(req, res, url);
            } else if (pathname === '/api/v1/cartridge/active' && req.method === 'GET') {
                this.handleGetActiveCartridge(req, res);
            } else if (pathname === '/api/v1/cartridge/state' && req.method === 'GET') {
                this.handleGetCartridgeState(req, res);
            } else if (pathname === '/api/v1/cartridge/execute' && req.method === 'POST') {
                await this.handleExecuteOpcode(req, res);
            } else if (pathname === '/api/v1/vm/execute' && req.method === 'POST') {
                await this.handleVMExecute(req, res);
            } else if (pathname === '/api/v1/vm/state' && req.method === 'GET') {
                this.handleVMState(req, res);
            } else if (pathname === '/api/v1/vm/reset' && req.method === 'POST') {
                this.handleVMReset(req, res);
            } else if (pathname === '/api/v1/pixelvm/python' && req.method === 'POST') {
                await this.handlePixelPython(req, res);
            } else if (pathname === '/api/v1/pixelvm/pixels' && req.method === 'POST') {
                await this.handlePixelPixels(req, res);
            } else if (pathname === '/api/v1/pixelvm/state' && req.method === 'GET') {
                this.handlePixelState(req, res);
            } else if (pathname === '/api/v1/pixelvm/map' && req.method === 'GET') {
                this.handlePixelMap(req, res);
            } else if (pathname === '/api/v1/pixelvm/reset' && req.method === 'POST') {
                this.handlePixelReset(req, res);
            } else if (pathname === '/api/v1/pixelvm/viewport' && req.method === 'GET') {
                await this.handlePixelViewport(req, res);
            } else if (pathname === '/api/v1/experiments' && req.method === 'GET') {
                this.handleGetExperiments(req, res);
            } else if (pathname === '/api/v1/experiments/run' && req.method === 'POST') {
                await this.handleRunExperiment(req, res);
            } else if (pathname === '/api/v1/experiments/specs' && req.method === 'GET') {
                this.handleGetExperimentSpecs(req, res);
            } else if (pathname === '/api/v1/vcc/validate' && req.method === 'POST') {
                await this.handleVCCValidate(req, res);
            // GPU Agent Bridge API
            } else if (pathname === '/api/v1/gpu/agent/start' && req.method === 'POST') {
                await this.handleGPUAgentStart(req, res);
            } else if (pathname === '/api/v1/gpu/agent/stop' && req.method === 'POST') {
                await this.handleGPUAgentStop(req, res);
            } else if (pathname === '/api/v1/gpu/agent/stats' && req.method === 'GET') {
                this.handleGPUAgentStats(req, res);
            } else if (pathname === '/api/v1/gpu/inject' && req.method === 'POST') {
                await this.handleGPUInject(req, res);
            } else if (pathname === '/api/v1/gpu/wire' && req.method === 'POST') {
                await this.handleGPUWire(req, res);
            } else if (pathname === '/api/v1/gpu/gate' && req.method === 'POST') {
                await this.handleGPUGate(req, res);
            } else if (pathname === '/api/v1/gpu/circuit/load' && req.method === 'POST') {
                await this.handleGPUCircuitLoad(req, res);
            } else if (pathname === '/api/v1/gpu/circuit/scan' && req.method === 'GET') {
                await this.handleGPUCircuitScan(req, res, url);
            } else if (pathname === '/api/v1/gpu/circuit/templates' && req.method === 'GET') {
                this.handleGPUCircuitTemplates(req, res);
            } else if (pathname === '/api/v1/gpu/heatmap' && req.method === 'POST') {
                await this.handleGPUHeatmap(req, res);
            } else if (pathname === '/api/v1/gpu/bridge/start' && req.method === 'POST') {
                await this.handleGPUBridgeStart(req, res);
            } else if (pathname === '/api/v1/gpu/bridge/connect' && req.method === 'POST') {
                await this.handleGPUBridgeConnect(req, res);
            } else if (pathname === '/api/v1/gpu/glyphs' && req.method === 'GET') {
                this.handleGPUGlyphs(req, res);
            // YouTube API
            } else if (pathname === '/youtube') {
                this.handleYouTubeViewer(req, res);
            } else if (pathname === '/api/youtube/feed') {
                await this.handleYouTubeFeed(req, res);
            } else if (pathname === '/api/youtube/audio') {
                await this.handleYouTubeStream(req, res, url, 'audio');
            } else if (pathname === '/api/youtube/video') {
                await this.handleYouTubeStream(req, res, url, 'video');
            } else if (pathname === '/api/youtube/channels' && req.method === 'GET') {
                this.handleYouTubeChannels(req, res);
            } else if (pathname === '/api/youtube/channels' && req.method === 'POST') {
                await this.handleAddYouTubeChannel(req, res);
            } else if (pathname.startsWith('/api/youtube/channels/') && req.method === 'DELETE') {
                this.handleRemoveYouTubeChannel(req, res, url);
            } else if (pathname === '/api/youtube/cookies' && req.method === 'POST') {
                await this.handleYouTubeCookies(req, res);
            } else if (pathname === '/api/youtube/personalized') {
                await this.handleYouTubePersonalized(req, res);
            } else if (pathname === '/api/youtube/discover') {
                await this.handleYouTubeDiscover(req, res, url);
            } else {
                this.sendError(res, 404, 'Not found');
            }
        } catch (err) {
            console.error('Request error:', err);
            this.sendError(res, 500, 'Internal server error');
        }
    }

    serveViewer(req, res) {
        const viewerPath = path.join(__dirname, '../viewer/viewer.html');
        readFile(viewerPath, (err, data) => {
            if (err) {
                this.sendError(res, 500, 'Viewer not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    }

    handleHealth(req, res) {
        this.sendJSON(res, 200, { status: 'ok', timestamp: Date.now() });
    }

    handleGetCells(req, res) {
        this.sendJSON(res, 200, this.cellStore.getCells());
    }

    async handlePostCells(req, res) {
        const body = await this.readBody(req);
        const cells = JSON.parse(body);
        const changes = this.cellStore.setCells(cells);
        this.sendJSON(res, 200, { ok: true, changes });
    }

    async handleRender(req, res) {
        this.engine.setCells(this.cellStore.getCells());
        this.engine.renderTemplate(this.template);
        const png = await this.engine.toPNG();
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(png);
    }

    async handleMultiRender(req, res, url) {
        // Parse format from URL: /api/v1/render/:format
        let format = url.pathname.replace('/api/v1/render/', '').toLowerCase() || 'html';
        if (format === '/api/v1/render') format = 'html'; // Default

        const canonicalFormat = detectFormat(format);
        const renderer = renderers[canonicalFormat];

        if (!renderer) {
            return this.sendError(res, 400, `Unknown format: ${format}. Available: ${Object.keys(renderers).join(', ')}`);
        }

        let asciiContent = '';
        if (req.method === 'POST') {
            const body = await this.readBody(req);
            const { content } = JSON.parse(body);
            asciiContent = content;
        } else {
            // Default to rendering current cell state as a formatted table
            const cells = this.cellStore.getCells();
            // Simple grid generation (80x24)
            asciiContent = '╔═══════════════════════════════════════════════════════════════╗\n';
            asciiContent += '║ pxOS Substrate (Live State)                                   ║\n';
            asciiContent += '╠═══════════════════════════════════════════════════════════════╣\n';
            
            const keys = Object.keys(cells).filter(k => k !== 'title' && k.length < 20);
            for (let i = 0; i < Math.min(keys.length, 20); i++) {
                const k = keys[i];
                const v = String(cells[k]).substring(0, 40);
                asciiContent += `║ ${k.padEnd(20)} : ${v.padEnd(40)} ║\n`;
            }
            asciiContent += '╚═══════════════════════════════════════════════════════════════╝';
        }

        try {
            const result = await renderer(asciiContent);
            
            // Set correct Content-Type
            const types = {
                'html': 'text/html',
                'python': 'text/x-python',
                'svg': 'image/svg+xml',
                'png': 'image/png',
                'pixels': 'application/octet-stream',
                'ansi': 'text/plain',
                'json': 'application/json',
                'markdown': 'text/markdown'
            };

            res.writeHead(200, { 'Content-Type': types[canonicalFormat] || 'text/plain' });
            
            if (canonicalFormat === 'png' || canonicalFormat === 'pixels') {
                res.end(result);
            } else if (canonicalFormat === 'json') {
                res.end(JSON.stringify(result, null, 2));
            } else {
                res.end(String(result));
            }
        } catch (err) {
            this.sendError(res, 500, `Render error: ${err.message}`);
        }
    }

    async handleVCCValidate(req, res) {
        try {
            const body = await this.readBody(req);
            const { content } = JSON.parse(body);
            
            if (!content) {
                return this.sendError(res, 400, 'Content required for VCC validation');
            }

            const result = await runAllVCCTests(content);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, `VCC validation error: ${err.message}`);
        }
    }

    async handlePostTemplate(req, res) {
        const body = await this.readBody(req);
        this.template = JSON.parse(body);
        this.sendJSON(res, 200, { ok: true, templateSize: this.template.length });
    }

    handleGetAlerts(req, res) {
        this.sendJSON(res, 200, this.alertEngine.getRules());
    }

    async handlePostAlerts(req, res) {
        const body = await this.readBody(req);
        const rules = JSON.parse(body);
        this.alertEngine.setRules(rules);
        this.sendJSON(res, 200, { ok: true, ruleCount: rules.length });
    }

    handleGetAlertHistory(req, res) {
        this.sendJSON(res, 200, this.alertEngine.getHistory());
    }

    handleGetCellHistory(req, res, url) {
        const cell = url.pathname.replace('/api/v1/history/', '');
        const points = parseInt(url.searchParams.get('points')) || 100;
        const history = this.timeSeriesStore.getHistory(cell, points);
        this.sendJSON(res, 200, history);
    }

    handleGetAllHistory(req, res, url) {
        const points = parseInt(url.searchParams.get('points')) || 100;
        const history = this.timeSeriesStore.getAllHistory(points);
        this.sendJSON(res, 200, history);
    }

    handleListDashboards(req, res) {
        this.sendJSON(res, 200, this.dashboardStore.list());
    }

    async handleSaveDashboard(req, res) {
        const body = await this.readBody(req);
        const { name } = JSON.parse(body);
        
        if (!name) {
            this.sendError(res, 400, 'Dashboard name required');
            return;
        }

        this.dashboardStore.save(name, this.template, this.alertEngine.getRules());
        this.sendJSON(res, 200, { ok: true, name });
    }

    handleLoadDashboard(req, res, url) {
        const name = url.pathname.replace('/api/v1/dashboards/', '');
        const dashboard = this.dashboardStore.load(name);

        if (!dashboard) {
            this.sendError(res, 404, 'Dashboard not found');
            return;
        }

        // Apply template and alerts
        this.template = [...dashboard.template];
        this.alertEngine.setRules(dashboard.alerts);

        this.sendJSON(res, 200, { ok: true, ...dashboard });
    }

    handleDeleteDashboard(req, res, url) {
        const name = url.pathname.replace('/api/v1/dashboards/', '');
        const deleted = this.dashboardStore.delete(name);

        this.sendJSON(res, 200, { ok: deleted });
    }

    trackRequest() {
        this.requestCount++;
        
        // Reset per-minute counter
        const now = Date.now();
        if (now - this.lastMinuteReset >= 60000) {
            this.requestCountPerMinute = this.requestCount;
            this.requestCount = 0;
            this.lastMinuteReset = now;
        }
    }

    getStatusCells() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
        
        const mem = process.memoryUsage();
        const memMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
        
        const cells = this.cellStore.getCells();
        const alerts = this.alertEngine.getRules();
        
        return {
            ...cells,
            title: 'pxOS Status',
            uptime_label: 'Uptime',
            uptime: uptimeStr,
            clients_label: 'Clients',
            clients: this.clients.size,
            cells_label: 'Cells',
            cells_count: Object.keys(cells).length,
            alerts_label: 'Alerts',
            alerts_count: `${alerts.length} rules`,
            memory_label: 'Memory',
            memory: `${memMB} MB`,
            requests_label: 'Requests',
            requests: `${this.requestCountPerMinute}/min`,
            gpu_label: 'GPU',
            vms_label: 'VMS',
        };
    }

    async handleStatus(req, res) {
        const statusCells = this.getStatusCells();
        this.engine.setCells(statusCells);
        
        const template = [
            { fn: 'TEXT', args: [0, 0, 'title'] },
            { fn: 'TIME', args: [70, 0, 'HH:mm:ss'] },
            { fn: 'LINE', args: [0, 1, 80, 'h', 'borderHighlight'] },
            { fn: 'TEXT', args: [0, 2, 'uptime_label'] },
            { fn: 'TEXT', args: [12, 2, 'uptime'] },
            { fn: 'TEXT', args: [0, 3, 'clients_label'] },
            { fn: 'NUMBER', args: [12, 3, 'clients', '0'] },
            { fn: 'TEXT', args: [0, 4, 'cells_label'] },
            { fn: 'NUMBER', args: [12, 4, 'cells_count', '0'] },
            { fn: 'TEXT', args: [0, 5, 'alerts_label'] },
            { fn: 'TEXT', args: [12, 5, 'alerts_count'] },
            { fn: 'TEXT', args: [40, 2, 'memory_label'] },
            { fn: 'TEXT', args: [52, 2, 'memory'] },
            { fn: 'TEXT', args: [40, 3, 'requests_label'] },
            { fn: 'TEXT', args: [52, 3, 'requests'] },

            // GPU Monitor Section
            { fn: 'LINE', args: [0, 7, 80, 'h', 'border'] },
            { fn: 'TEXT', args: [0, 8, 'gpu_label'] },
            { fn: 'TEXT', args: [12, 8, 'gpu_status'] },
            { fn: 'TEXT', args: [0, 9, 'vms_label'] },
            { fn: 'BAR', args: [12, 9, 'gpu_vms_pct', 20] },
            { fn: 'NUMBER', args: [35, 9, 'gpu_vms', '0'] },
        ];
        
        this.engine.renderTemplate(template);
        const png = await this.engine.toPNG();
        
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(png);
    }

    handleWebSocket(ws) {
        this.clients.add(ws);
        console.log(`WebSocket client connected. Total: ${this.clients.size}`);

        // Send current state
        ws.send(JSON.stringify({
            type: 'cells',
            cells: this.cellStore.getCells(),
            changes: {}
        }));

        ws.on('close', () => {
            this.clients.delete(ws);
            console.log(`WebSocket client disconnected. Total: ${this.clients.size}`);
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            this.clients.delete(ws);
        });
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(data);
            }
        }
    }

    readBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    sendJSON(res, status, data) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    sendError(res, status, message) {
        this.sendJSON(res, status, { error: message });
    }

    // ─────────────────────────────────────────────────────
    // YouTube Integration
    // ─────────────────────────────────────────────────────

    loadYouTubeChannels() {
        try {
            if (existsSync(this.youtubeChannelsPath)) {
                const data = readFileSync(this.youtubeChannelsPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (err) {
            console.error('Failed to load YouTube channels:', err.message);
        }
        return { channels: [] };
    }

    saveYouTubeChannels() {
        try {
            writeFileSync(this.youtubeChannelsPath, JSON.stringify(this.youtubeChannels, null, 2));
        } catch (err) {
            console.error('Failed to save YouTube channels:', err.message);
        }
    }

    async handleYouTubeViewer(req, res) {
        const viewerPath = path.join(__dirname, '../viewer/youtube.html');
        readFile(viewerPath, (err, data) => {
            if (err) {
                this.sendError(res, 500, 'YouTube viewer not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    }

    async handleYouTubeFeed(req, res) {
        const { channels } = this.youtubeChannels;

        if (channels.length === 0) {
            this.sendJSON(res, 200, {
                videos: [],
                fetched: new Date().toISOString(),
                channelCount: 0,
                message: 'No channels configured. Add a channel to get started.'
            });
            return;
        }

        try {
            const allVideos = [];

            const results = await Promise.allSettled(
                channels.map(ch =>
                    this.youtubeScraper.fetchChannel(ch.url, ch.id || ch.name)
                        .catch(err => {
                            console.error(`Channel ${ch.id} failed:`, err.message);
                            return [];
                        })
                )
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allVideos.push(...result.value);
                }
            }

            this.sendJSON(res, 200, {
                videos: allVideos,
                fetched: new Date().toISOString(),
                channelCount: channels.length
            });
        } catch (err) {
            this.sendError(res, 500, `Failed to fetch feed: ${err.message}`);
        }
    }

    async handleYouTubeStream(req, res, url, type = 'audio') {
        const videoUrl = url.searchParams.get('url');

        if (!videoUrl) {
            this.sendError(res, 400, 'Missing url parameter');
            return;
        }

        if (!this.youtubeExtractor.isValidVideoURL(videoUrl)) {
            this.sendError(res, 400, 'Invalid YouTube URL');
            return;
        }

        try {
            console.log(`[YOUTUBE] Fetching ${type} URL for: ${videoUrl}`);
            const result = type === 'video' 
                ? await this.youtubeExtractor.getVideoUrl(videoUrl)
                : await this.youtubeExtractor.getAudioUrl(videoUrl);
            
            this.sendJSON(res, 200, { 
                url: result.url,
                videoId: result.videoId,
                type 
            });
        } catch (err) {
            console.error(`[YOUTUBE] ${type} extraction error:`, err.message);
            this.sendError(res, 500, `Failed to extract ${type}: ${err.message}`);
        }
    }

    handleYouTubeChannels(req, res) {
        this.sendJSON(res, 200, this.youtubeChannels);
    }

    async handleAddYouTubeChannel(req, res) {
        const body = await this.readBody(req);
        const { url, name } = JSON.parse(body);

        if (!url) {
            this.sendError(res, 400, 'Channel URL required');
            return;
        }

        if (!this.youtubeScraper.isValidYouTubeURL(url)) {
            this.sendError(res, 400, 'Invalid YouTube URL');
            return;
        }

        const match = url.match(/youtube\.com\/(@[\w-]+)/);
        const id = match ? match[1] : `channel_${Date.now()}`;

        if (this.youtubeChannels.channels.some(ch => ch.id === id)) {
            this.sendError(res, 400, 'Channel already added');
            return;
        }

        this.youtubeChannels.channels.push({
            id,
            url,
            name: name || id
        });

        this.saveYouTubeChannels();
        this.sendJSON(res, 200, { ok: true, channel: { id, url, name: name || id } });
    }

    handleRemoveYouTubeChannel(req, res, url) {
        const id = url.pathname.replace('/api/youtube/channels/', '');

        const index = this.youtubeChannels.channels.findIndex(ch => ch.id === id);
        if (index === -1) {
            this.sendError(res, 404, 'Channel not found');
            return;
        }

        this.youtubeChannels.channels.splice(index, 1);
        this.saveYouTubeChannels();
        this.sendJSON(res, 200, { ok: true });
    }

    async handleYouTubeCookies(req, res) {
        try {
            const body = await this.readBody(req);
            const { cookies } = JSON.parse(body);
            if (!cookies) {
                return this.sendError(res, 400, 'Cookies are required');
            }
            // Save cookies to a file
            writeFileSync('./.youtube-cookies.txt', cookies);
            console.log('[YOUTUBE] Saved cookies to .youtube-cookies.txt');
            this.sendJSON(res, 200, { ok: true });
        } catch (err) {
            this.sendError(res, 500, `Failed to save cookies: ${err.message}`);
        }
    }

    async handleYouTubePersonalized(req, res) {
        try {
            console.log('[PERSONALIZED] Fetching videos with chromium cookies...');
            const videos = await this.youtubeScraper.fetchPersonalizedHomepage();
            console.log('[PERSONALIZED] Found', videos.length, 'videos');
            this.sendJSON(res, 200, {
                videos,
                fetched: new Date().toISOString(),
                source: 'personal'
            });
        } catch (err) {
            console.error('[PERSONALIZED] Error:', err.message);
            this.sendError(res, 500, `Failed to fetch personalized feed: ${err.message}`);
        }
    }

    async handleYouTubeDiscover(req, res, url) {
        try {
            const query = url.searchParams.get('q') || 'music';
            console.log('[DISCOVER] Searching for:', query);
            const videos = await this.youtubeScraper.fetchHomepage(query);
            console.log('[DISCOVER] Found', videos.length, 'videos');
            this.sendJSON(res, 200, {
                videos,
                fetched: new Date().toISOString(),
                query,
                source: 'youtube.com'
            });
        } catch (err) {
            console.error('[DISCOVER] Error:', err.message);
            this.sendError(res, 500, `Failed to fetch discover feed: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────────────
    // Cartridge Handlers
    // ─────────────────────────────────────────────────────

    handleListCartridges(req, res) {
        const cartridges = this.cartridgeStore.list();
        this.sendJSON(res, 200, { cartridges, count: cartridges.length });
    }

    handleGetCartridge(req, res, url) {
        const name = url.pathname.split('/').pop();
        const cart = this.cartridgeStore.get(name);
        if (!cart) {
            return this.sendError(res, 404, 'Cartridge not found');
        }
        this.sendJSON(res, 200, { name: cart.name, size: cart.size, path: cart.path });
    }

    handleGetActiveCartridge(req, res) {
        const active = this.cartridgeStore.activeCartridge;
        this.sendJSON(res, 200, { active: active ? active.name : null });
    }

    handleGetCartridgeState(req, res) {
        const state = this.cartridgeStore.getAllState();
        this.sendJSON(res, 200, { state });
    }

    async handleExecuteOpcode(req, res) {
        const body = await this.readBody(req);
        const { opcode, target, flags } = JSON.parse(body);
        const result = this.cartridgeStore.executeOpcode(opcode, target, flags);
        this.sendJSON(res, 200, result);
    }

    // SyntheticGlyphVM API
    async handleVMExecute(req, res) {
        const body = await this.readBody(req);
        const { program, maxCycles = 10000 } = JSON.parse(body);

        if (program && program.length > 0) {
            this.vm.loadProgram(program);
        }

        const result = this.vm.executeFrame(maxCycles);

        const pixelBuffer = this.vm.memory.slice(0, 480 * 240 * 4);
        this.sendJSON(res, 200, {
            cycles: this.vm.state.cycles,
            halted: this.vm.state.halted,
            pc: this.vm.state.pc,
            opCount: this.vm.state.opCount,
            pixels: Array.from(pixelBuffer).slice(0, 480 * 240 * 4)
        });
    }

    handleVMState(req, res) {
        this.sendJSON(res, 200, {
            pc: this.vm.state.pc,
            sp: this.vm.state.sp,
            flags: this.vm.state.flags,
            halted: this.vm.state.halted,
            cycles: this.vm.state.cycles,
            opCount: this.vm.state.opCount,
            memory: Array.from(this.vm.memory.slice(0, 1024))
        });
    }

    handleVMReset(req, res) {
        this.vm.reset();
        this.sendJSON(res, 200, { reset: true });
    }

    // PixelVM API (Python → Pixels → Execution)
    async handlePixelPython(req, res) {
        const body = await this.readBody(req);
        const { code, options } = JSON.parse(body);
        const result = this.pixelvm.executePython(code, options || {});
        this.sendJSON(res, 200, result);
    }

    async handlePixelPixels(req, res) {
        const body = await this.readBody(req);
        const { pixels, options } = JSON.parse(body);
        const result = this.pixelvm.executePixels(pixels, options || {});
        this.sendJSON(res, 200, result);
    }

    handlePixelState(req, res) {
        const state = this.pixelvm.getVMState();
        this.sendJSON(res, 200, state);
    }

    handlePixelMap(req, res) {
        const state = this.pixelvm.getMapState();
        this.sendJSON(res, 200, state);
    }

    handlePixelReset(req, res) {
        const result = this.pixelvm.reset(true);
        this.sendJSON(res, 200, result);
    }

    async handlePixelViewport(req, res) {
        try {
            const png = await this.pixelvm.getViewportPNG();
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(png);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    // ASCII Experiment API
    handleGetExperiments(req, res) {
        const logger = new ASCIIResultsLogger();
        const results = logger.readRecent(50);
        this.sendJSON(res, 200, results);
    }

    async handleRunExperiment(req, res) {
        const body = await this.readBody(req);
        const { spec, x = 10, y = 15 } = JSON.parse(body);
        
        // Execute via bridge (it now handles SIT bonds + template rendering)
        const { result } = await this.geometryBridge.executeOnCanvas(spec, x, y);
        
        this.sendJSON(res, 200, result);
    }

    handleGetExperimentSpecs(req, res) {
        const fs = require('fs');
        const path = require('path');
        const specsDir = '.autoresearch/specs';
        if (!fs.existsSync(specsDir)) {
            this.sendJSON(res, 200, []);
            return;
        }
        const files = fs.readdirSync(specsDir).filter(f => f.endsWith('.ascii'));
        const specs = files.map(f => ({
            name: f,
            content: fs.readFileSync(path.join(specsDir, f), 'utf-8')
        }));
        this.sendJSON(res, 200, specs);
    }

    // ─────────────────────────────────────────────────────
    // GPU Agent Bridge API Handlers
    // ─────────────────────────────────────────────────────

    async handleGPUAgentStart(req, res) {
        try {
            const result = await this.gpuAgentBridge.startAgent();
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    async handleGPUAgentStop(req, res) {
        try {
            const result = await this.gpuAgentBridge.stopAgent();
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    handleGPUAgentStats(req, res) {
        const stats = this.gpuAgentBridge.getStats();
        this.sendJSON(res, 200, stats);
    }

    async handleGPUInject(req, res) {
        try {
            const body = await this.readBody(req);
            const { x, y, opcode, r, g, b } = JSON.parse(body);
            const result = await this.gpuAgentBridge.injectSignal(x, y, opcode, r, g, b);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    async handleGPUWire(req, res) {
        try {
            const body = await this.readBody(req);
            const { x1, y1, x2, y2, color } = JSON.parse(body);
            const result = await this.gpuAgentBridge.injectWire(x1, y1, x2, y2, color);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    async handleGPUGate(req, res) {
        try {
            const body = await this.readBody(req);
            const { type, x, y } = JSON.parse(body);
            const result = await this.gpuAgentBridge.injectGate(type, x, y);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    async handleGPUCircuitLoad(req, res) {
        try {
            const body = await this.readBody(req);
            const { ascii, template, x, y } = JSON.parse(body);
            
            let result;
            if (template) {
                result = await this.gpuAgentBridge.loadCircuitTemplate(template, x, y);
            } else if (ascii) {
                result = await this.gpuAgentBridge.loadCircuit(ascii, x, y);
            } else {
                return this.sendError(res, 400, 'Either "ascii" or "template" required');
            }
            
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    async handleGPUCircuitScan(req, res, url) {
        try {
            const x = parseInt(url.searchParams.get('x')) || 0;
            const y = parseInt(url.searchParams.get('y')) || 0;
            const width = parseInt(url.searchParams.get('width')) || 80;
            const height = parseInt(url.searchParams.get('height')) || 24;
            
            const result = await this.gpuAgentBridge.scanRegion(x, y, width, height);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    handleGPUCircuitTemplates(req, res) {
        const templates = this.gpuAgentBridge.listCircuitTemplates();
        this.sendJSON(res, 200, { templates });
    }

    async handleGPUHeatmap(req, res) {
        try {
            const body = await this.readBody(req);
            const { ascii, offsetX, offsetY } = JSON.parse(body);
            const result = await this.gpuAgentBridge.getHeatmap(ascii, offsetX, offsetY);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    async handleGPUBridgeStart(req, res) {
        try {
            const body = await this.readBody(req);
            const { port, offsetX, offsetY } = JSON.parse(body);
            const result = await this.gpuAgentBridge.startNetworkBridge(port, offsetX, offsetY);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    async handleGPUBridgeConnect(req, res) {
        try {
            const body = await this.readBody(req);
            const { server, localX, localY, width, height } = JSON.parse(body);
            const result = await this.gpuAgentBridge.connectToBridge(server, localX, localY, width, height);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    handleGPUGlyphs(req, res) {
        this.sendJSON(res, 200, {
            glyphToOpcode: GLYPH_TO_OPCODE,
            opcodeColors: OPCODE_COLORS
        });
    }
}

// Auto-start if run directly
import { realpathSync } from 'fs';
const entryPath = realpathSync(process.argv[1]);
const currentPath = fileURLToPath(import.meta.url);

if (entryPath === currentPath) {
    const PORT = parseInt(process.env.PORT || process.env.SYNC_PORT || '3840');
    const server = new PxOSServer(PORT);
    server.start().then(() => {
        console.log(`pxOS Server running on http://localhost:${PORT}`);
        console.log(`GPU Agent Dashboard: http://localhost:${PORT}/viewer/gpu-agent-dashboard.html`);
    }).catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
