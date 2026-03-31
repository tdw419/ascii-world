// src/renderer/webgpu/SaccadeRenderer.ts
// GPU-accelerated renderer for OpenMind neural saccade paths.

export interface SaccadePath {
    start_pos: [number, number];
    control_pos: [number, number];
    end_pos: [number, number];
    intensity: number;
    similarity: number;
    layer: number;
}

export class SaccadeRenderer {
    private device: GPUDevice | null = null;
    private pipeline: GPURenderPipeline | null = null;
    private uniformBuffer: GPUBuffer | null = null;
    private pathBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private paths: SaccadePath[] = [];

    constructor(private canvas: HTMLCanvasElement) {}

    async init() {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error('WebGPU not supported');
        this.device = await adapter.requestDevice();

        const context = this.canvas.getContext('webgpu');
        if (!context) throw new Error('WebGPU context not found');

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
            device: this.device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
        });

        // Load shader
        const shaderCode = await fetch('/openmind_shimmer.wgsl').then(r => r.text());
        const shaderModule = this.device.createShaderModule({ code: shaderCode });

        // Uniform buffer: time (f32), width (f32), height (f32), effort_scale (f32)
        this.uniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
                    }
                }],
            },
            primitive: { topology: 'triangle-strip' },
        });
    }

    setPaths(paths: any[]) {
        if (!this.device) return;

        // Convert path data to Float32Array for GPU
        // SaccadePath struct: start(2), control(2), end(2), intensity(1), similarity(1), layer(1) = 9 floats
        // Rounded to 12 floats for alignment (48 bytes per path)
        const data = new Float32Array(paths.length * 12);
        paths.forEach((p, i) => {
            const offset = i * 12;
            const start = p.path[0];
            const end = p.path[p.path.length - 1];
            
            // For quadratic Bezier, we need a control point. 
            // In bridge.py we calculated it, but let's approximate or extract it.
            // Simplified: use mid-point + offset for now if not explicitly passed.
            const mx = (start.x + end.x) / 2;
            const my = (start.y + end.y) / 2;
            const cx = p.path[Math.floor(p.path.length / 2)].x;
            const cy = p.path[Math.floor(p.path.length / 2)].y;

            data[offset + 0] = start.x;
            data[offset + 1] = start.y;
            data[offset + 2] = cx;
            data[offset + 3] = cy;
            data[offset + 4] = end.x;
            data[offset + 5] = end.y;
            data[offset + 6] = p.intensity;
            data[offset + 7] = p.similarity;
            data[offset + 8] = p.layer;
            // padding 9, 10, 11
        });

        if (this.pathBuffer) this.pathBuffer.destroy();
        this.pathBuffer = this.device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.pathBuffer, 0, data);

        // Re-create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline!.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer! } },
                { binding: 1, resource: { buffer: this.pathBuffer } },
            ],
        });

        this.paths = paths;
    }

    render(time: number) {
        if (!this.device || !this.pipeline || !this.bindGroup || this.paths.length === 0) return;

        const context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        // Update uniforms
        const uniforms = new Float32Array([
            time / 1000, 
            this.canvas.width, 
            this.canvas.height, 
            1.0
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer!, 0, uniforms);

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        // Draw 4 vertices (triangle strip quad) per path instance
        passEncoder.draw(4, this.paths.length);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
