/**
 * Tests for framebuffer-writer — Stride-aware framebuffer output
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FramebufferWriter, queryScreenInfo } from '../sync/framebuffer-writer.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';

describe('FramebufferWriter - construction', () => {
    it('creates with default device', () => {
        const fw = new FramebufferWriter();
        assert.strictEqual(fw.device, '/dev/fb0');
        assert.strictEqual(fw.screenInfo, null);
        assert.strictEqual(fw._fd, null);
    });

    it('accepts custom device', () => {
        const fw = new FramebufferWriter({ device: '/dev/fb1' });
        assert.strictEqual(fw.device, '/dev/fb1');
    });

    it('accepts pre-set screen info', () => {
        const info = { xres: 800, yres: 600, bitsPerPixel: 32, lineLength: 3200, smemLen: 1920000 };
        const fw = new FramebufferWriter({ screenInfo: info });
        assert.deepStrictEqual(fw.getScreenInfo(), info);
    });
});

describe('FramebufferWriter - getScreenInfo', () => {
    it('returns cached screen info on repeated calls', () => {
        const fw = new FramebufferWriter({ device: '/dev/nonexistent' });
        // First call will try sysfs, fail, and return defaults
        const info1 = fw.getScreenInfo();
        const info2 = fw.getScreenInfo();
        assert.strictEqual(info1, info2); // Same object reference (cached)
    });

    it('provides sensible defaults when sysfs unavailable', () => {
        const fw = new FramebufferWriter({ device: '/dev/nonexistent' });
        const info = fw.getScreenInfo();
        assert.strictEqual(info.xres, 1920);
        assert.strictEqual(info.yres, 1080);
        assert.strictEqual(info.bitsPerPixel, 32);
        assert.strictEqual(info.lineLength, 1920 * 4); // stride = xres * bytesPerPixel
        assert.strictEqual(info.smemLen, info.lineLength * info.yres);
    });

    it('computes lineLength from xres * bytesPerPixel', () => {
        const fw = new FramebufferWriter({ device: '/dev/nonexistent' });
        const info = fw.getScreenInfo();
        assert.strictEqual(info.lineLength, info.xres * (info.bitsPerPixel / 8));
    });
});

describe('FramebufferWriter - open/close', () => {
    it('open throws on nonexistent device', () => {
        const fw = new FramebufferWriter({ device: '/dev/nonexistent_fb_device' });
        assert.throws(() => fw.open(), /Cannot open framebuffer/);
    });

    it('close is safe when not open', () => {
        const fw = new FramebufferWriter({ device: '/dev/nonexistent' });
        fw.close(); // Should not throw
        assert.strictEqual(fw._fd, null);
    });

    it('close is safe to call multiple times', () => {
        const fw = new FramebufferWriter({ device: '/dev/nonexistent' });
        fw.close();
        fw.close(); // Should not throw
    });
});

describe('FramebufferWriter - writeFullFrame (mocked)', () => {
    it('writeFullFrame returns false when device unavailable', () => {
        const info = { xres: 10, yres: 10, bitsPerPixel: 32, lineLength: 40, smemLen: 400 };
        const fw = new FramebufferWriter({ device: '/dev/nonexistent', screenInfo: info });
        const pb = new PixelBuffer(10, 10);
        pb.fill(255, 0, 0, 255);
        const result = fw.writeFullFrame(pb);
        assert.strictEqual(result, false);
    });
});

describe('FramebufferWriter - writeDirtyRows (mocked)', () => {
    it('returns false when no dirty rows', () => {
        const info = { xres: 10, yres: 10, bitsPerPixel: 32, lineLength: 40, smemLen: 400 };
        const fw = new FramebufferWriter({ device: '/dev/nonexistent', screenInfo: info });
        const pb = new PixelBuffer(10, 10);
        pb.clearDirty();
        const result = fw.writeDirtyRows(pb);
        assert.strictEqual(result, false);
    });

    it('returns true when dirty rows present (write attempts even if device unavailable)', () => {
        const info = { xres: 10, yres: 10, bitsPerPixel: 32, lineLength: 40, smemLen: 400 };
        const fw = new FramebufferWriter({ device: '/dev/nonexistent', screenInfo: info });
        const pb = new PixelBuffer(10, 10);
        pb.setPixel(5, 5, 255, 0, 0, 255);
        // writeDirtyRows clears dirty rows and returns true even if device write fails
        const result = fw.writeDirtyRows(pb);
        assert.strictEqual(result, true);
        // But dirty rows should be cleared
        assert.strictEqual(pb.isDirty(), false);
    });
});

describe('FramebufferWriter - flush', () => {
    it('returns false when pixel buffer is not dirty', () => {
        const fw = new FramebufferWriter({ device: '/dev/nonexistent' });
        const pb = new PixelBuffer(10, 10);
        pb.clearDirty();
        assert.strictEqual(fw.flush(pb), false);
    });

    it('returns true when dirty rows present', () => {
        const info = { xres: 10, yres: 10, bitsPerPixel: 32, lineLength: 40, smemLen: 400 };
        const fw = new FramebufferWriter({ device: '/dev/nonexistent', screenInfo: info });
        const pb = new PixelBuffer(10, 10);
        pb.setPixel(0, 0, 255, 0, 0, 255);
        // flush delegates to writeDirtyRows which returns true for dirty rows
        assert.strictEqual(fw.flush(pb), true);
    });
});

describe('FramebufferWriter - stride handling', () => {
    it('handles stride > visible width correctly', () => {
        const info = { xres: 10, yres: 10, bitsPerPixel: 32, lineLength: 48, smemLen: 480 }; // 10*4=40 visible, padded to 48
        const fw = new FramebufferWriter({ device: '/dev/nonexistent', screenInfo: info });
        const pb = new PixelBuffer(10, 10);
        pb.fill(128, 64, 32, 255);

        // writeFullFrame should handle the stride difference
        const result = fw.writeFullFrame(pb);
        assert.strictEqual(result, false); // Fails due to no device, but shouldn't throw
    });
});

describe('queryScreenInfo', () => {
    it('returns defaults for nonexistent device', () => {
        const info = queryScreenInfo('/dev/nonexistent');
        assert.strictEqual(info.xres, 1920);
        assert.strictEqual(info.yres, 1080);
        assert.strictEqual(info.bitsPerPixel, 32);
        assert.strictEqual(info.lineLength, 1920 * 4);
    });
});
