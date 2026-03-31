#!/usr/bin/env node
// python-pixel-demo.js — Demo: Python → Pixels → Execution
// This shows how existing code becomes executable pixels

import { PythonToPixels, OP, tokenize, compile } from '../sync/python-to-pixels.js';
import { PixelVM } from '../sync/pixel-vm.js';
import { InfiniteMap } from '../sync/infinite-map.js';
import fs from 'fs';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     PYTHON → PIXELS → EXECUTION Demo                      ║');
console.log('║     "Existing code becomes executable pixels"             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 1: Simple arithmetic
// ═══════════════════════════════════════════════════════════════

console.log('═══ EXAMPLE 1: Simple Arithmetic ═══\n');

const pythonCode1 = `
# Simple arithmetic
x = 10
y = 20
z = x + y
print(z)
`;

console.log('Python source:');
console.log(pythonCode1);

const transpiler1 = new PythonToPixels();
const result1 = transpiler1.transpile(pythonCode1);

console.log('Compilation result:');
console.log(`  Instructions: ${result1.instructionCount}`);
console.log(`  Variables:`, result1.variables);
console.log(`  Functions:`, result1.functions);

// Show the pixels
console.log('\nGenerated pixels (first 10):');
for (let i = 0; i < Math.min(10, result1.pixels.length); i++) {
    const [r, g, b, a] = result1.pixels[i];
    const opName = Object.keys(OP).find(k => OP[k] === r) || 'UNKNOWN';
    console.log(`  [${i}] R=${r}(${opName}) G=${g} B=${b} A=${a}`);
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 2: Loop
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ EXAMPLE 2: Loop ═══\n');

const pythonCode2 = `
# Count to 5
for i in range(0, 5):
    print(i)
`;

console.log('Python source:');
console.log(pythonCode2);

const transpiler2 = new PythonToPixels();
const result2 = transpiler2.transpile(pythonCode2);

console.log('Compilation result:');
console.log(`  Instructions: ${result2.instructionCount}`);
console.log(`  Variables:`, result2.variables);

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 3: Conditional
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ EXAMPLE 3: Conditional ═══\n');

const pythonCode3 = `
# Conditional
x = 10
if x > 5:
    print(1)
else:
    print(0)
`;

console.log('Python source:');
console.log(pythonCode3);

const transpiler3 = new PythonToPixels();
const result3 = transpiler3.transpile(pythonCode3);

console.log('Compilation result:');
console.log(`  Instructions: ${result3.instructionCount}`);

// ═══════════════════════════════════════════════════════════════
// Export to PNG
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ EXPORT ═══\n');

const transpiler = new PythonToPixels();
const fullCode = `
# Full demo program
x = 5
y = 10
z = x + y
print(z)
`;

const finalResult = transpiler.transpile(fullCode);
await transpiler.exportPNG(finalResult, '/tmp/python-program.png');
console.log('✓ Saved to /tmp/python-program.png');

// ═══════════════════════════════════════════════════════════════
// ASCII visualization of pixels
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ PIXEL VISUALIZATION ═══\n');

console.log('Each pixel = one instruction');
console.log('R=opcode, G=dst, B=p1, A=p2\n');

console.log('   R   G   B   A   | Meaning');
console.log('──────────────────┼─────────────────────');

for (let i = 0; i < Math.min(15, finalResult.pixels.length); i++) {
    const [r, g, b, a] = finalResult.pixels[i];
    const opName = Object.keys(OP).find(k => OP[k] === r) || '???';
    console.log(`  ${r.toString().padStart(3)} ${g.toString().padStart(3)} ${b.toString().padStart(3)} ${a.toString().padStart(3)} | ${opName}`);
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                    SUMMARY                                ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log('║                                                            ║');
console.log('║  Python source  →  Tokenizer  →  Compiler  →  Pixels      ║');
console.log('║                                                            ║');
console.log('║  Each pixel:                                               ║');
console.log('║    R = opcode (what to do)                                 ║');
console.log('║    G = destination (where result goes)                     ║');
console.log('║    B = parameter 1                                         ║');
console.log('║    A = parameter 2                                         ║');
console.log('║                                                            ║');
console.log('║  Next steps:                                               ║');
console.log('║  1. Expand Python subset (classes, imports, stdlib)        ║');
console.log('║  2. Optimize bytecode (peephole, register alloc)           ║');
console.log('║  3. Self-host: transpiler written in Python → pixels       ║');
console.log('║                                                            ║');
console.log('╚════════════════════════════════════════════════════════════╝');
