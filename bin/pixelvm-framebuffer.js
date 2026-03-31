#!/usr/bin/env node
// pixelvm-framebuffer.js — The Bridge: PixelVM → /dev/fb0
// This file IS the display. Pixels become the monitor surface.
//
// Usage:
//   sudo node bin/pixelvm-framebuffer.js --dry-run    # Test without takeover
//   sudo node bin/pixelvm-framebuffer.js --takeover   # Full takeover
//   sudo node bin/pixelvm-framebuffer.js --python "x=10;print(x)"  # Run Python
//
// Requirements:
//   - Linux with /dev/fb0
//   - sudo access
//   - Run from TTY or have SSH access to recover

import fs from 'fs';
import { execSync } from 'child_process';
import { PixelVMBridge } from '../sync/pixelvm-bridge.js';

const FRAMEBUFFER_DEVICE = '/dev/fb0';
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

class PixelVMFramebuffer {
    constructor(options = {}) {
        this.width = options.width || DEFAULT_WIDTH;
        this.height = options.height || DEFAULT_HEIGHT;
        this.device = options.device || FRAMEBUFFER_DEVICE;

        // Detect actual framebuffer size
        this._detectFramebuffer();

        // Create the bridge
        this.bridge = new PixelVMBridge({
            viewportW: this.width,
            viewportH: this.height,
            maxCycles: options.maxCycles || 1000000,
        });

        this.running = false;
        this.frameCount = 0;
        this.startTime = Date.now();
    }

    _detectFramebuffer() {
        try {
            // Try to read actual framebuffer dimensions
            const sizePath = '/sys/class/graphics/fb0/virtual_size';
            if (fs.existsSync(sizePath)) {
                const [w, h] = fs.readFileSync(sizePath, 'utf8').trim().split(',');
                this.width = parseInt(w) || this.width;
                this.height = parseInt(h) || this.height;
                console.log(`✓ Framebuffer detected: ${this.width}x${this.height}`);
            }

            const bppPath = '/sys/class/graphics/fb0/bits_per_pixel';
            if (fs.existsSync(bppPath)) {
                this.bpp = parseInt(fs.readFileSync(bppPath, 'utf8').trim());
                console.log(`✓ Bits per pixel: ${this.bpp}`);
            }
        } catch (err) {
            console.log(`  Using default: ${this.width}x${this.height}`);
        }
    }

