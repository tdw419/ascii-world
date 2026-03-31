#!/usr/bin/env node
// Test script for multi-renderer system
// Run: node sync/renderers/test-renderers.js

import { render, renderers, getRendererInfo } from './index.js';

// Sample ASCII substrate (80x24)
const SAMPLE_ASCII = `
┌────────────────────────────────────────────────────────────────────────────────┐
│ ASCII WORLD - Multi-Renderer Test                                              │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  STATUS: ● ACTIVE    CPU: [████████░░] 80%    MEM: [████░░░░░░] 40%           │
│                                                                                │
│  ┌─ AGENTS ────────────────────────────────────────────────────────────────┐   │
│  │ [A] Alpha    ● running    0.5s ago                                      │   │
│  │ [B] Beta     ○ idle       2.3s ago                                      │   │
│  │ [C] Gamma    ◉ error      5.1s ago                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│  Last update: 2026-03-22 15:30:00 UTC                                         │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
`.trim();

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║ ASCII WORLD - Multi-Renderer Test                             ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Show available renderers
console.log('Available renderers:');
const info = getRendererInfo();
info.forEach(r => {
    console.log(`  ${r.name.padEnd(12)} → ${r.description}`);
});
console.log('');

// Test each renderer
const formats = ['html', 'python', 'svg'];

for (const format of formats) {
    console.log(`\n── ${format.toUpperCase()} ─────────────────────────────────────────`);

    try {
        const output = render(SAMPLE_ASCII, format, { standalone: true });

        if (format === 'html') {
            // Show first 500 chars
            console.log(output.substring(0, 500) + '...');
            console.log(`\n  Total size: ${output.length} bytes`);
        } else if (format === 'python') {
            // Show class definition
            const lines = output.split('\n').slice(0, 30);
            console.log(lines.join('\n'));
            console.log(`\n  Total size: ${output.length} bytes`);
        } else if (format === 'svg') {
            // Show SVG structure
            const lines = output.split('\n').slice(0, 10);
            console.log(lines.join('\n'));
            console.log(`\n  Total size: ${output.length} bytes`);
        }

        console.log(`  ✓ ${format} renderer working`);
    } catch (err) {
        console.log(`  ✗ ${format} renderer failed: ${err.message}`);
    }
}

// Test pixel renderer
console.log('\n── PIXELS ──────────────────────────────────────────────────────');
try {
    const pixels = render(SAMPLE_ASCII, 'pixels');
    console.log(`  Dimensions: ${pixels.width}x${pixels.height}`);
    console.log(`  Buffer size: ${pixels.data.length} bytes (RGBA)`);
    console.log('  ✓ pixels renderer working');
} catch (err) {
    console.log(`  ✗ pixels renderer failed: ${err.message}`);
}

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║ All renderers tested!                                         ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
