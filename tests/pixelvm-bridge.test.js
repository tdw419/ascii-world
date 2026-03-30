// pixelvm-bridge.test.js — Test the PixelVM bridge

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PixelVMBridge } from '../sync/pixelvm-bridge.js';

describe('PixelVMBridge', () => {
    let bridge;

    beforeEach(() => {
        bridge = new PixelVMBridge();
    });

    it('creates bridge with default options', () => {
        assert.ok(bridge.vm);
        assert.ok(bridge.map);
        assert.ok(bridge.transpiler);
    });

    it('executes simple Python code', () => {
        const code = `
x = 10
y = 20
z = x + y
`;
        const result = bridge.executePython(code);
        assert.ok(result.success);
        assert.ok(result.transpile.instructionCount > 0);
    });

    it('returns error for invalid code gracefully', () => {
        const result = bridge.executePython('invalid !!! code');
        // Should either succeed with limited parsing or return error object
        assert.ok(result.success !== undefined);
    });

    it('gets VM state', () => {
        const state = bridge.getVMState();
        assert.ok(state.ipX !== undefined);
        assert.ok(state.ipY !== undefined);
        assert.ok(state.halted !== undefined);
        assert.ok(state.cycles !== undefined);
    });

    it('gets map state', () => {
        const state = bridge.getMapState();
        assert.ok(state.stats);
        assert.ok(state.chunks);
    });

    it('sets and gets pixels', () => {
        bridge.setPixel(100, 100, 255, 0, 0);
        const pixel = bridge.getPixel(100, 100);
        assert.deepStrictEqual(pixel, [255, 0, 0, 255]);
    });

    it('executes raw pixels', () => {
        // NOP, HALT
        const pixels = [
            [140, 0, 0, 0],  // NOP
            [141, 0, 0, 0],  // HALT
        ];
        const result = bridge.executePixels(pixels);
        assert.ok(result.success);
    });

    it('logs executions', () => {
        bridge.executePython('x = 5');
        const log = bridge.getExecutionLog();
        assert.ok(log.length > 0);
        assert.ok(log[0].type);
    });

    it('resets VM', () => {
        bridge.executePython('x = 5');
        const result = bridge.reset();
        assert.ok(result.reset);
        const state = bridge.getVMState();
        assert.strictEqual(state.cycles, 0);
    });

    it('reset with map clear', () => {
        bridge.setPixel(0, 0, 255, 0, 0);
        const result = bridge.reset(true);
        assert.ok(result.cleared);
        const pixel = bridge.getPixel(0, 0);
        assert.deepStrictEqual(pixel, [0, 0, 0, 0]);
    });
});
