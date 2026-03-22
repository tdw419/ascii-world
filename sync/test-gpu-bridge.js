#!/usr/bin/env node
// test-gpu-bridge.js
// Test script for GPU execution bridge

import { SyntheticGlyphVM, OP, OP_NAMES } from './synthetic-glyph-vm.js';

console.log('=== GPU Execution Bridge Test ===\n');

// Test 1: Basic VM operations
console.log('Test 1: Basic VM Operations');
const vm = new SyntheticGlyphVM();

// Test state operations
vm.setState(0, 0);
vm.executeUIOpcode(8, 0, 0); // INC
console.log(`  INC slot 0: ${vm.getState(0)} (expected: 1)`);

vm.executeUIOpcode(8, 0, 0); // INC again
console.log(`  INC slot 0: ${vm.getState(0)} (expected: 2)`);

vm.executeUIOpcode(9, 0, 0); // DEC
console.log(`  DEC slot 0: ${vm.getState(0)} (expected: 1)`);

vm.executeUIOpcode(3, 1, 0); // TOGGLE
console.log(`  TOGGLE slot 1: ${vm.getState(1)} (expected: 255)`);

vm.executeUIOpcode(3, 1, 0); // TOGGLE again
console.log(`  TOGGLE slot 1: ${vm.getState(1)} (expected: 0)`);

vm.executeUIOpcode(6, 2, 0); // SET
console.log(`  SET slot 2: ${vm.getState(2)} (expected: 255)`);

vm.executeUIOpcode(7, 2, 0); // CLEAR
console.log(`  CLEAR slot 2: ${vm.getState(2)} (expected: 0)`);

vm.executeUIOpcode(204, 3, 42); // LDI (load immediate)
console.log(`  LDI slot 3 with 42: ${vm.getState(3)} (expected: 42)`);

// Test 2: WGSL-compatible opcodes
console.log('\nTest 2: WGSL-Compatible Opcodes');

vm.reset();

// Load a simple program
vm.loadProgram([
    { opcode: OP.LD, stratum: 0, p1: 10.0, p2: 0, dst: 0 },  // Load 10 into mem[0]
    { opcode: OP.ADD, stratum: 0, p1: 5.0, p2: 0, dst: 0 },  // mem[0] += 5
    { opcode: OP.LD, stratum: 0, p1: 3.0, p2: 0, dst: 1 },   // Load 3 into mem[1]
    { opcode: OP.ADD_MEM, stratum: 0, p1: 1.0, p2: 0, dst: 0 }, // mem[0] += mem[1]
    { opcode: OP.HALT, stratum: 0, p1: 0, p2: 0, dst: 0 }
]);

console.log('  Executing program...');
while (!vm.state.halted) {
    const result = vm.executeSingle();
    console.log(`    PC=${result.pc - 1} ${result.opcodeName || 'UNKNOWN'}`);
}

console.log(`  mem[0] = ${vm.memory[0]} (expected: 18 = 10 + 5 + 3)`);
console.log(`  mem[1] = ${vm.memory[1]} (expected: 3)`);

// Test 3: Bitwise operations
console.log('\nTest 3: Bitwise Operations');

vm.reset();
vm.memory[0] = 0b11110000; // 240
vm.memory[1] = 0b10101010; // 170

vm.loadProgram([
    { opcode: OP.AND, stratum: 0, p1: 0b11000000, p2: 0, dst: 0 }, // mem[0] &= 0b11000000
    { opcode: OP.OR, stratum: 0, p1: 0b00001111, p2: 0, dst: 1 },  // mem[1] |= 0b00001111
    { opcode: OP.XOR, stratum: 0, p1: 0b11111111, p2: 0, dst: 2 }, // mem[2] ^= 0xFF
    { opcode: OP.HALT, stratum: 0, p1: 0, p2: 0, dst: 0 }
]);

// Initialize mem[2] for XOR test
vm.memory[2] = 0b10101010;

console.log('  Executing bitwise program...');
vm.executeFrame(100);

console.log(`  mem[0] (AND): ${vm.memory[0].toString(2).padStart(8, '0')} (expected: 11000000)`);
console.log(`  mem[1] (OR):  ${vm.memory[1].toString(2).padStart(8, '0')} (expected: 10101111)`);
console.log(`  mem[2] (XOR): ${vm.memory[2].toString(2).padStart(8, '0')} (expected: 01010101)`);

// Test 4: Conditional jump
console.log('\nTest 4: Conditional Jump');

vm.reset();
vm.memory[0] = 5; // Counter

vm.loadProgram([
    // 0: mem[0] -= 1
    { opcode: OP.SUB, stratum: 0, p1: 1.0, p2: 0, dst: 0 },
    // 1: JZ mem[0] -> halt (address 3)
    { opcode: OP.JZ, stratum: 0, p1: 3.0, p2: 0, dst: 0 },
    // 2: JMP back to address 0
    { opcode: OP.JMP, stratum: 0, p1: 0.0, p2: 0, dst: 0 },
    // 3: HALT
    { opcode: OP.HALT, stratum: 0, p1: 0, p2: 0, dst: 0 }
]);

console.log('  Executing loop program (5 iterations)...');
const results = vm.executeFrame(100);
console.log(`  Cycles: ${vm.state.cycles} (expected: ~11)`);
console.log(`  mem[0]: ${vm.memory[0]} (expected: 0)`);

// Test 5: State buffer integration
console.log('\nTest 5: State Buffer Integration');

vm.reset();

// Test using state slots (at address 0x1000)
const stateSlot = 5;
vm.setState(stateSlot, 100);
console.log(`  Initial state[${stateSlot}]: ${vm.getState(stateSlot)}`);

vm.executeUIOpcode(8, stateSlot, 0); // INC
console.log(`  After INC: state[${stateSlot}]: ${vm.getState(stateSlot)}`);

vm.executeUIOpcode(8, stateSlot, 0); // INC
console.log(`  After INC: state[${stateSlot}]: ${vm.getState(stateSlot)}`);

vm.executeUIOpcode(204, stateSlot, 42); // LDI
console.log(`  After LDI 42: state[${stateSlot}]: ${vm.getState(stateSlot)}`);

// Summary
console.log('\n=== Test Summary ===');
console.log('All tests completed.');
console.log('\nState buffer contents:');
const state = vm.getAllState();
console.log(JSON.stringify(state, null, 2));
