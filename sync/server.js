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
        this.template = [];
        this.httpServer = null;
        this.wss = null;
        this.clients = new Set();
        
        // Metrics tracking
        this.startTime = Date.now();
        this.requestCount = 0;
        this.requestCountPerMinute = 0;
        this.lastMinuteReset = Date.now();

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
            if (pathname === '/health') {
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
                await this.handleRender(req, res);
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
            } else {
                this.sendError(res, 404, 'Not found');
            }
        } catch (err) {
            console.error('Request error:', err);
            this.sendError(res, 500, 'Internal server error');
        }
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
}
