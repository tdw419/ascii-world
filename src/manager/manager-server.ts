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
import { ProjectRegistry, ASCIIProject } from './project-registry';
import { ManagerStateManager, ManagerContext, ManagerState } from './manager-state';
import { AsciiGenerator, TemplateData } from './ascii-generator';

// Server configuration
const PORT = 3422;
const HOST = '0.0.0.0';

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

// Active child processes for managed projects
const activeProcesses: Map<string, ChildProcess> = new Map();

// App version (read from package.json or default)
const APP_VERSION = '1.0.0';

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

    /**
     * Start the HTTP server
     */
    public start(): void {
        this.server = Bun.serve({
            port: PORT,
            hostname: HOST,
            fetch: async (request: Request): Promise<Response> => {
                const startTime = Date.now();
                const url = new URL(request.url);
                const path = url.pathname;
                const method = request.method;

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
    }

    /**
     * Stop the HTTP server and all managed processes
     */
    public stop(): void {
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
    private handleView(): Response {
        const context = this.stateManager.getData();
        const state = context.state.toLowerCase();

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
            return this.handleProjectControl(projectId, action || label);
        }

        // Handle manager state actions
        if (!label) {
            return this.jsonResponse({ error: 'Missing label or projectId' }, 400);
        }

        const result = this.stateManager.handleAction(label);

        if (!result.success) {
            return this.jsonResponse({ error: result.error }, 400);
        }

        // Handle special actions
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
     * Handle project-specific control actions
     */
    private handleProjectControl(projectId: string, action?: string): Response {
        const project = this.registry.getProject(projectId);

        if (!project) {
            return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
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

        try {
            // Spawn the project process
            const childProcess = spawn('bun', ['run', 'src/index.ts'], {
                cwd: project.path,
                env: {
                    ...process.env,
                    PORT: String(project.port)
                },
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

        try {
            // Find an available port if not specified
            const assignedPort = port || this.registry.findAvailablePort();

            // Register the project
            const project = this.registry.registerProject(projectPath, assignedPort);

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

        // GET /projects/:id - Get project details
        if (!action && method === 'GET') {
            const project = this.registry.getProject(projectId);
            if (!project) {
                return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
            }
            return this.jsonResponse({ project });
        }

        // DELETE /projects/:id - Unregister project
        if (!action && method === 'DELETE') {
            // Stop if running
            if (activeProcesses.has(projectId)) {
                this.stopProject(this.registry.getProject(projectId)!);
            }

            const removed = this.registry.unregisterProject(projectId);
            if (!removed) {
                return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
            }

            return this.jsonResponse({ success: true, action: 'unregister', projectId });
        }

        // POST /projects/:id/start - Start project
        if (action === 'start' && method === 'POST') {
            const project = this.registry.getProject(projectId);
            if (!project) {
                return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
            }
            return this.startProject(project);
        }

        // POST /projects/:id/stop - Stop project
        if (action === 'stop' && method === 'POST') {
            const project = this.registry.getProject(projectId);
            if (!project) {
                return this.jsonResponse({ error: `Project not found: ${projectId}` }, 404);
            }
            return this.stopProject(project);
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
                'Access-Control-Allow-Origin': '*',
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
                'Access-Control-Allow-Origin': '*',
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
