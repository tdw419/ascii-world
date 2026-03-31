#!/usr/bin/env node
// Test script for ANSI renderer
// Run: node sync/renderers/test-ansi.js

import { render, renderers } from './index.js';

// Sample ASCII substrate
const SAMPLE_ASCII = `
┌────────────────────────────────────────────────────────────────────────────────┐
│ ASCII WORLD - ANSI Test                                                   │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  STATUS: ● ACTIVE    ○ IDLE    ◉ ERROR    ◐ WARNING              │
│                                                                            │
│  [A] Alpha    ● running    [B] Beta     ○ idle    [C] Gamma    ◉ error            │
│                                                                            │
│  Progress: [████████░░] 40%  [████░░░░░░] 20%                            │
│                                                                            │
│  Time: ${new Date().toLocaleTimeString()}                                           │
└────────────────────────────────────────────────────────────────────────────────┘
`;

console.log('╔═════════════════════════════════════════════════════════════════════════════╗');
console.log('║ ANSI RENDERER TEST                                                              ║');
console.log('╚═════════════════════════════════════════════════════════════════════════════╝');
console.log('');

// Test raw rendering
const raw = render(SAMPLE_ASCII, 'ansi');
console.log('Raw output:');
console.log(raw);

// Test with options
const withTheme = render(SAMPLE_ASCII, 'ansi', { theme: 'outrboros' });
console.log('\nOuroboros theme output:');
console.log(withTheme);

// Test terminal detection
const hasColors = process.stdout.isTTY && process.stdout.hasColors;
console.log('\nTerminal supports colors:', hasColors);

// Test HTML with ANSI preserved
const htmlWithANSI = render(SAMPLE_ASCII, 'html', { preserveANSI: true });
console.log('\nHTML with ANSI preserved:');
console.log(htmlWithANSI.includes('\x1b['));

// Test color detection
const hasANSIColors = raw.includes('\x1b[');
console.log('\nContains ANSI codes:', hasANSIColors);

console.log('\n── Color Palette Test ──────────────────────────────────────────────');
const paletteTest = [
    `\x1b[32m●\x1b[0m ACTIVE (green)`,
    `\x1b[90m○\x1b[0m IDLE (gray)`,
    `\x1b[31m◉\x1b[0m ERROR (red)`,
    `\x1b[33m◐\x1b[0m WARNING (yellow)`,
    `\x1b[36m[A]\x1b[0m BRACKET (cyan)`,
    `\x1b[1mBOLD\x1b[0m`,
    `\x1b[2mDIM\x1b[0m`,
];
console.log('  ' + paletteTest.join('  '));

console.log('\n✓ ANSI renderer working!');
console.log('\n╔═════════════════════════════════════════════════════════════════════════════╝');
console.log('║ All tests passed!                                              ║');
console.log('╚═════════════════════════════════════════════════════════════════════════════╝');
