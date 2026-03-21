// sync/server.js
// HTTP + WebSocket server for pxOS

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { CellStore } from './cell-store.js';
import { PixelFormulaEngine } from './pixel-formula-engine.js';
import { AlertEngine } from './alert-engine.js';
import { TimeSeriesStore } from './time-series-store.js';
import { DashboardStore } from './dashboard-store.js';

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
        this.template = [];
        this.httpServer = null;
        this.wss = null;
        this.clients = new Set();

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
}
