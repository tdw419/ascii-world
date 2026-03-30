// pixel-vm.js — VM that reads from and writes to an InfiniteMap
// "Pixels move pixels" — the feedback loop

import { InfiniteMap } from './infinite-map.js';
import { Glyph } from './synthetic-glyph-vm.js';
import { GlyphAtlas } from './glyph-atlas.js';
import { PixelBuffer } from './pixel-buffer.js';

// Opcode definitions (matching SyntheticGlyphVM)
const OP = {
    NOP: 140, DATA: 128, LOAD: 129, STORE: 130,
    MOV: 206, LD: 204, ST: 205, ADD: 142, SUB: 143,
    JZ: 209, JMP: 208, DRAW: 215, HALT: 141,
    ADD_MEM: 216, SUB_MEM: 217, INT_DISPATCH: 218,
    AND: 220, OR: 221, XOR: 222, NOT: 223,
    SHL: 224, SHR: 225, SAR: 226,
    AND_MEM: 227, OR_MEM: 228, XOR_MEM: 229,
    SHL_MEM: 230, SHR_MEM: 231, SPATIAL_SPAWN: 232,
    // Extended opcodes for pixel-to-pixel
    PEEK: 240,      // Read pixel at (mem[dst], mem[dst+1]) -> mem[dst+2]
    POKE: 241,      // Write pixel (r,g,b) at (x,y) from mem[dst..dst+4]
    COPY: 242,      // Copy region
    FILL: 243,      // Fill region with color
    MOV_IMM: 244,   // mem[dst] = (B << 8) | A — 16-bit immediate (0–65535)
    LDHI: 245,      // mem[dst] = (mem[dst] & 0xFFFF) | (((B << 8) | A) << 16) — set high 16 bits
    ADD_IMM16: 246,  // mem[dst] += (B << 8) | A — add 16-bit immediate
    MUL_IMM: 247,   // mem[dst] *= B — multiply by 8-bit immediate
};

const OP_NAMES = new Map();
for (const [k, v] of Object.entries(OP)) OP_NAMES[v] = k;

/**
 * PixelVM — Executes instructions stored in pixels, writes output to pixels
 * 
 * The core loop:
 * 1. Read pixels from InfiniteMap at instruction pointer
 * 2. Decode as opcodes
 * 3. Execute (may write new pixels back to InfiniteMap)
 * 4. Advance or jump
 * 5. Repeat
 */
export class PixelVM {
    constructor(options = {}) {
        this.map = options.map || new InfiniteMap(options.mapOptions || {});
        this.maxCycles = options.maxCycles || 100000;
        
        // Execution state
        this.ipX = options.ipX || 0;  // Instruction pointer X
        this.ipY = options.ipY || 0;  // Instruction pointer Y
        this.halted = false;
        this.cycles = 0;
        
        // General purpose memory (for LOAD/STORE)
        this.memory = new Float32Array(65536);
        
        // Stack
        this.stack = new Float32Array(256);
        this.sp = 0;
        
        // Agent ID for sovereignty tracking
        this.agentId = options.agentId || 'pixel-vm';
        
        // Viewport for rendering output
        this.viewportX = options.viewportX || 0;
        this.viewportY = options.viewportY || 0;
        this.viewportW = options.viewportW || 256;
        this.viewportH = options.viewportH || 256;
        
        // Text rendering: viewport buffer + glyph atlas
        this.viewportBuffer = new PixelBuffer(this.viewportW, this.viewportH);
        this.atlas = new GlyphAtlas(6, 10);
        this.viewportBuffer.clear(0x0a0a12); // Dark background
        
        // Text cursor for sequential print()
        this.cursorX = 0;
        this.cursorY = 0;
        
        // Event listeners
        this.listeners = new Set();
    }

    /**
     * Load program from a region of the map
     */
    loadFromRegion(x, y, w, h) {
        this.ipX = x;
        this.ipY = y;
        this.instructionW = w;
        this.instructionH = h;
        this.halted = false;
        this.cycles = 0;
    }

    /**
     * Fetch instruction at current IP
     * Returns raw bytes AND normalized floats for backward compat
     */
    fetchInstruction() {
        const pixel = this.map.getPixel(this.ipX, this.ipY);
        // R = opcode, G = dst/target, B = p1, A = p2
        return {
            opcode: pixel[0],
            dst: pixel[1],
            p1: pixel[2] / 255,
            p2: pixel[3] / 255,
            // Raw byte access for extended opcodes
            b1: pixel[2],  // B channel raw
            b2: pixel[3],  // A channel raw
        };
    }

