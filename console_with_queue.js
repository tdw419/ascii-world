#!/usr/bin/env node
/**
 * Ouroboros Console with Queue Manager
 * 
 * Extends the console with rate limit handling and multi-provider support.
 * 
 * Usage:
 *   node console_with_queue.js --demo
 *   node console_with_queue.js --flush
 */

import { PromptQueueManager, routePrompt, PROVIDERS } from '../src/ouroboros/v2/prompt_queue.js';
import { TextWriter } from './text-to-fb.js';
import { KeyboardInput, InputLine } from './keyboard.js';
import * as readline from 'node:readline';
import * as fs from 'fs';

const COLS = 320;
const ROWS = 108;

const queue = new PromptQueueManager();

class ConsoleWithQueue {
    constructor(options = {}) {
        this.writer = new TextWriter(options);
        this.keyboard = new KeyboardInput();
        this.inputLine = new InputLine();
        this.lines = [];
        this.maxLines = ROWS - 5;
        this.running = false;
        this.header = options.header || 'GEOMETRY OS | QUEUE-MANAGED CONSOLE';
        this.width = options.width || 1920;
        this.height = options.height || 1080;
        
        this.commands = new Map();
        this.registerDefaultCommands();
    }

    registerDefaultCommands() {
        this.commands.set('help', () => {
            this.print('Commands:', 0x00FFFF);
            this.print('  help              - Show commands', 0xAAAAAA);
            this.print('  clear             - Clear screen', 0xAAAAAA);
            this.print('  queue status      - Show queue status', 0xFFFF00);
            this.print('  queue process     - Process queued prompts', 0xFFFF00);
            this.print('  queue retry       - Retry failed prompts', 0xFFFF00);
            this.print('  providers         - List available providers', 0xFFFF00);
            this.print('  eval <expr>       - Evaluate JS expression', 0xAAAAAA);
            this.print('  formula <fn>      - Render grayscale formula', 0xAAAAAA);
            this.print('  rgb <fn>          - Render RGB formula', 0xAAAAAA);
            this.print('  animate <fn>      - Animate formula (x,y,t)=>v', 0xFFFF00);
            this.print('  stop              - Stop animation', 0xFFFF00);
        });

        this.commands.set('queue', (args) => {
            const subCmd = args[0];
            
            if (subCmd === 'status') {
                const status = queue.getStatus();
                this.print('\n📊 Queue Status:', 0x00FFFF);
                this.print(`   Pending:   ${status.pending}`, status.pending > 0 ? 0xFFFF00 : 0x00FF00);
                this.print(`   Completed: ${status.completed}`, 0x00FF00);
                this.print(`   Failed:    ${status.failed}`, status.failed > 0 ? 0xFF4444 : 0x00FF00);
                
                this.print('\n🔌 Providers:', 0x00FFFF);
                for (const [name, info] of Object.entries(status.providers)) {
                    const icon = info.rateLimited ? '🔴' : (info.enabled ? '🟢' : '⚪');
                    const statusText = info.rateLimited 
                        ? `RATE LIMITED (${Math.round(info.waitTime/1000)}s)`
                        : `${info.recentRequests} recent`;
                    this.print(`   ${icon} ${name}: ${statusText}`, info.rateLimited ? 0xFF4444 : 0x00FF00);
                }
            } else if (subCmd === 'process') {
                this.print('🔄 Processing queue...', 0xFFFF00);
                queue.processQueue(this.handlePrompt.bind(this)).then(() => {
                    this.print('✅ Queue processed', 0x00FF00);
                    this.render();
                    if (this.flushCallback) this.flushCallback();
                });
            } else if (subCmd === 'retry') {
                queue.retryFailed();
                this.print('🔄 Retrying failed prompts', 0xFFFF00);
            } else {
                this.print('Usage: queue <status|process|retry>', 0x888888);
            }
        });

        this.commands.set('providers', () => {
            this.print('\n🔌 Available Providers:', 0x00FFFF);
            for (const [key, config] of Object.entries(PROVIDERS)) {
                const hasKey = !config.envKey || process.env[config.envKey];
                const icon = hasKey ? '✅' : '❌';
                this.print(`   ${icon} ${config.name} (${config.rpmLimit} RPM)`, hasKey ? 0x00FF00 : 0xFF4444);
            }
        });

        this.commands.set('clear', () => {
            this.lines = [];
            this.print('Screen cleared', 0x888888);
        });

        this.commands.set('eval', (args) => {
            const expr = args.join(' ');
            if (!expr) {
                this.print('Usage: eval <expression>', 0x888888);
                return;
            }
            try {
                const result = Function('"use strict"; return (' + expr + ')')();
                const output = typeof result === 'object' 
                    ? JSON.stringify(result, null, 2) 
                    : String(result);
                this.print(`= ${output}`, 0x00FF88);
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

        // Pass through formula/rgb/animate to original console
        this.commands.set('formula', (args) => {
            this.print('Formula rendering - use original console for full support', 0x888888);
        });

        this.commands.set('rgb', (args) => {
            this.print('RGB rendering - use original console for full support', 0x888888);
        });

        this.commands.set('animate', (args) => {
            this.print('Animation - use original console for full support', 0x888888);
        });
    }

    async handlePrompt(prompt, provider, options) {
        this.print(`\n📤 Sending to ${provider}...`, 0xFFFF00);
        
        try {
            const result = await routePrompt(prompt, provider, options);
            this.print(`✅ ${provider} responded`, 0x00FF00);
            this.print(result.slice(0, 500) + (result.length > 500 ? '...' : ''), 0xFFFFFF);
            return result;
        } catch (error) {
            if (error.status === 429) {
                this.print(`⏸️ Rate limited on ${provider}`, 0xFFFF00);
                throw error; // Let queue manager handle it
            }
            this.print(`❌ Error: ${error.message}`, 0xFF4444);
            throw error;
        }
    }

    print(text, color = 0xFFFFFF) {
        this.lines.push({ text, color });
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
    }

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
        
        this.render();
    }

    render() {
        // Clear buffer
        this.writer.clear(0x0a0a12);
        
        // Header
        this.writer.print(this.header, 0, 0, 0x00FFFF);
        this.writer.fillRect(0, 12, this.width, 2, 0x00FFFF);
        
        // Output lines
        const startRow = 2;
        for (let i = 0; i < this.lines.length; i++) {
            const { text, color } = this.lines[i];
            this.writer.print(text.slice(0, COLS), 0, (startRow + i) * 10, color);
        }
        
        // Input line
        const inputY = (ROWS - 2) * 10;
        this.writer.fillRect(0, inputY, this.width, 2, 0x00FFFF);
        this.writer.print('> ' + this.inputLine.getBuffer(), 0, inputY + 2, 0xFFFFFF);
    }

    async savePNG(path) {
        await this.writer.savePNG(path);
    }

    flush() {
        this.writer.flush();
    }

    start() {
        this.running = true;
        
        this.keyboard.onKey((event) => {
            if (!this.running) return;
            
            const action = this.inputLine.handleKey(event);
            
            if (action === 'submit') {
                const line = this.inputLine.getBuffer();
                this.inputLine.clear();
                this.handleCommand(line);
            } else if (action !== 'none') {
                this.render();
            }
        });
        
        this.print('🐍 Ouroboros Console with Queue Manager', 0x00FFFF);
        this.print('Type "help" for commands', 0x888888);
        this.print('Type "queue status" to see rate limit status', 0x888888);
        this.render();
        
        this.keyboard.start();
    }

    stop() {
        this.running = false;
        this.keyboard.stop();
    }
}

// Demo mode
async function main() {
    const args = process.argv.slice(2);
    const demo = args.includes('--demo');
    const flush = args.includes('--flush');
    
    if (args[0] === 'queue') {
        // Direct queue commands
        const cmd = args[1];
        const status = queue.getStatus();
        
        if (cmd === 'status') {
            console.log(JSON.stringify(status, null, 2));
        } else if (cmd === 'providers') {
            console.log('\n🔌 Available Providers:');
            for (const [key, config] of Object.entries(PROVIDERS)) {
                const hasKey = !config.envKey || process.env[config.envKey];
                console.log(`  ${hasKey ? '✅' : '❌'} ${config.name} (${config.rpmLimit} RPM)`);
            }
        } else {
            console.log(`
Queue Commands:
  node console_with_queue.js queue status    - Show queue status
  node console_with_queue.js queue providers  - List providers
`);
        }
        return;
    }
    
    const console = new ConsoleWithQueue();
    
    if (demo) {
        console.print('🐍 Demo Mode', 0x00FFFF);
        console.print('', 0);
        console.print('Queue Status:', 0xFFFF00);
        
        const status = queue.getStatus();
        console.print(`  Pending: ${status.pending}`, 0x00FF00);
        console.print(`  Providers: ${Object.keys(status.providers).length}`, 0x00FF00);
        
        console.render();
        await console.savePNG('/tmp/console_queue_demo.png');
        console.print('\nDemo saved to /tmp/console_queue_demo.png', 0x00FF00);
        console.render();
        await console.savePNG('/tmp/console_queue_demo.png');
        console.log('Demo saved to /tmp/console_queue_demo.png');
        return;
    }
    
    if (flush) {
        console.render();
        console.flush();
        return;
    }
    
    // Interactive mode
    console.start();
}

main().catch(console.error);
