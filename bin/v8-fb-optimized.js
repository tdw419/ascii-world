// bin/v8-fb-optimized.js
// High-Performance Bare-Metal Graphics Architecture in Node.js
// Multi-threaded rendering with SharedArrayBuffer and direct /dev/fb0 access

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { SpatialManager } from '../sync/spatial-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMEBUFFER = '/dev/fb0';
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

class HighPerfFB {
    constructor(options = {}) {
        this.width = options.width || DEFAULT_WIDTH;
        this.height = options.height || DEFAULT_HEIGHT;
        this.device = options.device || FRAMEBUFFER;
        this.shader = options.shader || 'spatial-grid';
        this.workerCount = options.workerCount || os.cpus().length;
        
        this._detectFramebuffer();
        
        // Spatial State
        this.spatial = new SpatialManager();
        
        // SharedArrayBuffer for zero-copy between workers
        const size = this.width * this.height * 4;
        this.sab = new SharedArrayBuffer(size);
        this.bufferView = new Uint8Array(this.sab);
        this.bufferView32 = new Uint32Array(this.sab);
        
        this.workers = [];
        this.workerPromises = [];
        this.running = false;
        this.frameCount = 0;
        this.startTime = Date.now();
        
        this._initWorkers();
    }

    _detectFramebuffer() {
        try {
            const sizePath = '/sys/class/graphics/fb0/virtual_size';
            if (fs.existsSync(sizePath)) {
                const [w, h] = fs.readFileSync(sizePath, 'utf8').trim().split(',');
                this.width = parseInt(w) || this.width;
                this.height = parseInt(h) || this.height;
                console.log(`[FB] Detected resolution: ${this.width}x${this.height}`);
            }
        } catch (err) {
            console.warn(`[FB] Using default resolution: ${this.width}x${this.height}`);
        }
    }

    _initWorkers() {
        console.log(`[FB] Initializing ${this.workerCount} worker threads...`);
        
        // CACHE ALIGNMENT: Each pixel is 4 bytes. 
        // A standard CPU cache line is 64 bytes (16 pixels).
        // To prevent 'False Sharing', workers MUST start on 64-byte boundaries.
        const pixelsPerCacheLine = 16;
        
        // Total rows divided by workers, but we adjust to keep alignment
        const idealRowsPerWorker = Math.floor(this.height / this.workerCount);
        
        let currentY = 0;
        for (let i = 0; i < this.workerCount; i++) {
            const startY = currentY;
            let endY = (i === this.workerCount - 1) ? this.height : (startY + idealRowsPerWorker);
            
            // Ensure the next worker starts on a cache-aligned boundary
            // The number of pixels from the start of the buffer must be a multiple of 16
            // Offset = endY * this.width
            // If (endY * this.width) % 16 != 0, we nudge endY
            if (i < this.workerCount - 1) {
                while ((endY * this.width) % pixelsPerCacheLine !== 0) {
                    endY++;
                }
            }
            
            // Safety check: don't exceed height
            if (endY > this.height) endY = this.height;

            const worker = new Worker(path.join(__dirname, 'fb-worker.js'), {
                workerData: {
                    threadId: i,
                    width: this.width,
                    height: this.height,
                    startY,
                    endY,
                    buffer: this.sab
                }
            });
            
            worker.on('message', (msg) => {
                if (msg.type === 'done') {
                    if (this._resolveWorker) {
                        this._pendingCount--;
                        if (this._pendingCount === 0) {
                            this._resolveWorker();
                        }
                    }
                }
            });
            
            this.workers.push(worker);
            currentY = endY;
            if (currentY >= this.height && i < this.workerCount - 1) {
                console.warn(`[FB] Resource saturation: Worker ${i} reached bottom of screen early.`);
                break;
            }
        }
        
        // Update actual active worker count
        this.activeWorkerCount = this.workers.length;
    }

    async renderFrame(time) {
        this._pendingCount = this.activeWorkerCount;
        const promise = new Promise(resolve => {
            this._resolveWorker = resolve;
        });
        
        // Simulate spatial flight path
        this.spatial.cameraX += Math.sin(time / 100) * 10;
        this.spatial.cameraY += Math.cos(time / 100) * 10;
        this.spatial.zoom = 1.0 + Math.sin(time / 200) * 0.5;

        for (const worker of this.workers) {
            worker.postMessage({ 
                type: 'render', 
                time, 
                shader: this.shader,
                cameraX: this.spatial.cameraX,
                cameraY: this.spatial.cameraY,
                zoom: this.spatial.zoom
            });
        }
        
        await promise;
    }

    writeToFB(fd) {
        // High-performance write of the entire buffer
        // Note: Ideally we use mmap, but fs.writeSync is the next best thing in pure JS
        fs.writeSync(fd, this.bufferView, 0, this.bufferView.length, 0);
    }

    async start(targetFPS = 60) {
        this.running = true;
        const frameTime = 1000 / targetFPS;
        let fd;
        
        if (!this.dryRun) {
            try {
                fd = fs.openSync(this.device, 'w');
            } catch (err) {
                console.error(`[FB] Error opening ${this.device}: ${err.message}`);
                console.error('     Try running with sudo or use --dry-run for testing.');
                process.exit(1);
            }
        }

        console.log(`[FB] Starting render loop at ${targetFPS} FPS...`);
        console.log(`[FB] Shader: ${this.shader}`);
        if (this.dryRun) console.log('[FB] MODE: DRY RUN (no hardware write)');
        console.log('     Press Ctrl+C to stop.\n');

        const loop = async () => {
            if (!this.running) {
                if (fd) fs.closeSync(fd);
                return;
            }

            const frameStart = performance.now();
            const time = (performance.now() - this.startTime) / 10;
            
            // Parallel render via workers
            await this.renderFrame(time);
            
            // Sync write to hardware
            if (!this.dryRun) {
                this.writeToFB(fd);
            }
            
            this.frameCount++;
            if (this.frameCount % 60 === 0) {
                const elapsed = (Date.now() - this.startTime) / 1000;
                const fps = (this.frameCount / elapsed).toFixed(1);
                process.stdout.write(`\r[FB] Frame: ${this.frameCount} | FPS: ${fps} | Uptime: ${elapsed.toFixed(1)}s    `);
            }

            const elapsed = performance.now() - frameStart;
            const delay = Math.max(0, frameTime - elapsed);
            
            setTimeout(loop, delay);
        };

        loop();
    }

    stop() {
        this.running = false;
        for (const worker of this.workers) {
            worker.terminate();
        }
        console.log('\n[FB] Rendering stopped.');
    }
}

// CLI
const args = process.argv.slice(2);
const options = {};

if (args.includes('--shader')) {
    options.shader = args[args.indexOf('--shader') + 1];
}

const fb = new HighPerfFB(options);
fb.dryRun = args.includes('--dry-run');

process.on('SIGINT', () => {
    fb.stop();
    process.exit(0);
});

fb.start(60).catch(err => {
    console.error(`[FB] Error: ${err.stack}`);
    process.exit(1);
});
