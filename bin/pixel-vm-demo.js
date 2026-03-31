#!/usr/bin/env node
// pixel-vm-demo.js — Demonstrate the "pixels move pixels" feedback loop
// Updated: Uses small coordinates (0-255 fit in pixel bytes)
//          Shows MOV_IMM for loading larger values (0-65535)

import { PixelVM, OP } from '../sync/pixel-vm.js';
import { InfiniteMap } from '../sync/infinite-map.js';
import fs from 'fs';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         PIXEL VM DEMO — Pixels Move Pixels                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const map = new InfiniteMap({ chunkSize: 256 });
const vm = new PixelVM({ 
    map, 
    agentId: 'demo-agent',
    viewportX: 0,
    viewportY: 0,
    viewportW: 64,
    viewportH: 64
});

// ═══════════════════════════════════════════════════════════════
// DEMO 1: Basic feedback loop (small coordinates, all fit in 0-255)
// ═══════════════════════════════════════════════════════════════

console.log('═══ DEMO 1: Basic Feedback Loop (small coords) ═══\n');

// Set up memory for FILL: small region at (5,5) size 8x8
vm.memory[0] = 5;    // x  (fits in byte)
vm.memory[1] = 5;    // y  (fits in byte)
vm.memory[2] = 8;    // w  (fits in byte)
vm.memory[3] = 8;    // h  (fits in byte)
vm.memory[4] = 50;   // r
vm.memory[5] = 50;   // g
vm.memory[6] = 50;   // b

// Set PEEK coordinates inside the filled region
vm.memory[10] = 8;   // x (inside 5..12)
vm.memory[11] = 8;   // y (inside 5..12)

const program1 = [
    // FILL: mem[0..6] → fill region at (5,5) 8x8 with [50,50,50]
    [OP.FILL, 0, 0, 0],
    
    // PEEK: read pixel at (mem[10], mem[11]) → mem[12..14]
    [OP.PEEK, 10, 0, 0],
    
    // ADD 50 to each color channel
    [OP.ADD, 12, 50, 0],   // r += 50  → 100
    [OP.ADD, 13, 50, 0],   // g += 50  → 100
    [OP.ADD, 14, 50, 0],   // b += 50  → 100
    
    // POKE: write modified color back at (mem[10], mem[11])
    [OP.POKE, 10, 0, 0],
    
    // DRAW marker at viewport position
    [OP.MOV, 30, 200, 0],  // mem[30] = 200 (glyph brightness)
    [OP.MOV, 31, 20, 0],   // mem[31] = 20  (x offset)
    [OP.MOV, 32, 20, 0],   // mem[32] = 20  (y offset)
    [OP.DRAW, 30, 0, 0],
    
    [OP.HALT, 0, 0, 0]
];

// Write program to map at (0,0) — each instruction is one pixel
for (let i = 0; i < program1.length; i++) {
    const [opcode, dst, p1, p2] = program1[i];
    map.setPixel(i, 0, opcode, dst, p1, p2, vm.agentId);
}

console.log('Executing program...');
const result1 = vm.run(1000);
console.log(`✓ Completed in ${result1.cycles} cycles, halted: ${result1.halted}`);

// Verify
const pFilled = map.getPixel(7, 7);
const pModified = map.getPixel(8, 8);
const pMarker = map.getPixel(20, 20);

console.log(`\n  Filled pixel (7,7):    [${pFilled.join(', ')}]  expected [50,50,50,255]`);
console.log(`  Modified pixel (8,8):  [${pModified.join(', ')}]  expected [100,100,100,255]`);
console.log(`  Marker pixel (20,20):  [${pMarker.join(', ')}]  expected [200,200,200,255]`);

const ok1 = pFilled[0] === 50 && pModified[0] === 100 && pMarker[0] === 200;
console.log(`\n  Result: ${ok1 ? '✅ PASS' : '❌ FAIL'}\n`);

// ═══════════════════════════════════════════════════════════════
// DEMO 2: Loading larger values with MOV_IMM (16-bit)
// ═══════════════════════════════════════════════════════════════

console.log('═══ DEMO 2: Loading Large Values (MOV_IMM) ═══\n');
console.log('Problem: Regular MOV can only store 0-255 (one byte).');
console.log('Solution: MOV_IMM uses both B and A bytes → 0-65535.\n');

