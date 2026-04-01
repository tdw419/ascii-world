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
import { VCCTextureBridge } from './vcc-texture-bridge.js';
import { YouTubeScraper } from './youtube-scraper.js';
import { YouTubeExtractor } from './youtube-extractor.js';
import { exportPNG } from './publish/png-export.js';
import { compileHTML } from './publish/html-compiler.js';
import { ContentStore } from './content-store.js';
import { Router } from './router.js';
import { NavigationRenderer } from './navigation-renderer.js';
import { ThemeEditor, DEFAULT_THEME, THEME_PRESETS } from './theme-editor.js';
import { AiArchitect } from './ai-architect.js';
import { AiRefiner } from './ai-refiner.js';
import { AgentRegistry } from './agent-registry.js';
import { AgentLogStore } from './agent-log-store.js';
import { AuditTrail } from './audit-trail.js';
import { TaskStore } from './task-store.js';
import { RouteTable } from './route-table.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readFile } from 'fs';
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
        this.vccBridge = new VCCTextureBridge({
            cellStore: this.cellStore,
            onFrame: ({ rgba, stats }) => {
                this.broadcast({ type: 'vcc-frame', stats });
            },
            onError: (err) => {
                console.error('[VCC Bridge]', err);
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

        // CMS: Router + Navigation
        this.cmsContentStore = new ContentStore({
            filePath: './data/cms-content.json',
            saveDelay: 1000,
        });
        this.cmsRouter = new Router(this.cmsContentStore);
        this.cmsNavRenderer = new NavigationRenderer(this.cmsRouter, {
            style: 'horizontal',
        });

        // CMS: Theme Editor
        this.themeEditor = new ThemeEditor({
            themesDir: './themes',
        });

        // CMS: AI Architect & Refiner
        this.aiArchitect = new AiArchitect({
            contentStore: this.cmsContentStore,
            router: this.cmsRouter,
            themeEditor: this.themeEditor,
        });
        this.aiRefiner = new AiRefiner({
            contentStore: this.cmsContentStore,
            router: this.cmsRouter,
            themeEditor: this.themeEditor,
        });

        // Setup alert notifiers
        this.alertEngine.addNotifier((alert, rule) => {
            console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
            this.broadcast({ type: 'alert', alert });
        });

        // Agent Registry
        this.agentRegistry = new AgentRegistry({ filePath: './data/agents.json' });

        // Agent Log Store (ring buffer per agent)
        this.agentLogStore = new AgentLogStore({ maxEntries: 1000 });

        // Audit Trail (append-only JSONL)
        this.auditTrail = new AuditTrail({ filePath: './data/audit.jsonl' });

        // Task Store (agent task queue)
        this.taskStore = new TaskStore({ dataPath: './data/tasks.json' });

        // Route table (declarative HTTP dispatch)
        this.routeTable = new RouteTable();
        this._registerRoutes();
    }

    /**
     * Register all HTTP routes in the declarative route table.
     * Each handler wrapper preserves the original calling convention
     * (req, res[, pathname][, url]) so that no handler logic changes.
     */
    _registerRoutes() {
        const t = this.routeTable;

        // Helper: register a route with a handler that takes no extra args
        const h = (method, pattern, fn) => t.register(method, pattern, (req, res /*, pathname, url */) => fn.call(this, req, res));
        // Helper: register a route with a handler that takes (req, res, url)
        const hu = (method, pattern, fn) => t.register(method, pattern, (req, res, _pathname, url) => fn.call(this, req, res, url));
        // Helper: register a route with a handler that takes (req, res, pathname)
        const hp = (method, pattern, fn) => t.register(method, pattern, (req, res, pathname) => fn.call(this, req, res, pathname));
        // Helper: register a route with a handler that takes (req, res, pathname, url)
        const hpu = (method, pattern, fn) => t.register(method, pattern, (req, res, pathname, url) => fn.call(this, req, res, pathname, url));

        // ── Viewer & Health ───────────────────────────────────────
        t.register('*', '/', (req, res) => this.serveViewer(req, res));
        t.register('*', '/viewer/', (req, res) => this.serveViewer(req, res));
        t.register('*', '/viewer.html', (req, res) => this.serveViewer(req, res));
        h('*', '/health', this.handleHealth);
        h('*', '/status', this.handleStatus);

        // ── Cells ─────────────────────────────────────────────────
        h('GET', '/api/v1/cells', this.handleGetCells);
        h('POST', '/api/v1/cells', this.handlePostCells);

        // ── Render ────────────────────────────────────────────────
        hu('POST', '/api/v1/render', this.handleMultiRender);
        h('GET', '/api/v1/render', this.handleRender);
        hu('*', '/api/v1/render/:format', this.handleMultiRender);

        // ── Template ──────────────────────────────────────────────
        h('POST', '/api/v1/template', this.handlePostTemplate);

        // ── Alerts ────────────────────────────────────────────────
        h('GET', '/api/v1/alerts', this.handleGetAlerts);
        h('POST', '/api/v1/alerts', this.handlePostAlerts);
        h('*', '/api/v1/alerts/history', this.handleGetAlertHistory);

        // ── History (Time Series) ─────────────────────────────────
        hu('*', '/api/v1/history/:cell', this.handleGetCellHistory);
        hu('*', '/api/v1/history', this.handleGetAllHistory);

        // ── Dashboards ────────────────────────────────────────────
        h('GET', '/api/v1/dashboards', this.handleListDashboards);
        h('POST', '/api/v1/dashboards', this.handleSaveDashboard);
        hu('GET', '/api/v1/dashboards/:name', this.handleLoadDashboard);
        hu('DELETE', '/api/v1/dashboards/:name', this.handleDeleteDashboard);

        // ── Cartridges ────────────────────────────────────────────
        h('GET', '/api/v1/cartridges', this.handleListCartridges);
        hu('GET', '/api/v1/cartridges/:name', this.handleGetCartridge);
        h('GET', '/api/v1/cartridge/active', this.handleGetActiveCartridge);
        h('GET', '/api/v1/cartridge/state', this.handleGetCartridgeState);
        h('POST', '/api/v1/cartridge/execute', this.handleExecuteOpcode);

        // ── VM ────────────────────────────────────────────────────
        h('POST', '/api/v1/vm/execute', this.handleVMExecute);
        h('GET', '/api/v1/vm/state', this.handleVMState);
        h('POST', '/api/v1/vm/reset', this.handleVMReset);

        // ── PixelVM ───────────────────────────────────────────────
        h('POST', '/api/v1/pixelvm/python', this.handlePixelPython);
        h('POST', '/api/v1/pixelvm/pixels', this.handlePixelPixels);
        h('GET', '/api/v1/pixelvm/state', this.handlePixelState);
        h('GET', '/api/v1/pixelvm/map', this.handlePixelMap);
        h('POST', '/api/v1/pixelvm/reset', this.handlePixelReset);
        h('GET', '/api/v1/pixelvm/viewport', this.handlePixelViewport);

        // ── Experiments ───────────────────────────────────────────
        h('GET', '/api/v1/experiments', this.handleGetExperiments);
        h('POST', '/api/v1/experiments/run', this.handleRunExperiment);
        h('GET', '/api/v1/experiments/specs', this.handleGetExperimentSpecs);

        // ── VCC ───────────────────────────────────────────────────
        h('POST', '/api/v1/vcc/validate', this.handleVCCValidate);
        h('GET', '/api/v1/vcc/texture', this.handleVCCTexture);
        h('GET', '/api/v1/vcc/ascii', this.handleVCCASCII);
        h('GET', '/api/v1/vcc/stats', this.handleVCCStats);

        // ── GPU Agent Bridge ──────────────────────────────────────
        h('POST', '/api/v1/gpu/agent/start', this.handleGPUAgentStart);
        h('POST', '/api/v1/gpu/agent/stop', this.handleGPUAgentStop);
        h('GET', '/api/v1/gpu/agent/stats', this.handleGPUAgentStats);
        h('POST', '/api/v1/gpu/inject', this.handleGPUInject);
        h('POST', '/api/v1/gpu/wire', this.handleGPUWire);
        h('POST', '/api/v1/gpu/gate', this.handleGPUGate);
        h('POST', '/api/v1/gpu/circuit/load', this.handleGPUCircuitLoad);
        hu('GET', '/api/v1/gpu/circuit/scan', this.handleGPUCircuitScan);
        h('GET', '/api/v1/gpu/circuit/templates', this.handleGPUCircuitTemplates);
        h('POST', '/api/v1/gpu/heatmap', this.handleGPUHeatmap);
        h('POST', '/api/v1/gpu/bridge/start', this.handleGPUBridgeStart);
        h('POST', '/api/v1/gpu/bridge/connect', this.handleGPUBridgeConnect);
        h('GET', '/api/v1/gpu/glyphs', this.handleGPUGlyphs);

        // ── YouTube ───────────────────────────────────────────────
        h('*', '/youtube', this.handleYouTubeViewer);
        h('*', '/api/youtube/feed', this.handleYouTubeFeed);
        t.register('*', '/api/youtube/audio', (req, res, _p, url) => this.handleYouTubeStream(req, res, url, 'audio'));
        t.register('*', '/api/youtube/video', (req, res, _p, url) => this.handleYouTubeStream(req, res, url, 'video'));
        h('GET', '/api/youtube/channels', this.handleYouTubeChannels);
        h('POST', '/api/youtube/channels', this.handleAddYouTubeChannel);
        hu('DELETE', '/api/youtube/channels/:id', this.handleRemoveYouTubeChannel);
        h('POST', '/api/youtube/cookies', this.handleYouTubeCookies);
        hu('*', '/api/youtube/personalized', this.handleYouTubePersonalized);
        hu('*', '/api/youtube/personalized/v2', this.handleYouTubePersonalizedV2);
        h('*', '/api/youtube/subscriptions', this.handleYouTubeSubscriptions);
        hu('*', '/api/youtube/discover', this.handleYouTubeDiscover);
        hu('*', '/api/youtube/video-info', this.handleYouTubeSpecificVideo);

        // ── CMS Navigation & Routing ──────────────────────────────
        h('GET', '/api/cms/nav', this.handleCMSNav);
        hu('GET', '/api/cms/page', this.handleCMSPage);

        // ── CMS Theme Editor ──────────────────────────────────────
        h('GET', '/api/cms/theme', this.handleCMSThemeGet);
        h('POST', '/api/cms/theme/save', this.handleCMSThemeSave);
        h('POST', '/api/cms/theme/reset', this.handleCMSThemeReset);
        hu('GET', '/api/cms/theme/preset', this.handleCMSThemePreset);
        h('GET', '/api/cms/theme/preview', this.handleCMSThemePreview);
        h('POST', '/api/cms/theme/generate', this.handleCMSThemeGenerate);

        // ── CMS Export ────────────────────────────────────────────
        h('POST', '/api/cms/export/png', this.handleCMSExportPNG);
        h('POST', '/api/cms/export/html', this.handleCMSExportHTML);

        // ── CMS AI Architect ──────────────────────────────────────
        h('POST', '/api/cms/architect', this.handleCMSArchitect);
        h('POST', '/api/cms/refine', this.handleCMSRefine);

        // ── Agent Registry ────────────────────────────────────────
        h('POST', '/api/v1/agents', this.handleRegisterAgent);
        h('GET', '/api/v1/agents', this.handleListAgents);
        hp('PUT', '/api/v1/agents/:agentId/heartbeat', this.handleAgentHeartbeat);
        hpu('POST', '/api/v1/agents/:agentId/logs', this.handlePostAgentLogs);
        hpu('GET', '/api/v1/agents/:agentId/logs', this.handleGetAgentLogs);
        hp('GET', '/api/v1/agents/:agentId/metrics/:name/history', this.handleGetAgentMetricHistory);
        hp('POST', '/api/v1/agents/:agentId/metrics', this.handlePostAgentMetrics);
        hp('GET', '/api/v1/agents/:agentId/metrics', this.handleGetAgentMetrics);
        hp('GET', '/api/v1/agents/:agentId', this.handleGetAgent);
        hp('DELETE', '/api/v1/agents/:agentId', this.handleDeleteAgent);
        hp('POST', '/api/v1/agents/:agentId/tasks', this.handleAssignTask);

        // ── Audit Trail ───────────────────────────────────────────
        hu('GET', '/api/v1/audit', this.handleGetAudit);

        // ── Task Queue ────────────────────────────────────────────
        h('POST', '/api/v1/tasks', this.handleCreateTask);
        hu('GET', '/api/v1/tasks', this.handleListTasks);
        h('GET', '/api/v1/tasks/stats', this.handleTaskStats);
        hp('PUT', '/api/v1/tasks/:taskId/claim', this.handleClaimTask);
        hp('PUT', '/api/v1/tasks/:taskId/complete', this.handleCompleteTask);
        hp('PUT', '/api/v1/tasks/:taskId/fail', this.handleFailTask);
        hp('GET', '/api/v1/tasks/:taskId', this.handleGetTask);
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

        // Start VCC Texture Bridge (reads GlyphLang colony from SHM)
        this.vccBridge.start(100);

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

        // Load agent registry and start liveness check
        this.agentRegistry.load();
        this.agentRegistry.startLivenessCheck();

        // Subscribe to agent liveness events for audit trail
        this.agentRegistry.addEventListener('agent:offline', (e) => {
            const agent = e.detail.agent;
            this.auditTrail.append('agent.heartbeat-lost', {
                agentId: agent.id,
                lastSeen: agent.lastHeartbeat,
            });
            this.auditTrail.append('agent.status-change', {
                agentId: agent.id,
                from: 'online',
                to: 'offline',
            });
        });
        this.agentRegistry.addEventListener('agent:error', (e) => {
            const agent = e.detail.agent;
            this.auditTrail.append('agent.status-change', {
                agentId: agent.id,
                from: 'offline',
                to: 'error',
            });
        });

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

        // Stop VCC Texture Bridge
        this.vccBridge.stop();

        // Stop Evolutionary Agent
        if (this.evoAgent && this.evoAgent.stop) {
            this.evoAgent.stop();
        }
        
        // Stop GPU Agent Bridge
        await this.gpuAgentBridge.stop();

        // Stop agent registry liveness check
        this.agentRegistry.stopLivenessCheck();

        return new Promise((resolve) => {
            if (this.wss) {
                for (const client of this.clients) {
                    client.close();
                }
                this.wss.close();
            }
            if (this.httpServer) {
                this.httpServer.closeAllConnections();
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
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        try {
            // Dispatch via declarative route table
            const match = this.routeTable.match(pathname, req.method);
            if (match) {
                return await match.handler(req, res, pathname, url);
            }

            // Path exists but method not allowed?
            if (this.routeTable.hasPath(pathname)) {
                this.sendError(res, 405, 'Method not allowed');
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

    // ── VCC Colony Texture API ──

    handleVCCTexture(req, res) {
        // Serve raw RGBA from shared memory as binary
        try {
            const rgba = this.vccBridge.getRawRGBA();
            if (!rgba || rgba.length === 0) {
                return this.sendError(res, 503, 'VCC texture not available');
            }
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': rgba.length,
                'X-VCC-Width': 256,
                'X-VCC-Height': 256,
                'X-VCC-Format': 'rgba8',
                'Cache-Control': 'no-cache',
            });
            res.end(rgba);
        } catch (err) {
            this.sendError(res, 500, `VCC texture error: ${err.message}`);
        }
    }

    handleVCCASCII(req, res) {
        try {
            const ascii = this.vccBridge.toASCII(80, 24);
            this.sendJSON(res, 200, { ascii, width: 80, height: 24 });
        } catch (err) {
            this.sendError(res, 500, `VCC ASCII error: ${err.message}`);
        }
    }

    handleVCCStats(req, res) {
        this.sendJSON(res, 200, this.vccBridge.getStats());
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

        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.type === 'cms:navigate' && msg.slug) {
                    const result = this.cmsRouter.navigate(msg.slug);
                    ws.send(JSON.stringify({ type: 'cms:page-change', ...result }));
                } else if (msg.type === 'cms:back') {
                    const result = this.cmsRouter.back();
                    ws.send(JSON.stringify({ type: 'cms:navigation', action: 'back', result }));
                } else if (msg.type === 'cms:forward') {
                    const result = this.cmsRouter.forward();
                    ws.send(JSON.stringify({ type: 'cms:navigation', action: 'forward', result }));
                } else if (msg.type === 'cms:theme:edit') {
                    // Live theme editing via WebSocket
                    const action = this.themeEditor.handleKey(msg.key);
                    const theme = this.themeEditor.getTheme();
                    ws.send(JSON.stringify({ type: 'cms:theme:updated', action, theme }));
                } else if (msg.type === 'cms:theme:set') {
                    // Set a specific theme property
                    const { prop, value } = msg;
                    try {
                        this.themeEditor.setProperty(prop, value);
                        const theme = this.themeEditor.getTheme();
                        ws.send(JSON.stringify({ type: 'cms:theme:updated', action: 'set', theme }));
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'cms:theme:error', error: err.message }));
                    }
                }
            } catch {}
        });

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

    // ─────────────────────────────────────────────────────
    // CMS Navigation & Routing Handlers
    // ─────────────────────────────────────────────────────

    handleCMSNav(req, res) {
        const tree = this.cmsRouter.getNavigationTree();
        const history = this.cmsRouter.getHistory();
        this.sendJSON(res, 200, { tree, history });
    }

    handleCMSPage(req, res, url) {
        const slug = url.searchParams.get('slug') || '';
        const result = this.cmsRouter.resolve(slug);
        this.sendJSON(res, 200, result);
    }

    // ─────────────────────────────────────────────────────
    // CMS Theme Editor Handlers
    // ─────────────────────────────────────────────────────

    handleCMSThemeGet(req, res) {
        const theme = this.themeEditor.getTheme();
        this.sendJSON(res, 200, { theme });
    }

    async handleCMSThemeSave(req, res) {
        try {
            const body = await this.readBody(req);
            const overrides = body ? JSON.parse(body) : {};
            if (overrides.name || overrides.theme) {
                const themeData = overrides.theme || overrides;
                this.themeEditor.setTheme(themeData);
            }
            const saved = this.themeEditor.save();

            // Persist to themes/custom.json
            const themesDir = this.themeEditor.themesDir;
            if (themesDir) {
                const filePath = path.join(themesDir, 'custom.json');
                const dir = path.dirname(filePath);
                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                writeFileSync(filePath, JSON.stringify(saved, null, 2));
            }

            this.sendJSON(res, 200, { ok: true, theme: saved });
        } catch (err) {
            this.sendError(res, 500, `Theme save error: ${err.message}`);
        }
    }

    handleCMSThemeReset(req, res) {
        const theme = this.themeEditor.reset();
        this.sendJSON(res, 200, { ok: true, theme });
    }

    handleCMSThemePreset(req, res, url) {
        const name = url.searchParams.get('name') || '';
        if (name) {
            const applied = this.themeEditor.applyPreset(name);
            if (!applied) {
                return this.sendError(res, 404, `Unknown preset: ${name}`);
            }
            return this.sendJSON(res, 200, { ok: true, theme: this.themeEditor.getTheme() });
        }
        // List available presets
        const presets = {};
        for (const [key, val] of Object.entries(THEME_PRESETS)) {
            presets[key] = val.name || key;
        }
        this.sendJSON(res, 200, { presets });
    }

    handleCMSThemePreview(req, res) {
        const ascii = this.themeEditor.renderPreview();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(ascii);
    }

    async handleCMSThemeGenerate(req, res) {
        try {
            const body = await this.readBody(req);
            const { description } = body ? JSON.parse(body) : {};
            if (!description || typeof description !== 'string') {
                return this.sendError(res, 400, 'description is required');
            }
            const generated = this._generateThemeFromDescription(description);
            this.themeEditor.setTheme(generated);
            const theme = this.themeEditor.getTheme();
            this.sendJSON(res, 200, { ok: true, theme, description });
        } catch (err) {
            this.sendError(res, 500, `Theme generate error: ${err.message}`);
        }
    }

    /**
     * Generate a theme from a text description using keyword matching.
     * Maps descriptive words to color values for a simple AI-like generation.
     * @param {string} description
     * @returns {Object}
     */
    _generateThemeFromDescription(description) {
        const d = description.toLowerCase();
        const theme = { ...DEFAULT_THEME, name: `ai-${d.slice(0, 20).replace(/\s+/g, '-')}` };

        // Dark mode keywords
        if (d.includes('dark') || d.includes('night') || d.includes('midnight')) {
            theme.bg = [10, 10, 25, 255];
            theme.fg = [200, 200, 220, 255];
        }
        // Light mode keywords
        if (d.includes('light') || d.includes('bright') || d.includes('day')) {
            theme.bg = [245, 245, 245, 255];
            theme.fg = [30, 30, 30, 255];
        }
        // Color keyword mapping
        const colorMap = {
            red:    { fg: [255, 100, 100, 255], border: [200, 50, 50, 255], borderHighlight: [255, 80, 80, 255] },
            green:  { fg: [100, 255, 100, 255], border: [50, 200, 50, 255], borderHighlight: [80, 255, 80, 255] },
            blue:   { fg: [100, 150, 255, 255], border: [50, 80, 200, 255], borderHighlight: [80, 120, 255, 255] },
            cyan:   { fg: [0, 255, 255, 255],   border: [0, 180, 180, 255], borderHighlight: [0, 220, 220, 255] },
            purple: { fg: [180, 100, 255, 255], border: [120, 50, 200, 255], borderHighlight: [150, 80, 255, 255] },
            orange: { fg: [255, 180, 50, 255],  border: [200, 120, 30, 255], borderHighlight: [255, 160, 40, 255] },
            amber:  { fg: [255, 176, 0, 255],   border: [180, 120, 0, 255], borderHighlight: [255, 200, 50, 255] },
            pink:   { fg: [255, 105, 180, 255], border: [200, 80, 140, 255], borderHighlight: [255, 120, 200, 255] },
        };
        for (const [keyword, colors] of Object.entries(colorMap)) {
            if (d.includes(keyword)) {
                Object.assign(theme, colors);
            }
        }
        // Style keywords
        if (d.includes('retro') || d.includes('terminal')) {
            theme.fg = [0, 255, 0, 255];
            theme.bg = [0, 0, 0, 255];
            theme.border = [0, 180, 0, 255];
        }
        if (d.includes('ocean') || d.includes('sea')) {
            theme.bg = [0, 20, 50, 255];
            theme.fg = [100, 200, 255, 255];
            theme.border = [0, 80, 150, 255];
            theme.borderHighlight = [50, 150, 255, 255];
        }
        if (d.includes('sunset')) {
            theme.bg = [40, 10, 20, 255];
            theme.fg = [255, 200, 100, 255];
            theme.border = [200, 80, 40, 255];
            theme.borderHighlight = [255, 120, 60, 255];
        }
        if (d.includes('forest') || d.includes('nature')) {
            theme.bg = [10, 30, 15, 255];
            theme.fg = [150, 220, 150, 255];
            theme.border = [40, 120, 50, 255];
            theme.borderHighlight = [60, 180, 80, 255];
        }
        // Border style keywords
        if (d.includes('double')) theme.borderStyle = 'double';
        if (d.includes('rounded')) theme.borderStyle = 'rounded';
        if (d.includes('bold') && !d.includes('border')) {} // no-op to avoid false positive
        if (d.includes('no border') || d.includes('borderless')) theme.borderStyle = 'none';
        // Effect keywords
        if (d.includes('scanlines')) theme.effects = { ...theme.effects, scanlines: true };
        if (d.includes('glow')) theme.effects = { ...theme.effects, glow: true };
        if (d.includes('shadow')) theme.effects = { ...theme.effects, shadow: true };

        return theme;
    }

    // ─────────────────────────────────────────────────────
    // CMS Export Handlers
    // ─────────────────────────────────────────────────────

    async handleCMSExportPNG(req, res) {
        try {
            const body = await this.readBody(req);
            const { asciiContent, scale = 1, slug } = body ? JSON.parse(body) : {};

            let content = asciiContent || '';
            if (!content && slug) {
                const result = this.cmsRouter.resolve(slug);
                if (result.manifest) {
                    content = this._manifestToASCII(result.manifest);
                }
            }

            if (!content) {
                return this.sendError(res, 400, 'asciiContent or slug is required');
            }

            const png = await exportPNG({ asciiContent: content, scale });
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': png.length,
            });
            res.end(png);
        } catch (err) {
            this.sendError(res, 500, `PNG export error: ${err.message}`);
        }
    }

    async handleCMSExportHTML(req, res) {
        try {
            const body = await this.readBody(req);
            const { slug, manifestId } = body ? JSON.parse(body) : {};

            const targetSlug = slug || '';
            const result = this.cmsRouter.resolve(targetSlug);
            const manifest = manifestId
                ? this.cmsContentStore.readManifest(manifestId)
                : result.manifest;

            if (!manifest) {
                return this.sendError(res, 404, 'Page not found');
            }

            const navTree = this.cmsRouter.getNavigationTree();
            const theme = this.themeEditor.getTheme();
            const html = compileHTML(manifest, this.cmsContentStore, {
                theme,
                navigationTree: navTree,
                currentSlug: targetSlug,
            });

            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': Buffer.byteLength(html),
            });
            res.end(html);
        } catch (err) {
            this.sendError(res, 500, `HTML export error: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────────────
    // CMS AI Architect & Refiner Handlers
    // ─────────────────────────────────────────────────────

    async handleCMSArchitect(req, res) {
        try {
            const body = await this.readBody(req);
            const { description } = body ? JSON.parse(body) : {};
            if (!description || typeof description !== 'string') {
                return this.sendError(res, 400, 'description is required');
            }
            const siteManifest = this.aiArchitect.generate(description);
            this.sendJSON(res, 200, { ok: true, site: siteManifest });
        } catch (err) {
            this.sendError(res, 500, `Architect error: ${err.message}`);
        }
    }

    async handleCMSRefine(req, res) {
        try {
            const body = await this.readBody(req);
            const { instruction } = body ? JSON.parse(body) : {};
            if (!instruction || typeof instruction !== 'string') {
                return this.sendError(res, 400, 'instruction is required');
            }
            const result = this.aiRefiner.refine(instruction);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, `Refine error: ${err.message}`);
        }
    }

    /**
     * Convert a manifest's layout to simple ASCII content string.
     */
    _manifestToASCII(manifest) {
        if (!manifest || !manifest.layout) return '';
        return manifest.layout
            .map(r => {
                if (r.inline) return r.inline;
                if (r.contentId) {
                    const item = this.cmsContentStore.read(r.contentId);
                    return item ? item.body : '';
                }
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }

    // ─────────────────────────────────────────────────────
    // Agent Registry REST API

    async handleRegisterAgent(req, res) {
        const body = await this.readBody(req);
        const data = JSON.parse(body);
        const { agent, errors } = this.agentRegistry.register(data);
        if (errors.length > 0) {
            return this.sendError(res, 400, errors.join('; '));
        }
        this.auditTrail.append('agent.registered', {
            agentId: agent.id,
            name: agent.name,
            capabilities: agent.capabilities,
        });
        this.sendJSON(res, 201, agent.toJSON());
    }

    handleListAgents(req, res) {
        const agents = this.agentRegistry.list().map(a => a.toJSON());
        this.sendJSON(res, 200, agents);
    }

    handleGetAgent(req, res, pathname) {
        const id = pathname.replace('/api/v1/agents/', '');
        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');
        this.sendJSON(res, 200, agent.toJSON());
    }

    async handleAgentHeartbeat(req, res, pathname) {
        const id = pathname.replace('/api/v1/agents/', '').replace('/heartbeat', '');
        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');
        const prevStatus = agent.status;
        this.agentRegistry.heartbeat(id);
        if (prevStatus !== 'online') {
            this.auditTrail.append('agent.status-change', {
                agentId: id,
                from: prevStatus,
                to: 'online',
            });
        }
        this.sendJSON(res, 200, { ok: true });
    }

    handleDeleteAgent(req, res, pathname) {
        const id = pathname.replace('/api/v1/agents/', '');
        const removed = this.agentRegistry.remove(id);
        if (!removed) return this.sendError(res, 404, 'Agent not found');
        res.writeHead(204);
        res.end();
    }

    // ─────────────────────────────────────────────────────
    // Agent Logs API

    async handlePostAgentLogs(req, res, pathname, url) {
        const id = pathname.replace('/api/v1/agents/', '').replace('/logs', '');
        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');

        const body = await this.readBody(req);
        let data;
        try { data = JSON.parse(body); } catch { return this.sendError(res, 400, 'Invalid JSON'); }

        if (!data.message || typeof data.message !== 'string') {
            return this.sendError(res, 400, 'message is required and must be a string');
        }

        const validLevels = ['error', 'warn', 'info'];
        const level = data.level || 'info';
        if (!validLevels.includes(level)) {
            return this.sendError(res, 400, `level must be one of: ${validLevels.join(', ')}`);
        }

        const entry = this.agentLogStore.append(id, { level, message: data.message });

        // Broadcast via WebSocket
        this.broadcast({ type: 'agent:log', agentId: id, entry });

        this.sendJSON(res, 201, entry);
    }

    handleGetAgentLogs(req, res, pathname, url) {
        const id = pathname.replace('/api/v1/agents/', '').replace('/logs', '');
        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');

        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const level = url.searchParams.get('level') || undefined;

        const logs = this.agentLogStore.getLogs(id, { limit, level });
        this.sendJSON(res, 200, { agentId: id, logs });
    }

    // ─────────────────────────────────────────────────────
    // Agent Metrics API

    async handlePostAgentMetrics(req, res, pathname) {
        const id = pathname.replace('/api/v1/agents/', '').replace('/metrics', '');
        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');

        const body = await this.readBody(req);
        let data;
        try { data = JSON.parse(body); } catch { return this.sendError(res, 400, 'Invalid JSON'); }

        if (!data.key || typeof data.key !== 'string') {
            return this.sendError(res, 400, 'key is required and must be a string');
        }
        if (data.value === undefined || data.value === null) {
            return this.sendError(res, 400, 'value is required');
        }

        const tsKey = `agent:${id}:${data.key}`;
        this.timeSeriesStore.record(tsKey, data.value);
        this.sendJSON(res, 201, { ok: true, key: data.key });
    }

    handleGetAgentMetrics(req, res, pathname) {
        const id = pathname.replace('/api/v1/agents/', '').replace('/metrics', '');
        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');

        // Collect latest values for all metrics belonging to this agent
        const prefix = `agent:${id}:`;
        const metrics = {};
        for (const [cell, points] of this.timeSeriesStore.history) {
            if (cell.startsWith(prefix) && points.length > 0) {
                const key = cell.slice(prefix.length);
                metrics[key] = points[points.length - 1].v;
            }
        }
        this.sendJSON(res, 200, { agentId: id, metrics });
    }

    handleGetAgentMetricHistory(req, res, pathname) {
        // Path: /api/v1/agents/:id/metrics/:key/history
        const parts = pathname.replace('/api/v1/agents/', '').split('/');
        const id = parts[0];
        const key = parts[2]; // parts = [id, 'metrics', key, 'history']

        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');

        const tsKey = `agent:${id}:${key}`;
        const history = this.timeSeriesStore.getHistory(tsKey);
        this.sendJSON(res, 200, { agentId: id, key, history });
    }

    // ─────────────────────────────────────────────────────
    // Agent Task Assignment

    async handleAssignTask(req, res, pathname) {
        const id = pathname.replace('/api/v1/agents/', '').replace('/tasks', '');
        const agent = this.agentRegistry.get(id);
        if (!agent) return this.sendError(res, 404, 'Agent not found');

        const body = await this.readBody(req);
        let data;
        try { data = JSON.parse(body); } catch { return this.sendError(res, 400, 'Invalid JSON'); }

        if (!data.taskId || typeof data.taskId !== 'string') {
            return this.sendError(res, 400, 'taskId is required and must be a string');
        }

        this.auditTrail.append('agent.task-assigned', {
            agentId: id,
            taskId: data.taskId,
        });

        this.sendJSON(res, 201, { ok: true, agentId: id, taskId: data.taskId });
    }

    // ─────────────────────────────────────────────────────
    // Audit Trail API

    handleGetAudit(req, res, url) {
        const agentId = url.searchParams.get('agentId') || undefined;
        const limit = parseInt(url.searchParams.get('limit')) || undefined;
        const entries = this.auditTrail.query({ agentId, limit });
        this.sendJSON(res, 200, entries);
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

    async handleYouTubePersonalized(req, res, url) {
        try {
            const continuation = url.searchParams.get('c');
            console.log(`[PERSONALIZED] Fetching videos ${continuation ? '(Next Page)' : '...'}`);
            const result = await this.youtubeScraper.fetchPersonalizedHomepage(continuation);

            this.sendJSON(res, 200, {
                videos: Array.isArray(result) ? result : result.videos,
                continuation: result.continuation || null,
                fetched: new Date().toISOString(),
                source: 'personal'
            });
        } catch (err) {
            console.error('[PERSONALIZED] Error:', err.message);
            this.sendError(res, 500, `Failed to fetch personalized feed: ${err.message}`);
        }
    }

    async handleYouTubePersonalizedV2(req, res, url) {
        try {
            console.log('[PERSONALIZED-V2] Fetching videos using cookies (preferred)...');
            let html;
            try {
                html = await this.youtubeScraper.fetchWithCookies('https://www.youtube.com/');
            } catch (err) {
                console.warn('[PERSONALIZED-V2] Fetch with cookies failed, falling back to Chromium...');
                html = await this.youtubeScraper.fetchWithChromium('https://www.youtube.com/');
            }

            // Re-use existing HTML parser
            const videos = this.youtubeScraper.parseSearchHTML(html);

            this.sendJSON(res, 200, {
                videos,
                fetched: new Date().toISOString(),
                source: 'personalized-v2'
            });
        } catch (err) {
            console.error('[PERSONALIZED-V2] Error:', err.message);
            this.sendError(res, 500, `Failed to fetch V2 feed: ${err.message}`);
        }
    }

    async handleYouTubeSubscriptions(req, res) {
        try {
            console.log('[SUBSCRIPTIONS] Fetching videos with cookies...');
            const videos = await this.youtubeScraper.fetchSubscriptions();
            console.log('[SUBSCRIPTIONS] Found', videos.length, 'videos');
            this.sendJSON(res, 200, {
                videos,
                fetched: new Date().toISOString(),
                source: 'subscriptions'
            });
        } catch (err) {
            console.error('[SUBSCRIPTIONS] Error:', err.message);
            this.sendError(res, 500, `Failed to fetch subscriptions feed: ${err.message}`);
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

    async handleYouTubeSpecificVideo(req, res, url) {
        try {
            const videoUrl = url.searchParams.get('url');
            if (!videoUrl) {
                return this.sendError(res, 400, 'Missing url parameter');
            }
            console.log('[VIDEO-INFO] Fetching info for:', videoUrl);
            const videos = await this.youtubeScraper.fetchHomepage(videoUrl);
            console.log('[VIDEO-INFO] Found', videos.length, 'videos');
            
            this.sendJSON(res, 200, {
                videos,
                fetched: new Date().toISOString()
            });
        } catch (err) {
            console.error('[VIDEO-INFO] Error:', err.message);
            this.sendError(res, 500, `Failed to fetch video info: ${err.message}`);
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

    // ─────────────────────────────────────────────────────
    // Task Queue API
    // ─────────────────────────────────────────────────────

    async handleCreateTask(req, res) {
        const body = await this.readBody(req);
        const data = JSON.parse(body);
        if (!data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) {
            return this.sendError(res, 400, 'payload is required and must be a JSON object');
        }
        const task = this.taskStore.create(data.payload, data.priority);
        this.sendJSON(res, 201, task.toJSON());
    }

    handleListTasks(req, res, url) {
        const status = url.searchParams.get('status') || undefined;
        const agentId = url.searchParams.get('agentId') || undefined;
        const filters = {};
        if (status) filters.status = status;
        if (agentId) filters.agentId = agentId;
        const tasks = this.taskStore.list(filters).map(t => t.toJSON());
        this.sendJSON(res, 200, tasks);
    }

    handleGetTask(req, res, pathname) {
        const id = pathname.replace('/api/v1/tasks/', '');
        const task = this.taskStore.get(id);
        if (!task) return this.sendError(res, 404, 'Task not found');
        this.sendJSON(res, 200, task.toJSON());
    }

    async handleClaimTask(req, res, pathname) {
        const id = pathname.replace('/api/v1/tasks/', '').replace('/claim', '');
        const body = await this.readBody(req);
        const data = JSON.parse(body);
        if (!data.agentId) {
            return this.sendError(res, 400, 'agentId is required');
        }
        const task = this.taskStore.get(id);
        if (!task) return this.sendError(res, 404, 'Task not found');
        if (task.status !== 'pending') {
            return this.sendError(res, 409, 'Task is not pending');
        }
        task.status = 'running';
        task.agentId = data.agentId;
        task.startedAt = new Date().toISOString();
        this.sendJSON(res, 200, task.toJSON());
    }

    async handleCompleteTask(req, res, pathname) {
        const id = pathname.replace('/api/v1/tasks/', '').replace('/complete', '');
        const body = await this.readBody(req);
        const data = JSON.parse(body);
        const task = this.taskStore.complete(id, data.result);
        if (!task) return this.sendError(res, 404, 'Task not found');
        this.sendJSON(res, 200, task.toJSON());
    }

    async handleFailTask(req, res, pathname) {
        const id = pathname.replace('/api/v1/tasks/', '').replace('/fail', '');
        const body = await this.readBody(req);
        const data = JSON.parse(body);
        const task = this.taskStore.fail(id, data.error);
        if (!task) return this.sendError(res, 404, 'Task not found');
        this.sendJSON(res, 200, task.toJSON());
    }

    handleTaskStats(req, res) {
        const stats = this.taskStore.getStats();
        this.sendJSON(res, 200, stats);
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
