/**
 * Project Scaffold Generator
 *
 * Creates a new ASCII-wrapped project with all necessary files.
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ScaffoldOptions {
    projectName: string;
    targetPath: string;
    port: number;
    description?: string;
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
 * @throws Error if the target path already exists
 */
export function scaffoldProject(options: ScaffoldOptions): void {
    const { projectName, targetPath, port, description } = options;

    // Check if target path already exists
    if (existsSync(targetPath)) {
        throw new Error(`Target path already exists: ${targetPath}`);
    }

    // Create directory structure
    const dirs = [
        targetPath,
        join(targetPath, 'src'),
        join(targetPath, 'src/bun'),
        join(targetPath, 'src/ascii'),
        join(targetPath, 'src/ascii/states')
    ];

    for (const dir of dirs) {
        mkdirSync(dir, { recursive: true });
    }

    // Create ASCII templates
    const appName = projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    writeFileSync(
        join(targetPath, 'src/ascii/states/dashboard.ascii'),
        ASCII_TEMPLATE.replace(/{{app_name}}/g, appName).replace('{{app_version}}', '0.1.0')
    );

    writeFileSync(
        join(targetPath, 'src/ascii/states/settings.ascii'),
        SETTINGS_TEMPLATE.replace(/{{app_name}}/g, appName).replace('{{app_version}}', '0.1.0')
    );

    // Create bindings.json
    writeFileSync(
        join(targetPath, 'src/ascii/bindings.json'),
        JSON.stringify(BINDINGS_TEMPLATE, null, 2)
    );

    // Create server.ts
    writeFileSync(
        join(targetPath, 'src/bun/server.ts'),
        SERVER_TEMPLATE
            .replace(/{{app_name}}/g, appName)
            .replace(/{{api_port}}/g, String(port))
    );

    // Create package.json
    writeFileSync(
        join(targetPath, 'package.json'),
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
        join(targetPath, 'README.md'),
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
}
