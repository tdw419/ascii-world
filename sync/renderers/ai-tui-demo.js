#!/usr/bin/env node
// sync/renderers/ai-tui-demo.js
// Demo: AI-controlled TUI using ASCII as the interface layer
//
// This demonstrates how an AI can "write screens" naturally
// and users interact with them through a terminal.
//
// Run: node sync/renderers/ai-tui-demo.js

import { parseASCIIToComponents, renderToTUI, createTUISession } from './tui.js';
import { renderToANSI } from './ansi.js';
import { render } from './index.js';

// ── Simulated AI Screens ─────────────────────────────────────────────────────

const SCREENS = {
    main: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🤖 AI ASSISTANT - Main Menu                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  What would you like to do?                                                  │
│                                                                              │
│  [1] Search Codebase     [2] Run Tests      [3] View Logs                   │
│  [4] Deploy App          [5] Settings       [6] Help                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────    │
│  System Status: ● All systems operational                                    │
│  CPU: [████████░░] 80%    MEM: [████░░░░░░] 40%    DISK: [██████░░░░] 60%   │
│                                                                              │
│  [Q] Quit                                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
`,

    search: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔍 SEARCH CODEBASE                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Enter search query:                                                         │
│  > ________________________________________________________________________  │
│                                                                              │
│  Options:                                                                    │
│  [C] Case sensitive    [R] Regex mode    [F] Files only                     │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────    │
│  [ESC] Back    [ENTER] Search                                                │
└──────────────────────────────────────────────────────────────────────────────┘
`,

    results: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔍 SEARCH RESULTS: "renderToTUI" (5 matches)                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  01. sync/renderers/tui.js:45    renderToTUI() {●}                          │
│  02. sync/renderers/tui.js:120   async function renderToTUI() {●}           │
│  03. sync/renderers/index.js:15  import { renderToTUI } from './tui.js'; {●}│
│  04. sync/renderers/tui.js:200   export function renderToTUI() {●}          │
│  05. tests/tui.test.js:12        describe('renderToTUI', () => {●}          │
│                                                                              │
│  [1-5] Select file    [V] View    [E] Edit    [N] Next page                 │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────    │
│  [ESC] Back    [ENTER] Open first result                                     │
└──────────────────────────────────────────────────────────────────────────────┘
`,

    deploy: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🚀 DEPLOY APP                                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Environment: [P] Production    [S] Staging    [D] Development              │
│                                                                              │
│  Selected: Staging ◑                                                         │
│                                                                              │
│  Deployment Progress:                                                        │
│  [████████████████░░░░░░░░] 67%                                              │
│                                                                              │
│  Current Step: Running tests...                                              │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────    │
│  [C] Cancel    [L] View Logs    [ESC] Back                                   │
└──────────────────────────────────────────────────────────────────────────────┘
`,

    help: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ ❓ HELP - AI TUI System                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  This TUI is controlled by AI-generated ASCII screens.                       │
│                                                                              │
│  HOW IT WORKS:                                                               │
│  1. AI writes ASCII screen (natural text output)                            │
│  2. ASCII parser extracts components (buttons, inputs, etc.)                │
│  3. TUI renderer creates interactive widgets                                │
│  4. User input flows back to AI                                             │
│  5. AI generates new screen based on input                                  │
│                                                                              │
│  KEY BINDINGS:                                                               │
│  [1-9] Quick actions    [ESC] Go back    [Q] Quit                           │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────    │
│  [ESC] Back to Main Menu                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
`
};

// ── AI TUI Controller (Simplified) ───────────────────────────────────────────

class AITUIController {
    constructor() {
        this.history = [];
        this.currentScreen = 'main';
        this.state = {
            searchQuery: '',
            environment: 'staging',
            deployProgress: 67
        };
    }

    // Simulated AI response - in production, this would call an LLM
    async generateScreen(event) {
        this.history.push({ ...event, timestamp: Date.now() });

        // Simple routing logic (simulating AI decision)
        if (event.type === 'shortcut') {
            switch (event.key) {
                case '1': return { screen: 'search', action: 'show_search' };
                case '2': return { screen: 'results', action: 'run_tests' };
                case '3': return { screen: 'main', action: 'view_logs' };
                case '4': return { screen: 'deploy', action: 'deploy_app' };
                case '5': return { screen: 'main', action: 'settings' };
                case '6': return { screen: 'help', action: 'show_help' };
            }
        }

        if (event.type === 'command' && event.text) {
            this.state.searchQuery = event.text;
            return { screen: 'results', action: 'search_results', query: event.text };
        }

        if (event.type === 'button') {
            switch (event.action) {
                case 'search_codebase': return { screen: 'search' };
                case 'run_tests': return { screen: 'results' };
                case 'deploy_app': return { screen: 'deploy' };
                case 'help': return { screen: 'help' };
            }
        }

        if (event.key === 'escape') {
            return { screen: 'main', action: 'back' };
        }

        return { screen: this.currentScreen };
    }

    getASCIIScreen(screenName) {
        return SCREENS[screenName] || SCREENS.main;
    }
}

// ── Demo Runner ──────────────────────────────────────────────────────────────

async function runDemo() {
    console.log('╔═════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ AI-CONTROLLED TUI DEMO                                                       ║');
    console.log('║ ASCII as the Interface Layer                                                 ║');
    console.log('╚═════════════════════════════════════════════════════════════════════════════╝\n');

    // Show what AI outputs (raw ASCII)
    console.log('── 1. AI OUTPUT (Raw ASCII) ──────────────────────────────────────────────\n');
    console.log(SCREENS.main);

    // Show parsed components
    console.log('\n── 2. PARSED COMPONENTS ──────────────────────────────────────────────────\n');
    const components = parseASCIIToComponents(SCREENS.main);
    console.log('Title:', components.title);
    console.log('Boxes:', components.boxes.length);
    console.log('Buttons:', components.buttons.map(b => `[${b.key}] ${b.label}`).join(', '));
    console.log('Progress Bars:', components.progressBars.map(p => `${p.value}%`).join(', '));
    console.log('Status Indicators:', components.labels.map(l => `${l.char}=${l.status}`).join(', '));

    // Show ANSI rendered version
    console.log('\n── 3. ANSI RENDERED (Terminal) ───────────────────────────────────────────\n');
    const ansiOutput = renderToANSI(SCREENS.main);
    console.log(ansiOutput);

    // Show other format outputs
    console.log('\n── 4. MULTI-FORMAT OUTPUT ────────────────────────────────────────────────\n');
    console.log('HTML:', render(SCREENS.main, 'html').substring(0, 100) + '...');
    console.log('JSON:', JSON.stringify(render(SCREENS.main, 'json')).substring(0, 100) + '...');
    console.log('SVG:', render(SCREENS.main, 'svg').substring(0, 100) + '...');

    // Interactive demo simulation
    console.log('\n── 5. INTERACTION SIMULATION ─────────────────────────────────────────────\n');

    const controller = new AITUIController();

    // Simulate user pressing [1] for Search
    console.log('User presses [1]...');
    let response = await controller.generateScreen({ type: 'shortcut', key: '1' });
    console.log(`AI responds with screen: ${response.screen}`);
    console.log(controller.getASCIIScreen(response.screen));

    await sleep(500);

    // Simulate user entering search query
    console.log('\nUser types "renderToTUI" and presses Enter...');
    response = await controller.generateScreen({ type: 'command', text: 'renderToTUI' });
    console.log(`AI responds with screen: ${response.screen}`);
    console.log(controller.getASCIIScreen(response.screen));

    // Summary
    console.log('\n── 6. ARCHITECTURE SUMMARY ───────────────────────────────────────────────\n');
    console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI-TUI ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   AI (writes) ──▶ ASCII Substrate ──▶ Parser ──▶ TUI Renderer              │
│        ▲              (80x24)           │              │                     │
│        │                               │              ▼                     │
│        │                               │         Interactive                │
│        │                               │           Terminal                 │
│        │                               │              │                     │
│        │                               ▼              │                     │
│        └──────────── Event Parser ◀──────────────────┘                     │
│                                                                              │
│   KEY INSIGHT: AI outputs text naturally. ASCII IS the interface.          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
`);

    console.log('✓ Demo complete!\n');
    console.log('To run interactive TUI (requires blessed): node sync/renderers/ai-tui-demo.js --interactive\n');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Interactive Mode ─────────────────────────────────────────────────────────

async function runInteractive() {
    const controller = new AITUIController();
    let currentScreen = 'main';
    let screen;

    const renderScreen = async (screenName) => {
        const ascii = controller.getASCIIScreen(screenName);
        
        // Re-render the screen with the new ASCII content
        screen = await renderToTUI(ascii, {
            title: `AI TUI Demo - ${screenName}`,
            onButton: async (action, btn) => {
                const response = await controller.generateScreen({ type: 'button', action, key: btn.key });
                currentScreen = response.screen;
                await renderScreen(currentScreen);
            },
            onInput: async (text) => {
                const response = await controller.generateScreen({ type: 'command', text });
                currentScreen = response.screen;
                await renderScreen(currentScreen);
            },
            onKey: async (ch, key) => {
                if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
                    process.exit(0);
                }
                if (key.name === 'escape') {
                    const response = await controller.generateScreen({ key: 'escape' });
                    currentScreen = response.screen;
                    await renderScreen(currentScreen);
                }
                // Handle shortcut keys 1-6
                if (['1', '2', '3', '4', '5', '6'].includes(ch)) {
                    const response = await controller.generateScreen({ type: 'shortcut', key: ch });
                    currentScreen = response.screen;
                    await renderScreen(currentScreen);
                }
            }
        });

        if (!screen) {
            console.error('Failed to initialize TUI screen.');
            process.exit(1);
        }
    };

    // Initial render
    await renderScreen(currentScreen);
}

// ── Entry Point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--interactive') || args.includes('-i')) {
    runInteractive();
} else {
    runDemo();
}
