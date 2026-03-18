import { StateManager } from './state-manager';
import { AsciiGenerator } from './ascii-generator';

const metrics = {
    requests: 0,
    totalLatencyMs: 0,
    minLatencyMs: Infinity,
    maxLatencyMs: 0,
    lastAction: '',
    lastActionTime: 0,
};

export function startControlApi(stateManager: StateManager, asciiGenerator: AsciiGenerator) {
    const server = Bun.serve({
        port: 3421,
        async fetch(req) {
            const startTime = performance.now();
            const url = new URL(req.url);

            if (url.pathname === '/view') {
                const ascii = asciiGenerator.render(stateManager);
                return new Response(ascii, {
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            if (url.pathname === '/state') {
                return Response.json(stateManager.getData());
            }

            if (url.pathname === '/metrics') {
                return Response.json({
                    ...metrics,
                    avgLatencyMs: metrics.requests > 0 
                        ? metrics.totalLatencyMs / metrics.requests 
                        : 0
                });
            }

            if (url.pathname === '/control' && req.method === 'POST') {
                try {
                    const body = await req.json();
                    const label = body.label;

                    if (!label) {
                        return new Response('Missing label', { status: 400 });
                    }

                    const success = stateManager.handleAction(label);
                    const latency = performance.now() - startTime;

                    metrics.requests++;
                    metrics.totalLatencyMs += latency;
                    metrics.minLatencyMs = Math.min(metrics.minLatencyMs, latency);
                    metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latency);
                    metrics.lastAction = label;
                    metrics.lastActionTime = Date.now();

                    if (success) {
                        return Response.json({ 
                            status: 'ok', 
                            newState: stateManager.currentState,
                            latencyMs: Math.round(latency * 100) / 100
                        });
                    } else {
                        return new Response('Invalid action', { status: 400 });
                    }
                } catch (e) {
                    return new Response('Invalid JSON', { status: 400 });
                }
            }

            return new Response('Not Found', { status: 404 });
        },
    });

    console.log(`Control API listening on http://localhost:${server.port}`);
    console.log(`Metrics available at http://localhost:${server.port}/metrics`);
    return server;
}