vm.reset();
map.chunks.clear(); // Fresh map

// MOV_IMM encoding: R=opcode, G=dst, B=low_byte, A=high_byte
// Value = (A << 8) | B
// Example: 1000 = 0x03E8 → B=0xE8(232), A=0x03(3)
// Example: 40000 = 0x9C40 → B=0x40(64), A=0x9C(156)

const val1000_lo = 1000 & 0xFF;         // 232
const val1000_hi = (1000 >> 8) & 0xFF;  // 3

const val40000_lo = 40000 & 0xFF;         // 64
const val40000_hi = (40000 >> 8) & 0xFF;  // 156

const program2 = [
    // MOV_IMM: mem[0] = 1000
    [OP.MOV_IMM, 0, val1000_lo, val1000_hi],
    
    // MOV_IMM: mem[1] = 40000
    [OP.MOV_IMM, 1, val40000_lo, val40000_hi],
    
    // ADD_IMM16: mem[0] += 500  (500 = 0x01F4)
    [OP.ADD_IMM16, 0, 500 & 0xFF, (500 >> 8) & 0xFF],
    
    // MUL_IMM: mem[1] *= 2
    [OP.MUL_IMM, 1, 2, 0],
    
    [OP.HALT, 0, 0, 0]
];

for (let i = 0; i < program2.length; i++) {
    const [opcode, dst, p1, p2] = program2[i];
    map.setPixel(i, 0, opcode, dst, p1, p2, vm.agentId);
}

console.log('Program:');
console.log('  MOV_IMM mem[0], 1000     → B=232, A=3   (lo/hi bytes)');
console.log('  MOV_IMM mem[1], 40000    → B=64,  A=156');
console.log('  ADD_IMM16 mem[0], 500    → mem[0] = 1500');
console.log('  MUL_IMM mem[1], 2        → mem[1] = 80000');
console.log('');

const result2 = vm.run(100);
console.log(`  mem[0] = ${vm.memory[0]}  (expected 1500)`);
console.log(`  mem[1] = ${vm.memory[1]}  (expected 80000)`);

const ok2 = vm.memory[0] === 1500 && vm.memory[1] === 80000;
console.log(`\n  Result: ${ok2 ? '✅ PASS' : '❌ FAIL'}\n`);

// ═══════════════════════════════════════════════════════════════
// DEMO 3: LDHI for 32-bit values
// ═══════════════════════════════════════════════════════════════

console.log('═══ DEMO 3: Full 32-bit Values (MOV_IMM + LDHI) ═══\n');
console.log('Two instructions compose any 32-bit value:');
console.log('  MOV_IMM sets low 16 bits,  LDHI sets high 16 bits.\n');

vm.reset();
map.chunks.clear();

// Target: mem[0] = 100000 (0x000186A0)
// Low 16: 0x86A0 = 34464
// High 16: 0x0001 = 1
const target = 100000;
const lo16 = target & 0xFFFF;
const hi16 = (target >> 16) & 0xFFFF;

const program3 = [
    // MOV_IMM: mem[0] = low 16 bits of 100000 (34464)
    [OP.MOV_IMM, 0, lo16 & 0xFF, (lo16 >> 8) & 0xFF],
    
    // LDHI: mem[0] high 16 bits = 1
    [OP.LDHI, 0, hi16 & 0xFF, (hi16 >> 8) & 0xFF],
    
    [OP.HALT, 0, 0, 0]
];

for (let i = 0; i < program3.length; i++) {
    const [opcode, dst, p1, p2] = program3[i];
    map.setPixel(i, 0, opcode, dst, p1, p2, vm.agentId);
}

console.log(`  Target value: ${target}`);
console.log(`  Low 16 bits:  ${lo16} (0x${lo16.toString(16)})`);
console.log(`  High 16 bits: ${hi16} (0x${hi16.toString(16)})`);
console.log('');

const result3 = vm.run(100);
console.log(`  mem[0] = ${vm.memory[0]}  (expected ${target})`);

const ok3 = vm.memory[0] === target;
console.log(`\n  Result: ${ok3 ? '✅ PASS' : '❌ FAIL'}\n`);

// ═══════════════════════════════════════════════════════════════
// DEMO 4: Large coordinate PEEK/POKE using MOV_IMM
// ═══════════════════════════════════════════════════════════════

