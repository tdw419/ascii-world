/**
 * Standalone test server for integration tests
 *
 * This is a simplified version of the ascii-ref-app server
 * that doesn't require Electrobun dependencies.
 */

import { StateManager } from '../../apps/ascii-ref-app/src/bun/state-manager';
import { AsciiGenerator } from '../../apps/ascii-ref-app/src/bun/ascii-generator';

const stateManager = new StateManager();
const asciiGenerator = new AsciiGenerator();

const server = Bun.serve({
    port: 3421,
    async fetch(req) {
        const url = new URL(req.url);

        // CORS headers for cross-origin requests
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (url.pathname === '/view') {
            const ascii = asciiGenerator.render(stateManager);
            return new Response(ascii, {
                headers: { 'Content-Type': 'text/plain', ...corsHeaders }
            });
        }

        if (url.pathname === '/state') {
            return Response.json(stateManager.getData(), {
                headers: corsHeaders
            });
        }

        if (url.pathname === '/control' && req.method === 'POST') {
            try {
                const body = await req.json();
                const label = body.label;

                if (!label) {
                    return new Response('Missing label', { status: 400, headers: corsHeaders });
                }

                const success = stateManager.handleAction(label);

                if (success) {
                    return Response.json({
                        status: 'ok',
                        newState: stateManager.currentState,
                    }, { headers: corsHeaders });
                } else {
                    return new Response('Invalid action', { status: 400, headers: corsHeaders });
                }
            } catch {
                return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
            }
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
});

console.log(`Test server running on http://localhost:${server.port}`);
