#!/usr/bin/env node
// sync/renderers/pxos-tui-viewer.js
// pxOS Dashboard - Interactive TUI for the Pixel Formula Engine
//
// This demonstrates a real-world use case for the TUI renderer:
// A live dashboard showing system metrics, formula execution, and AI status.

import { renderToTUI } from './tui.js';

// ── Dashboard Substrate (80x24) ──────────────────────────────────────────────

const DASHBOARD_ASCII = `
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🌐 pxOS - PIXEL OPERATING SYSTEM DASHBOARD v1.0                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PIXEL FORMULA ENGINE: [ RUNNING ]    AI STATUS: [ ONLINE ]                  │
│  UPTIME: 03:24:12                     THROUGHPUT: 1.2M pixels/sec            │
│                                                                              │
│  ┌─ SYSTEM METRICS ──────────────┐   ┌─ ACTIVE FORMULAS ──────────────────┐  │
│  │ CPU: [████████░░] 80%         │   │ 01. ripple_distortion.wgsl         │  │
│  │ MEM: [████░░░░░░] 40%         │   │ 02. cellular_automata_v3.js        │  │
│  │ GPU: [██████░░░░] 60%         │   │ 03. neural_saccade_opt.py          │  │
│  └───────────────────────────────┘   └────────────────────────────────────┘  │
│                                                                              │
│  ┌─ AI REASONING TRACE (LATEST) ──────────────────────────────────────────┐  │
│  │ > Optimizing render group partition for WebGPU...                      │  │
│  │ > Detected visual artifacts in HILBERT_COHERENCE check.                │  │
│  │ > Re-allocating GPU buffers for 60 FPS visual consistency.             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────    │
│  [R] Restart Engine    [L] View Logs    [S] Settings    [H] Help             │
│  [ESC] Exit Dashboard                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
`;

// ── Interactive Controller ───────────────────────────────────────────────────

async function startDashboard() {
    console.log('Initializing pxOS TUI Dashboard...');

    const render = async () => {
        const screen = await renderToTUI(DASHBOARD_ASCII, {
            title: 'pxOS Dashboard',
            onButton: (action) => {
                // Placeholder for actual button actions
                if (action === 'restart_engine') {
                    // Logic to restart pxos-server.js
                }
            },
            onKey: (ch, key) => {
                if (key.name === 'q' || key.name === 'escape') {
                    process.exit(0);
                }
                // Handle keyboard shortcuts
                if (ch === 'r') console.log('Restarting Engine...');
                if (ch === 'l') console.log('Opening Logs...');
            }
        });

        if (!screen) {
            console.error('Failed to initialize TUI screen.');
            process.exit(1);
        }
    };

    await render();
}

// ── Entry Point ──────────────────────────────────────────────────────────────

startDashboard().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
