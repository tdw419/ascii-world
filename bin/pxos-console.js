#!/usr/bin/env node
/**
 * pxos-console.js — High-performance interactive console for pxOS
 * Uses modern sync/ modules and supports RGB animation modes.
 */

import { ScreenManager } from '../sync/screen-manager.js';
import { KeyboardInput, InputLine } from '../sync/keyboard-input.js';
import { MouseInput } from '../sync/mouse-input.js';
import { SoftwareShader, compileFormula } from '../sync/software-shader.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import { Window, WindowManager } from '../sync/window-manager.js';
import { FormulaStore } from '../sync/formula-store.js';

export class PxOSConsole {
    constructor(options = {}) {
        const width = options.width || 1920;
        const height = options.height || 1080;
        
        this.screen = new ScreenManager({
            width,
            height,
            device: options.device || '/dev/fb0'
        });

        this.kb = new KeyboardInput();
        this.mouse = new MouseInput({
            width,
            height,
            startX: width / 2,
            startY: height / 2
        });

        this.wm = new WindowManager(this.screen);
        this.store = new FormulaStore();

        this.input = new InputLine({
            prompt: '> ',
            onEnter: (line) => this.handleCommand(line)
        });

        this.lines = [];
        this.maxLines = this.screen.rows - 4;
        this.header = options.header || ' pxOS | GEOMETRIC INTELLIGENCE CONSOLE ';
        
        this.commands = new Map();
        this.registerDefaultCommands();

        this.animation = null;
        this.startTime = Date.now();
        this.frameCount = 0;
        this.dirty = true;
        
        // Mouse state for rendering
        this.mouseX = width / 2;
        this.mouseY = height / 2;
    }

    registerDefaultCommands() {
        this.commands.set('help', () => {
            this.print('General:', '\x1b[1;36m');
            this.print('  help, clear, echo, exit');
            this.print('Graphics:', '\x1b[1;33m');
            this.print('  rgb-animate [formula|name] - Start animation');
            this.print('  stop                       - Stop animation');
            this.print('Formulas:', '\x1b[1;32m');
            this.print('  save-formula <name> <fn>   - Save named formula');
            this.print('  list-formulas              - List saved formulas');
            this.print('UI:', '\x1b[1;34m');
            this.print('  window-demo                - Show windows');
            this.print('  mouse-test                 - Toggle mouse debug');
        });

        this.commands.set('clear', () => {
            this.lines = [];
            this.screen.clear();
            this.wm.windows = [];
            this.print('Console cleared', '\x1b[2m');
        });

        this.commands.set('echo', (args) => {
            this.print(args.join(' '));
        });

        this.commands.set('rgb-animate', (args) => {
            let formula = args.join(' ');
            
            // Check if it's a named formula
            if (formula && this.store.get(formula)) {
                this.print(`Recalling formula: ${formula}`, '\x1b[1;32m');
                formula = this.store.get(formula);
            }

            if (!formula) {
                // Default plasma
                formula = '(x, y, t) => { const scale = 0.05; const r = Math.sin(x * scale + t) * 127 + 128; const g = Math.sin(y * scale + t * 1.2) * 127 + 128; const b = Math.sin((x + y) * scale + t * 0.8) * 127 + 128; return (255 << 24) | ((b|0) << 16) | ((g|0) << 8) | (r|0); }';
            }

            try {
                const fn = compileFormula(formula);
                this.print('Starting RGB Animation...', '\x1b[1;32m');
                this.startAnimation(fn);
            } catch (e) {
                this.print(`Error: ${e.message}`, '\x1b[31m');
            }
        });

        this.commands.set('save-formula', (args) => {
            const name = args[0];
            const formula = args.slice(1).join(' ');
            if (!name || !formula) {
                this.print('Usage: save-formula <name> <formula>', '\x1b[31m');
                return;
            }
            this.store.set(name, formula);
            this.print(`Formula "${name}" saved`, '\x1b[1;32m');
        });

        this.commands.set('list-formulas', () => {
            const names = this.store.list();
            if (names.length === 0) {
                this.print('No saved formulas', '\x1b[2m');
            } else {
                this.print('Saved Formulas:', '\x1b[1;32m');
                names.forEach(n => this.print(`  ${n}`));
            }
        });

        this.commands.set('window-demo', () => {
            this.print('Creating sample windows...', '\x1b[1;34m');
            
            const win1 = new Window({
                title: 'System Metrics',
                x: 10, y: 10, w: 40, h: 15,
                bg: [10, 30, 40, 255]
            });
            win1.setCell(2, 2, 'C', [0, 255, 0, 255]);
            win1.setCell(3, 2, 'P', [0, 255, 0, 255]);
            win1.setCell(4, 2, 'U', [0, 255, 0, 255]);
            win1.setCell(6, 2, ':', [255, 255, 255, 255]);
            win1.setCell(8, 2, '4', [255, 255, 0, 255]);
            win1.setCell(9, 2, '2', [255, 255, 0, 255]);
            win1.setCell(10, 2, '%', [255, 255, 0, 255]);

            const win2 = new Window({
                title: 'Neural Logs',
                x: 30, y: 20, w: 50, h: 12,
                style: 'double',
                bg: [30, 10, 20, 255]
            });
            
            this.wm.addWindow(win1);
            this.wm.addWindow(win2);
            this.dirty = true;
        });

        this.commands.set('mouse-test', () => {
            this.showMouseDebug = !this.showMouseDebug;
            this.print(`Mouse debug: ${this.showMouseDebug ? 'ON' : 'OFF'}`, '\x1b[1;35m');
        });

        this.commands.set('stop', () => {
            this.stopAnimation();
            this.print('Animation stopped', '\x1b[1;31m');
        });

        this.commands.set('exit', () => {
            this.stop();
            process.exit(0);
        });
    }

