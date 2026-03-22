// sync/synthetic-glyph-vm.js
// CPU-side emulator of the Glyph VM (matching glyph_microcode.wgsl)
// Enables "pixels move pixels" execution without GPU

// Opcode definitions matching WGSL shader exactly
const OP = {
    NOP: 140, DATA: 128, LOAD: 129, STORE: 130,
    MOV: 206, LD: 204, ST: 205, ADD: 142, SUB: 143,
    JZ: 209, JMP: 208, DRAW: 215, HALT: 141,
    ADD_MEM: 216, SUB_MEM: 217, INT_DISPATCH: 218,
    AND: 220, OR: 221, XOR: 222, NOT: 223,
    SHL: 224, SHR: 225, SAR: 226,
    AND_MEM: 227, OR_MEM: 228, XOR_MEM: 229,
    SHL_MEM: 230, SHR_MEM: 231, SPATIAL_SPAWN: 232
    // AutoResearch: added opcode
    OP_NOP2: 199, // Experimental nop variant
};

// Cached opcode name lookup (optimization)
const OP_NAMES = new Map();
for (const [k, v] of Object.entries(OP)) OP_NAMES[v] = k;

/**
 * A single Glyph instruction (matches WGSL struct)
 */
class Glyph {
    constructor(opcode = 0, stratum = 0, p1 = 0, p2 = 0, dst = 0) {
        this.opcode = opcode;
        this.stratum = stratum;
        this.p1 = p1;
        this.p2 = p2;
        this.dst = dst;
    }

    static fromRGBA(r, g, b, a) {
        return new Glyph(r, g, b / 255, a / 255, 0);
    }
}

/**
 * VM State (matches WGSL VMState)
 */
class VMState {
    constructor() {
        this.pc = 0;
        this.sp = 0;
        this.flags = 0;
        this.halted = false;
        this.cycles = 0;
        // AutoResearch: added method
        this.opCount = 0; // Operation counter
    }
}

/**
 * SyntheticGlyphVM - CPU emulator matching WGSL shader behavior
 */
export class SyntheticGlyphVM {
    constructor(options = {}) {
        this.maxCycles = options.maxCycles || 1000000;
        this.memorySize = options.memorySize || 65536; // 64K words
        this.programSize = options.programSize || 80 * 24; // 1920 glyphs

        // Memory (f32 array matching WGSL)
        this.memory = new Float32Array(this.memorySize);
        this.program = new Array(this.programSize).fill(null).map(() => new Glyph());
        this.stack = new Float32Array(64); // Call stack

        // VM state
        this.state = new VMState();

        // Input state (for INT_DISPATCH)
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseBtn = 0;

        // State buffer (320 slots at address 0x1000)
        this.stateBaseAddress = 0x1000;
        this.stateSlotCount = 320;

        // Event listeners
        this.listeners = new Set();
    }

    /**
     * Load a program (array of Glyphs) into memory
     */
    loadProgram(glyphs, baseAddress = 0) {
        for (let i = 0; i < glyphs.length && i < this.programSize; i++) {
            if (baseAddress + i < this.programSize) {
                this.program[baseAddress + i] = glyphs[i];
            }
        }
        this.state.pc = baseAddress;
        this.state.halted = false;
        this.state.cycles = 0;
    }

