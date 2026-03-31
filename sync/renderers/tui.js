// sync/renderers/tui.js
// ASCII → Interactive TUI (Terminal User Interface)
// Parses ASCII substrate and creates blessed/curses widgets
//
// This is the bridge between AI-generated ASCII and interactive terminals.
// AI writes ASCII naturally → This parser creates widgets → User interacts

import { renderToANSI } from './ansi.js';

/**
 * Parse ASCII content into TUI components.
 * Detects: boxes, buttons, inputs, labels, progress bars, tables
 */
export function parseASCIIToComponents(asciiContent) {
    const components = {
        boxes: [],
        buttons: [],
        inputs: [],
        labels: [],
        progressBars: [],
        tables: [],
        title: '',
        dimensions: { width: 80, height: 24 }
    };

    const lines = asciiContent.split('\n');
    components.dimensions.height = lines.length;
    components.dimensions.width = Math.max(...lines.map(l => l.length));

    // Track box boundaries
    const boxStack = [];

    for (let y = 0; y < lines.length; y++) {
        const line = lines[y];

        // Detect title (first text after top border)
        if (y === 1 && line.includes('│')) {
            const match = line.match(/│\s*(.+?)\s*│/);
            if (match) {
                components.title = match[1].trim();
            }
        }

        // Detect buttons: [X] Label or [1] Label
        const buttonPattern = /\[([A-Za-z0-9])\]\s*([A-Za-z][A-Za-z\s]*?)(?=\s{2}|\s*$|\s*\[)/g;
        let btnMatch;
        while ((btnMatch = buttonPattern.exec(line)) !== null) {
            components.buttons.push({
                key: btnMatch[1],
                label: btnMatch[2].trim(),
                x: btnMatch.index,
                y,
                action: btnMatch[2].trim().toLowerCase().replace(/\s+/g, '_')
            });
        }

        // Detect input fields: > _ or [input] or ___________
        if (line.includes('> _') || line.includes('[input')) {
            const inputX = line.indexOf('>');
            components.inputs.push({
                x: inputX + 2,
                y,
                width: (line.slice(inputX + 2).match(/^_+/) || [''])[0].length || 40,
                placeholder: ''
            });
        }

        // Detect progress bars: [████░░░░] XX%
        const progressPattern = /\[([█▓▒░]+)\]\s*(\d+)%?/g;
        let progMatch;
        while ((progMatch = progressPattern.exec(line)) !== null) {
            const filled = progMatch[1].replace(/[░▒]/g, '').length;
            const total = progMatch[1].length;
            components.progressBars.push({
                x: progMatch.index,
                y,
                value: parseInt(progMatch[2]) || Math.round((filled / total) * 100),
                filled,
                total,
                raw: progMatch[1]
            });
        }

        // Detect status indicators: ● ○ ◉
        const statusPattern = /[●○◉◐◑]/g;
        let statusMatch;
        while ((statusMatch = statusPattern.exec(line)) !== null) {
            const char = statusMatch[0];
            const statusMap = {
                '●': 'active',
                '○': 'idle',
                '◉': 'error',
                '◐': 'warning',
                '◑': 'warning'
            };
            components.labels.push({
                type: 'status',
                status: statusMap[char],
                x: statusMatch.index,
                y,
                char
            });
        }

        // Detect box drawing (top-left corners)
        if (line.includes('┌') || line.includes('╔') || line.includes('╭')) {
            const x = line.search(/[┌╔╭]/);
            boxStack.push({ x, y, type: 'box-start' });
        }

        // Detect box drawing (bottom-right corners)
        if (line.includes('┘') || line.includes('╝') || line.includes('╯')) {
            const endX = line.search(/[┘╝╯]/);
            if (boxStack.length > 0) {
                const start = boxStack.pop();
                components.boxes.push({
                    x: start.x,
                    y: start.y,
                    width: endX - start.x + 1,
                    height: y - start.y + 1
                });
            }
        }
    }

    return components;
}

/**
 * Render ASCII content to blessed TUI screen.
 * Requires 'blessed' package: npm install blessed
 *
 * @param {string} asciiContent - The ASCII substrate
 * @param {object} options - TUI options
 * @param {function} options.onInput - Callback for input submission
 * @param {function} options.onButton - Callback for button press
 * @param {function} options.onKey - Callback for any key press
 * @returns {object} Blessed screen object
 */
export async function renderToTUI(asciiContent, options = {}) {
    const { onInput, onButton, onKey, title = 'ASCII TUI' } = options;

    // Parse ASCII into components
    const components = parseASCIIToComponents(asciiContent);

    // Try to load blessed (optional dependency)
    let blessed;
    try {
        const blessedModule = await import('blessed');
        blessed = blessedModule.default || blessedModule;
    } catch (err) {
        // Fallback to ANSI output if blessed not available
        console.error('[TUI] error loading blessed:', err);
        console.log('[TUI] blessed not installed, falling back to ANSI output');
        console.log(renderToANSI(asciiContent));
        return null;
    }

    // Create screen
    const screen = blessed.screen({
        smartCSR: true,
        title: components.title || title,
        fullUnicode: true
    });

    // Main container
    const container = blessed.box({
        parent: screen,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        style: {
            bg: '#0a0a0f',
            fg: '#c9d1d9'
        }
    });

    // Render boxes
    for (const box of components.boxes) {
        blessed.box({
            parent: container,
            top: box.y,
            left: box.x,
            width: box.width,
            height: box.height,
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                bg: '#0a0a0f'
            }
        });
    }

    // Render title
    if (components.title) {
        blessed.text({
            parent: container,
            top: 1,
            left: 'center',
            content: ` ${components.title} `,
            style: {
                fg: 'white',
                bold: true,
                bg: '#0a0a0f'
            }
        });
    }

    // Render buttons
    const buttonElements = [];
    for (const btn of components.buttons) {
        const buttonEl = blessed.button({
            parent: container,
            top: btn.y,
            left: btn.x,
            width: btn.label.length + 4,
            height: 1,
            content: `[${btn.key}] ${btn.label}`,
            style: {
                fg: 'cyan',
                hover: { fg: 'green' },
                focus: { fg: 'green', bold: true }
            },
            mouse: true
        });

        buttonEl.key(btn.key.toLowerCase(), () => {
            if (onButton) onButton(btn.action, btn);
            screen.render();
        });

        buttonEl.on('click', () => {
            if (onButton) onButton(btn.action, btn);
            screen.render();
        });

        buttonElements.push({ el: buttonEl, info: btn });
    }

    // Render inputs
    const inputElements = [];
    for (const input of components.inputs) {
        const inputEl = blessed.textbox({
            parent: container,
            top: input.y,
            left: input.x,
            width: input.width,
            height: 1,
            style: {
                fg: 'white',
                bg: '#161b22',
                focus: { bg: '#1f2428' }
            },
            inputOnFocus: true
        });

        inputEl.key('enter', () => {
            const value = inputEl.getValue();
            if (onInput) onInput(value, input);
            screen.render();
        });

        inputElements.push({ el: inputEl, info: input });
    }

    // Render progress bars
    for (const prog of components.progressBars) {
        const filledWidth = Math.round((prog.value / 100) * (prog.total * 2));
        const emptyWidth = (prog.total * 2) - filledWidth;

        blessed.text({
            parent: container,
            top: prog.y,
            left: prog.x,
            content: `[${'█'.repeat(filledWidth)}${'░'.repeat(emptyWidth)}] ${prog.value}%`,
            style: {
                fg: 'green'
            }
        });
    }

    // Global key handlers
    screen.key(['escape', 'q', 'C-c'], () => {
        screen.destroy();
        process.exit(0);
    });

    if (onKey) {
        screen.on('keypress', (ch, key) => {
            onKey({ ch, key: key?.name, full: key });
        });
    }

    // Focus first input if exists
    if (inputElements.length > 0) {
        inputElements[0].el.focus();
    }

    screen.render();

    return {
        screen,
        components,
        buttons: buttonElements,
        inputs: inputElements,
        destroy: () => screen.destroy(),
        render: () => screen.render()
    };
}

/**
 * Create an interactive TUI session from ASCII.
 * This is the main entry point for AI-controlled TUI.
 *
 * @param {string} initialScreen - Initial ASCII screen
 * @param {object} handlers - Event handlers
 * @returns {Promise<object>} TUI session
 */
export async function createTUISession(initialScreen, handlers = {}) {
    const { onInput, onButton, onKey, onUpdate } = handlers;

    let currentScreen = initialScreen;
    let session = null;

    const updateScreen = async (newScreen) => {
        currentScreen = newScreen;
        if (session) {
            session.destroy();
        }
        session = await renderToTUI(currentScreen, {
            onInput,
            onButton,
            onKey
        });
        if (onUpdate) onUpdate(currentScreen);
        return session;
    };

    // Initial render
    session = await renderToTUI(initialScreen, {
        onInput,
        onButton,
        onKey
    });

    return {
        session,
        updateScreen,
        getCurrentScreen: () => currentScreen,
        destroy: () => session?.destroy()
    };
}

export default renderToTUI;
