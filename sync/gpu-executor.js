// gpu-executor.js
// WebGPU-based Glyph VM executor
// "Pixels move pixels" - GPU reads opcode textures and executes

import { SyntheticGlyphVM, OP } from './synthetic-glyph-vm.js';

const SHADER_SOURCE = await fetch('./wgsl/cartridge_executor.wgsl').then(r => r.text());

// Execution modes
const MODE_CLICK = 0;
const MODE_FRAME = 1;

/**
 * GPUExecutor - WebGPU-based Glyph VM execution
 *
 * Uses compute shaders to execute opcodes directly on GPU.
 * State is stored in textures for visual debugging.
 */
export class GPUExecutor {
    constructor(options = {}) {
        this.gridWidth = options.gridWidth || 80;
        this.gridHeight = options.gridHeight || 24;
        this.stateCount = options.stateCount || 320;

        this.device = null;
        this.sitTexture = null;
        this.stateTexture = null;
        this.pipeline = null;
        this.bindGroup = null;
        this.uniformBuffer = null;

        this.initialized = false;
    }

    /**
     * Initialize WebGPU device and create resources.
     */
    async init() {
        if (this.initialized) return;

        // Request adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('WebGPU not supported');
        }

        this.device = await adapter.requestDevice();

        // Create SIT texture (read-only, stores opcodes)
        this.sitTexture = this.device.createTexture({
            size: [this.gridWidth, this.gridHeight],
            format: 'rgba8uint',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            label: 'SIT texture',
        });

        // Create state texture (read-write, stores slot values)
        this.stateTexture = this.device.createTexture({
            size: [this.stateCount, 1],
            format: 'rgba8uint',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
            label: 'State texture',
        });

        // Create uniform buffer for execution params
        this.uniformBuffer = this.device.createBuffer({
            size: 32,  // 8 u32s
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Exec params buffer',
        });

        // Create shader module
        const shaderModule = this.device.createShaderModule({
            code: SHADER_SOURCE,
            label: 'Cartridge executor shader',
        });

