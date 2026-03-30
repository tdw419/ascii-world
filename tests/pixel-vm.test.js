// pixel-vm.test.js — Tests for the pixels-move-pixels VM

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PixelVM, OP } from '../sync/pixel-vm.js';
import { InfiniteMap } from '../sync/infinite-map.js';

describe('PixelVM', () => {
    let vm, map;

    beforeEach(() => {
        map = new InfiniteMap({ chunkSize: 64 });
        vm = new PixelVM({ map, agentId: 'test-vm' });
    });

    it('starts with IP at origin', () => {
        assert.strictEqual(vm.ipX, 0);
        assert.strictEqual(vm.ipY, 0);
    });

    it('fetches instruction from map at IP', () => {
        map.setPixel(0, 0, OP.NOP, 0, 0, 0);
        const inst = vm.fetchInstruction();
        assert.strictEqual(inst.opcode, OP.NOP);
    });

    it('executes NOP and advances IP', () => {
        map.setPixel(0, 0, OP.NOP, 0, 0, 0);
        vm.step();
        assert.strictEqual(vm.ipX, 1);
    });

    it('halts on HALT opcode', () => {
        map.setPixel(0, 0, OP.HALT, 0, 0, 0);
        vm.step();
        assert.strictEqual(vm.halted, true);
    });

    it('MOV sets memory', () => {
        map.setPixel(0, 0, OP.MOV, 10, 128, 0); // mem[10] = 128
        vm.step();
        assert.strictEqual(vm.memory[10], 128);
    });

    it('ADD adds to memory', () => {
        vm.memory[10] = 5;
        map.setPixel(0, 0, OP.ADD, 10, 10, 0); // mem[10] += 10
        vm.step();
        assert.strictEqual(vm.memory[10], 15);
    });

    it('JZ jumps when zero', () => {
        vm.memory[0] = 0;
        map.setPixel(0, 0, OP.JZ, 0, 128, 128); // Jump if mem[0] == 0
        vm.step();
        // Should have jumped (not just advanced by 1)
        assert.ok(vm.ipX !== 1);
    });

    it('JZ does not jump when non-zero', () => {
        vm.memory[0] = 5;
        map.setPixel(0, 0, OP.JZ, 0, 128, 128);
        vm.step();
        assert.strictEqual(vm.ipX, 1); // Just advanced
    });

    it('JMP always jumps', () => {
        map.setPixel(0, 0, OP.JMP, 0, 128, 128);
        vm.step();
        assert.ok(vm.ipX !== 1);
    });

    // === PIXEL-TO-PIXEL TESTS ===

    it('PEEK reads pixel to memory', () => {
        // Write a pixel somewhere
        map.setPixel(100, 200, 255, 128, 64);
        
        // Set up PEEK: mem[0]=100, mem[1]=200
        vm.memory[0] = 100;
        vm.memory[1] = 200;
        
        // PEEK: read pixel at (mem[0], mem[1]) -> mem[2..4]
        map.setPixel(0, 0, OP.PEEK, 0, 0, 0);
        vm.step();
        
        assert.strictEqual(vm.memory[2], 255); // R
        assert.strictEqual(vm.memory[3], 128); // G
        assert.strictEqual(vm.memory[4], 64);  // B
    });

    it('POKE writes pixel from memory', () => {
        // Set up POKE: write (50,100,150) at (100,200)
        vm.memory[0] = 100;
        vm.memory[1] = 200;
        vm.memory[2] = 50;
        vm.memory[3] = 100;
        vm.memory[4] = 150;
        
        map.setPixel(0, 0, OP.POKE, 0, 0, 0);
        vm.step();
        
        const pixel = map.getPixel(100, 200);
        assert.deepStrictEqual(pixel, [50, 100, 150, 255]);
    });

    it('POKE tracks writer for sovereignty', () => {
        vm.memory[0] = 100;
        vm.memory[1] = 200;
        vm.memory[2] = 255;
        vm.memory[3] = 0;
        vm.memory[4] = 0;
        
        map.setPixel(0, 0, OP.POKE, 0, 0, 0);
        vm.step();
        
        const stats = map.getStats();
        assert.strictEqual(stats.writerCounts['test-vm'], 1);
    });

    it('FILL fills a region', () => {
        // Fill 4x2 region at (100,100) with (50,50,50)
        vm.memory[0] = 100;  // x
        vm.memory[1] = 100;  // y
        vm.memory[2] = 4;    // w
        vm.memory[3] = 2;    // h
        vm.memory[4] = 50;   // r
        vm.memory[5] = 50;   // g
        vm.memory[6] = 50;   // b
        
        map.setPixel(0, 0, OP.FILL, 0, 0, 0);
        vm.step();
        
        // Check all 8 pixels
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 4; dx++) {
                const pixel = map.getPixel(100 + dx, 100 + dy);
                assert.deepStrictEqual(pixel, [50, 50, 50, 255]);
            }
        }
    });

    it('DRAW writes glyph to viewport', () => {
        vm.viewportX = 1000;
        vm.viewportY = 1000;
        vm.memory[10] = 200;  // glyph/color
        vm.memory[11] = 10;   // x (relative to viewport)
        vm.memory[12] = 20;   // y (relative to viewport)
        
        map.setPixel(0, 0, OP.DRAW, 10, 0, 0);
        vm.step();
        
        // Should write at viewport + offset
        const pixel = map.getPixel(1010, 1020);
        assert.deepStrictEqual(pixel, [200, 200, 200, 255]);
    });

    it('run() executes until HALT', () => {
        map.setPixel(0, 0, OP.NOP, 0, 0, 0);
        map.setPixel(1, 0, OP.NOP, 0, 0, 0);
        map.setPixel(2, 0, OP.HALT, 0, 0, 0);
        
        const result = vm.run(100);
        assert.strictEqual(result.halted, true);
        assert.strictEqual(vm.cycles, 3);
    });

    it('run() stops at max cycles', () => {
        map.setPixel(0, 0, OP.NOP, 0, 0, 0);
        
        const result = vm.run(10);
        assert.strictEqual(result.halted, false);
        assert.strictEqual(vm.cycles, 10);
    });

    it('injectProgram writes program to map', () => {
        vm.injectProgram(500, 500, [
            { opcode: OP.MOV, dst: 10, p1: 0.5 },
            { opcode: OP.ADD, dst: 10, p1: 0.1 },
            { opcode: OP.HALT }
        ]);
        
        // Verify program was written
        assert.deepStrictEqual(map.getPixel(500, 500), [OP.MOV, 10, 127, 0]);
        assert.deepStrictEqual(map.getPixel(501, 500), [OP.ADD, 10, 25, 0]);
        assert.deepStrictEqual(map.getPixel(502, 500), [OP.HALT, 0, 0, 0]);
    });

    it('can execute injected program', () => {
        vm.injectProgram(0, 0, [
            { opcode: OP.MOV, dst: 10, p1: 1.0 }, // stores 255
            { opcode: OP.HALT }
        ]);
        
        vm.run(100);
        
        assert.strictEqual(vm.halted, true);
        assert.strictEqual(vm.memory[10], 255); // MOV stores p1*255
    });

    // === EXTENDED VALUE OPCODE TESTS ===

    it('MOV_IMM loads 16-bit value from two bytes', () => {
        // 1000 = 0x03E8 → B=0xE8(232), A=0x03(3)
        map.setPixel(0, 0, OP.MOV_IMM, 5, 232, 3);
        vm.step();
        assert.strictEqual(vm.memory[5], 1000);
    });

    it('MOV_IMM handles max 16-bit value (65535)', () => {
        map.setPixel(0, 0, OP.MOV_IMM, 0, 0xFF, 0xFF);
        vm.step();
        assert.strictEqual(vm.memory[0], 65535);
    });

    it('LDHI sets high 16 bits preserving low', () => {
        vm.memory[10] = 0x86A0; // low 16 bits of 100000
        // high 16 bits = 1 → B=1, A=0
        map.setPixel(0, 0, OP.LDHI, 10, 1, 0);
        vm.step();
        assert.strictEqual(vm.memory[10], 100000);
    });

    it('MOV_IMM + LDHI compose 32-bit value', () => {
        const target = 100000; // 0x000186A0
        const lo16 = target & 0xFFFF;    // 0x86A0 = 34464
        const hi16 = (target >> 16) & 0xFFFF; // 0x0001
        
        map.setPixel(0, 0, OP.MOV_IMM, 0, lo16 & 0xFF, (lo16 >> 8) & 0xFF);
        map.setPixel(1, 0, OP.LDHI, 0, hi16 & 0xFF, (hi16 >> 8) & 0xFF);
        map.setPixel(2, 0, OP.HALT, 0, 0, 0);
        
        vm.run(10);
        assert.strictEqual(vm.memory[0], 100000);
    });

    it('ADD_IMM16 adds 16-bit value', () => {
        vm.memory[0] = 1000;
        // 500 = 0x01F4 → B=0xF4(244), A=0x01(1)
        map.setPixel(0, 0, OP.ADD_IMM16, 0, 244, 1);
        vm.step();
        assert.strictEqual(vm.memory[0], 1500);
    });

    it('MUL_IMM multiplies by byte value', () => {
        vm.memory[0] = 100;
        map.setPixel(0, 0, OP.MUL_IMM, 0, 5, 0);
        vm.step();
        assert.strictEqual(vm.memory[0], 500);
    });

    it('MOV_IMM enables PEEK/POKE at large coordinates', () => {
        // Write a pixel at (500, 750)
        map.setPixel(500, 750, 42, 84, 126, 255);
        
        // Load large coords via MOV_IMM
        map.setPixel(0, 0, OP.MOV_IMM, 0, 500 & 0xFF, (500 >> 8) & 0xFF); // x=500
        map.setPixel(1, 0, OP.MOV_IMM, 1, 750 & 0xFF, (750 >> 8) & 0xFF); // y=750
        map.setPixel(2, 0, OP.PEEK, 0, 0, 0);
        map.setPixel(3, 0, OP.HALT, 0, 0, 0);
        
        vm.run(10);
        assert.strictEqual(vm.memory[2], 42);
        assert.strictEqual(vm.memory[3], 84);
        assert.strictEqual(vm.memory[4], 126);
    });

    it('reset clears state', () => {
        vm.memory[10] = 99;
        vm.ipX = 500;
        vm.cycles = 100;
        
        vm.reset();
        
        assert.strictEqual(vm.memory[10], 0);
        assert.strictEqual(vm.ipX, 0);
        assert.strictEqual(vm.cycles, 0);
    });
});