    /**
     * Load program from SIT (Spatial Instruction Table) pixel data
     * Each pixel: R=opcode, G=target, B=flags, A=unused
     */
    loadFromSIT(imageData, width = 80, height = 24) {
        const glyphs = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = imageData[idx];     // opcode
                const g = imageData[idx + 1]; // target
                const b = imageData[idx + 2]; // flags/p1
                const a = imageData[idx + 3]; // unused

                // Map to WGSL Glyph format
                glyphs.push(new Glyph(
                    r,           // opcode
                    0,           // stratum
                    b / 255,     // p1 (flags as float)
                    0,           // p2
                    g            // dst (target)
                ));
            }
        }

        this.loadProgram(glyphs);
        return glyphs;
    }

    /**
     * Get state value
     */
    getState(slot) {
        if (slot < 0 || slot >= this.stateSlotCount) return 0;
        return this.memory[this.stateBaseAddress + slot];
    }

    /**
     * Set state value
     */
    setState(slot, value) {
        if (slot < 0 || slot >= this.stateSlotCount) return;
        const oldVal = this.memory[this.stateBaseAddress + slot];
        this.memory[this.stateBaseAddress + slot] = value;

        if (oldVal !== value) {
            this.notifyListeners({
                type: 'state_change',
                slot,
                oldValue: oldVal,
                newValue: value
            });
        }
    }

    /**
     * Execute a single opcode (matching WGSL switch statement)
     */
    executeSingle() {
        if (this.state.halted || this.state.cycles >= this.maxCycles) {
            return { halted: true };
        }

        // FETCH
        const inst = this.program[this.state.pc];
        if (!inst) {
            this.state.halted = true;
            return { halted: true, error: 'Invalid PC' };
        }

        this.state.cycles++;

        // DECODE & EXECUTE (matching WGSL shader)
        switch (inst.opcode) {
            case OP.DATA:
                this.memory[inst.dst] = inst.p1;
                this.state.pc++;
                break;

            case OP.MOV:
                this.memory[inst.dst] = this.memory[Math.floor(inst.p1)];
                this.state.pc++;
                break;

            case OP.LOAD:
                this.memory[inst.dst] = this.memory[Math.floor(inst.p1)];
                this.state.pc++;
                break;

            case OP.STORE:
                this.memory[Math.floor(inst.p1)] = this.memory[inst.dst];
                this.state.pc++;
                break;

            case OP.ADD:
                this.memory[inst.dst] = this.memory[inst.dst] + inst.p1;
                this.state.pc++;
                break;

            case OP.SUB:
                this.memory[inst.dst] = this.memory[inst.dst] - inst.p1;
                this.state.pc++;
                break;

            case OP.LD: // Load immediate
                this.memory[inst.dst] = inst.p1;
                this.state.pc++;
                break;

            case OP.ST: // Store memory[dst] into memory[p1]
                this.memory[Math.floor(inst.p1)] = this.memory[inst.dst];
                this.state.pc++;
                break;

            case OP.ADD_MEM:
                this.memory[inst.dst] = this.memory[inst.dst] + this.memory[Math.floor(inst.p1)];
                this.state.pc++;
                break;

            case OP.SUB_MEM:
                this.memory[inst.dst] = this.memory[inst.dst] - this.memory[Math.floor(inst.p1)];
                this.state.pc++;
                break;

            case OP.INT_DISPATCH: {
                // Hit-test mouse against region
                const hitTableAddr = Math.floor(inst.p1);
                const rectX = this.memory[hitTableAddr];
                const rectY = this.memory[hitTableAddr + 1];
                const rectW = this.memory[hitTableAddr + 2];
                const rectH = this.memory[hitTableAddr + 3];

                const inRect = this.mouseX >= rectX &&
                              this.mouseX < rectX + rectW &&
                              this.mouseY >= rectY &&
                              this.mouseY < rectY + rectH;

                this.memory[inst.dst] = (inRect && this.mouseBtn > 0) ? 1.0 : 0.0;
                this.state.pc++;
                break;
            }

            // Bitwise operations (using bitcast for float-as-int)
            case OP.AND: {
                const val = floatToU32(this.memory[inst.dst]);
                const imm = Math.floor(inst.p1);
                this.memory[inst.dst] = u32ToFloat(val & imm);
                this.state.pc++;
                break;
            }
            case OP.OR: {
                const val = floatToU32(this.memory[inst.dst]);
                const imm = Math.floor(inst.p1);
                this.memory[inst.dst] = u32ToFloat(val | imm);
                this.state.pc++;
                break;
            }
            case OP.XOR: {
                const val = floatToU32(this.memory[inst.dst]);
                const imm = Math.floor(inst.p1);
                this.memory[inst.dst] = u32ToFloat(val ^ imm);
                this.state.pc++;
                break;
            }
            case OP.NOT: {
                const val = floatToU32(this.memory[inst.dst]);
                this.memory[inst.dst] = u32ToFloat(~val);
                this.state.pc++;
                break;
            }
            case OP.SHL: {
                const val = floatToU32(this.memory[inst.dst]);
                const shift = Math.floor(inst.p1) & 31;
                this.memory[inst.dst] = u32ToFloat(val << shift);
                this.state.pc++;
                break;
            }
            case OP.SHR: {
                const val = floatToU32(this.memory[inst.dst]);
                const shift = Math.floor(inst.p1) & 31;
                this.memory[inst.dst] = u32ToFloat(val >>> shift);
                this.state.pc++;
                break;
            }

            case OP.JMP:
                this.state.pc = Math.floor(inst.p1);
                break;

            case OP.JZ:
                if (this.memory[inst.dst] === 0.0) {
                    this.state.pc = Math.floor(inst.p1);
                } else {
                    this.state.pc++;
                }
                break;

            case OP.DRAW: {
                // Simplified draw - would integrate with rendering
                const glyphId = Math.floor(inst.p1);
                const x = this.memory[inst.dst];
                const y = this.memory[inst.dst + 1];
                this.notifyListeners({
                    type: 'draw',
                    glyphId,
                    x,
                    y
                });
                this.state.pc++;
                break;
            }

            case OP.HALT:
                this.state.halted = true;
                break;

            case OP.NOP:
            default:
                this.state.pc++;
                break;
        }

        return {
            halted: this.state.halted,
            pc: this.state.pc,
            cycles: this.state.cycles,
            opcode: inst.opcode,
            opcodeName: OP_NAMES[inst.opcode] || 'UNKNOWN'
        };
    }

    /**
     * Execute up to N cycles
     */
    executeFrame(maxCycles = 1024) {
        const results = [];
        let count = 0;

        while (!this.state.halted && count < maxCycles) {
            results.push(this.executeSingle());
            count++;
        }

        return results;
    }

    /**
     * Reset VM state
     */
    reset() {
        this.state = new VMState();
        this.memory.fill(0);
    }

    /**
     * Set mouse position (for INT_DISPATCH)
     */
    setMouse(x, y, btn = 0) {
        this.mouseX = x;
        this.mouseY = y;
        this.mouseBtn = btn;
    }

    /**
     * Subscribe to events
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyListeners(event) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    /**
     * Get all non-zero state values
     */
    getAllState() {
        const result = {};
        for (let i = 0; i < this.stateSlotCount; i++) {
            const val = this.getState(i);
            if (val !== 0) result[i] = val;
        }
        return result;
    }

    /**
     * Quick execute a UI opcode (for cartridge clicks)
     * Maps UI opcodes to internal execution
     */
    executeUIOpcode(opcode, target, flags = 0) {
        // Map common UI opcodes
        let gpuOpcode = opcode;
        let result = { executed: 'UNKNOWN', opcode };

        switch (opcode) {
            case 3: // TOGGLE
                const cur = this.getState(target);
                this.setState(target, cur > 0 ? 0 : 255);
                result = { executed: 'TOGGLE', result: this.getState(target) };
                break;

            case 6: // SET
                this.setState(target, 255);
                result = { executed: 'SET' };
                break;

            case 7: // CLEAR
                this.setState(target, 0);
                result = { executed: 'CLEAR' };
                break;

            case 8: // INC
                const curInc = this.getState(target);
                this.setState(target, Math.min(curInc + 1, 255));
                result = { executed: 'INC', result: this.getState(target) };
                break;

            case 9: // DEC
                const curDec = this.getState(target);
                this.setState(target, Math.max(curDec - 1, 0));
                result = { executed: 'DEC', result: this.getState(target) };
                break;

            case 204: // LDI
                this.setState(target, flags);
                result = { executed: 'LDI', value: flags };
                break;

            default:
                // Try as GPU opcode
                const glyph = new Glyph(opcode, 0, flags, 0, target);
                this.program[this.state.pc] = glyph;
                this.executeSingle();
                result = { executed: OP_NAMES[opcode] || 'GPU_OPCODE', opcode };
                break;
        }

        return result;
    }
}

// Helper functions for float/int bitcasting
function floatToU32(f) {
    const buf = new ArrayBuffer(4);
    const f32 = new Float32Array(buf);
    const u32 = new Uint32Array(buf);
    f32[0] = f;
    return u32[0];
}

function u32ToFloat(u) {
    const buf = new ArrayBuffer(4);
    const f32 = new Float32Array(buf);
    const u32 = new Uint32Array(buf);
    u32[0] = u;
    return f32[0];
}

// Export for external use
export { OP, OP_NAMES, Glyph, VMState };
