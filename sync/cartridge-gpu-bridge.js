// sync/cartridge-gpu-bridge.js
// Bridge between pxOS CartridgeStore and Geometry OS GPU execution
// Enables "pixels move pixels" - cartridge opcodes execute on GPU via WGSL

import http from 'http';
import { readFileSync } from 'fs';

// Opcode definitions matching glyph_microcode.wgsl
const GPU_OPCODES = {
    NOP: 140, DATA: 128, LOAD: 129, STORE: 130,
    MOV: 206, LD: 204, ST: 205, ADD: 142, SUB: 143,
    JZ: 209, JMP: 208, DRAW: 215, HALT: 141,
    ADD_MEM: 216, SUB_MEM: 217, INT_DISPATCH: 218,
    AND: 220, OR: 221, XOR: 222, NOT: 223,
    SHL: 224, SHR: 225, SAR: 226,
    AND_MEM: 227, OR_MEM: 228, XOR_MEM: 229,
    SHL_MEM: 230, SHR_MEM: 231, SPATIAL_SPAWN: 232
};

// Map UI opcodes to GPU opcodes
const UI_TO_GPU_OPCODE = {
    0: GPU_OPCODES.NOP,      // NOP
    3: GPU_OPCODES.LD,       // TOGGLE -> LD (load)
    6: GPU_OPCODES.ST,       // SET -> ST
    7: GPU_OPCODES.ST,       // CLEAR -> ST
    8: GPU_OPCODES.ADD,      // INC -> ADD
    9: GPU_OPCODES.SUB,      // DEC -> SUB
    204: GPU_OPCODES.LD,     // LDI -> LD
    206: GPU_OPCODES.MOV,    // MOV
    209: GPU_OPCODES.JMP,    // JMP
    214: GPU_OPCODES.NOP,    // CMP (not in WGSL yet)
    215: GPU_OPCODES.DRAW,   // DRAW
};

export class CartridgeGpuBridge {
    constructor(cartridgeStore, geometryOsUrl = 'http://localhost:8769') {
        this.cartridgeStore = cartridgeStore;
        this.geometryOsUrl = new URL(geometryOsUrl);
        this.activeProgram = null;
        this.baseAddress = 0x8000; // Cartridges load into guest RAM
        this.stateBaseAddress = 0x1000; // State buffer in MMIO space
    }

    /**
     * Upload a cartridge to Geometry OS for GPU execution
     * Converts the SIT (Spatial Instruction Table) to WGSL Glyph format
     */
    async uploadCartridge(name) {
        const cart = this.cartridgeStore.get(name);
        if (!cart) {
            throw new Error(`Cartridge not found: ${name}`);
        }

        // Parse the cartridge PNG to extract SIT
        const sit = await this.extractSIT(cart.buffer);

        // Convert SIT to WGSL Glyph array format
        const glyphs = this.sitToGlyphs(sit);

        // Upload to Geometry OS
        const payload = {
            type: 'load_program',
            base_address: this.baseAddress,
            glyphs: glyphs,
            metadata: {
                name: cart.name,
                width: 80,
                height: 24,
                state_slots: 320
            }
        };

        const result = await this.sendToGeometryOS('/api/program/load', payload);

        if (result.success) {
            this.activeProgram = {
                name,
                baseAddress: this.baseAddress,
                glyphCount: glyphs.length
            };
            console.log(`[GPU-BRIDGE] Uploaded ${name}: ${glyphs.length} glyphs to GPU`);
        }

        return result;
    }

    /**
     * Extract the Spatial Instruction Table from a cartridge PNG
     * The SIT is at y=24 in the 80x54 PNG format
     */
    async extractSIT(buffer) {
        // In browser, we'd use canvas/ImageData
        // In Node.js, we need to parse PNG manually
        // For now, return the raw buffer - actual parsing happens in browser
        return {
            buffer,
            width: 80,
            height: 24,
            offsetY: 24 // SIT starts at y=24
        };
    }

    /**
     * Convert SIT pixels to WGSL Glyph structs
     * Glyph format: { opcode: u32, stratum: u32, p1: f32, p2: f32, dst: u32 }
     */
    sitToGlyphs(sit) {
        const glyphs = [];

        // Each pixel in the SIT is: R=opcode, G=target, B=flags, A=unused
        // We map to WGSL Glyph: opcode, stratum, p1 (param1), p2 (param2), dst (destination)

        // For now, create placeholder glyphs
        // Full implementation would parse PNG and convert each pixel
        for (let i = 0; i < sit.width * sit.height; i++) {
            glyphs.push({
                opcode: GPU_OPCODES.NOP,
                stratum: 0,
                p1: 0.0,
                p2: 0.0,
                dst: 0
            });
        }

        return glyphs;
    }