    print(text, style = '') {
        this.lines.push(style + text + '\x1b[0m');
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
        this.dirty = true;
    }

    handleCommand(line) {
        this.print('> ' + line, '\x1b[36m');
        const parts = line.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        if (this.commands.has(cmd)) {
            try {
                this.commands.get(cmd)(args);
            } catch (e) {
                this.print(`Command Error: ${e.message}`, '\x1b[31m');
            }
        } else if (cmd) {
            this.print(`Unknown command: ${cmd}`, '\x1b[31m');
        }
        this.dirty = true;
    }

    startAnimation(formula) {
        this.stopAnimation();
        this.startTime = Date.now();
        this.frameCount = 0;
        this.animation = formula;
    }

    stopAnimation() {
        this.animation = null;
        this.screen.buffer.clear(0x0a0a12);
        this.screen.forceRedraw();
    }

    render() {
        if (this.animation) {
            const t = (Date.now() - this.startTime) / 1000;
            SoftwareShader.renderFast(this.screen.buffer, this.animation, null, t);
            this.screen.forceRedraw();
            this.frameCount++;
        }

        if (this.dirty || this.animation || this.mouseMoved) {
            // Header
            this.screen.writeAnsi(`\x1b[1;30;46m${this.header.padEnd(this.screen.cols)}\x1b[0m`, 0, 0);
            
            // Lines
            for (let i = 0; i < this.lines.length; i++) {
                this.screen.writeAnsi(this.lines[i], 1, i + 2);
            }

            // Input
            const inputY = this.screen.rows - 1;
            this.screen.writeAnsi(`\x1b[2m${'-'.repeat(this.screen.cols)}\x1b[0m`, 0, inputY - 1);
            this.screen.writeAnsi(this.input.getDisplayText(), 0, inputY);
            
            // Cursor
            const cursorX = this.input.getCursorPos();
            const charAtCursor = this.input.buffer[this.input.cursor] || ' ';
            this.screen.writeAnsi(`\x1b[7m${charAtCursor}\x1b[0m`, cursorX, inputY);

            // Render windows on top of console lines but below cursor
            this.wm.render();

            // Render text to pixel buffer
            this.screen.render();

            // Draw mouse cursor (pixel-level)
            this.drawMouseCursor();

            if (this.showMouseDebug) {
                const debugText = ` MOUSE: ${this.mouseX},${this.mouseY} `;
                this.screen.writeAnsi(`\x1b[1;37;45m${debugText}\x1b[0m`, this.screen.cols - debugText.length - 1, 0);
                this.screen.render(); // Re-render header part
            }

            this.screen.flush();
            this.dirty = false;
            this.mouseMoved = false;
        }
    }

    drawMouseCursor() {
        const x = this.mouseX;
        const y = this.mouseY;
        const color = PixelBuffer.packRGBA(255, 255, 255, 255);
        const shadow = PixelBuffer.packRGBA(0, 0, 0, 128);

        // Simple arrow shape
        for (let i = 0; i < 10; i++) {
            // Shadow
            this.screen.buffer.setPixel32(x + i + 1, y + i + 1, shadow);
            this.screen.buffer.setPixel32(x + 1, y + i + 1, shadow);
            this.screen.buffer.setPixel32(x + i + 1, y + 1, shadow);

            // Cursor
            this.screen.buffer.setPixel32(x, y + i, color);
            this.screen.buffer.setPixel32(x + i, y, color);
            this.screen.buffer.setPixel32(x + i, y + i, color);
        }
        
        // Mark rows dirty for framebuffer flush
        this.screen.buffer.markRowsDirty(y, 11);
    }

    start() {
        this.kb.on('key', (key, event) => {
            this.input.handleKey(event);
            this.dirty = true;
            if (!this.animation) this.render();
        });

        this.mouse.on('move', (pos) => {
            this.mouseX = pos.x;
            this.mouseY = pos.y;
            this.mouseMoved = true;
            if (!this.animation) this.render();
        });

        this.mouse.on('click', (event) => {
            if (this.wm.handleMouse(event)) {
                this.print(`Focused window: ${this.wm.focusedWindow?.title}`, '\x1b[2m');
            } else {
                this.print(`Mouse click at ${event.x},${event.y}`, '\x1b[2m');
            }
            this.dirty = true;
        });

        this.kb.start();
        this.mouse.start();
        
        this.print('pxOS Console v1.2', '\x1b[1;36m');
        this.print('Autonomous Window Manager Active', '\x1b[1;34m');
        this.print('Type "help" for commands');
        
        // Render loop for animation and mouse
        this.renderInterval = setInterval(() => this.render(), 33);
    }

    stop() {
        clearInterval(this.renderInterval);
        this.kb.stop();
        this.mouse.stop();
    }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    const console = new PxOSConsole();
    console.start();
}
