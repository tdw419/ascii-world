/**
 * Tests for SyntheticGlyphVM - CPU-side emulator of the Glyph VM
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SyntheticGlyphVM, Glyph, VMState } from '../sync/synthetic-glyph-vm.js';

describe('Glyph', () => {
    it('creates with default values', () => {
        const g = new Glyph();
        assert.strictEqual(g.opcode, 0);
        assert.strictEqual(g.stratum, 0);
        assert.strictEqual(g.p1, 0);
        assert.strictEqual(g.p2, 0);
        assert.strictEqual(g.dst, 0);
    });

    it('creates with specified values', () => {
        const g = new Glyph(140, 1, 0.5, 0.25, 10);
        assert.strictEqual(g.opcode, 140);
        assert.strictEqual(g.stratum, 1);
        assert.strictEqual(g.p1, 0.5);
        assert.strictEqual(g.p2, 0.25);
        assert.strictEqual(g.dst, 10);
    });

    it('fromRGBA creates Glyph from pixel values', () => {
        const g = Glyph.fromRGBA(140, 10, 128, 64);
        assert.strictEqual(g.opcode, 140);
        // fromRGBA uses: R=opcode, G=target (stratum), B=p1/255, A=p2/255, dst=0
        assert.strictEqual(g.stratum, 10);
        assert.strictEqual(g.p1, 128 / 255);
        assert.strictEqual(g.p2, 64 / 255);
        assert.strictEqual(g.dst, 0); // Always 0 in fromRGBA
    });
});

describe('VMState', () => {
    it('creates with default values', () => {
        const state = new VMState();
        assert.strictEqual(state.pc, 0);
        assert.strictEqual(state.sp, 0);
        assert.strictEqual(state.flags, 0);
        assert.strictEqual(state.halted, false);
        assert.strictEqual(state.cycles, 0);
    });

    it('reset clears state', () => {
        const state = new VMState();
        state.pc = 10;
        state.cycles = 100;
        state.halted = true;
        state.reset();
        assert.strictEqual(state.pc, 0);
        assert.strictEqual(state.cycles, 0);
        assert.strictEqual(state.halted, false);
    });
});

describe('SyntheticGlyphVM', () => {
    let vm;

    beforeEach(() => {
        vm = new SyntheticGlyphVM({ maxCycles: 1000 });
    });

    describe('constructor', () => {
        it('creates VM with default options', () => {
            const defaultVM = new SyntheticGlyphVM();
            assert.strictEqual(defaultVM.maxCycles, 1000000);
            assert.strictEqual(defaultVM.memorySize, 65536);
            assert.ok(defaultVM.memory instanceof Float32Array);
            assert.ok(defaultVM.program instanceof Array);
        });

        it('creates VM with custom options', () => {
            const customVM = new SyntheticGlyphVM({
                maxCycles: 500,
                memorySize: 32768,
                programSize: 100
            });
            assert.strictEqual(customVM.maxCycles, 500);
            assert.strictEqual(customVM.memorySize, 32768);
            assert.strictEqual(customVM.program.length, 100);
        });
    });

    describe('loadProgram', () => {
        it('loads program into memory', () => {
            const program = [
                new Glyph(140), // NOP
                new Glyph(141), // HALT
            ];
            vm.loadProgram(program);
            assert.strictEqual(vm.program[0].opcode, 140);
            assert.strictEqual(vm.program[1].opcode, 141);
            assert.strictEqual(vm.state.pc, 0);
            assert.strictEqual(vm.state.halted, false);
        });

        it('respects baseAddress', () => {
            const program = [new Glyph(141)];
            vm.loadProgram(program, 10);
            assert.strictEqual(vm.program[10].opcode, 141);
            assert.strictEqual(vm.state.pc, 10);
        });
    });

    describe('loadFromSIT', () => {
        it('loads program from image data', () => {
            // Create 2x2 image data (RGBA)
            const imageData = new Uint8Array([
                140, 10, 128, 255,  // pixel 0,0: NOP
                141, 20, 64, 128,   // pixel 1,0: HALT
                140, 30, 0, 0,      // pixel 0,1: NOP
                140, 40, 255, 0,    // pixel 1,1: NOP
            ]);

            const glyphs = vm.loadFromSIT(imageData, 2, 2);
            assert.strictEqual(glyphs.length, 4);
            assert.strictEqual(glyphs[0].opcode, 140);
            assert.strictEqual(glyphs[1].opcode, 141);
        });
    });

    describe('state management', () => {
        it('getState returns 0 for unset slots', () => {
            assert.strictEqual(vm.getState(0), 0);
            assert.strictEqual(vm.getState(100), 0);
        });

        it('setState and getState work together', () => {
            vm.setState(0, 42.5);
            assert.strictEqual(vm.getState(0), 42.5);
        });

        it('getState returns 0 for out-of-bounds slots', () => {
            assert.strictEqual(vm.getState(-1), 0);
            assert.strictEqual(vm.getState(1000), 0);
        });

        it('setState ignores out-of-bounds slots', () => {
            vm.setState(-1, 100);
            vm.setState(1000, 100);
            // Should not throw
        });
    });

    describe('executeSingle', () => {
        it('halts on invalid PC', () => {
            vm.state.pc = 10000;
            const result = vm.executeSingle();
            assert.strictEqual(result.halted, true);
            assert.ok(result.error);
        });

        it('handles NOP opcode', () => {
            vm.loadProgram([new Glyph(140)]); // NOP
            const result = vm.executeSingle();
            assert.strictEqual(vm.state.pc, 1);
            assert.strictEqual(vm.state.halted, false);
        });

        it('handles HALT opcode', () => {
            vm.loadProgram([new Glyph(141)]); // HALT
            const result = vm.executeSingle();
            assert.strictEqual(vm.state.halted, true);
        });

        it('handles DATA/LD opcode (load immediate)', () => {
            vm.loadProgram([new Glyph(128, 0, 42.0, 0, 5)]); // DATA: mem[5] = 42
            vm.executeSingle();
            assert.strictEqual(vm.memory[5], 42.0);
        });

        it('handles MOV opcode', () => {
            vm.memory[10] = 99;
            vm.loadProgram([new Glyph(206, 0, 10, 0, 20)]); // MOV: mem[20] = mem[10]
            vm.executeSingle();
            assert.strictEqual(vm.memory[20], 99);
        });

        it('handles ADD opcode', () => {
            vm.memory[5] = 10;
            vm.loadProgram([new Glyph(142, 0, 5, 0, 5)]); // ADD: mem[5] += 5
            vm.executeSingle();
            assert.strictEqual(vm.memory[5], 15);
        });

        it('handles SUB opcode', () => {
            vm.memory[5] = 20;
            vm.loadProgram([new Glyph(143, 0, 8, 0, 5)]); // SUB: mem[5] -= 8
            vm.executeSingle();
            assert.strictEqual(vm.memory[5], 12);
        });

        it('handles JMP opcode', () => {
            vm.loadProgram([
                new Glyph(208, 0, 3, 0, 0),  // JMP to PC=3
                new Glyph(140),
                new Glyph(140),
                new Glyph(141), // HALT
            ]);
            vm.executeSingle();
            assert.strictEqual(vm.state.pc, 3);
        });

        it('handles JZ when zero', () => {
            vm.memory[0] = 0;
            vm.loadProgram([
                new Glyph(209, 0, 5, 0, 0),  // JZ: if mem[0]==0, jump to 5
            ]);
            vm.executeSingle();
            assert.strictEqual(vm.state.pc, 5);
        });

        it('handles JZ when non-zero', () => {
            vm.memory[0] = 1;
            vm.loadProgram([
                new Glyph(209, 0, 5, 0, 0),  // JZ: if mem[0]==0, jump to 5
            ]);
            vm.executeSingle();
            assert.strictEqual(vm.state.pc, 1); // Just increments
        });

        it('stops at maxCycles', () => {
            vm.maxCycles = 2;
            vm.loadProgram([
                new Glyph(140), // NOP
                new Glyph(140), // NOP
                new Glyph(140), // NOP
            ]);
            vm.executeSingle();
            vm.executeSingle();
            const result = vm.executeSingle();
            assert.strictEqual(result.halted, true);
        });
    });

    describe('executeFrame', () => {
        it('executes until halt', () => {
            vm.loadProgram([
                new Glyph(140), // NOP
                new Glyph(140), // NOP
                new Glyph(141), // HALT
            ]);
            const results = vm.executeFrame(100);
            assert.strictEqual(vm.state.halted, true);
            assert.strictEqual(results.length, 3);
        });

        it('respects maxCycles parameter', () => {
            vm.loadProgram([
                new Glyph(140), // NOP (infinite loop without halt)
            ]);
            const results = vm.executeFrame(10);
            assert.strictEqual(results.length, 10);
            assert.strictEqual(vm.state.halted, false);
        });
    });

    describe('reset', () => {
        it('resets all state', () => {
            vm.memory[0] = 100;
            vm.state.pc = 50;
            vm.state.cycles = 100;
            vm.state.halted = true;

            vm.reset();

            assert.strictEqual(vm.memory[0], 0);
            assert.strictEqual(vm.state.pc, 0);
            assert.strictEqual(vm.state.cycles, 0);
            assert.strictEqual(vm.state.halted, false);
        });
    });

    describe('mouse input', () => {
        it('setMouse updates mouse state', () => {
            vm.setMouse(100, 200, 1);
            assert.strictEqual(vm.mouseX, 100);
            assert.strictEqual(vm.mouseY, 200);
            assert.strictEqual(vm.mouseBtn, 1);
        });
    });

    describe('events', () => {
        it('subscribe adds listener', () => {
            let received = null;
            const unsub = vm.subscribe((event) => {
                received = event;
            });

            vm.notifyListeners({ type: 'test', data: 42 });
            assert.strictEqual(received.type, 'test');
            assert.strictEqual(received.data, 42);

            unsub();
        });

        it('unsubscribe removes listener', () => {
            let count = 0;
            const unsub = vm.subscribe(() => count++);

            vm.notifyListeners({ type: 'test' });
            assert.strictEqual(count, 1);

            unsub();
            vm.notifyListeners({ type: 'test' });
            assert.strictEqual(count, 1); // Still 1
        });
    });

    describe('getAllState', () => {
        it('returns empty object when no state set', () => {
            const state = vm.getAllState();
            assert.strictEqual(Object.keys(state).length, 0);
        });

        it('returns non-zero state values', () => {
            vm.setState(0, 10);
            vm.setState(5, 20);
            vm.setState(10, 30);

            const state = vm.getAllState();
            assert.strictEqual(state[0], 10);
            assert.strictEqual(state[5], 20);
            assert.strictEqual(state[10], 30);
        });
    });
});