    /**
     * Get raw RGBA buffer from viewport
     */
    async getViewportRaw() {
        const map = this.bridge.map;
        const vm = this.bridge.vm;

        // Create raw buffer
        const buffer = Buffer.alloc(this.width * this.height * 4);

        // Copy pixels from InfiniteMap to buffer
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const [r, g, b, a] = map.getPixel(
                    vm.viewportX + x,
                    vm.viewportY + y
                );
                const idx = (y * this.width + x) * 4;
                buffer[idx] = r;
                buffer[idx + 1] = g;
                buffer[idx + 2] = b;
                buffer[idx + 3] = a;
            }
        }

        return buffer;
    }

    /**
     * Write buffer directly to framebuffer
     */
    writeToFramebuffer(buffer) {
        if (!fs.existsSync(this.device)) {
            throw new Error(`Framebuffer device not found: ${this.device}`);
        }

        // Open framebuffer for writing
        const fd = fs.openSync(this.device, 'w');
        fs.writeSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
    }

    /**
     * Execute Python code and display result
     */
    async runPython(code, options = {}) {
        console.log('\n═══ EXECUTING PYTHON ═══\n');
        console.log(code);
        console.log('\n────────────────────────\n');

        const result = this.bridge.executePython(code, {
            baseX: options.baseX || 0,
            baseY: options.baseY || 0,
            maxCycles: options.maxCycles || 10000,
        });

        if (result.success) {
            console.log(`✓ Compiled: ${result.transpile.instructionCount} instructions`);
            console.log(`✓ Executed: ${result.execution.cycles} cycles`);
            console.log(`✓ Time: ${result.elapsed}ms`);
        } else {
            console.error(`✗ Error: ${result.error}`);
        }

        return result;
    }

    /**
     * Execute raw pixel bytecode
     */
    async runPixels(pixels, options = {}) {
        console.log('\n═══ EXECUTING PIXELS ═══\n');
        console.log(`Pixel count: ${pixels.length}`);
        console.log('First 5 pixels:');
        for (let i = 0; i < Math.min(5, pixels.length); i++) {
            const [r, g, b, a] = pixels[i];
            console.log(`  [${i}] R=${r} G=${g} B=${b} A=${a}`);
        }

        const result = this.bridge.executePixels(pixels, options);

        if (result.success) {
            console.log(`✓ Executed: ${result.execution.cycles} cycles`);
        } else {
            console.error(`✗ Error: ${result.error}`);
        }

        return result;
    }

    /**
     * Main render loop - continuously write to framebuffer
     */
    async startLoop(fps = 60) {
        this.running = true;
        const frameTime = 1000 / fps;

        console.log('\n═══ FRAMEBUFFER LOOP ═══\n');
        console.log(`Resolution: ${this.width}x${this.height}`);
        console.log(`Target FPS: ${fps}`);
        console.log(`Device: ${this.device}`);
        console.log('\nPress Ctrl+C to stop\n');

        const renderFrame = async () => {
            if (!this.running) return;

            const frameStart = Date.now();

            try {
                // Get viewport pixels
                const buffer = await this.getViewportRaw();

                // Write to framebuffer
                this.writeToFramebuffer(buffer);

                this.frameCount++;

                // Stats every 60 frames
                if (this.frameCount % 60 === 0) {
                    const elapsed = Date.now() - this.startTime;
                    const actualFps = (this.frameCount / elapsed * 1000).toFixed(1);
                    console.log(`Frame ${this.frameCount} | ${actualFps} FPS`);
                }

            } catch (err) {
                console.error(`Frame error: ${err.message}`);
            }

            // Schedule next frame
            const elapsed = Date.now() - frameStart;
            const delay = Math.max(0, frameTime - elapsed);

            if (this.running) {
                setTimeout(renderFrame, delay);
            }
        };

        renderFrame();
    }

    /**
     * Stop the render loop
     */
    stop() {
        this.running = false;
        console.log('\n✓ Stopped');
    }

    /**
     * Take over the display (write once)
     */
    async takeover() {
        console.log('\n═══ DISPLAY TAKEOVER ═══\n');
        console.log(`Writing ${this.width}x${this.height} to ${this.device}...`);

        const buffer = await this.getViewportRaw();
        this.writeToFramebuffer(buffer);

        console.log('✓ Display taken over');
        console.log('  The pixel system IS your monitor now.');
    }

    /**
     * Dry run - test without writing to framebuffer
     */
    async dryRun() {
        console.log('\n═══ DRY RUN ═══\n');
        console.log(`Would write ${this.width}x${this.height} to ${this.device}`);

        const buffer = await this.getViewportRaw();
        console.log(`Buffer size: ${buffer.length} bytes`);
        console.log(`First 16 bytes: ${buffer.slice(0, 16).toString('hex')}`);

        console.log('\n✓ Dry run complete (no display changes)');
    }

    /**
     * Fill viewport with test pattern
     */
    fillTestPattern() {
        const map = this.bridge.map;
        const vm = this.bridge.vm;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Gradient pattern
                const r = (x / this.width * 255) | 0;
                const g = (y / this.height * 255) | 0;
                const b = ((x + y) / (this.width + this.height) * 255) | 0;
                map.setPixel(vm.viewportX + x, vm.viewportY + y, r, g, b, 255, 'test-pattern');
            }
        }

        console.log(`✓ Filled ${this.width}x${this.height} with test pattern`);
    }

    /**
     * Clear viewport
     */
    clear(color = [10, 10, 15, 255]) {
        const map = this.bridge.map;
        const vm = this.bridge.vm;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                map.setPixel(vm.viewportX + x, vm.viewportY + y, ...color, 'clear');
            }
        }

        console.log(`✓ Cleared viewport`);
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isTakeover = args.includes('--takeover');
    const isLoop = args.includes('--loop');
    const isTest = args.includes('--test');
    const pythonIdx = args.indexOf('--python');
    const help = args.includes('--help') || args.includes('-h');

    if (help) {
        console.log(`
pixelvm-framebuffer.js — PixelVM → /dev/fb0 Bridge

Usage:
  sudo node bin/pixelvm-framebuffer.js [options]

Options:
  --dry-run       Test without writing to framebuffer
  --takeover      Write once to framebuffer (take over display)
  --loop          Continuous render loop at 60 FPS
  --test          Fill with test pattern first
  --python CODE   Execute Python code and display result
  --help, -h      Show this help

Examples:
  # Test without display changes
  sudo node bin/pixelvm-framebuffer.js --dry-run

  # Fill with test pattern and take over display
  sudo node bin/pixelvm-framebuffer.js --test --takeover

  # Run Python code and display
  sudo node bin/pixelvm-framebuffer.js --python "x=10;print(x)" --takeover

  # Continuous render loop
  sudo node bin/pixelvm-framebuffer.js --test --loop

WARNING: --takeover replaces your display. Run from TTY or have SSH access.
`);
        process.exit(0);
    }

    const fbuf = new PixelVMFramebuffer();

    // Test pattern?
    if (isTest) {
        fbuf.fillTestPattern();
    }

    // Run Python?
    if (pythonIdx >= 0 && pythonIdx + 1 < args.length) {
        const code = args[pythonIdx + 1];
        await fbuf.runPython(code);
    }

    // What to do?
    if (isLoop) {
        // Continuous loop
        process.on('SIGINT', () => {
            fbuf.stop();
            process.exit(0);
        });
        await fbuf.startLoop(60);
    } else if (isTakeover) {
        // One-time takeover
        await fbuf.takeover();
    } else if (isDryRun) {
        // Dry run
        await fbuf.dryRun();
    } else {
        // Default: show help
        console.log('Use --help for usage. Defaulting to --dry-run.\n');
        await fbuf.dryRun();
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
