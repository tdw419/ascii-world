#!/usr/bin/env node
// console.js — Interactive console for framebuffer
// Combines TextWriter + KeyboardInput into a usable terminal

import { TextWriter } from './text-to-fb.js';
import { KeyboardInput, InputLine } from './keyboard.js';
import * as readline from 'node:readline';

const COLS = 320;  // 1920 / 6
const ROWS = 108;  // 1080 / 10

/**
 * ScreenConsole — Interactive console on framebuffer
 * 
 * Layout:
 * ┌─────────────────────────────────────┐
 * │ HEADER                              │ row 0
 * ├─────────────────────────────────────┤ row 1
 * │                                     │
 * │ OUTPUT AREA                         │ rows 2-105
 * │ (scrolling)                         │
 * │                                     │
 * ├─────────────────────────────────────┤ row 106
 * │> input line_                        │ row 107
 * └─────────────────────────────────────┘
 */
export class ScreenConsole {
    constructor(options = {}) {
        this.width = options.width || 1920;
        this.height = options.height || 1080;
        this.device = options.device || '/dev/fb0';
        
        this.writer = new TextWriter({
            width: this.width,
            height: this.height,
            device: this.device
        });
        
        this.kb = new KeyboardInput();
        this.input = new InputLine({
            prompt: '> ',
            onEnter: (line) => this.handleCommand(line)
        });
        
        // Screen buffer
        this.lines = [];
        this.maxLines = ROWS - 4; // Leave room for header and input
        this.scrollOffset = 0;
        
        // Header
        this.header = options.header || 'GEOMETRY OS | FRAMEBUFFER CONSOLE';
        
        // Commands
        this.commands = new Map();
        this.registerDefaultCommands();
        
        // Render state
        this.dirty = true;
        this.renderInterval = null;
        this.pixelFormula = null; // Active pixel formula for re-rendering
    }
    
