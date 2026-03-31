#!/usr/bin/env node
/**
 * Map Control CLI - Test the Infinite Map Agent
 * 
 * Usage:
 *   node bin/map-control.js "Move the viewport to 1000, 1000 and allocate a neural sector there."
 */

import { InfiniteMapAgent } from '../sync/infinite-map-agent.js';
import { InfiniteMap } from '../sync/infinite-map.js';

async function main() {
    const prompt = process.argv[2];
    if (!prompt) {
        console.log("Usage: node bin/map-control.js \"your prompt\"");
        process.exit(1);
    }

    // Initialize with dummy map state for demo
    const map = new InfiniteMap();
    map.setPixel(0, 0, 255, 0, 0, 255, 'commander'); // Add some seed data
    
    const agent = new InfiniteMapAgent({ map });

    console.log(`\nPROMPT: "${prompt}"`);
    console.log("--------------------------------------------------");

    const response = await agent.chat(prompt);

    console.log(`THOUGHT: ${response.thought}`);
    console.log("--------------------------------------------------");
    console.log(`ACTION: ${JSON.stringify(response.action, null, 2)}`);
    console.log("--------------------------------------------------");
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
