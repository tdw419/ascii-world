/**
 * Project Scaffold Generator
 *
 * Creates a new ASCII-wrapped project with all necessary files.
 */

import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join, resolve, normalize, relative } from 'path';

export interface ScaffoldOptions {
    projectName: string;
    targetPath: string;
    port: number;
    description?: string;
}

// Validation constants
const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MIN_PORT = 1;
const MAX_PORT = 65535;

// Default allowed base directory (can be overridden via ALLOWED_SCAFFOLD_BASE env var)
const ALLOWED_BASE_DIR = process.env.ALLOWED_SCAFFOLD_BASE || process.cwd();

/**
 * Validation error with specific error code
 */
export class ScaffoldValidationError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'ScaffoldValidationError';
    }
}

/**
 * Validate project name against security pattern
 * @param name Project name to validate
 * @throws ScaffoldValidationError if invalid
 */
function validateProjectName(name: string): void {
    if (!name || typeof name !== 'string') {
        throw new ScaffoldValidationError(
            'INVALID_PROJECT_NAME',
            'Project name is required and must be a string'
        );
    }

    if (!PROJECT_NAME_PATTERN.test(name)) {
        throw new ScaffoldValidationError(
            'INVALID_PROJECT_NAME',
            `Project name "${name}" is invalid. Must match pattern: ${PROJECT_NAME_PATTERN.source} (1-64 characters, alphanumeric, underscore, or hyphen only)`
        );
    }
}

/**
 * Validate port number is within valid range
 * @param port Port number to validate
 * @throws ScaffoldValidationError if invalid
 */
function validatePort(port: number): void {
    if (!Number.isInteger(port)) {
        throw new ScaffoldValidationError(
            'INVALID_PORT',
            'Port must be an integer'
        );
    }

    if (port < MIN_PORT || port > MAX_PORT) {
        throw new ScaffoldValidationError(
            'INVALID_PORT',
            `Port must be between ${MIN_PORT} and ${MAX_PORT}, got: ${port}`
        );
    }
}

/**
 * Validate target path to prevent path traversal attacks
 * @param targetPath Path to validate
 * @param allowedBaseDir Base directory that paths must be within
 * @throws ScaffoldValidationError if path is invalid or outside allowed directory
 */
function validateTargetPath(targetPath: string, allowedBaseDir: string): void {
    if (!targetPath || typeof targetPath !== 'string') {
        throw new ScaffoldValidationError(
            'INVALID_PATH',
            'Target path is required and must be a string'
        );
    }

    // Normalize and resolve the path
    const normalizedTarget = normalize(targetPath);
    const resolvedTarget = resolve(allowedBaseDir, normalizedTarget);
    const resolvedBase = resolve(allowedBaseDir);

    // Check for path traversal attempts
    if (normalizedTarget.includes('..')) {
        throw new ScaffoldValidationError(
            'PATH_TRAVERSAL_DETECTED',
            'Path traversal detected: target path cannot contain ".." segments'
        );
    }

    // Verify the resolved path is within the allowed base directory
    const relativePath = relative(resolvedBase, resolvedTarget);
    if (relativePath.startsWith('..') || (relativePath && !relativePath.startsWith('.'))) {
        throw new ScaffoldValidationError(
            'PATH_OUTSIDE_ALLOWED_DIR',
            `Target path "${targetPath}" is outside allowed directory: ${allowedBaseDir}`
        );
    }
}

const ASCII_TEMPLATE = `╔══════════════════════════════════════════════════════════════════════════════╗
║  {{app_name}}                                              v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Dashboard  [B] Settings  [X] Quit                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  Status: {{app_status}}                                                     ║
║                                                                             ║
║  Welcome to {{app_name}}!                                                   ║
║                                                                             ║
║  This is your new ASCII-wrapped application.                                ║
║                                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

const SETTINGS_TEMPLATE = `╔══════════════════════════════════════════════════════════════════════════════╗
║  {{app_name}} - Settings                                   v{{app_version}}   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Dashboard  [B] Settings  [X] Quit                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  SETTINGS                                                                   ║
║                                                                             ║
║  [1] API Port: {{api_port}}                                                 ║
║  [2] Debug Mode: {{debug_mode}}                                             ║
║  [3] Log Level: {{log_level}}                                               ║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [W] Save Settings  [Z] Reset Defaults                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

