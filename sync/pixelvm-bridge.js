// pixelvm-bridge.js — Bridge between pxOS server and PixelVM
// Enables live Python → Pixels → Execution via HTTP API

import { PixelVM, OP, OP_NAMES } from './pixel-vm.js';
import { InfiniteMap } from './infinite-map.js';
import { PythonToPixels } from './python-to-pixels.js';

// Helper function to check if a value is a valid number
function isValidNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n);
}

/**
 * PixelVMBridge — Manages PixelVM instances connected to pxOS
 */
export class PixelVMBridge {
    constructor(options = {}) {
        this.map = new InfiniteMap(options.mapOptions || { chunkSize: 256 });
        this.vm = new PixelVM({
            map: this.map,
            maxCycles: options.maxCycles || 100000,
            agentId: options.agentId || 'pixelvm-bridge',
            viewportX: options.viewportX || 0,
            viewportY: options.viewportY || 0,
            viewportW: options.viewportW || 256,
            viewportH: options.viewportH || 256,
        });

        this.transpiler = new PythonToPixels();
        this.executionLog = [];
        this.maxLogSize = options.maxLogSize || 100;
    }

    /**
     * Execute Python code → pixels → run
     */
    executePython(code, options = {}) {
        const startTime = Date.now();

        try {
            // Transpile Python to pixels
            const transpileResult = this.transpiler.transpile(code, options.baseX || 0, options.baseY || 0);

            // Write transpiled pixels to the map
            const baseX = options.baseX || 0;
            const baseY = options.baseY || 0;
            for (let i = 0; i < transpileResult.pixels.length; i++) {
                const [r, g, b, a] = transpileResult.pixels[i];
                this.map.setPixel(baseX + i, baseY, r, g, b, a, this.vm.agentId);
            }

            // Load program into VM
            this.vm.ipX = baseX;
            this.vm.ipY = baseY;
            this.vm.halted = false;
            this.vm.cycles = 0;

            // Execute
            const maxCycles = options.maxCycles || 10000;
            const result = this.vm.run(maxCycles);

            const elapsed = Date.now() - startTime;

            const logEntry = {
                type: 'python',
                code: code.slice(0, 200),
                instructions: transpileResult.instructionCount,
                cycles: result.cycles,
                halted: result.halted,
                elapsed,
                timestamp: startTime,
            };
            this.logExecution(logEntry);

            return {
                success: true,
                transpile: {
                    instructionCount: transpileResult.instructionCount,
                    variables: transpileResult.variables,
                    functions: transpileResult.functions,
                },
                execution: {
                    cycles: result.cycles,
                    halted: result.halted,
                    finalIP: result.finalIP,
                },
                elapsed,
                logEntry,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                stack: error.stack,
                elapsed: Date.now() - startTime,
            };
        }
    }

    /**
     * Execute raw pixel instructions
     */
    executePixels(pixels, options = {}) {
        const startTime = Date.now();

        try {
            // Write pixels to map
            const baseX = options.baseX || 0;
            const baseY = options.baseY || 0;

            for (let i = 0; i < pixels.length; i++) {
                const [r, g, b, a] = pixels[i];
                this.map.setPixel(baseX + i, baseY, r, g, b, a, this.vm.agentId);
            }

            // Set IP and execute
            this.vm.ipX = baseX;
            this.vm.ipY = baseY;
            this.vm.halted = false;
            this.vm.cycles = 0;

            const result = this.vm.run(options.maxCycles || 10000);
            const elapsed = Date.now() - startTime;

            const logEntry = {
                type: 'pixels',
                pixelCount: pixels.length,
                cycles: result.cycles,
                halted: result.halted,
                elapsed,
                timestamp: startTime,
            };
            this.logExecution(logEntry);

            return {
                success: true,
                pixels: pixels.length,
                execution: result,
                elapsed,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                elapsed: Date.now() - startTime,
            };
        }
    }

    /**
     * Get current map state
     */
    getMapState() {
        return {
            stats: this.map.getStats(),
            chunks: this.map.listChunks(),
            sovereign: this.map.getSovereign(),
        };
    }

    /**
     * Get VM state
     */
    getVMState() {
        return {
            ipX: this.vm.ipX,
            ipY: this.vm.ipY,
            halted: this.vm.halted,
            cycles: this.vm.cycles,
            viewport: {
                x: this.vm.viewportX,
                y: this.vm.viewportY,
                w: this.vm.viewportW,
                h: this.vm.viewportH,
            },
            memory: Array.from(this.vm.memory.slice(0, 256)),
        };
    }

    /**
     * Get pixel at coordinates
     */
    getPixel(x, y) {
        return this.map.getPixel(x, y);
    }

    /**
     * Set pixel at coordinates
     */
    setPixel(x, y, r, g, b, a = 255) {
        this.map.setPixel(x, y, r, g, b, a, this.vm.agentId);
    }

    /**
     * Get viewport as PNG buffer
     */
    async getViewportPNG() {
        return this.vm.viewportToPNG();
    }

    /**
     * Get execution log
     */
    getExecutionLog(limit = 20) {
        return this.executionLog.slice(-limit);
    }

    /**
     * Reset VM and optionally clear map
     */
    reset(clearMap = false) {
        this.vm.reset();
        if (clearMap) {
            this.map = new InfiniteMap();
            this.vm.map = this.map;
        }
        return { reset: true, cleared: clearMap };
    }

    /**
     * Log execution for history
     */
    logExecution(entry) {
        this.executionLog.push(entry);
        if (this.executionLog.length > this.maxLogSize) {
            this.executionLog.shift();
        }
    }

    /**
     * Export map region as PNG
     */
    async exportRegion(x, y, w, h) {
        const region = this.map.getRegion(x, y, w, h);
        const sharp = (await import('sharp')).default;
        return sharp(Buffer.from(region), {
            raw: { width: w, height: h, channels: 4 }
        }).png().toBuffer();
    }
}