    /**
     * Register default commands
     */
    registerDefaultCommands() {
        this.commands.set('clear', () => {
            this.lines = [];
            this.pixelFormula = null; // Clear pixel formula too
            this.print('Screen cleared', 0x888888);
        });
        
        this.commands.set('help', () => {
            this.print('Commands:', 0x00FFFF);
            this.print('  help              - Show commands', 0xAAAAAA);
            this.print('  clear             - Clear screen', 0xAAAAAA);
            this.print('  echo <text>       - Print text', 0xAAAAAA);
            this.print('  color <hex>       - Test color', 0xAAAAAA);
            this.print('  eval <expr>       - Evaluate JS expression', 0xAAAAAA);
            this.print('  calc <expr>       - Same as eval', 0xAAAAAA);
            this.print('  formula <fn>      - Render grayscale formula (x,y)=>v', 0xAAAAAA);
            this.print('  rgb <fn>          - Render RGB formula (x,y)=>[r,g,b]', 0xAAAAAA);
            this.print('  animate <fn>      - Animate formula (x,y,t)=>v', 0xFFFF00);
            this.print('  stop              - Stop animation', 0xFFFF00);
            this.print('  fps               - Show animation FPS', 0xAAAAAA);
            this.print('  test              - Run test', 0xAAAAAA);
            this.print('  fill <hex>        - Fill screen with color', 0xAAAAAA);
            this.print('  queue status      - Show queue and rate limits', 0xFFFF00);
            this.print('  providers         - List available AI providers', 0xFFFF00);
        });
        
        this.commands.set('echo', (args) => {
            this.print(args.join(' '), 0xFFFFFF);
        });
        
        this.commands.set('color', (args) => {
            const color = parseInt(args[0], 16) || 0xFFFFFF;
            this.print(`Color test: ${args[0]}`, color);
        });
        
        this.commands.set('test', () => {
            this.print('Running test...', 0xFFFF00);
            for (let i = 0; i < 10; i++) {
                this.print(`Line ${i + 1}`, (i * 0x19000) + 0x0000FF);
            }
        });
        
        this.commands.set('fill', (args) => {
            const color = parseInt(args[0], 16) || 0xFF0000;
            this.writer.fillRect(0, 0, this.width, this.height, color);
            this.flush();
            this.print('Screen filled', color);
        });
        
        this.commands.set('eval', (args) => {
            const expr = args.join(' ');
            if (!expr) {
                this.print('Usage: eval <expression>', 0x888888);
                return;
            }
            try {
                // Safe-ish eval (no access to require, process, etc.)
                const result = Function(
                    '"use strict"; return (' + expr + ')'
                )();
                const output = typeof result === 'object' 
                    ? JSON.stringify(result, null, 2) 
                    : String(result);
                this.print(`= ${output}`, 0x00FF88);
            } catch (e) {
                this.print(`Error: ${e.message}`, 0xFF4444);
            }
        });
        
        this.commands.set('calc', (args) => {
            // Alias for eval
            this.commands.get('eval')(args);
        });
        
        this.commands.set('formula', (args) => {
            const expr = args.join(' ');
            if (!expr) {
                this.print('Usage: formula (x,y) => expression', 0x888888);
                this.print('  formula (x,y) => (x ^ y) & 0xFF', 0x666666);
                this.print('  formula (x,y) => x * y', 0x666666);
                this.print('  formula (x,y) => Math.sin(x/10) * 127 + 128', 0x666666);
                return;
            }
            
            try {
                // Compile formula to function
                const fn = eval(expr);
                if (typeof fn !== 'function') {
                    this.print('Error: formula must be a function (x,y) => value', 0xFF4444);
                    return;
                }
                
                this.print(`Rendering: ${expr}`, 0xFFFF00);
                
                // Render to a 256x256 region
                const regionSize = 256;
                const startX = 10;
                const startY = 30;
                
                for (let y = 0; y < regionSize; y++) {
                    for (let x = 0; x < regionSize; x++) {
                        try {
                            let value = fn(x, y);
                            
                            // Convert to 0-255 range
                            if (typeof value === 'number') {
                                value = Math.max(0, Math.min(255, Math.floor(value)));
                            } else {
                                value = 0;
                            }
                            
                            // Write as grayscale pixel
                            this.writer.buffer.setPixel(startX + x, startY + y, value, value, value, 255);
                        } catch (e) {
                            // Skip bad pixels
                        }
                    }
                }
                
                // Store formula for re-rendering
                this.pixelFormula = { fn, startX, startY, regionSize, type: 'grayscale' };
                
                this.print(`Rendered ${regionSize}x${regionSize} pixels`, 0x00FF88);
                this.dirty = true;
                this.renderWithPixels(); // Render text on top of pixels
                
            } catch (e) {
                this.print(`Error: ${e.message}`, 0xFF4444);
            }
        });
        
        this.commands.set('rgb', (args) => {
            const expr = args.join(' ');
            if (!expr) {
                this.print('Usage: rgb (x,y) => [r, g, b]', 0x888888);
                this.print('  rgb (x,y) => [x & 0xFF, y & 0xFF, (x ^ y) & 0xFF]', 0x666666);
                return;
            }
            
            try {
                const fn = eval(expr);
                if (typeof fn !== 'function') {
                    this.print('Error: must be a function (x,y) => [r,g,b]', 0xFF4444);
                    return;
                }
                
                this.print(`Rendering RGB: ${expr}`, 0xFFFF00);
                
                const regionSize = 256;
                const startX = 10;
                const startY = 30;
                
                for (let y = 0; y < regionSize; y++) {
                    for (let x = 0; x < regionSize; x++) {
                        try {
                            const result = fn(x, y);
                            if (Array.isArray(result) && result.length >= 3) {
                                const [r, g, b] = result.map(v => Math.max(0, Math.min(255, Math.floor(v))));
                                this.writer.buffer.setPixel(startX + x, startY + y, r, g, b, 255);
                            }
                        } catch (e) {
                            // Skip
                        }
                    }
                }
                
                // Store formula for re-rendering
                this.pixelFormula = { fn, startX, startY, regionSize, type: 'rgb' };
                
                this.print(`Rendered ${regionSize}x${regionSize} RGB pixels`, 0x00FF88);
                this.dirty = true;
                this.renderWithPixels();
                
            } catch (e) {
                this.print(`Error: ${e.message}`, 0xFF4444);
            }
        });
        
        this.commands.set('animate', (args) => {
            const expr = args.join(' ');
            if (!expr) {
                this.print('Usage: animate (x,y,t) => expression', 0x888888);
                this.print('  animate (x,y,t) => Math.sin(x/20 + t/10) * 127 + 128', 0x666666);
                this.print('  animate (x,y,t) => ((x + t) ^ y) & 0xFF', 0x666666);
                this.print('  animate (x,y,t) => Math.sin(Math.sqrt((x-128)**2 + (y-128)**2) - t/5) * 127 + 128', 0x666666);
                this.print('  stop - Stop animation', 0x666666);
                return;
            }
            
            // Stop any existing animation
            if (this.animationInterval) {
                clearInterval(this.animationInterval);
                this.animationInterval = null;
            }
            
            try {
                // Compile formula to function
                const fn = eval(expr);
                if (typeof fn !== 'function') {
                    this.print('Error: formula must be a function (x,y,t) => value', 0xFF4444);
                    return;
                }
                
                this.print(`Animating: ${expr}`, 0xFFFF00);
                this.print('Type "stop" to halt animation', 0x888888);
                
                const regionSize = 256;
                const startX = 10;
                const startY = 30;
                let t = 0;
                let frameCount = 0;
                const startTime = Date.now();
                
                // Animation loop at ~30fps
                this.animationInterval = setInterval(() => {
                    // Render frame
                    for (let y = 0; y < regionSize; y++) {
                        for (let x = 0; x < regionSize; x++) {
                            try {
                                let value = fn(x, y, t);
                                if (typeof value === 'number') {
                                    value = Math.max(0, Math.min(255, Math.floor(value)));
                                    this.writer.buffer.setPixel(startX + x, startY + y, value, value, value, 255);
                                }
                            } catch (e) {
                                // Skip bad pixels
                            }
                        }
                    }
                    
                    // Flush to framebuffer
                    this.flush();
                    
                    t++;
                    frameCount++;
                    
                    // Every 30 frames, show FPS
                    if (frameCount % 30 === 0) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const fps = frameCount / elapsed;
                        // Don't print - would flicker. Just update header?
                    }
                    
                }, 33); // ~30fps
                
                // Store for stop command
                this.animationExpr = expr;
                
            } catch (e) {
                this.print(`Error: ${e.message}`, 0xFF4444);
            }
        });
        
