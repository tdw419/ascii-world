/**
 * ASCII Interface Manager - HTTP API Server
 *
 * HTTP server running on port 3422 that exposes endpoints for AI agents
 * to control the ASCII Interface Manager.
 *
 * Endpoints:
 * - GET /health - Health check
 * - GET /view - ASCII view (renders current state template with data)
 * - POST /control - Execute action by label
 * - GET /projects - List registered projects
 * - POST /projects - Register new project
 * - GET /metrics - Performance metrics
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, statSync, realpathSync, readFileSync } from 'fs';
import { resolve, normalize, relative } from 'path';
import { ProjectRegistry, ASCIIProject } from './project-registry';
import { ManagerStateManager, ManagerContext, ManagerState } from './manager-state';
import { AsciiGenerator, TemplateData } from './ascii-generator';

// Server configuration
const PORT = 3422;
const HOST = '0.0.0.0';

// Security configuration
const CORS_ORIGIN = process.env.MANAGER_CORS_ORIGIN || 'http://localhost:3422';
const ALLOWED_BASE_DIRS = (process.env.MANAGER_ALLOWED_DIRS || process.cwd()).split(':');
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// Valid input patterns
const VALID_LABEL_PATTERN = /^[a-zA-Z0-9]$/;
const VALID_PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

// Request metrics tracking
interface RequestMetrics {
    totalRequests: number;
    requestsByEndpoint: Record<string, number>;
    requestsByMethod: Record<string, number>;
    errors: number;
    startTime: number;
    lastRequestTime: number | null;
    averageResponseTime: number;
    responseTimes: number[];
}

// Rate limiting tracking
interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// Active child processes for managed projects
const activeProcesses: Map<string, ChildProcess> = new Map();

// Rate limiting store (in-memory, per IP)
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// App version (read from package.json or default)
const APP_VERSION = '1.0.0';

/**
 * Format uptime from milliseconds to human-readable string
 */
