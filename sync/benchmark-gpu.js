#!/usr/bin/env node
// benchmark-gpu.js
// Benchmark for GPU-native Glyph VM execution
// Compares CPU (SyntheticGlyphVM) vs GPU (GPUExecutor) performance

import { SyntheticGlyphVM, OP } from './synthetic-glyph-vm.js';

const WARMUP_ITERATIONS = 10;
const BENCHMARK_ITERATIONS = 100;
const OPS_PER_FRAME = 80 * 24;  // Full grid

// Create a representative program
function createTestProgram() {
    const program = [];

    // Mix of opcodes that would be in a real cartridge
    for (let i = 0; i < 50; i++) {
        program.push({ opcode: OP.LD, stratum: 0, p1: i * 5, p2: 0, dst: i % 320 });
    }

    for (let i = 0; i < 30; i++) {
        program.push({ opcode: OP.ADD, stratum: 0, p1: 1, p2: 0, dst: i % 320 });
        program.push({ opcode: OP.SUB, stratum: 0, p1: 1, p2: 0, dst: (i + 1) % 320 });
    }

    for (let i = 0; i < 20; i++) {
        program.push({ opcode: OP.AND, stratum: 0, p1: 0xFF, p2: 0, dst: i % 320 });
        program.push({ opcode: OP.OR, stratum: 0, p1: 0x0F, p2: 0, dst: (i + 50) % 320 });
    }

    // Pad to fill grid
    while (program.length < OPS_PER_FRAME) {
        program.push({ opcode: OP.NOP, stratum: 0, p1: 0, p2: 0, dst: 0 });
    }

    return program;
}

// CPU benchmark
function benchmarkCPU() {
    console.log('\n=== CPU Benchmark (SyntheticGlyphVM) ===\n');

    const vm = new SyntheticGlyphVM({ maxCycles: 10000000 });
    const program = createTestProgram();

    // Warmup
    console.log('Warming up...');
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        vm.reset();
        vm.loadProgram(program);
        vm.executeFrame(OPS_PER_FRAME);
    }

    // Benchmark
    console.log(`Running ${BENCHMARK_ITERATIONS} iterations...`);
    const results = [];

    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        vm.reset();
        vm.loadProgram(program);

        const start = performance.now();
        vm.executeFrame(OPS_PER_FRAME);
        const elapsed = performance.now() - start;

        results.push(OPS_PER_FRAME / (elapsed / 1000));
    }

    // Calculate stats
    results.sort((a, b) => a - b);
    const median = results[Math.floor(results.length / 2)];
    const min = results[0];
    const max = results[results.length - 1];
    const avg = results.reduce((a, b) => a + b, 0) / results.length;

    console.log('\nResults:');
    console.log(`  Median: ${formatNumber(median)} ops/sec`);
    console.log(`  Min:    ${formatNumber(min)} ops/sec`);
    console.log(`  Max:    ${formatNumber(max)} ops/sec`);
    console.log(`  Avg:    ${formatNumber(avg)} ops/sec`);

    // Output in AutoResearch-parseable format
    console.log(`\nops/sec=${Math.round(median)}`);
    console.log(`total_ops=${BENCHMARK_ITERATIONS * OPS_PER_FRAME}`);

    return median;
}

// GPU benchmark (if WebGPU available)
async function benchmarkGPU() {
    console.log('\n=== GPU Benchmark (WebGPU) ===\n');

    try {
        // Dynamic import for GPU executor
        const { GPUExecutor, isWebGPUAvailable } = await import('./gpu-executor.js');

        const available = await isWebGPUAvailable();
        if (!available) {
            console.log('WebGPU not available - skipping GPU benchmark');
            console.log('(Requires browser or Node.js with wgpu-native)');
            return null;
        }

        const executor = new GPUExecutor();
        await executor.init();

        // Create SIT texture from program
        const program = createTestProgram();
        const sitData = new Uint8Array(80 * 24 * 4);

        for (let i = 0; i < program.length && i < OPS_PER_FRAME; i++) {
            const glyph = program[i];
            sitData[i * 4] = glyph.opcode;      // R = opcode
            sitData[i * 4 + 1] = glyph.dst;     // G = target
            sitData[i * 4 + 2] = glyph.p1;      // B = flags/immediate
            sitData[i * 4 + 3] = 0;             // A = unused
        }

        executor.loadSIT(sitData);

        // Warmup
        console.log('Warming up...');
        for (let i = 0; i < WARMUP_ITERATIONS; i++) {
            executor.loadState(new Uint8Array(320));
            await executor.executeFrame();
        }

        // Benchmark
        console.log(`Running ${BENCHMARK_ITERATIONS} iterations...`);
        const result = await executor.benchmark(BENCHMARK_ITERATIONS, OPS_PER_FRAME);

        console.log('\nResults:');
        console.log(`  Median: ${formatNumber(result.opsPerSec)} ops/sec`);

        console.log(`\nops/sec=${Math.round(result.opsPerSec)}`);

        return result.opsPerSec;

    } catch (e) {
        console.log(`GPU benchmark failed: ${e.message}`);
        console.log('(This is expected in Node.js without wgpu-native)');
        return null;
    }
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(0);
}

// Main
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║          Glyph VM Benchmark - CPU vs GPU                      ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ Grid: 80x24 (${OPS_PER_FRAME} opcodes)                              ║`);
    console.log(`║ Iterations: ${BENCHMARK_ITERATIONS}                                              ║`);
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    const cpuResult = benchmarkCPU();
    const gpuResult = await benchmarkGPU();

    if (gpuResult !== null) {
        console.log('\n=== Comparison ===\n');
        console.log(`CPU: ${formatNumber(cpuResult)} ops/sec`);
        console.log(`GPU: ${formatNumber(gpuResult)} ops/sec`);
        console.log(`Speedup: ${(gpuResult / cpuResult).toFixed(2)}x`);
    }
}

main().catch(console.error);