        this.commands.set('stop', () => {
            if (this.animationInterval) {
                clearInterval(this.animationInterval);
                this.animationInterval = null;
                this.print('Animation stopped', 0xFFFF00);
            } else {
                this.print('No animation running', 0x888888);
            }
        });
        
        this.commands.set('fps', () => {
            // Show FPS counter during animation
            if (this.animationInterval && this.frameCount) {
                const elapsed = (Date.now() - this.animationStart) / 1000;
                const fps = this.frameCount / elapsed;
                this.print(`FPS: ${fps.toFixed(1)}`, 0x00FF00);
            } else {
                this.print('No animation running', 0x888888);
            }
        });
    }
    
    /**
     * Render screen with pixel formula underneath
     */
    renderWithPixels() {
        // First render the base (clears and draws text)
        this.render();
        
        // Then re-apply pixel formula on top
        if (this.pixelFormula) {
            const { fn, startX, startY, regionSize, type } = this.pixelFormula;
            
            for (let y = 0; y < regionSize; y++) {
                for (let x = 0; x < regionSize; x++) {
                    try {
                        if (type === 'rgb') {
                            const result = fn(x, y);
                            if (Array.isArray(result) && result.length >= 3) {
                                const [r, g, b] = result.map(v => Math.max(0, Math.min(255, Math.floor(v))));
                                this.writer.buffer.setPixel(startX + x, startY + y, r, g, b, 255);
                            }
                        } else {
                            let value = fn(x, y);
                            if (typeof value === 'number') {
                                value = Math.max(0, Math.min(255, Math.floor(value)));
                                this.writer.buffer.setPixel(startX + x, startY + y, value, value, value, 255);
                            }
                        }
                    } catch (e) {
                        // Skip
                    }
                }
            }
        }
        
        this.dirty = false;
    }
    
    /**
     * Register custom command
     */
    command(name, handler) {
        this.commands.set(name, handler);
        return this;
    }
    
    /**
     * Print a line to output area
     */
    print(text, color = 0xFFFFFF) {
        this.lines.push({ text, color });
        
        // Scroll if needed
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
        
        this.dirty = true;
    }
    
    /**
     * Handle command input
     */
    handleCommand(line) {
        this.print(`> ${line}`, 0xAAAAAA);
        
        const parts = line.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        if (this.commands.has(cmd)) {
            try {
                this.commands.get(cmd)(args, line);
            } catch (e) {
                this.print(`Error: ${e.message}`, 0xFF4444);
            }
        } else if (cmd) {
            this.print(`Unknown command: ${cmd}`, 0xFF8888);
            this.print('Type "help" for commands', 0x888888);
        }
        
        this.dirty = true;
    }
    
    /**
     * Render screen
     */
    render() {
        if (!this.dirty) return;
        
        const atlas = this.writer.atlas;
        const glyphW = atlas.glyphW;
        const glyphH = atlas.glyphH;
        
        // Clear
        this.writer.clear(0x0a0a12);
        
        // Header
        this.writer.print(this.header, 0, 0, 0x00FFFF);
        
        // Separator
        this.writer.fillRect(0, glyphH + 2, this.width, 2, 0x00FFFF);
        
        // Output lines
        const startRow = 2;
        const visibleLines = this.lines.slice(-this.maxLines);
        
        for (let i = 0; i < visibleLines.length; i++) {
            const { text, color } = visibleLines[i];
            const y = (startRow + i) * glyphH;
            this.writer.print(text.slice(0, COLS), 0, y, color);
        }
        
        // Input line
        const inputY = (ROWS - 1) * glyphH;
        this.writer.fillRect(0, inputY - 2, this.width, 2, 0x444444);
        this.writer.print(this.input.getDisplayText(), 0, inputY, 0xFFFFFF);
        
        // Cursor blink (just use block for now)
        const cursorX = this.input.getCursorPos() * glyphW;
        this.writer.fillRect(cursorX, inputY, glyphW, glyphH, 0x444444);
        this.writer.print(this.input.buffer[this.input.cursor] || ' ', cursorX, inputY, 0xFFFFFF);
        
        this.dirty = false;
    }
    
    /**
     * Write to framebuffer
     */
    flush() {
        return this.writer.flush();
    }
    
    /**
     * Save to PNG
     */
    async savePNG(filename) {
        return this.writer.savePNG(filename);
    }
    
    /**
     * Render and save (for demos)
     */
    async renderToPNG(filename) {
        this.render();
        return this.savePNG(filename);
    }
    
    /**
     * Start interactive console
     */
    start(options = {}) {
        const flushToFB = options.flushToFB !== false;
        
        // Keyboard handler
        this.kb.on('key', (key, event) => {
            this.input.handleKey(event);
            this.dirty = true;
            
            // Use renderWithPixels if there's an active formula
            if (this.pixelFormula) {
                this.renderWithPixels();
            } else {
                this.render();
            }
            
            if (flushToFB) {
                this.flush();
            }
        });
        
        this.kb.on('interrupt', () => {
            this.print('\nInterrupted. Press Ctrl+C again to exit.', 0xFFFF00);
            this.render();
            if (flushToFB) this.flush();
        });
        
        // Welcome message
        this.print('Framebuffer Console v0.1', 0x00FFFF);
        this.print('Type "help" for commands', 0x888888);
        this.print('', 0);
        
        // Initial render
        this.render();
        
        if (flushToFB) {
            this.flush();
        }
        
        // Start keyboard
        this.kb.start();
        
        console.log('Console started. Switch to TTY or check framebuffer.');
        console.log('Commands: help, clear, echo, color, test, fill');
    }
    
    /**
     * Stop console
     */
    stop() {
        this.kb.stop();
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node console.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --demo      Save demo PNG instead of running');
        console.log('  --flush     Write to /dev/fb0 (requires sudo)');
        console.log('  --header S  Set header text');
        process.exit(0);
    }
    
    const screen = new ScreenConsole({
        header: args.find(a => a.startsWith('--header'))?.split('=')[1] || 'GEOMETRY OS | FRAMEBUFFER CONSOLE'
    });
    
    if (args.includes('--demo')) {
        // Demo mode - save PNG
        screen.print('Framebuffer Console v0.1', 0x00FFFF);
        screen.print('', 0);
        screen.print('This is a demo screenshot.', 0xFFFFFF);
        screen.print('Run with --flush to write to /dev/fb0', 0x888888);
        screen.print('', 0);
        screen.print('Commands:', 0xFFFF00);
        screen.print('  help  - Show commands', 0xAAAAAA);
        screen.print('  clear - Clear screen', 0xAAAAAA);
        screen.print('  test  - Run test', 0xAAAAAA);
        screen.input.buffer = 'type here';
        
        screen.render();
        await screen.savePNG('/tmp/console-demo.png');
        globalThis.console.log('Demo saved to /tmp/console-demo.png');
        return;
    }
    
    const flushToFB = args.includes('--flush') || args.includes('-f');
    
    if (flushToFB) {
        globalThis.console.log('Starting console with framebuffer output...');
        globalThis.console.log('Press Ctrl+C twice to exit.');
    } else {
        globalThis.console.log('Starting console (demo mode - not writing to framebuffer)');
        globalThis.console.log('Use --flush to write to /dev/fb0');
    }
    
    screen.start({ flushToFB });
}

main().catch(e => console.error('Error:', e));