function formatUptime(startedAt: number | undefined): string {
    if (!startedAt) return '--';

    const elapsedMs = Date.now() - startedAt;
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

/**
 * Format timestamp to HH:MM:SS
 */
function formatTime(timestamp: number | null): string {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * ManagerServer
 *
 * Main HTTP server class that integrates all manager components.
 */
export class ManagerServer {
    private registry: ProjectRegistry;
    private stateManager: ManagerStateManager;
    private asciiGenerator: AsciiGenerator;
    private metrics: RequestMetrics;
    private server: ReturnType<typeof Bun.serve> | null = null;
    private discoveryInterval: ReturnType<typeof setInterval> | null = null;
    private lastDiscoveryTime: number | null = null;

    constructor(
        registryPath?: string,
        templatesPath?: string,
        bindingsPath?: string
    ) {
        this.registry = new ProjectRegistry(registryPath);
        this.stateManager = new ManagerStateManager(bindingsPath);
        this.asciiGenerator = new AsciiGenerator(templatesPath);

        this.metrics = {
            totalRequests: 0,
            requestsByEndpoint: {},
            requestsByMethod: {},
            errors: 0,
            startTime: Date.now(),
            lastRequestTime: null,
            averageResponseTime: 0,
            responseTimes: []
        };
    }

    // ==================== SECURITY UTILITIES ====================

    /**
     * Validate and sanitize a project path to prevent path traversal attacks
     * @param inputPath - The path to validate
     * @returns Sanitized absolute path or null if invalid
     */
    private validateProjectPath(inputPath: string): string | null {
        // Check for empty path
        if (!inputPath || typeof inputPath !== 'string') {
            return null;
        }

        // Check for path traversal patterns
        if (inputPath.includes('..') || inputPath.includes('\0')) {
            return null;
        }

        // Resolve to absolute path
        let resolvedPath: string;
        try {
            resolvedPath = resolve(inputPath);
        } catch {
            return null;
        }

        // Check if path exists and is a directory
        if (!existsSync(resolvedPath)) {
            return null;
        }

        try {
            const stats = statSync(resolvedPath);
            if (!stats.isDirectory()) {
                return null;
            }
        } catch {
            return null;
        }

        // Resolve symlinks to prevent symlink attacks
        let realPath: string;
        try {
            realPath = realpathSync(resolvedPath);
        } catch {
            return null;
        }

        // Check if path is within allowed base directories
        const isAllowed = ALLOWED_BASE_DIRS.some(baseDir => {
            const normalizedBase = resolve(baseDir);
            const relativePath = relative(normalizedBase, realPath);
            // Path is within base dir if relative path doesn't start with ..
            return !relativePath.startsWith('..') && !relativePath.startsWith('/');
        });

        if (!isAllowed) {
            return null;
        }

        return realPath;
    }

    /**
     * Validate label format (single letter or number)
     */
    private validateLabel(label: unknown): string | null {
        if (typeof label !== 'string' || !VALID_LABEL_PATTERN.test(label)) {
            return null;
        }
        return label;
    }

    /**
     * Validate project ID format
     */
    private validateProjectId(projectId: unknown): string | null {
        if (typeof projectId !== 'string' || !VALID_PROJECT_ID_PATTERN.test(projectId)) {
            return null;
        }
        return projectId;
    }

    /**
     * Validate port number
     */
    private validatePort(port: unknown): number | null {
        if (typeof port !== 'number' || !Number.isInteger(port)) {
            return null;
        }
        if (port < MIN_PORT || port > MAX_PORT) {
            return null;
        }
        return port;
    }

    /**
     * Check rate limit for a client IP
     * @param clientIp - Client IP address
     * @returns true if request is allowed, false if rate limited
     */
    private checkRateLimit(clientIp: string): boolean {
        const now = Date.now();
        const entry = rateLimitStore.get(clientIp);

        if (!entry || now > entry.resetTime) {
            // Reset or create new entry
            rateLimitStore.set(clientIp, {
                count: 1,
                resetTime: now + RATE_LIMIT_WINDOW_MS
            });
            return true;
        }

        if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
            return false;
        }

        entry.count++;
        return true;
    }

    /**
     * Extract client IP from request
     */
    private getClientIp(request: Request): string {
        // Check X-Forwarded-For header (for reverse proxy setups)
        const forwarded = request.headers.get('x-forwarded-for');
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        // Fallback to a default - Bun doesn't expose remote address directly in fetch handler
        return 'unknown';
    }

    /**
     * Build safe environment variables for child processes
     * Only includes necessary variables, prevents injection
     */
    private buildSafeEnv(port: number): NodeJS.ProcessEnv {
        return {
            PORT: String(port),
            PATH: process.env.PATH || '',
            NODE_ENV: process.env.NODE_ENV || 'development',
            HOME: process.env.HOME || '',
            USER: process.env.USER || ''
        };
    }

    /**
     * Start the HTTP server and auto-discovery background tasks
     */
    public start(): void {
        // Initial auto-discovery
        this.runDiscovery();

        // Background interval for auto-discovery and health checks (every 60s)
        this.discoveryInterval = setInterval(() => {
            this.runDiscovery();
            this.runHealthChecks();
        }, 60000);

        this.server = Bun.serve({
            port: PORT,
            hostname: HOST,
            fetch: async (request: Request): Promise<Response> => {
                const startTime = Date.now();
                const url = new URL(request.url);
                const path = url.pathname;
                const method = request.method;
                const clientIp = this.getClientIp(request);

                // Apply rate limiting to /control endpoint
                if (path === '/control' && method === 'POST') {
                    if (!this.checkRateLimit(clientIp)) {
                        return this.jsonResponse(
                            { error: 'Rate limit exceeded. Please try again later.' },
                            429
                        );
                    }
                }

                // Update metrics
                this.updateMetrics(path, method, startTime);

                try {
                    // Route the request
                    const response = await this.routeRequest(request, path, method);

                    // Track response time
                    const responseTime = Date.now() - startTime;
                    this.trackResponseTime(responseTime);

                    return response;
                } catch (error) {
                    this.metrics.errors++;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return this.jsonResponse({ error: errorMessage }, 500);
                }
            }
        });

        console.log(`ASCII Interface Manager started on http://${HOST}:${PORT}`);
        console.log(`CORS origin: ${CORS_ORIGIN}`);
        console.log(`Allowed base directories: ${ALLOWED_BASE_DIRS.join(', ')}`);
    }

    /**
     * Stop the HTTP server and all managed processes
     */
    public stop(): void {
        // Stop discovery interval
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }

        // Stop all managed processes
        for (const [projectId, childProcess] of activeProcesses) {
            try {
                childProcess.kill();
                this.registry.updateProjectStatus(projectId, 'stopped');
            } catch (error) {
                console.error(`Failed to stop project ${projectId}:`, error);
            }
        }
        activeProcesses.clear();

        // Stop the server
        if (this.server) {
            this.server.stop();
            this.server = null;
        }

        console.log('ASCII Interface Manager stopped');
    }

    /**
     * Run the project auto-discovery scan
     * Scans zion/projects/ base directories for ASCII projects
     */
    public runDiscovery(): string[] {
        console.log(`[Auto-Discovery] Starting project scan...`);
        this.lastDiscoveryTime = Date.now();
        const newlyDiscovered = this.registry.syncDiscoveredProjects(ALLOWED_BASE_DIRS);
        
        if (newlyDiscovered.length > 0) {
            console.log(`[Auto-Discovery] Discovered ${newlyDiscovered.length} new project(s): ${newlyDiscovered.join(', ')}`);
        } else {
            console.log(`[Auto-Discovery] Scan complete - no new projects found.`);
        }
        
        return newlyDiscovered;
    }

    /**
     * Run background health checks for all running projects
     */
    public async runHealthChecks(): Promise<void> {
        const projects = this.registry.getAllProjects();
        const runningProjects = projects.filter(p => p.status === 'running');

        if (runningProjects.length === 0) return;

        console.log(`[Health-Check] Running status verification for ${runningProjects.length} project(s)...`);

        for (const project of runningProjects) {
            try {
                // Fetch /health from the project
                const response = await fetch(`http://localhost:${project.port}/health`);
                
                if (!response.ok) {
                    console.warn(`[Health-Check] Project ${project.id} is non-responsive (HTTP ${response.status}).`);
                    // We don't automatically stop it, but we could mark it as 'error'
                }
            } catch (error) {
                console.warn(`[Health-Check] Project ${project.id} connection failed: ${error instanceof Error ? error.message : String(error)}`);
                // If the process is supposed to be running but the port is closed, update status
                const childProcess = activeProcesses.get(project.id);
                if (childProcess && childProcess.killed) {
                    this.registry.updateProjectStatus(project.id, 'stopped');
                    activeProcesses.delete(project.id);
                }
            }
        }
    }

    /**
     * Check health of a single project
     */
    private async checkProjectHealth(project: ASCIIProject): Promise<{
        projectId: string;
        projectName: string;
        port: number;
        status: 'running' | 'stopped' | 'error';
        uptime: string | null;
        lastCheck: string | null;
        responseTime: number | null;
    }> {
        const startTime = Date.now();

        if (project.status !== 'running') {
            return {
                projectId: project.id,
                projectName: project.name,
                port: project.port,
                status: project.status,
                uptime: null,
                lastCheck: null,
                responseTime: null
            };
        }

        try {
            const response = await fetch(`http://localhost:${project.port}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            const responseTime = Date.now() - startTime;

            if (response.ok) {
                return {
                    projectId: project.id,
                    projectName: project.name,
                    port: project.port,
                    status: 'running',
                    uptime: formatUptime(project.lastStarted),
                    lastCheck: formatTime(Date.now()),
                    responseTime
                };
            } else {
                return {
                    projectId: project.id,
                    projectName: project.name,
                    port: project.port,
                    status: 'error',
                    uptime: null,
                    lastCheck: formatTime(Date.now()),
                    responseTime
                };
            }
        } catch (error) {
            return {
                projectId: project.id,
                projectName: project.name,
                port: project.port,
                status: 'error',
                uptime: null,
                lastCheck: formatTime(Date.now()),
                responseTime: null
            };
        }
    }

    /**
     * Check health of all projects
     */
    private async checkAllProjectsHealth(): Promise<Array<{
        projectId: string;
        projectName: string;
        port: number;
        status: 'running' | 'stopped' | 'error';
        uptime: string | null;
        lastCheck: string | null;
        responseTime: number | null;
    }>> {
        const projects = this.registry.getAllProjects();
        const healthChecks = await Promise.all(
            projects.map(project => this.checkProjectHealth(project))
        );
        return healthChecks;
    }

    /**
     * Route incoming requests to appropriate handlers
     */
    private async routeRequest(request: Request, path: string, method: string): Promise<Response> {
        // Handle CORS preflight
        if (method === 'OPTIONS') {
            return this.corsResponse();
        }

        // Route by path
        switch (path) {
            case '/health':
                return this.handleHealth();

            case '/view':
                return this.handleView();

            case '/control':
                if (method === 'POST') {
                    return this.handleControl(request);
                }
                return this.jsonResponse({ error: 'Method not allowed' }, 405);

            case '/projects':
                if (method === 'GET') {
                    return this.handleGetProjects();
                } else if (method === 'POST') {
                    return this.handleRegisterProject(request);
                }
                return this.jsonResponse({ error: 'Method not allowed' }, 405);

            case '/metrics':
                return this.handleMetrics();

            default:
                // Handle project-specific endpoints
                if (path.startsWith('/projects/')) {
                    return this.handleProjectAction(path, method, request);
                }

                return this.jsonResponse({ error: 'Not found' }, 404);
        }
    }

    /**
     * GET /health - Health check endpoint
     */
    private handleHealth(): Response {
        return this.jsonResponse({
            status: 'healthy',
            uptime: Date.now() - this.metrics.startTime,
            version: APP_VERSION
        });
    }

    /**
     * GET /view - Render ASCII view of current state
     */
    private async handleView(): Promise<Response> {
        const context = this.stateManager.getData();
        const state = context.state.toLowerCase();

        // Handle PROJECT_VIEW state specially - fetch from managed project
        if (context.state === 'PROJECT_VIEW' && context.selectedProjectId) {
            return this.handleProjectViewRender(context.selectedProjectId);
        }

        // Handle DASHBOARD state specially - fetch health data for all projects
        if (context.state === 'DASHBOARD') {
            return this.handleDashboardView();
        }

        // Build template data based on current state
        const templateData = this.buildTemplateData(context);

        // Render the ASCII template
        const rendered = this.asciiGenerator.render(state, templateData);

        return this.jsonResponse({
            state: context.state,
            view: rendered,
            context: {
                selectedProjectId: context.selectedProjectId,
                editMode: context.editMode,
                unsavedChanges: context.unsavedChanges
            }
        });
    }

    /**
     * Handle rendering of PROJECT_VIEW state
     * Fetches content from the managed project's /view endpoint
     */
    private async handleProjectViewRender(projectId: string): Promise<Response> {
        const project = this.registry.getProject(projectId);

        if (!project) {
            // Project not found, return to PROJECTS state
            this.stateManager.setState('PROJECTS');
            return this.jsonResponse({
                state: 'PROJECTS',
                view: this.asciiGenerator.render('projects', this.buildTemplateData(this.stateManager.getData())),
                error: `Project ${projectId} not found`,
                context: {
                    selectedProjectId: null,
                    editMode: false,
                    unsavedChanges: false
                }
            });
        }

        // Check if project is running
        if (project.status !== 'running') {
            // Project not running, render with error message
            const templateData = {
                ...this.buildTemplateData(this.stateManager.getData()),
                project_name: project.name,
                port: project.port,
                proxied_view: `ERROR: Project is not running (status: ${project.status})`
            };
            const rendered = this.asciiGenerator.render('project-view', templateData);
            return this.jsonResponse({
                state: 'PROJECT_VIEW',
                view: rendered,
                context: {
                    selectedProjectId: projectId,
                    editMode: false,
                    unsavedChanges: false
                }
            });
        }

        // Fetch view from managed project
        try {
            const response = await fetch(`http://localhost:${project.port}/view`);

            if (!response.ok) {
                const templateData = {
                    ...this.buildTemplateData(this.stateManager.getData()),
                    project_name: project.name,
                    port: project.port,
                    proxied_view: `ERROR: Failed to fetch view (HTTP ${response.status})`
                };
                const rendered = this.asciiGenerator.render('project-view', templateData);
                return this.jsonResponse({
                    state: 'PROJECT_VIEW',
                    view: rendered,
                    context: {
                        selectedProjectId: projectId,
                        editMode: false,
                        unsavedChanges: false
                    }
                });
            }

            const data = await response.json() as { view?: string };
            const proxiedView = data.view || '(No view content available)';

            const templateData = {
                ...this.buildTemplateData(this.stateManager.getData()),
                project_name: project.name,
                port: project.port,
                proxied_view: proxiedView
            };
            const rendered = this.asciiGenerator.render('project-view', templateData);

            return this.jsonResponse({
                state: 'PROJECT_VIEW',
                view: rendered,
                context: {
                    selectedProjectId: projectId,
                    editMode: false,
                    unsavedChanges: false
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const templateData = {
                ...this.buildTemplateData(this.stateManager.getData()),
                project_name: project.name,
                port: project.port,
                proxied_view: `ERROR: Connection failed - ${errorMessage}`
            };
            const rendered = this.asciiGenerator.render('project-view', templateData);
            return this.jsonResponse({
                state: 'PROJECT_VIEW',
                view: rendered,
                context: {
                    selectedProjectId: projectId,
                    editMode: false,
                    unsavedChanges: false
                }
            });
        }
    }

    /**
     * Update dashboard health data for all projects
     */
    private async updateDashboardHealth(): Promise<Array<{
        projectId: string;
        projectName: string;
        port: number;
        status: 'running' | 'stopped' | 'error';
        uptime: string | null;
        lastCheck: string | null;
        responseTime: number | null;
    }>> {
        const healthData = await this.checkAllProjectsHealth();
        this.stateManager.setDashboardHealth(healthData);
        return healthData;
    }

    /**
     * Handle rendering of DASHBOARD state
     * Displays health status of all registered projects
     */
    private async handleDashboardView(): Promise<Response> {
        try {
            // Fetch health data for all projects
            const healthData = await this.updateDashboardHealth();

            // Calculate summary
            const runningCount = healthData.filter(h => h.status === 'running').length;
            const stoppedCount = healthData.filter(h => h.status === 'stopped').length;
            const errorCount = healthData.filter(h => h.status === 'error').length;

            // Format health items for template
            const healthItems = healthData.map((health, index) => ({
                label: String(index + 1),
                project_name: health.projectName.padEnd(20).substring(0, 20),
                port: health.port,
                status_icon: health.status === 'running' ? '●' : health.status === 'stopped' ? '○' : '⚠',
                status: health.status.padEnd(7),
                uptime: (health.uptime || '--').padStart(8),
                last_check: (health.lastCheck || '--').padStart(8)
            }));

            const templateData: TemplateData = {
                app_version: APP_VERSION,
                last_check_time: formatTime(this.stateManager.getData().lastHealthCheck),
                health_items: healthItems,
                running_count: runningCount,
                stopped_count: stoppedCount,
                error_count: errorCount
            };

            const rendered = this.asciiGenerator.render('dashboard', templateData);

            return this.jsonResponse({
                state: 'DASHBOARD',
                view: rendered,
                context: {
                    selectedProjectId: null,
                    editMode: false,
                    unsavedChanges: false
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error rendering dashboard:', errorMessage);
            return this.jsonResponse({
                error: 'Failed to render dashboard',
                details: errorMessage
            }, 500);
        }
    }

    /**
     * POST /control - Execute an action by label
     */
    private async handleControl(request: Request): Promise<Response> {
        let body: { label?: string; projectId?: string; action?: string };

        try {
            body = await request.json();
        } catch {
            return this.jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const { label, projectId, action } = body;

        // Handle project-specific actions
        if (projectId) {
            // Validate projectId
            const validatedProjectId = this.validateProjectId(projectId);
            if (!validatedProjectId) {
                return this.jsonResponse({ error: 'Invalid project ID format' }, 400);
            }
            return this.handleProjectControl(validatedProjectId, action || label);
        }

        // Handle manager state actions
        if (!label) {
            return this.jsonResponse({ error: 'Missing label or projectId' }, 400);
        }

        // Validate label format
        const validatedLabel = this.validateLabel(label);
        if (!validatedLabel) {
            return this.jsonResponse({ error: 'Invalid label format. Must be a single letter or digit.' }, 400);
        }

        const currentState = this.stateManager.getState();
        const context = this.stateManager.getData();

        // Handle 'V' action - Enter project view mode
        if (validatedLabel === 'V' && currentState === 'PROJECTS') {
            if (!context.selectedProjectId) {
                return this.jsonResponse({ error: 'No project selected. Select a project first.' }, 400);
            }

            const project = this.registry.getProject(context.selectedProjectId);
            if (!project) {
                return this.jsonResponse({ error: `Project not found: ${context.selectedProjectId}` }, 404);
            }

            if (project.status !== 'running') {
                return this.jsonResponse({
                    error: `Project ${project.name} is not running. Start it first.`
                }, 400);
            }

            this.stateManager.enterProjectView(context.selectedProjectId);
            return this.jsonResponse({
                success: true,
                action: 'enter_project_view',
                projectId: context.selectedProjectId,
                newState: this.stateManager.getState()
            });
        }

        // Handle PROJECT_VIEW state control
        if (currentState === 'PROJECT_VIEW') {
            return this.handleProjectViewControl(validatedLabel);
        }

        // Handle 'R' action to refresh dashboard
        if (validatedLabel === 'R' && currentState === 'DASHBOARD') {
            const healthData = await this.updateDashboardHealth();
            return this.jsonResponse({
                success: true,
                action: 'refresh_dashboard',
                projects_checked: healthData.length,
                state: 'DASHBOARD'
            });
        }

        const result = this.stateManager.handleAction(validatedLabel);

        if (!result.success) {
            return this.jsonResponse({ error: result.error }, 400);
        }

        // Handle special actions
        if (result.action === 'refresh_discovery') {
            const newlyDiscovered = this.runDiscovery();
            return this.jsonResponse({
                success: true,
                action: 'refresh_discovery',
                message: `Scan complete. Discovered ${newlyDiscovered.length} new project(s).`,
                count: newlyDiscovered.length,
                newlyDiscovered
            });
        }

        if (result.action === 'quit') {
            // Graceful shutdown
            setTimeout(() => {
                this.stop();
                process.exit(0);
            }, 100);

            return this.jsonResponse({ action: 'quit', message: 'Shutting down...' });
        }

        return this.jsonResponse({
            success: true,
            action: result.action,
            newState: this.stateManager.getState()
        });
    }

    /**
     * Handle control actions when in PROJECT_VIEW state
     * - A or X: Return to PROJECTS state
     * - Other labels: Forward to managed project's /control endpoint
     */
    private async handleProjectViewControl(label: string): Promise<Response> {
        // A or X returns to PROJECTS state
        if (label === 'A' || label === 'X') {
            const result = this.stateManager.handleAction(label);
            return this.jsonResponse({
                success: true,
                action: result.action,
                newState: this.stateManager.getState(),
                message: 'Returned to projects list'
            });
        }

        // Forward other labels to the managed project
        const context = this.stateManager.getData();
        if (!context.selectedProjectId) {
            this.stateManager.setState('PROJECTS');
            return this.jsonResponse({
                error: 'No project selected, returning to projects list',
                newState: 'PROJECTS'
            }, 400);
        }

        const project = this.registry.getProject(context.selectedProjectId);
        if (!project) {
            this.stateManager.setState('PROJECTS');
            return this.jsonResponse({
                error: `Project ${context.selectedProjectId} not found, returning to projects list`,
                newState: 'PROJECTS'
            }, 404);
        }

        if (project.status !== 'running') {
            return this.jsonResponse({
                error: `Project ${project.name} is not running. Cannot forward control.`,
                state: 'PROJECT_VIEW'
            }, 503);
        }

        // Forward control to managed project
        try {
            const response = await fetch(`http://localhost:${project.port}/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ label })
            });

            if (!response.ok) {
                return this.jsonResponse({
                    error: `Failed to forward control to project ${project.name}`,
                    status: response.status,
                    state: 'PROJECT_VIEW'
                }, 502);
            }

            const data = await response.json();
            return this.jsonResponse({
                ...data,
                forwarded: true,
                projectId: project.id,
                state: 'PROJECT_VIEW'
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.jsonResponse({
                error: `Failed to connect to project ${project.name}: ${errorMessage}`,
                state: 'PROJECT_VIEW'
            }, 502);
        }
    }

    /**
     * Handle project-specific control actions
     */
    private handleProjectControl(projectId: string, action?: string): Response {
        const project = this.registry.getProject(projectId);

        if (!project) {
            return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
        }

        // Validate action if provided
        const validActions = ['start', 'stop', 'select'];
        if (action && !validActions.includes(action)) {
            return this.jsonResponse({ error: `Unknown action: ${action}` }, 400);
        }

        switch (action) {
            case 'start':
                return this.startProject(project);

            case 'stop':
                return this.stopProject(project);

            case 'select':
                this.stateManager.selectProject(projectId);
                return this.jsonResponse({ success: true, action: 'select', projectId });

            default:
                return this.jsonResponse({ error: `Unknown action: ${action}` }, 400);
        }
    }

    /**
     * Start a managed project as a child process
     */
    private startProject(project: ASCIIProject): Response {
        // Check if already running
        if (project.status === 'running') {
            return this.jsonResponse({
                error: `Project ${project.id} is already running`,
                project
            }, 400);
        }

        // Re-validate the project path before spawning (defense in depth)
        const validatedPath = this.validateProjectPath(project.path);
        if (!validatedPath) {
            return this.jsonResponse({
                error: `Invalid or unauthorized project path`
            }, 400);
        }

        // Validate port
        const validatedPort = this.validatePort(project.port);
        if (!validatedPort) {
            return this.jsonResponse({
                error: `Invalid port number: ${project.port}`
            }, 400);
        }

        try {
            // Spawn the project process with sanitized environment
            const childProcess = spawn('bun', ['run', 'src/bun/server.ts'], {
                cwd: validatedPath,
                env: this.buildSafeEnv(validatedPort),
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // Track the process
            activeProcesses.set(project.id, childProcess);

            // Handle process events
            childProcess.on('error', (error) => {
                console.error(`Project ${project.id} error:`, error);
                this.registry.updateProjectStatus(project.id, 'error');
                activeProcesses.delete(project.id);
            });

            childProcess.on('exit', (code) => {
                console.log(`Project ${project.id} exited with code ${code}`);
                const status = code === 0 ? 'stopped' : 'error';
                this.registry.updateProjectStatus(project.id, status);
                activeProcesses.delete(project.id);
            });

            // Update registry
            this.registry.updateProjectStatus(project.id, 'running', childProcess.pid);

            // Select the project
            this.stateManager.selectProject(project.id);

            return this.jsonResponse({
                success: true,
                action: 'start',
                project: this.registry.getProject(project.id)
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.jsonResponse({
                error: `Failed to start project: ${errorMessage}`
            }, 500);
        }
    }

    /**
     * Stop a managed project
     */
    private stopProject(project: ASCIIProject): Response {
        const childProcess = activeProcesses.get(project.id);

        if (!childProcess) {
            return this.jsonResponse({
                error: `Project ${project.id} is not running`,
                project
            }, 400);
        }

        try {
            childProcess.kill();
            activeProcesses.delete(project.id);
            this.registry.updateProjectStatus(project.id, 'stopped');

            return this.jsonResponse({
                success: true,
                action: 'stop',
                project: this.registry.getProject(project.id)
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.jsonResponse({
                error: `Failed to stop project: ${errorMessage}`
            }, 500);
        }
    }

    /**
     * GET /projects/:id/view - Proxy view endpoint to managed project
     * Fetches the managed project's ASCII view from its /view endpoint
     */
    private async handleProxyView(projectId: string): Promise<Response> {
        const project = this.registry.getProject(projectId);

        if (!project) {
            return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
        }

        if (project.status !== 'running') {
            return this.jsonResponse({ error: `Project ${projectId} is not running` }, 503);
        }

        try {
            const response = await fetch(`http://localhost:${project.port}/view`);

            if (!response.ok) {
                return this.jsonResponse({
                    error: `Failed to fetch view from project ${projectId}`,
                    status: response.status
                }, 502);
            }

            const data = await response.json();
            return this.jsonResponse(data);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.jsonResponse({
                error: `Failed to connect to project ${projectId}: ${errorMessage}`
            }, 502);
        }
    }

    /**
     * POST /projects/:id/control - Proxy control endpoint to managed project
     * Forwards control commands (label) to the managed project's /control endpoint
     */
    private async handleProxyControl(projectId: string, request: Request): Promise<Response> {
        const project = this.registry.getProject(projectId);

        if (!project) {
            return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
        }

        if (project.status !== 'running') {
            return this.jsonResponse({ error: `Project ${projectId} is not running` }, 503);
        }

        let body: { label?: string };

        try {
            body = await request.json();
        } catch {
            return this.jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const { label } = body;

        if (!label) {
            return this.jsonResponse({ error: 'Missing label' }, 400);
        }

        // Validate label format (single character A-Z or 1-9)
        const validatedLabel = this.validateLabel(label);
        if (!validatedLabel) {
            return this.jsonResponse({
                error: 'Invalid label format. Must be a single character A-Z or 1-9.'
            }, 400);
        }

        try {
            const response = await fetch(`http://localhost:${project.port}/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ label: validatedLabel })
            });

            if (!response.ok) {
                return this.jsonResponse({
                    error: `Failed to send control to project ${projectId}`,
                    status: response.status
                }, 502);
            }

            const data = await response.json();
            return this.jsonResponse(data);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.jsonResponse({
                error: `Failed to connect to project ${projectId}: ${errorMessage}`
            }, 502);
        }
    }

    /**
     * GET /projects/:id/bindings - Get project bindings
     * Reads the project's bindings.json from {project.path}/src/ascii/bindings.json
     */
    private handleProjectBindings(projectId: string): Response {
        const project = this.registry.getProject(projectId);

        if (!project) {
            return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
        }

        const bindingsPath = resolve(project.path, 'src/ascii/bindings.json');

        if (!existsSync(bindingsPath)) {
            return this.jsonResponse({
                error: `Bindings file not found for project ${projectId}`
            }, 404);
        }

        try {
            const content = readFileSync(bindingsPath, 'utf-8');
            const bindings = JSON.parse(content);
            return this.jsonResponse({ bindings });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.jsonResponse({
                error: `Failed to read bindings for project ${projectId}: ${errorMessage}`
            }, 500);
        }
    }

    /**
     * GET /projects - List all registered projects
     */
    private handleGetProjects(): Response {
        const projects = this.registry.getAllProjects();
        return this.jsonResponse({
            projects,
            count: projects.length
        });
    }

    /**
     * POST /projects - Register a new project
     */
    private async handleRegisterProject(request: Request): Promise<Response> {
        let body: { path?: string; port?: number };

        try {
            body = await request.json();
        } catch {
            return this.jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const { path: projectPath, port } = body;

        if (!projectPath) {
            return this.jsonResponse({ error: 'Missing project path' }, 400);
        }

        // Validate and sanitize the project path
        const validatedPath = this.validateProjectPath(projectPath);
        if (!validatedPath) {
            return this.jsonResponse({
                error: 'Invalid project path. Path must be an absolute path to an existing directory within allowed boundaries.'
            }, 400);
        }

        // Validate port if provided
        let assignedPort: number;
        if (port !== undefined) {
            const validatedPort = this.validatePort(port);
            if (!validatedPort) {
                return this.jsonResponse({
                    error: `Invalid port number. Must be between ${MIN_PORT} and ${MAX_PORT}.`
                }, 400);
            }
            assignedPort = validatedPort;
        } else {
            assignedPort = this.registry.findAvailablePort();
        }

        try {
            // Register the project with validated path
            const project = this.registry.registerProject(validatedPath, assignedPort);

            return this.jsonResponse({
                success: true,
                project
            }, 201);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.jsonResponse({ error: errorMessage }, 400);
        }
    }

    /**
     * GET /metrics - Get performance metrics
     */
    private handleMetrics(): Response {
        const projects = this.registry.getAllProjects();
        const runningProjects = projects.filter(p => p.status === 'running').length;

        return this.jsonResponse({
            server: {
                uptime: Date.now() - this.metrics.startTime,
                totalRequests: this.metrics.totalRequests,
                errors: this.metrics.errors,
                averageResponseTime: this.metrics.averageResponseTime,
                lastRequestTime: this.metrics.lastRequestTime
            },
            requests: {
                byEndpoint: this.metrics.requestsByEndpoint,
                byMethod: this.metrics.requestsByMethod
            },
            projects: {
                total: projects.length,
                running: runningProjects,
                stopped: projects.length - runningProjects
            },
            asciiGenerator: {
                cacheSize: this.asciiGenerator.getCacheSize()
            }
        });
    }

    /**
     * Handle project-specific actions (start, stop, etc.)
     */
    private handleProjectAction(path: string, method: string, request: Request): Response {
        // Parse path: /projects/:id/:action
        const parts = path.split('/').filter(Boolean);

        if (parts.length < 2) {
            return this.jsonResponse({ error: 'Invalid project path' }, 400);
        }

        const projectId = parts[1];
        const action = parts[2];

        // Validate project ID
        const validatedProjectId = this.validateProjectId(projectId);
        if (!validatedProjectId) {
            return this.jsonResponse({ error: 'Invalid project ID format' }, 400);
        }

        // GET /projects/:id - Get project details
        if (!action && method === 'GET') {
            const project = this.registry.getProject(validatedProjectId);
            if (!project) {
                return this.jsonResponse({ error: `Project not found: ${validatedProjectId}` }, 404);
            }
            return this.jsonResponse({ project });
        }

        // DELETE /projects/:id - Unregister project
        if (!action && method === 'DELETE') {
            // Stop if running
            if (activeProcesses.has(validatedProjectId)) {
                this.stopProject(this.registry.getProject(validatedProjectId)!);
            }

            const removed = this.registry.unregisterProject(validatedProjectId);
            if (!removed) {
                return this.jsonResponse({ error: `Project not found: ${validatedProjectId}` }, 404);
            }

            return this.jsonResponse({ success: true, action: 'unregister', projectId: validatedProjectId });
        }

        // POST /projects/:id/start - Start project
        if (action === 'start' && method === 'POST') {
            const project = this.registry.getProject(validatedProjectId);
            if (!project) {
                return this.jsonResponse({ error: `Project not found: ${validatedProjectId}` }, 404);
            }
            return this.startProject(project);
        }

        // POST /projects/:id/stop - Stop project
        if (action === 'stop' && method === 'POST') {
            const project = this.registry.getProject(validatedProjectId);
            if (!project) {
                return this.jsonResponse({ error: `Project not found: ${validatedProjectId}` }, 404);
            }
            return this.stopProject(project);
        }

        // GET /projects/:id/view - Proxy view endpoint to managed project
        if (action === 'view' && method === 'GET') {
            return this.handleProxyView(validatedProjectId);
        }

        // POST /projects/:id/control - Proxy control endpoint to managed project
        if (action === 'control' && method === 'POST') {
            return this.handleProxyControl(validatedProjectId, request);
        }

        // GET /projects/:id/bindings - Get project bindings
        if (action === 'bindings' && method === 'GET') {
            return this.handleProjectBindings(validatedProjectId);
        }

        return this.jsonResponse({ error: 'Unknown project action' }, 400);
    }

    /**
     * Build template data for rendering based on current context
     */
    private buildTemplateData(context: ManagerContext): TemplateData {
        const projects = this.registry.getAllProjects();

        // Map projects to template-friendly format
        const projectList = projects.map((project, index) => ({
            index: index + 1,
            label: String(index + 1),
            id: project.id,
            name: project.name,
            port: project.port,
            status: project.status,
            statusIcon: project.status === 'running' ? '●' : (project.status === 'error' ? '✗' : '○'),
            isRunning: project.status === 'running',
            isSelf: project.port === PORT
        }));

        const baseData: TemplateData = {
            app_version: APP_VERSION,
            current_state: context.state,
            selected_project_id: context.selectedProjectId || '',
            edit_mode: context.editMode,
            unsaved_changes: context.unsavedChanges,
            projects: projectList,
            project_count: projects.length,
            running_count: projects.filter(p => p.status === 'running').length
        };

        // Add state-specific data
        switch (context.state) {
            case 'PROJECTS':
                return {
                    ...baseData,
                    // Projects view specific data
                };

            case 'TEMPLATES':
                return {
                    ...baseData,
                    selected_template: context.selectedTemplateFile || '',
                    scroll_offset: context.templateScrollOffset
                };

            case 'BINDINGS':
                return {
                    ...baseData,
                    bindings: this.stateManager.getBindings().bindings
                };

            case 'TEST':
                return {
                    ...baseData,
                    test_results: context.testResults ? {
                        passed: context.testResults.passed,
                        failed: context.testResults.failed,
                        skipped: context.testResults.skipped,
                        total: context.testResults.total,
                        duration: context.testResults.duration,
                        lastRun: context.testResults.lastRun,
                        failedTests: context.testResults.failedTests
                    } : null,
                    has_results: context.testResults !== null
                };

            case 'GIT':
                return {
                    ...baseData,
                    git_status: context.gitStatus ? {
                        branch: context.gitStatus.branch,
                        ahead: context.gitStatus.ahead,
                        behind: context.gitStatus.behind,
                        staged: context.gitStatus.staged,
                        unstaged: context.gitStatus.unstaged,
                        untracked: context.gitStatus.untracked,
                        lastCommit: context.gitStatus.lastCommit
                    } : null,
                    has_status: context.gitStatus !== null
                };

            case 'PROJECT_VIEW':
                // PROJECT_VIEW uses its own rendering method (handleProjectViewRender)
                // This case is here for completeness but the view data is built separately
                const selectedProject = context.selectedProjectId
                    ? this.registry.getProject(context.selectedProjectId)
                    : null;
                return {
                    ...baseData,
                    project_name: selectedProject?.name || 'Unknown',
                    port: selectedProject?.port || 0,
                    proxied_view: '' // Will be populated in handleProjectViewRender
                };

            default:
                return baseData;
        }
    }

    /**
     * Update request metrics
     */
    private updateMetrics(path: string, method: string, timestamp: number): void {
        this.metrics.totalRequests++;
        this.metrics.lastRequestTime = timestamp;

        // Normalize path for metrics (replace IDs with placeholders)
        const normalizedPath = this.normalizePath(path);

        this.metrics.requestsByEndpoint[normalizedPath] =
            (this.metrics.requestsByEndpoint[normalizedPath] || 0) + 1;

        this.metrics.requestsByMethod[method] =
            (this.metrics.requestsByMethod[method] || 0) + 1;
    }

    /**
     * Normalize path for metrics tracking
     */
    private normalizePath(path: string): string {
        // Replace UUIDs and numeric IDs with placeholders
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            .replace(/\/\d+(?=\/|$)/g, '/:id');
    }

    /**
     * Track response time for averaging
     */
    private trackResponseTime(responseTime: number): void {
        // Keep last 100 response times for averaging
        this.metrics.responseTimes.push(responseTime);
        if (this.metrics.responseTimes.length > 100) {
            this.metrics.responseTimes.shift();
        }

        // Calculate average
        const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageResponseTime = sum / this.metrics.responseTimes.length;
    }

    /**
     * Create a JSON response with CORS headers
     */
    private jsonResponse(data: unknown, status: number = 200): Response {
        return new Response(JSON.stringify(data, null, 2), {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': CORS_ORIGIN,
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    /**
     * Create a CORS preflight response
     */
    private corsResponse(): Response {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': CORS_ORIGIN,
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    /**
     * Get the current server instance
     */
    public getServer(): ReturnType<typeof Bun.serve> | null {
        return this.server;
    }

    /**
     * Get the project registry
     */
    public getRegistry(): ProjectRegistry {
        return this.registry;
    }

    /**
     * Get the state manager
     */
    public getStateManager(): ManagerStateManager {
        return this.stateManager;
    }

    /**
     * Get the ASCII generator
     */
    public getAsciiGenerator(): AsciiGenerator {
        return this.asciiGenerator;
    }
}

// Default export for convenience
export default ManagerServer;

// Server singleton for module-level usage
let defaultServer: ManagerServer | null = null;

/**
 * Get or create the default server instance
 */
export function getManagerServer(
    registryPath?: string,
    templatesPath?: string,
    bindingsPath?: string
): ManagerServer {
    if (!defaultServer) {
        defaultServer = new ManagerServer(registryPath, templatesPath, bindingsPath);
    }
    return defaultServer;
}

/**
 * Start the default server
 */
export function startServer(
    registryPath?: string,
    templatesPath?: string,
    bindingsPath?: string
): ManagerServer {
    const server = getManagerServer(registryPath, templatesPath, bindingsPath);
    server.start();
    return server;
}

/**
 * Stop the default server
 */
export function stopServer(): void {
    if (defaultServer) {
        defaultServer.stop();
        defaultServer = null;
    }
}

// CLI entry point
if (import.meta.main) {
    const server = new ManagerServer();
    server.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT, shutting down...');
        server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, shutting down...');
        server.stop();
        process.exit(0);
    });
}