        // Create bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'uint', viewDimension: '2d' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'read-write', format: 'rgba8uint', viewDimension: '2d' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
            label: 'Executor bind group layout',
        });

        // Create pipeline
        this.pipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout],
            }),
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
            label: 'Cartridge executor pipeline',
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: this.sitTexture.createView() },
                { binding: 1, resource: this.stateTexture.createView() },
                { binding: 2, resource: { buffer: this.uniformBuffer } },
            ],
            label: 'Executor bind group',
        });

        this.initialized = true;
        console.log('[GPUExecutor] Initialized');
    }

    /**
     * Load SIT (Spatial Instruction Table) from RGBA pixel data.
     * Each pixel: R=opcode, G=target, B=flags, A=unused
     */
    loadSIT(imageData) {
        if (!this.initialized) {
            throw new Error('GPUExecutor not initialized');
        }

        // Create staging buffer
        const stagingBuffer = this.device.createBuffer({
            size: imageData.byteLength,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
            mappedAtCreation: true,
        });

        new Uint8Array(stagingBuffer.getMappedRange()).set(imageData);
        stagingBuffer.unmap();

        // Copy to texture
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToTexture(
            { buffer: stagingBuffer, bytesPerRow: this.gridWidth * 4 },
            { texture: this.sitTexture },
            [this.gridWidth, this.gridHeight, 1]
        );
        this.device.queue.submit([commandEncoder.finish()]);

        stagingBuffer.destroy();
    }

    /**
     * Load state from array.
     */
    loadState(stateArray) {
        if (!this.initialized) {
            throw new Error('GPUExecutor not initialized');
        }

        // Convert to RGBA (1 pixel per slot, R=slot value)
        const rgba = new Uint8Array(this.stateCount * 4);
        for (let i = 0; i < stateArray.length && i < this.stateCount; i++) {
            rgba[i * 4] = stateArray[i];
        }

        // Create staging buffer
        const stagingBuffer = this.device.createBuffer({
            size: rgba.byteLength,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
            mappedAtCreation: true,
        });

        new Uint8Array(stagingBuffer.getMappedRange()).set(rgba);
        stagingBuffer.unmap();

        // Copy to texture
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToTexture(
            { buffer: stagingBuffer, bytesPerRow: this.stateCount * 4 },
            { texture: this.stateTexture },
            [this.stateCount, 1, 1]
        );
        this.device.queue.submit([commandEncoder.finish()]);

        stagingBuffer.destroy();
    }

    /**
     * Get state array from GPU.
     */
    async getState() {
        if (!this.initialized) {
            throw new Error('GPUExecutor not initialized');
        }

        const size = this.stateCount * 4;
        const stagingBuffer = this.device.createBuffer({
            size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
            { texture: this.stateTexture },
            { buffer: stagingBuffer, bytesPerRow: this.stateCount * 4 },
            [this.stateCount, 1, 1]
        );
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const rgba = new Uint8Array(stagingBuffer.getMappedRange().slice(0));
        stagingBuffer.unmap();
        stagingBuffer.destroy();

        // Extract R channel (slot values)
        const state = new Uint8Array(this.stateCount);
        for (let i = 0; i < this.stateCount; i++) {
            state[i] = rgba[i * 4];
        }

        return state;
    }

    /**
     * Execute a single opcode at click coordinates.
     */
    async executeClick(x, y) {
        if (!this.initialized) {
            throw new Error('GPUExecutor not initialized');
        }

        // Update uniform buffer
        const params = new ArrayBuffer(32);
        const view = new DataView(params);
        view.setUint32(0, x, true);           // click_x
        view.setUint32(4, y, true);           // click_y
        view.setUint32(8, MODE_CLICK, true);  // exec_mode
        view.setUint32(12, this.gridWidth, true);
        view.setUint32(16, this.gridHeight, true);
        view.setUint32(20, this.stateCount, true);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, params);

        // Dispatch single workgroup (1x1)
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.dispatchWorkgroups(1, 1, 1);
        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);

        // Read back state
        return await this.getState();
    }

    /**
     * Execute all opcodes in the grid (frame mode).
     */
    async executeFrame() {
        if (!this.initialized) {
            throw new Error('GPUExecutor not initialized');
        }

        // Update uniform buffer
        const params = new ArrayBuffer(32);
        const view = new DataView(params);
        view.setUint32(0, 0, true);              // click_x (unused)
        view.setUint32(4, 0, true);              // click_y (unused)
        view.setUint32(8, MODE_FRAME, true);     // exec_mode
        view.setUint32(12, this.gridWidth, true);
        view.setUint32(16, this.gridHeight, true);
        view.setUint32(20, this.stateCount, true);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, params);

        // Dispatch workgroups covering entire grid
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.dispatchWorkgroups(this.gridWidth, this.gridHeight, 1);
        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);

        // Read back state
        return await this.getState();
    }

    /**
     * Run benchmark: execute N frames and measure ops/sec.
     */
    async benchmark(iterations = 100, opsPerFrame = 80 * 24) {
        if (!this.initialized) {
            await this.init();
        }

        const results = [];

        for (let i = 0; i < iterations; i++) {
            // Reset state
            this.loadState(new Uint8Array(this.stateCount));

            const start = performance.now();
            await this.executeFrame();
            const elapsed = performance.now() - start;

            results.push(opsPerFrame / (elapsed / 1000));
        }

        // Return median
        results.sort((a, b) => a - b);
        const median = results[Math.floor(results.length / 2)];

        return {
            opsPerSec: median,
            iterations,
            opsPerFrame,
        };
    }
}

/**
 * Check if WebGPU is available.
 */
export async function isWebGPUAvailable() {
    if (!navigator.gpu) {
        return false;
    }
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
}

// CLI entry point for Node.js
if (typeof process !== 'undefined' && process.argv[1]?.includes('gpu-executor.js')) {
    console.log('GPU Executor - WebGPU-based Glyph VM');
    console.log('');
    console.log('Note: WebGPU requires a browser or Node.js with wgpu-native');
    console.log('');
    console.log('For Node.js, use: node --experimental-wasm-memory64 gpu-executor.js');
    console.log('Or use the CPU fallback: node benchmark-vm.js');
}
