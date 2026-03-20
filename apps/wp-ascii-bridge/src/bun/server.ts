/**
 * WordPress ASCII Bridge Server
 * Translates WordPress REST API into a spatial ASCII interface.
 */

import { serve } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

// Configuration (can be overridden via ENV)
const PORT = process.env.PORT || 3450;
const WP_URL = process.env.WP_URL || "https://example.com";
const WP_USER = process.env.WP_USER || "admin";
const WP_PASSWORD = process.env.WP_APP_PASSWORD || "";

export type AppState = 'DASHBOARD' | 'POSTS' | 'PAGES' | 'SETTINGS';

class StateManager {
    public currentState: AppState = 'DASHBOARD';
    public selectedId: number | null = null;
    public posts: any[] = [];
    private bindings: any;

    constructor() {
        const bindingsPath = join(import.meta.dir, '..', 'ascii', 'bindings.json');
        this.bindings = JSON.parse(readFileSync(bindingsPath, 'utf8'));
    }

    public async handleAction(label: string): Promise<{ success: boolean; action?: string; error?: string }> {
        const stateTransitions = this.bindings.stateTransitions[this.currentState];

        // Handle numeric labels (1-9) for selecting items
        if (/^[1-9]$/.test(label)) {
            const index = parseInt(label) - 1;
            if (this.posts[index]) {
                this.selectedId = this.posts[index].id;
                return { success: true, action: 'select_post' };
            }
        }

        if (!stateTransitions || !stateTransitions[label]) {
            return { success: false, error: `No action for label [${label}] in state ${this.currentState}` };
        }

        const targetState = stateTransitions[label];

        switch (targetState) {
            case 'DASHBOARD': this.currentState = 'DASHBOARD'; break;
            case 'POSTS': this.currentState = 'POSTS'; break;
            case 'PAGES': this.currentState = 'PAGES'; break;
            case 'SETTINGS': this.currentState = 'SETTINGS'; break;
            case 'QUIT': process.exit(0);
        }

        return { success: true, action: `goto_${targetState.toLowerCase()}` };
    }
}

class AsciiGenerator {
    render(state: string, data: Record<string, any>): string {
        try {
            const templatePath = join(import.meta.dir, '..', 'ascii', 'states', `${state.toLowerCase()}.ascii`);
            let template = readFileSync(templatePath, 'utf8');

            // Replace simple variables {{var}}
            for (const [key, value] of Object.entries(data)) {
                if (typeof value !== 'object') {
                    template = template.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
                }
            }

            // Handle loops for posts (very basic for this bridge)
            if (data.posts && Array.isArray(data.posts)) {
                let postRows = "";
                data.posts.forEach((post, i) => {
                    const label = `[${i + 1}]`;
                    const title = post.title.rendered.padEnd(30).substring(0, 30);
                    const status = post.status.toUpperCase().padEnd(10);
                    postRows += `  │  ${label} ${title} | ${status} | ID: ${String(post.id).padEnd(6)} │\n`;
                });
                template = template.replace('{{post_list}}', postRows || "  │  (No posts found)                                                     │");
            }

            return template;
        } catch (e) {
            return `ERROR: Failed to render state ${state}. Template not found?`;
        }
    }
}

const stateManager = new StateManager();
const asciiGenerator = new AsciiGenerator();

console.log(`Starting WP-ASCII Bridge on port ${PORT}...`);

serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (req.method === "OPTIONS") return new Response(null, { headers });

        console.log(`[Request] ${req.method} ${path}`);

        if (path === "/" || path === "/view") {
            if (req.method === "GET") {

                // Mock data for initial demo
                if (stateManager.posts.length === 0) {
                    stateManager.posts = [
                        { id: 1042, title: { rendered: "The Future of Geometric OS" }, status: "publish" },
                        { id: 1043, title: { rendered: "Draft: AI Content Pipelines" }, status: "draft" },
                        { id: 1, title: { rendered: "Hello World" }, status: "publish" }
                    ];
                }

                const viewData = {
                    site_name: new URL(WP_URL).hostname,
                    wp_version: "6.4.3",
                    post_count: stateManager.posts.length,
                    selected_id: stateManager.selectedId || "None",
                    posts: stateManager.posts
                };

                const ascii = asciiGenerator.render(stateManager.currentState, viewData);

                if (req.headers.get("accept")?.includes("application/json")) {
                    return new Response(JSON.stringify({
                        state: stateManager.currentState,
                        view: ascii,
                        context: viewData
                    }), { headers });
                }

                return new Response(ascii, { headers: { ...headers, 'Content-Type': 'text/plain' } });
            }
        }

        if (path === "/health") return new Response(JSON.stringify({ status: "healthy", site: WP_URL }), { headers });

        if (path === "/control" && req.method === "POST") {
            const body = await req.json();
            const result = await stateManager.handleAction(body.label);
            return new Response(JSON.stringify(result), { headers });
        }

        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
    }
});