    /**
     * Execute an opcode on the GPU
     * This sends a click event to Geometry OS for GPU-side execution
     */
    async executeOnGPU(opcode, target, flags = 0) {
        if (!this.activeProgram) {
            throw new Error('No cartridge loaded on GPU');
        }

        // Map UI opcode to GPU opcode
        const gpuOpcode = UI_TO_GPU_OPCODE[opcode] || GPU_OPCODES.NOP;

        const payload = {
            type: 'execute_glyph',
            program_address: this.activeProgram.baseAddress,
            opcode: gpuOpcode,
            target: target,
            flags: flags
        };

        return this.sendToGeometryOS('/api/gpu/execute', payload);
    }

    /**
     * Read state from GPU memory
     * Returns the current state buffer values
     */
    async readGPUState() {
        const result = await this.sendToGeometryOS('/api/memory/read', {
            base_address: this.stateBaseAddress,
            length: 320 // 320 state slots
        });

        return result.data || {};
    }

    /**
     * Write state to GPU memory
     * Used for initial state setup or external updates
     */
    async writeGPUState(slot, value) {
        return this.sendToGeometryOS('/api/memory/write', {
            address: this.stateBaseAddress + slot,
            value: value
        });
    }

    /**
     * Spawn a VM on the GPU to execute the loaded cartridge
     */
    async spawnGPUVM(entryPoint = 0) {
        if (!this.activeProgram) {
            throw new Error('No cartridge loaded on GPU');
        }

        const payload = {
            type: 'spawn_vm',
            entry_point: this.activeProgram.baseAddress + entryPoint,
            base_addr: this.activeProgram.baseAddress,
            bound_addr: this.activeProgram.baseAddress + (80 * 24) // Program size
        };

        return this.sendToGeometryOS('/api/vm/spawn', payload);
    }

    /**
     * Halt the GPU VM
     */
    async haltGPUVM(vmId = 0) {
        return this.sendToGeometryOS('/api/vm/halt', { vm_id: vmId });
    }

    /**
     * Get GPU VM status
     */
    async getGPUVMStatus(vmId = 0) {
        return this.sendToGeometryOS('/api/vm/status', { vm_id: vmId });
    }

    /**
     * Handle a click event by executing on GPU
     * This is the main entry point for "pixels move pixels" execution
     */
    async handleClick(x, y) {
        if (!this.activeProgram) {
            // Fall back to JS execution if no GPU program loaded
            return { executed: false, reason: 'No GPU program loaded' };
        }

        // Calculate SIT index from click coordinates
        const sitIndex = y * 80 + x;

        // Read the opcode from GPU memory
        const glyphResult = await this.sendToGeometryOS('/api/memory/read_glyph', {
            address: this.activeProgram.baseAddress + sitIndex
        });

        if (!glyphResult.glyph) {
            return { executed: false, reason: 'No glyph at coordinates' };
        }

        const { opcode, stratum, p1, p2, dst } = glyphResult.glyph;

        // Execute the glyph on GPU
        const execResult = await this.executeOnGPU(opcode, dst, p1);

        return {
            executed: true,
            glyph: { opcode, stratum, p1, p2, dst },
            result: execResult
        };
    }

    /**
     * Send a request to Geometry OS daemon
     */
    async sendToGeometryOS(endpoint, payload) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.geometryOsUrl);

            const body = JSON.stringify(payload);

            const req = http.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                },
                timeout: 5000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ success: false, error: 'Invalid JSON response' });
                    }
                });
            });

            req.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });

            req.write(body);
            req.end();
        });
    }

    /**
     * Check if Geometry OS is available for GPU execution
     */
    async isAvailable() {
        try {
            const result = await this.sendToGeometryOS('/status', {});
            return result.status === 'running';
        } catch {
            return false;
        }
    }

    /**
     * Get GPU capabilities
     */
    async getCapabilities() {
        const result = await this.sendToGeometryOS('/api/capabilities', {});
        return result.capabilities || {
            max_vms: 8,
            memory_size: 4096 * 4096,
            compute_shaders: true
        };
    }
}

// Export opcode constants for external use
export { GPU_OPCODES, UI_TO_GPU_OPCODE };
