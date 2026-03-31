/**
 * Ouroboros Loop with Queue Manager Integration
 * 
 * This example shows how to use the prompt queue manager
 * in an Ouroboros self-improvement loop.
 * 
 * The queue manager handles:
 * - Rate limit errors (429) automatically
 * - Provider failover (GLM → Gemini → Claude → Local)
 * - Queue persistence across sessions
 */

import { PromptQueueManager, routePrompt, PROVIDERS } from '../src/ouroboros/v2/prompt_queue.js';

const queue = new PromptQueueManager();

// Set up event listeners
queue.on('enqueued', (item) => {
    console.log(`📥 Queued: ${item.id}`);
});

queue.on('processing', ({ item, provider }) => {
    console.log(`📤 Processing via ${provider}: ${item.prompt.slice(0, 50)}...`);
});

queue.on('rate_limited', ({ item, provider, retryAfter }) => {
    console.log(`⏸️ Rate limited on ${provider}, waiting ${retryAfter}s`);
});

queue.on('completed', ({ item, result }) => {
    console.log(`✅ Completed: ${item.id}`);
});

queue.on('failed', ({ item, error }) => {
    console.log(`❌ Failed: ${item.id} - ${error}`);
});

// Example: Self-improvement loop
async function ouroborosLoop() {
    console.log('🐍 Starting Ouroboros Loop with Queue Manager\n');
    
    // Show initial status
    const status = queue.getStatus();
    console.log('Available providers:');
    for (const [key, info] of Object.entries(status.providers)) {
        if (info?.enabled) {
            console.log(`  🟢 ${info.name}`);
        }
    }
    console.log('');
    
    // Add improvement prompts to queue
    const prompts = [
        { prompt: 'Analyze the test coverage and suggest improvements', priority: 1 },
        { prompt: 'Review code quality metrics', priority: 2 },
        { prompt: 'Generate documentation for new functions', priority: 3 }
    ];
    
    for (const { prompt, priority } of prompts) {
        queue.enqueue(prompt, { priority });
    }
    
    // Process the queue
    console.log('\n🔄 Processing queue...\n');
    await queue.processQueue(routePrompt);
    
    console.log('\n📊 Final status:');
    console.log(`   Completed: ${queue.getStatus().completed}`);
    console.log(`   Failed: ${queue.getStatus().failed}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    ouroborosLoop().catch(console.error);
}

export { ouroborosLoop };