    /**
     * Execute single instruction
     */
    step() {
        if (this.halted) return { halted: true };
        
        const inst = this.fetchInstruction();
        let jumped = false;
        let result = {
            ip: { x: this.ipX, y: this.ipY },
            opcode: inst.opcode,
            opcodeName: OP_NAMES[inst.opcode] || 'UNKNOWN',
        };
        
        switch (inst.opcode) {
            case OP.NOP:
                break;
                
            case OP.DATA:
                // Data: B channel contains raw value (0-255)
                // p1 = B/255 (normalized), so multiply back to get original
                this.memory[inst.dst] = inst.b1; // Use raw B channel value
                break;
                
            case OP.LOAD:
                // Load from memory address
                this.memory[inst.dst] = this.memory[Math.floor(inst.p1 * 65535)];
                break;
                
            case OP.STORE:
                // Store to memory address
                this.memory[Math.floor(inst.p1 * 65535)] = this.memory[inst.dst];
                break;
                
            case OP.MOV:
                // mem[dst] = p1 * 255 (store as integer for coordinates)
                this.memory[inst.dst] = Math.round(inst.p1 * 255);
                break;
                
            case OP.LD:
                // mem[dst] = mem[p1 as address]
                this.memory[inst.dst] = this.memory[Math.floor(inst.p1 * 255)];
                break;
                
            case OP.ST:
                // mem[mem[dst]] = p1
                this.memory[Math.floor(this.memory[inst.dst])] = inst.p1;
                break;
                
            case OP.ADD:
                // Add integer value (p1 * 255)
                this.memory[inst.dst] += Math.round(inst.p1 * 255);
                break;
                
            case OP.SUB:
                // Subtract integer value (p1 * 255)
                this.memory[inst.dst] -= Math.round(inst.p1 * 255);
                break;
                
            case OP.JZ:
                if (this.memory[inst.dst] === 0) {
                    // Jump to (p1 * 255, p2 * 255) relative
                    this.ipX += Math.floor(inst.p1 * 255) - 128;
                    this.ipY += Math.floor(inst.p2 * 255) - 128;
                    jumped = true;
                }
                break;
                
            case OP.JMP:
                this.ipX += Math.floor(inst.p1 * 255) - 128;
                this.ipY += Math.floor(inst.p2 * 255) - 128;
                jumped = true;
                break;
                
            case OP.DRAW: {
                // DRAW: Render value to viewport as text or grayscale pixel
                // mem[dst] = value to print (converted to string) OR grayscale color (0-255)
                // mem[dst+1] = x (relative to viewport)
                // mem[dst+2] = y (relative to viewport)
                // mem[dst+3] = color (24-bit RGB, optional, uses grayscale if 0 and value is 0-255)
                const value = this.memory[inst.dst];
                const text = String(Math.floor(value));
                
                let drawX = Math.floor(this.memory[inst.dst + 1] || 0);
                let drawY = Math.floor(this.memory[inst.dst + 2] || 0);
                let colorVal = Math.floor(this.memory[inst.dst + 3] || 0);
                
                // If x,y are 0, use cursor position
                if (drawX === 0 && drawY === 0) {
                    drawX = this.cursorX;
                    drawY = this.cursorY;
                }
                
                // Determine color: if colorVal is 0 and value is in grayscale range, use value as grayscale
                let r, g, b;
                if (colorVal === 0 && value >= 0 && value <= 255) {
                    // Grayscale mode: value is the color
                    r = g = b = Math.floor(value);
                } else {
                    // Color mode: use colorVal or default to white
                    colorVal = colorVal || 0xFFFFFF;
                    r = (colorVal >> 16) & 0xFF;
                    g = (colorVal >> 8) & 0xFF;
                    b = colorVal & 0xFF;
                }
                
                // Render text to viewport buffer
                this.atlas.drawText(this.viewportBuffer, drawX, drawY, text, [r, g, b, 255]);
                
                // Advance cursor
                this.cursorX = drawX + text.length * this.atlas.glyphW + 2;
                this.cursorY = drawY;
                
                // Write to map at viewport-relative coordinates for pixel-level visibility
                for (let i = 0; i < text.length; i++) {
                    const px = drawX + i * this.atlas.glyphW;
                    this.map.setPixel(this.viewportX + px, this.viewportY + drawY, r, g, b, 255, this.agentId);
                }
                
                this.notifyListeners({ type: 'draw', text, x: drawX, y: drawY, value });
                break;
            }
            
            // === PIXEL-TO-PIXEL OPCODES ===
            
            case OP.PEEK: {
                // Read pixel at (mem[dst], mem[dst+1]) -> mem[dst+2..dst+4]
                const x = Math.floor(this.memory[inst.dst]);
                const y = Math.floor(this.memory[inst.dst + 1]);
                const pixel = this.map.getPixel(x, y);
                this.memory[inst.dst + 2] = pixel[0]; // R
                this.memory[inst.dst + 3] = pixel[1]; // G
                this.memory[inst.dst + 4] = pixel[2]; // B
                break;
            }
            
            case OP.POKE: {
                // Write pixel at (mem[dst], mem[dst+1]) with color (mem[dst+2], mem[dst+3], mem[dst+4])
                const x = Math.floor(this.memory[inst.dst]);
                const y = Math.floor(this.memory[inst.dst + 1]);
                const r = Math.floor(this.memory[inst.dst + 2]);
                const g = Math.floor(this.memory[inst.dst + 3]);
                const b = Math.floor(this.memory[inst.dst + 4]);
                this.map.setPixel(x, y, r, g, b, 255, this.agentId);
                break;
            }
            
            case OP.FILL: {
                // Fill region: mem[dst]=x, mem[dst+1]=y, mem[dst+2]=w, mem[dst+3]=h
                // mem[dst+4]=r, mem[dst+5]=g, mem[dst+6]=b
                const x = Math.floor(this.memory[inst.dst]);
                const y = Math.floor(this.memory[inst.dst + 1]);
                const w = Math.floor(this.memory[inst.dst + 2]);
                const h = Math.floor(this.memory[inst.dst + 3]);
                const r = Math.floor(this.memory[inst.dst + 4]);
                const g = Math.floor(this.memory[inst.dst + 5]);
                const b = Math.floor(this.memory[inst.dst + 6]);
                
                for (let dy = 0; dy < h; dy++) {
                    for (let dx = 0; dx < w; dx++) {
                        this.map.setPixel(x + dx, y + dy, r, g, b, 255, this.agentId);
                    }
                }
                break;
            }
            
            // === EXTENDED VALUE OPCODES ===
            
            case OP.MOV_IMM: {
                // 16-bit immediate: mem[dst] = (b2 << 8) | b1
                this.memory[inst.dst] = (inst.b2 << 8) | inst.b1;
                break;
            }
            
            case OP.LDHI: {
                // Set high 16 bits: mem[dst] = (mem[dst] & 0xFFFF) | (((b2 << 8) | b1) << 16)
                const lo = this.memory[inst.dst] & 0xFFFF;
                const hi = ((inst.b2 << 8) | inst.b1) << 16;
                this.memory[inst.dst] = lo | hi;
                break;
            }
            
            case OP.ADD_IMM16: {
                // Add 16-bit immediate: mem[dst] += (b2 << 8) | b1
                this.memory[inst.dst] += (inst.b2 << 8) | inst.b1;
                break;
            }
            
            case OP.MUL_IMM: {
                // Multiply by 8-bit immediate: mem[dst] *= b1
                this.memory[inst.dst] *= inst.b1;
                break;
            }
            
            case OP.HALT:
                this.halted = true;
                result.halted = true;
                break;
                
            default:
                // Unknown opcode - skip
                break;
        }
        
        // Advance instruction pointer (unless jumped)
        if (!jumped && !this.halted) {
            this.ipX++;
            if (this.ipX >= this.ipX + (this.instructionW || 80)) {
                this.ipX = this.ipX; // Reset to start of row
                this.ipY++;
            }
        }
        
        this.cycles++;
        return result;
    }

