#!/usr/bin/env node
// benchmark-vm.js
// Benchmark script for SyntheticGlyphVM performance
// Output format: "ops/sec=1234567" for AutoResearch metric extraction

import { SyntheticGlyphVM, OP } from './synthetic-glyph-vm.js';

const WARMUP_ITERATIONS = 1000;
const BENCHMARK_ITERATIONS = 100000;

function createBenchmarkProgram() {
    // Create a representative program that exercises various opcodes
    return [
        { opcode: OP.LD, stratum: 0, p1: 10.0, p2: 0, dst: 0 },
        { opcode: OP.ADD, stratum: 0, p1: 5.0, p2: 0, dst: 0 },
        { opcode: OP.SUB, stratum: 0, p1: 2.0, p2: 0, dst: 0 },
        { opcode: OP.MOV, stratum: 0, p1: 0.0, p2: 0, dst: 1 },
        { opcode: OP.ADD_MEM, stratum: 0, p1: 0.0, p2: 0, dst: 1 },
        { opcode: OP.AND, stratum: 0, p1: 0xFF, p2: 0, dst: 2 },
        { opcode: OP.OR, stratum: 0, p1: 0x0F, p2: 0, dst: 2 },
        { opcode: OP.XOR, stratum: 0, p1: 0xAA, p2: 0, dst: 2 },
        { opcode: OP.JZ, stratum: 0, p1: 11.0, p2: 0, dst: 0 },  // Jump to HALT if 0
        { opcode: OP.JMP, stratum: 0, p1: 1.0, p2: 0, dst: 0 },  // Loop back
        { opcode: OP.HALT, stratum: 0, p1: 0, p2: 0, dst: 0 },
    ];
}

function benchmark() {
    const vm = new SyntheticGlyphVM({ maxCycles: 10000000 });
    const program = createBenchmarkProgram();

    // Warmup
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        vm.reset();
        vm.loadProgram(program);
        vm.executeFrame(1000);
    }

    // Benchmark
    let totalOps = 0;
    const startTime = performance.now();

    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        vm.reset();
        vm.loadProgram(program);
        const results = vm.executeFrame(1000);
        totalOps += results.length;
    }

    const endTime = performance.now();
    const elapsedSeconds = (endTime - startTime) / 1000;
    const opsPerSec = Math.round(totalOps / elapsedSeconds);

    // Output in AutoResearch-parseable format
    console.log(`ops/sec=${opsPerSec}`);
    console.log(`total_ops=${totalOps}`);
    console.log(`elapsed_ms=${Math.round(endTime - startTime)}`);

    return opsPerSec;
}

// Run benchmark
const result = benchmark();
process.exit(result > 0 ? 0 : 1);
