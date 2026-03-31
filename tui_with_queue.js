#!/usr/bin/env node
/**
 * Ouroboros TUI with Queue Manager
 * 
 * Wraps the Pi Agent TUI with the Prompt Queue Manager
 * to handle rate limits gracefully.
 * 
 * Features:
 * - Auto-retry on 429 errors
 * - Multi-provider fallback
 * - Visual queue status
 * - Graceful degradation
 */

import { spawn, execSync } from 'child_process';
import { PromptQueueManager, routePrompt, PROVIDERS } from './src/ouroboros/v2/prompt_queue.js';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = '/home/jericho/zion/projects/ascii_world/ascii_world';
const PI_SCRIPT = path.join(PROJECT_ROOT, 'apps', 'pi', 'pi-test.sh');
const EXTENSION_PATH = path.join(PROJECT_ROOT, 'src', 'ouroboros', 'v2', 'extension.ts');

const queue = new PromptQueueManager();

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(msg, color = 'white') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function showQueueStatus() {
    const status = queue.getStatus();
    
    console.log('\n' + '═'.repeat(50));
    log('  🐍 OUROBOROS QUEUE STATUS', 'cyan');
    console.log('═'.repeat(50));
    
    log(`\n  📊 Queue:`, 'yellow');
    log(`     Pending:   ${status.pending}`, status.pending > 0 ? 'red' : 'green');
    log(`     Completed: ${status.completed}`, 'green');
    log(`     Failed:    ${status.failed}`, status.failed > 0 ? 'red' : 'green');
    
    log(`\n  🔌 Providers:`, 'yellow');
    for (const [name, info] of Object.entries(status.providers)) {
        const icon = info.rateLimited ? '🔴' : (info.enabled ? '🟢' : '⚪');
        const statusText = info.rateLimited 
            ? `RATE LIMITED (${Math.round(info.waitTime/1000)}s wait)`
            : `${info.recentRequests} recent`;
        log(`     ${icon} ${name.padEnd(12)} ${statusText}`, info.rateLimited ? 'red' : 'green');
    }
    
    console.log('\n' + '═'.repeat(50) + '\n');
}

// Handle rate limit errors from child process
function handleRateLimit(error, prompt) {
    log('\n⏸️ Rate limit detected!', 'yellow');
    
    // Extract retry-after if available
    const retryAfter = error.headers?.['retry-after'] || 60;
    log(`   Provider paused for ${retryAfter}s`, 'yellow');
    
    // Queue the prompt for later
    const itemId = queue.enqueue(prompt, { 
        priority: 1,  // High priority
        maxAttempts: 5 
    });
    
    log(`   Queued as: ${itemId}`, 'cyan');
    showQueueStatus();
    
    return itemId;
}

// Wrapper for Pi Agent calls
async function callWithQueue(prompt, options = {}) {
    const provider = queue.getNextProvider();
    
    if (!provider) {
        const waitTime = queue.getNextAvailableTime();
        log(`\n⏸️ All providers rate limited. Waiting ${Math.round(waitTime/1000)}s...`, 'yellow');
        
        // Queue and wait
        const itemId = queue.enqueue(prompt, options);
        
        // Wait and retry
        await new Promise(r => setTimeout(r, Math.min(waitTime, 30000)));
        
        return queue.processQueue(routePrompt);
    }
    
    try {
        return await routePrompt(prompt, provider, options);
    } catch (error) {
        if (error.status === 429) {
            return handleRateLimit(error, prompt);
        }
        throw error;
    }
}

// Main TUI wrapper
async function main() {
    const args = process.argv.slice(2);
    
    // Show status on start
    showQueueStatus();
    
    // Check for queue commands
    if (args[0] === 'queue') {
        const cmd = args[1];
        
        switch (cmd) {
            case 'status':
                showQueueStatus();
                break;
                
            case 'process':
                log('🔄 Processing queue...', 'cyan');
                await queue.processQueue(routePrompt);
                showQueueStatus();
                break;
                
            case 'retry':
                queue.retryFailed();
                log('✅ Retrying failed items', 'green');
                break;
                
            case 'clear':
                queue.clear(args[2] || 'all');
                log('✅ Cleared: ' + (args[2] || 'all'), 'green');
                break;
                
            default:
                console.log(`
Usage: node tui_with_queue.js queue <command>

Commands:
  status   Show queue status
  process  Process queued prompts
  retry    Retry failed prompts
  clear    Clear completed/failed items
`);
        }
        process.exit(0);
    }
    
    // Start Pi Agent with extension
    log('🐍 Starting Ouroboros TUI with Queue Manager...', 'cyan');
    log('   Rate limits will be handled automatically', 'green');
    log('   Multiple providers available for failover', 'green');
    
    // Set environment for extension
    process.env.PI_CODING_AGENT_DIR = path.join(PROJECT_ROOT, '.ouroboros', 'v2');
    
    // Check if Pi exists
    if (!fs.existsSync(PI_SCRIPT)) {
        log('❌ Pi Agent not found at ' + PI_SCRIPT, 'red');
        log('   Falling back to queue-only mode', 'yellow');
        showQueueStatus();
        return;
    }
    
    // Launch Pi with extension
    const pi = spawn(PI_SCRIPT, ['--extension', EXTENSION_PATH, ...args], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: {
            ...process.env,
            OUROBOROS_QUEUE_ENABLED: 'true'
        }
    });
    
    pi.on('error', (err) => {
        log(`❌ Failed to start Pi Agent: ${err.message}`, 'red');
        showQueueStatus();
    });
    
    pi.on('exit', (code) => {
        log(`\n🐍 Pi Agent exited with code ${code}`, code === 0 ? 'green' : 'yellow');
        showQueueStatus();
        
        if (queue.getStatus().pending > 0) {
            log('💡 Tip: Run "node tui_with_queue.js queue process" to process queued prompts', 'cyan');
        }
    });
}

main().catch(console.error);
