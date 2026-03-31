#!/usr/bin/env node
// keyboard.js — Raw keyboard input for framebuffer console
// Reads from stdin in raw mode, emits key events

import { stdin as input, stdout as output } from 'node:process';
import { EventEmitter } from 'node:events';

/**
 * KeyboardInput — Raw keyboard reader for console apps
 * 
 * Usage:
 *   const kb = new KeyboardInput();
 *   kb.on('key', (key, event) => {
 *     console.log('Got key:', key, event);
 *   });
 *   kb.start();
 */
export class KeyboardInput extends EventEmitter {
    constructor() {
        super();
        this.running = false;
        this.buffer = '';
    }
    
    /**
     * Start reading keyboard input
     */
    start() {
        if (this.running) return;
        this.running = true;
        
        // Set stdin to raw mode (no line buffering, no echo)
        if (input.isTTY) {
            input.setRawMode(true);
        }
        input.resume();
        input.setEncoding('utf8');
        
        input.on('data', (chunk) => this.handleData(chunk));
        
        this.emit('ready');
    }
    
    /**
     * Stop reading keyboard input
     */
    stop() {
        if (!this.running) return;
        this.running = false;
        
        if (input.isTTY) {
            input.setRawMode(false);
        }
        input.pause();
    }
    
    /**
     * Handle raw input data
     */
    handleData(chunk) {
        // Check for Ctrl+C
        if (chunk === '\x03') {
            this.emit('interrupt');
            this.stop();
            process.exit(0);
            return;
        }
        
        // Check for Ctrl+D
        if (chunk === '\x04') {
            this.emit('eof');
            this.stop();
            return;
        }
        
        // Parse escape sequences
        const parsed = this.parseKey(chunk);
        this.emit('key', parsed.key, parsed);
    }
    
    /**
     * Parse raw input into key event
     */
    parseKey(chunk) {
        const event = {
            raw: chunk,
            key: chunk,
            ctrl: false,
            alt: false,
            shift: false,
            sequence: false,
        };
        
        // Single character
        if (chunk.length === 1) {
            const code = chunk.charCodeAt(0);
            
            // Enter (CR/LF)
            if (code === 13 || code === 10) {
                event.key = 'Enter';
                return event;
            }
            
            // Backspace (some terminals send 0x08)
            if (code === 8) {
                event.key = 'Backspace';
                return event;
            }
            
            // Tab
            if (code === 9) {
                event.key = 'Tab';
                return event;
            }
            
            // Escape (standalone)
            if (code === 27) {
                event.key = 'Escape';
                return event;
            }
            
            // Control characters
            if (code < 32) {
                event.ctrl = true;
                event.key = String.fromCharCode(code + 96); // Ctrl+A -> 'a'
                return event;
            }
            
            // Regular printable
            event.key = chunk;
            return event;
        }
        
        // Escape sequences (arrow keys, etc.)
        if (chunk.startsWith('\x1b[')) {
            event.sequence = true;
            
            const seq = chunk.slice(2);
            switch (seq) {
                case 'A': event.key = 'Up'; break;
                case 'B': event.key = 'Down'; break;
                case 'C': event.key = 'Right'; break;
                case 'D': event.key = 'Left'; break;
                case 'H': event.key = 'Home'; break;
                case 'F': event.key = 'End'; break;
                case '3~': event.key = 'Delete'; break;
                case '5~': event.key = 'PageUp'; break;
                case '6~': event.key = 'PageDown'; break;
                case '2~': event.key = 'Insert'; break;
                default:
                    // F1-F12
                    if (seq.match(/^\d+~$/)) {
                        event.key = `F${seq.slice(0, -1)}`;
                    } else {
                        event.key = `Unknown:${seq}`;
                    }
            }
            return event;
        }
        
        // Alt sequences
        if (chunk.startsWith('\x1b') && chunk.length === 2) {
            event.alt = true;
            event.key = chunk[1];
            return event;
        }
        
        return event;
    }
}

/**
 * InputLine — Single-line text input with cursor
 */
export class InputLine {
    constructor(options = {}) {
        this.prompt = options.prompt || '> ';
        this.maxLength = options.maxLength || 256;
        this.buffer = '';
        this.cursor = 0;
        this.history = [];
        this.historyIndex = -1;
        this.onEnter = options.onEnter || (() => {});
    }
    
    /**
     * Handle key event
     */
    handleKey(event) {
        const { key, ctrl, sequence } = event;
        
        // Enter
        if (key === 'Enter') {
            const line = this.buffer;
            if (line.trim()) {
                this.history.push(line);
                this.historyIndex = this.history.length;
            }
            this.buffer = '';
            this.cursor = 0;
            this.onEnter(line);
            return;
        }
        
        // Backspace
        if (key === '\x7f' || key === 'Backspace') {
            if (this.cursor > 0) {
                this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
                this.cursor--;
            }
            return;
        }
        
        // Delete
        if (key === 'Delete') {
            if (this.cursor < this.buffer.length) {
                this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
            }
            return;
        }
        
        // Arrow keys
        if (sequence) {
            if (key === 'Left') {
                if (this.cursor > 0) this.cursor--;
                return;
            }
            if (key === 'Right') {
                if (this.cursor < this.buffer.length) this.cursor++;
                return;
            }
            if (key === 'Up') {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.buffer = this.history[this.historyIndex] || '';
                    this.cursor = this.buffer.length;
                }
                return;
            }
            if (key === 'Down') {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.buffer = this.history[this.historyIndex] || '';
                    this.cursor = this.buffer.length;
                } else {
                    this.historyIndex = this.history.length;
                    this.buffer = '';
                    this.cursor = 0;
                }
                return;
            }
            if (key === 'Home') {
                this.cursor = 0;
                return;
            }
            if (key === 'End') {
                this.cursor = this.buffer.length;
                return;
            }
        }
        
        // Regular character
        if (key.length === 1 && !ctrl && this.buffer.length < this.maxLength) {
            this.buffer = this.buffer.slice(0, this.cursor) + key + this.buffer.slice(this.cursor);
            this.cursor++;
        }
    }
    
    /**
     * Get display text (prompt + buffer)
     */
    getDisplayText() {
        return this.prompt + this.buffer;
    }
    
    /**
     * Get cursor position (relative to display text)
     */
    getCursorPos() {
        return this.prompt.length + this.cursor;
    }
    
    /**
     * Clear input
     */
    clear() {
        this.buffer = '';
        this.cursor = 0;
    }
}

// Demo
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--demo') || args.includes('-d')) {
        console.log('Keyboard demo - type keys, Ctrl+C to exit');
        console.log('---');
        
        const kb = new KeyboardInput();
        
        kb.on('key', (key, event) => {
            console.log('Key:', JSON.stringify(key), event);
        });
        
        kb.on('interrupt', () => {
            console.log('\nInterrupted');
        });
        
        kb.start();
        
        // Keep process alive
        await new Promise(() => {});
    }
}

main().catch(e => console.error('Error:', e));