const BINDINGS_TEMPLATE = {
    bindings: [
        { label: "A", action: "goto_dashboard", target: "DASHBOARD" },
        { label: "B", action: "goto_settings", target: "SETTINGS" },
        { label: "X", action: "quit", target: "QUIT" },
        { label: "W", action: "save_settings", target: null },
        { label: "Z", action: "reset_defaults", target: null }
    ],
    stateTransitions: {
        DASHBOARD: { A: "DASHBOARD", B: "SETTINGS", X: "QUIT" },
        SETTINGS: { A: "DASHBOARD", B: "SETTINGS", X: "QUIT" }
    }
};

const SERVER_TEMPLATE = `#!/usr/bin/env bun
/**
 * {{app_name}} ASCII API Server
 * Port: {{api_port}}
 */

import { serve } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

export type AppState = 'DASHBOARD' | 'SETTINGS';

export class StateManager {
    public currentState: AppState = 'DASHBOARD';
    private bindings: any;

    constructor() {
        const bindingsPath = join(import.meta.dir, '..', 'ascii', 'bindings.json');
        this.bindings = JSON.parse(readFileSync(bindingsPath, 'utf8'));
    }

    public async handleAction(label: string): Promise<{ success: boolean; action?: string; error?: string }> {
        const stateTransitions = this.bindings.stateTransitions[this.currentState];

        if (!stateTransitions || !stateTransitions[label]) {
            return { success: false, error: \`No action for label [\${label}] in state \${this.currentState}\` };
        }

        const targetState = stateTransitions[label];

        switch (targetState) {
            case 'DASHBOARD':
                this.currentState = 'DASHBOARD';
                return { success: true, action: 'goto_dashboard' };
            case 'SETTINGS':
                this.currentState = 'SETTINGS';
                return { success: true, action: 'goto_settings' };
            case 'QUIT':
                process.exit(0);
        }

        return { success: true, action: targetState.toLowerCase() };
    }

    public getState(): AppState {
        return this.currentState;
    }
}

class AsciiGenerator {
    render(state: string, data: Record<string, any>): string {
        const templatePath = join(import.meta.dir, '..', 'ascii', 'states', \`\${state.toLowerCase()}.ascii\`);
        let template = readFileSync(templatePath, 'utf8');

        for (const [key, value] of Object.entries(data)) {
            template = template.replace(new RegExp(\`{{\${key}}}\`, 'g'), String(value));
        }

        return template;
    }
}

const stateManager = new StateManager();
const asciiGenerator = new AsciiGenerator();
const PORT = {{api_port}};

console.log(\`Starting {{app_name}} on port \${PORT}...\`);

serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        };

        if (path === "/health") {
            return new Response(JSON.stringify({ status: "healthy", port: PORT }), { headers });
        }

        if (path === "/view" && req.method === "GET") {
            const viewData = {
                app_name: "{{app_name}}",
                app_version: "0.1.0",
                app_status: "Running",
                api_port: PORT,
                debug_mode: "Off",
                log_level: "Info"
            };

            const ascii = asciiGenerator.render(stateManager.getState(), viewData);
            return new Response(ascii, { headers: { ...headers, 'Content-Type': 'text/plain' } });
        }

        if (path === "/control" && req.method === "POST") {
            const body = await req.json();
            const result = await stateManager.handleAction(body.label);

            if (result.success) {
                return new Response(JSON.stringify({
                    status: 'ok',
                    state: stateManager.getState(),
                    action: result.action
                }), { headers });
            } else {
                return new Response(JSON.stringify({ error: result.error }), { status: 400, headers });
            }
        }

        return new Response(JSON.stringify({ error: \`Not found: \${path}\` }), { status: 404, headers });
    }
});

console.log(\`+ {{app_name}} running at http://localhost:\${PORT}\`);
`;