    /**
     * Run until halt or max cycles
     */
    run(maxCycles = this.maxCycles) {
        const trace = [];
        let count = 0;
        
        while (!this.halted && count < maxCycles) {
            trace.push(this.step());
            count++;
        }
        
        return {
            halted: this.halted,
            cycles: this.cycles,
            trace: trace.slice(-100), // Last 100 instructions
            finalIP: { x: this.ipX, y: this.ipY }
        };
    }

    /**
     * Reset VM state
     */
    reset() {
        this.ipX = 0;
        this.ipY = 0;
        this.halted = false;
        this.cycles = 0;
        this.sp = 0;
        this.memory.fill(0);
        this.cursorX = 0;
        this.cursorY = 0;
        this.viewportBuffer.clear(0x0a0a12);
    }

    /**
     * Subscribe to events
     */
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    notifyListeners(event) {
        for (const fn of this.listeners) {
            try { fn(event); } catch (e) { /* ignore */ }
        }
    }

    /**
     * Get current viewport as PNG
     * Composites: map region (background) + viewport buffer (text/graphics)
     */
    async viewportToPNG() {
        // Start with map region as background
        const region = this.map.getRegion(
            this.viewportX, this.viewportY,
            this.viewportW, this.viewportH
        );
        
        // Composite viewport buffer on top (simple alpha blend)
        for (let y = 0; y < this.viewportH; y++) {
            for (let x = 0; x < this.viewportW; x++) {
                const bufPixel = this.viewportBuffer.getPixel(x, y);
                // If viewport buffer has non-background pixel, blend it
                if (bufPixel[0] !== 0x0a || bufPixel[1] !== 0x0a || bufPixel[2] !== 0x12) {
                    const idx = (y * this.viewportW + x) * 4;
                    region[idx] = bufPixel[0];
                    region[idx + 1] = bufPixel[1];
                    region[idx + 2] = bufPixel[2];
                    region[idx + 3] = bufPixel[3];
                }
            }
        }
        
        const sharp = (await import('sharp')).default;
        return sharp(Buffer.from(region), {
            raw: { width: this.viewportW, height: this.viewportH, channels: 4 }
        }).png().toBuffer();
    }

    /**
     * Inject a program directly into the map
     */
    injectProgram(x, y, program) {
        // program = array of { opcode, dst, p1, p2 }
        for (let i = 0; i < program.length; i++) {
            const inst = program[i];
            this.map.setPixel(
                x + i, y,
                inst.opcode || 0,
                inst.dst || 0,
                Math.floor((inst.p1 || 0) * 255),
                Math.floor((inst.p2 || 0) * 255),
                this.agentId
            );
        }
    }
}

export { OP, OP_NAMES };