console.log('═══ DEMO 4: PEEK/POKE at Large Coordinates ═══\n');

vm.reset();
map.chunks.clear();

// Write a sentinel pixel at coordinate (500, 750)
map.setPixel(500, 750, 42, 84, 126, 255, 'setup');

const program4 = [
    // Load x=500 into mem[0]  (500 = 0x01F4)
    [OP.MOV_IMM, 0, 500 & 0xFF, (500 >> 8) & 0xFF],
    
    // Load y=750 into mem[1]  (750 = 0x02EE)
    [OP.MOV_IMM, 1, 750 & 0xFF, (750 >> 8) & 0xFF],
    
    // PEEK pixel at (mem[0], mem[1]) → mem[2..4]
    [OP.PEEK, 0, 0, 0],
    
    // Add 100 to red channel
    [OP.ADD, 2, 100, 0],
    
    // POKE modified pixel back
    [OP.POKE, 0, 0, 0],
    
    [OP.HALT, 0, 0, 0]
];

for (let i = 0; i < program4.length; i++) {
    const [opcode, dst, p1, p2] = program4[i];
    map.setPixel(i, 0, opcode, dst, p1, p2, vm.agentId);
}

console.log('  Pixel at (500, 750) before: [42, 84, 126, 255]');

const result4 = vm.run(100);
const pixelAfter = map.getPixel(500, 750);
console.log(`  Pixel at (500, 750) after:  [${pixelAfter.join(', ')}]`);
console.log(`  Expected:                   [142, 84, 126, 255]`);

const ok4 = pixelAfter[0] === 142 && pixelAfter[1] === 84 && pixelAfter[2] === 126;
console.log(`\n  Result: ${ok4 ? '✅ PASS' : '❌ FAIL'}\n`);

// ═══════════════════════════════════════════════════════════════
// ASCII visualization
// ═══════════════════════════════════════════════════════════════

console.log('═══ VIEWPORT (ASCII) ═══\n');

// Reload demo 1's state for visualization
vm.reset();
map.chunks.clear();
vm.memory[0] = 5; vm.memory[1] = 5;
vm.memory[2] = 8; vm.memory[3] = 8;
vm.memory[4] = 50; vm.memory[5] = 50; vm.memory[6] = 50;
vm.memory[10] = 8; vm.memory[11] = 8;
for (let i = 0; i < program1.length; i++) {
    const [opcode, dst, p1, p2] = program1[i];
    map.setPixel(i, 0, opcode, dst, p1, p2, vm.agentId);
}
vm.run(1000);

for (let y = 0; y < 24; y++) {
    let line = '  ';
    for (let x = 0; x < 32; x++) {
        const [r, g, b] = map.getPixel(x, y);
        const brightness = (r + g + b) / 3;
        
        if (x === 20 && y === 20) line += '█';
        else if (x === 8 && y === 8) line += '▓';
        else if (brightness >= 50) line += '░';
        else line += ' ';
    }
    console.log(line);
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

const allPass = ok1 && ok2 && ok3 && ok4;

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                    VALUE RANGE SUMMARY                     ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log('║                                                            ║');
console.log('║  Instruction encoding: R=op, G=dst, B=byte1, A=byte2      ║');
console.log('║                                                            ║');
console.log('║  MOV      mem[G] = B              range: 0-255            ║');
console.log('║  MOV_IMM  mem[G] = (A<<8)|B       range: 0-65,535         ║');
console.log('║  LDHI     mem[G] |= ((A<<8)|B)<<16  extends to 32-bit    ║');
console.log('║                                                            ║');
console.log('║  ADD      mem[G] += B              small increments       ║');
console.log('║  ADD_IMM16 mem[G] += (A<<8)|B      up to ±65,535         ║');
console.log('║  MUL_IMM  mem[G] *= B              scale by 0-255        ║');
console.log('║                                                            ║');
console.log('║  Pattern for any 32-bit value:                             ║');
console.log('║    MOV_IMM reg, low16                                      ║');
console.log('║    LDHI    reg, high16                                     ║');
console.log('║                                                            ║');
console.log(`║  All demos: ${allPass ? '✅ PASS' : '❌ FAIL'}                                            ║`);
console.log('╚════════════════════════════════════════════════════════════╝');