/**
 * Scaffold a new ASCII-wrapped project
 *
 * Creates all necessary files for a new project that can be controlled via the ASCII paradigm:
 * - ASCII templates (dashboard.ascii, settings.ascii)
 * - bindings.json
 * - server.ts
 * - package.json
 * - README.md
 *
 * @param options Scaffold options including project name, target path, port, and optional description
 * @throws ScaffoldValidationError if input validation fails
 * @throws Error if the target path already exists or file operations fail
 */
export function scaffoldProject(options: ScaffoldOptions): void {
    const { projectName, targetPath, port, description } = options;

    // Input validation
    validateProjectName(projectName);
    validatePort(port);
    validateTargetPath(targetPath, ALLOWED_BASE_DIR);

    // Resolve the target path after validation
    const resolvedTargetPath = resolve(ALLOWED_BASE_DIR, targetPath);

    // Check if target path already exists
    if (existsSync(resolvedTargetPath)) {
        throw new Error(`Target path already exists: ${resolvedTargetPath}`);
    }

    // Track created directories for cleanup on failure
    const createdDirs: string[] = [];

    try {
        // Create directory structure
        const dirs = [
            resolvedTargetPath,
            join(resolvedTargetPath, 'src'),
            join(resolvedTargetPath, 'src/bun'),
            join(resolvedTargetPath, 'src/ascii'),
            join(resolvedTargetPath, 'src/ascii/states')
        ];

        for (const dir of dirs) {
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
                createdDirs.push(dir);
            }
        }

        // Create ASCII templates
        const appName = projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        writeFileSync(
            join(resolvedTargetPath, 'src/ascii/states/dashboard.ascii'),
            ASCII_TEMPLATE.replace(/{{app_name}}/g, appName).replace('{{app_version}}', '0.1.0')
        );

        writeFileSync(
            join(resolvedTargetPath, 'src/ascii/states/settings.ascii'),
            SETTINGS_TEMPLATE.replace(/{{app_name}}/g, appName).replace('{{app_version}}', '0.1.0')
        );

        // Create bindings.json
        writeFileSync(
            join(resolvedTargetPath, 'src/ascii/bindings.json'),
            JSON.stringify(BINDINGS_TEMPLATE, null, 2)
        );

        // Create server.ts
        writeFileSync(
            join(resolvedTargetPath, 'src/bun/server.ts'),
            SERVER_TEMPLATE
                .replace(/{{app_name}}/g, appName)
                .replace(/{{api_port}}/g, String(port))
        );

        // Create package.json
        writeFileSync(
            join(resolvedTargetPath, 'package.json'),
            JSON.stringify({
                name: projectName,
                version: "0.1.0",
                description: description || `${appName} - ASCII-wrapped application`,
                scripts: {
                    start: "bun run src/bun/server.ts",
                    dev: "bun --watch run src/bun/server.ts"
                },
                dependencies: {}
            }, null, 2)
        );

        // Create README
        writeFileSync(
            join(resolvedTargetPath, 'README.md'),
            `# ${appName}

${description || 'An ASCII-wrapped application.'}

## Running

\`\`\`bash
bun run src/bun/server.ts
\`\`\`

## API Endpoints

- GET /health - Health check
- GET /view - ASCII view
- POST /control - Execute action

## Labels

| Label | Action |
|-------|--------|
| A | Dashboard |
| B | Settings |
| X | Quit |
| W | Save Settings |
| Z | Reset Defaults |
`
        );
    } catch (error) {
        // Cleanup on failure - remove the root target directory if it was created
        if (existsSync(resolvedTargetPath)) {
            try {
                rmSync(resolvedTargetPath, { recursive: true, force: true });
            } catch (cleanupError) {
                // Log cleanup failure but throw the original error
                console.error(`Failed to cleanup ${resolvedTargetPath}:`, cleanupError);
            }
        }
        throw error;
    }
}
