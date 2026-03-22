/**
 * pxOS ← AutoResearch Bridge
 * 
 * Publishes experiment results from AutoResearch into pxOS's cell store
 * and sets up a dashboard template to visualize experiment progress.
 *
 * Usage:
 *   node bridge.js setup-dashboard       # Create experiment dashboard template
 *   node bridge.js publish '{"commit_hash":"abc","metric":91,"status":"KEEP","description":"..."}'
 *   node bridge.js check                 # Verify pxOS is running
 */

const PXOS_URL = process.env.PXOS_URL || 'http://localhost:3839';

async function checkServer() {
    try {
        const res = await fetch(`${PXOS_URL}/health`);
        if (res.ok) {
            console.log(`✓ pxOS running at ${PXOS_URL}`);
            return true;
        }
    } catch (e) {
        console.error(`✗ pxOS not reachable at ${PXOS_URL}: ${e.message}`);
    }
    return false;
}

async function publishResult(result) {
    // Map experiment result to pxOS cells
    const cells = {
        exp_commit: (result.commit_hash || '').slice(0, 7),
        exp_metric: typeof result.metric === 'number' ? result.metric : 0,
        exp_status: result.status === 'KEEP' ? 1 : 0,
        exp_status_text: result.status || 'UNKNOWN',
        exp_desc: (result.description || '').slice(0, 60),
        exp_timestamp: result.timestamp || new Date().toISOString(),
        // BAR expects 0-1 fraction; normalize against baseline of 91 tests
        exp_tests_passed: typeof result.metric === 'number' ? Math.min(1, result.metric / 100) : 0,
        exp_tests_raw: typeof result.metric === 'number' ? result.metric : 0,
    };

    const res = await fetch(`${PXOS_URL}/api/v1/cells`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cells),
    });

    if (!res.ok) {
        throw new Error(`POST /api/v1/cells failed: ${res.status}`);
    }

    const body = await res.json();
    console.log(`✓ Published: ${result.status} | metric=${result.metric} | ${body.changes} cells changed`);
}

async function setupDashboard() {
    // Template uses { fn, args } format — that's what PixelFormulaEngine.renderTemplate expects
    const template = [
        // Header
        { fn: 'BOX', args: [0, 0, 60, 3] },
        { fn: 'TEXT', args: [2, 1, 'AUTORESEARCH DASHBOARD'] },

        // Current experiment info
        { fn: 'BOX', args: [0, 4, 60, 7] },
        { fn: 'TEXT', args: [2, 5, 'Experiment:'] },
        { fn: 'TEXT', args: [14, 5, 'exp_desc'] },
        { fn: 'TEXT', args: [2, 6, 'Commit:'] },
        { fn: 'TEXT', args: [14, 6, 'exp_commit'] },
        { fn: 'TEXT', args: [2, 7, 'Status:'] },
        { fn: 'STATUS', args: [14, 7, 'exp_status', 1, '● KEEP', 0, '○ DISCARD'] },
        { fn: 'TEXT', args: [2, 8, 'Tests:'] },
        { fn: 'BAR', args: [14, 8, 'exp_tests_passed', 30] },
        { fn: 'TEXT', args: [2, 9, 'Time:'] },
        { fn: 'TEXT', args: [14, 9, 'exp_timestamp'] },

        // Metric history sparkline
        { fn: 'BOX', args: [0, 12, 60, 5] },
        { fn: 'TEXT', args: [2, 13, 'Metric History:'] },
        { fn: 'SPARKLINE', args: [2, 15, 'exp_metric', 56] },

        // Footer
        { fn: 'TEXT', args: [0, 18, 'pxOS + AutoResearch'] },
    ];

    const res = await fetch(`${PXOS_URL}/api/v1/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
    });

    if (!res.ok) {
        throw new Error(`POST /api/v1/template failed: ${res.status}`);
    }

    console.log(`✓ Dashboard template set (${template.length} formulas)`);

    // Save it as a named dashboard
    await fetch(`${PXOS_URL}/api/v1/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'autoresearch' }),
    });

    console.log('✓ Saved as "autoresearch" dashboard');
}

// CLI
const [,, command, ...args] = process.argv;

(async () => {
    switch (command) {
        case 'check':
            await checkServer();
            break;
        case 'setup-dashboard':
            if (!(await checkServer())) process.exit(1);
            await setupDashboard();
            break;
        case 'publish':
            if (!args[0]) {
                console.error('Usage: node bridge.js publish \'<json>\'');
                process.exit(1);
            }
            if (!(await checkServer())) process.exit(1);
            await publishResult(JSON.parse(args[0]));
            break;
        default:
            console.log(`pxOS ← AutoResearch Bridge

Commands:
  check             Verify pxOS is running
  setup-dashboard   Create experiment visualization template  
  publish '<json>'  Publish an experiment result

JSON shape: { "commit_hash": "...", "metric": 91, "status": "KEEP", "description": "..." }

Environment:
  PXOS_URL  (default: http://localhost:3839)`);
    }
})();
