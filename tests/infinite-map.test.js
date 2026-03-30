// infinite-map.test.js — Tests for sparse infinite coordinate space

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { InfiniteMap } from '../sync/infinite-map.js';

describe('InfiniteMap', () => {
    let map;

    beforeEach(() => {
        map = new InfiniteMap({ chunkSize: 64, maxChunks: 10 });
    });

    it('starts with no chunks', () => {
        assert.strictEqual(map.chunks.size, 0);
    });

    it('allocates chunk on first write', () => {
        map.setPixel(0, 0, 255, 0, 0);
        assert.strictEqual(map.chunks.size, 1);
    });

    it('writes and reads pixel in positive coords', () => {
        map.setPixel(100, 200, 255, 128, 64);
        const pixel = map.getPixel(100, 200);
        assert.deepStrictEqual(pixel, [255, 128, 64, 255]);
    });

    it('writes and reads pixel in negative coords', () => {
        map.setPixel(-100, -200, 0, 255, 0);
        const pixel = map.getPixel(-100, -200);
        assert.deepStrictEqual(pixel, [0, 255, 0, 255]);
    });

    it('returns transparent black for missing chunk', () => {
        const pixel = map.getPixel(10000, 10000);
        assert.deepStrictEqual(pixel, [0, 0, 0, 0]);
    });

    it('allocates separate chunks for far apart coords', () => {
        map.setPixel(0, 0, 255, 0, 0);
        map.setPixel(1000, 0, 0, 255, 0);
        map.setPixel(0, 1000, 0, 0, 255);
        assert.strictEqual(map.chunks.size, 3);
    });

    it('uses same chunk for coords within chunk size', () => {
        map.setPixel(0, 0, 255, 0, 0);
        map.setPixel(63, 63, 0, 255, 0);
        assert.strictEqual(map.chunks.size, 1);
    });

    it('getRegion returns pixel data for reading as instructions', () => {
        map.setPixel(0, 0, 140, 0, 0); // NOP opcode
        map.setPixel(1, 0, 141, 0, 0); // HALT opcode
        const region = map.getRegion(0, 0, 2, 1);
        assert.strictEqual(region[0], 140); // R of first pixel
        assert.strictEqual(region[4], 141); // R of second pixel
    });

    it('setRegion writes a block of pixels', () => {
        const data = new Uint8ClampedArray([
            255, 0, 0, 255,  // red
            0, 255, 0, 255,  // green
            0, 0, 255, 255,  // blue
            255, 255, 0, 255 // yellow
        ]);
        map.setRegion(10, 10, 2, 2, data);
        assert.deepStrictEqual(map.getPixel(10, 10), [255, 0, 0, 255]);
        assert.deepStrictEqual(map.getPixel(11, 10), [0, 255, 0, 255]);
        assert.deepStrictEqual(map.getPixel(10, 11), [0, 0, 255, 255]);
        assert.deepStrictEqual(map.getPixel(11, 11), [255, 255, 0, 255]);
    });

    it('tracks writer for sovereignty', () => {
        map.setPixel(0, 0, 255, 0, 0, 255, 'agent-alpha');
        map.setPixel(1000, 0, 0, 255, 0, 255, 'agent-beta');
        const stats = map.getStats();
        assert.strictEqual(stats.writerCounts['agent-alpha'], 1);
        assert.strictEqual(stats.writerCounts['agent-beta'], 1);
    });

    it('returns null sovereign when no 51% control', () => {
        map.setPixel(0, 0, 255, 0, 0, 255, 'agent-alpha');
        map.setPixel(1000, 0, 0, 255, 0, 255, 'agent-beta');
        assert.strictEqual(map.getSovereign(), null);
    });

    it('returns sovereign when one agent controls 51%+', () => {
        // Agent alpha writes to 2 chunks (out of 3)
        map.setPixel(0, 0, 255, 0, 0, 255, 'agent-alpha');
        map.setPixel(100, 0, 0, 255, 0, 255, 'agent-alpha');
        // Agent beta writes to 1 chunk
        map.setPixel(1000, 0, 0, 255, 0, 255, 'agent-beta');
        assert.strictEqual(map.getSovereign(), 'agent-alpha');
    });

    it('garbage collects oldest chunk when at maxChunks', () => {
        const smallMap = new InfiniteMap({ chunkSize: 64, maxChunks: 2 });
        smallMap.setPixel(0, 0, 255, 0, 0);
        smallMap.setPixel(100, 0, 0, 255, 0);
        assert.strictEqual(smallMap.chunks.size, 2);
        
        // Force GC by adding third chunk
        smallMap.setPixel(1000, 0, 0, 0, 255);
        assert.strictEqual(smallMap.chunks.size, 2);
        
        // First chunk should be gone
        assert.deepStrictEqual(smallMap.getPixel(0, 0), [0, 0, 0, 0]);
    });

    it('listChunks returns all chunk metadata', () => {
        map.setPixel(0, 0, 255, 0, 0, 255, 'agent-1');
        map.setPixel(1000, 0, 0, 255, 0, 255, 'agent-2');
        const list = map.listChunks();
        assert.strictEqual(list.length, 2);
        assert.ok(list.find(c => c.writerId === 'agent-1'));
        assert.ok(list.find(c => c.writerId === 'agent-2'));
    });
});
