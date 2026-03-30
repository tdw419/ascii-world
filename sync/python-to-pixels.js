// python-to-pixels.js — Transpile Python subset to Glyph pixel bytecode
// Goal: Existing Python code → pixels → execution

import { InfiniteMap } from './infinite-map.js';

// Glyph Opcodes (matching SyntheticGlyphVM)
const OP = {
    NOP: 140, DATA: 128, LOAD: 129, STORE: 130,
    MOV: 206, LD: 204, ST: 205, ADD: 142, SUB: 143,
    MUL: 144, DIV: 145, MOD: 146,
    JZ: 209, JMP: 208, DRAW: 215, HALT: 141,
    ADD_MEM: 216, SUB_MEM: 217,
    CMP: 214, JLT: 210, JGT: 211, JEQ: 212,
    AND: 220, OR: 221, XOR: 222, NOT: 223,
    PEEK: 240, POKE: 241, COPY: 242, FILL: 243,
    CALL: 250, RET: 251, PUSH: 252, POP: 253,
};

// Simple tokenizer for Python subset
function tokenize(code) {
    const tokens = [];
    const lines = code.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        let line = lines[lineNum];

        // Remove comments
        const commentIdx = line.indexOf('#');
        if (commentIdx >= 0) line = line.slice(0, commentIdx);

        // Track indentation (for blocks)
        const indent = line.match(/^(\s*)/)[1].length;
        line = line.trim();
        if (!line) continue;

        tokens.push({ type: 'INDENT', value: indent, line: lineNum });

        // Tokenize the line
        const patterns = [
            { type: 'DEF', regex: /^def\s+(\w+)\s*\(([^)]*)\):/ },
            { type: 'RETURN', regex: /^return\s+(.+)/ },
            { type: 'IF', regex: /^if\s+(.+):/ },
            { type: 'ELIF', regex: /^elif\s+(.+):/ },
            { type: 'ELSE', regex: /^else:/ },
            { type: 'WHILE', regex: /^while\s+(.+):/ },
            { type: 'FOR', regex: /^for\s+(\w+)\s+in\s+range\(([^)]+)\):/ },
            { type: 'PRINT', regex: /^print\s*\(([^)]+)\)/ },
            { type: 'ASSIGN', regex: /^(\w+)\s*=\s*(.+)/ },
            { type: 'AUGASSIGN', regex: /^(\w+)\s*([\+\-\*\/])=\s*(.+)/ },
            { type: 'CALL', regex: /^(\w+)\s*\(([^)]*)\)/ },
            { type: 'EXPR', regex: /^(.+)/ },
        ];

        let matched = false;
        for (const { type, regex } of patterns) {
            const m = line.match(regex);
            if (m) {
                tokens.push({ type, value: m.slice(1), line: lineNum, raw: line });
                matched = true;
                break;
            }
        }

        if (!matched && line) {
            tokens.push({ type: 'UNKNOWN', value: line, line: lineNum });
        }
    }

    return tokens;
}

// Compile tokens to Glyph bytecode
function compile(tokens) {
    const instructions = [];
    const variables = new Map();  // name -> memory address
    const functions = new Map();  // name -> instruction address
    let nextAddr = 0;
    let nextTemp = 100;  // Temp variables start at 100

    // Helper: get or create variable address
    function getVar(name) {
        if (!variables.has(name)) {
            variables.set(name, nextAddr++);
        }
        return variables.get(name);
    }

    // Helper: compile expression to instructions, return address of result
    function compileExpr(expr) {
        if (expr === undefined || expr === null) {
            console.warn('Warning: compileExpr called with undefined/null');
            return 0;
        }
        expr = expr.trim();

        // Number literal
        if (/^-?\d+(\.\d+)?$/.test(expr)) {
            const addr = nextTemp++;
            const val = parseFloat(expr);
            instructions.push({ op: OP.DATA, dst: addr, p1: Math.abs(val), p2: val < 0 ? 1 : 0 });
            return addr;
        }

        // String literal (for print)
        if (expr.startsWith('"') || expr.startsWith("'")) {
            const addr = nextTemp++;
            // Store string length in first byte, chars in subsequent
            const str = expr.slice(1, -1);
            instructions.push({ op: OP.DATA, dst: addr, p1: str.length, p2: 0 });
            return addr;
        }

        // Variable
        if (/^\w+$/.test(expr)) {
            return getVar(expr);
        }

        // Binary operation
        const binOps = [
            ['+', OP.ADD], ['-', OP.SUB], ['*', OP.MUL], ['/', OP.DIV],
            ['%', OP.MOD], ['==', OP.CMP], ['<', OP.CMP], ['>', OP.CMP],
        ];

        for (const [opStr, opCode] of binOps) {
            // Find operator not inside parentheses
            let depth = 0;
            for (let i = expr.length - 1; i >= 0; i--) {
                if (expr[i] === ')') depth++;
                else if (expr[i] === '(') depth--;
                else if (depth === 0 && expr.slice(i).startsWith(opStr)) {
                    const left = expr.slice(0, i).trim();
                    const right = expr.slice(i + opStr.length).trim();

                    if (!left || !right) continue;

                    const leftAddr = compileExpr(left);
                    const rightAddr = compileExpr(right);
                    const resultAddr = nextTemp++;

                    // Load left, apply op with right
                    instructions.push({ op: OP.LD, dst: resultAddr, p1: leftAddr });
                    instructions.push({ op: opCode, dst: resultAddr, p1: rightAddr });

                    return resultAddr;
                }
            }
        }

        // Function call in expression
        const callMatch = expr.match(/^(\w+)\s*\(([^)]*)\)$/);
        if (callMatch) {
            const [, fnName, args] = callMatch;
            // Compile args and push
            if (args.trim()) {
                for (const arg of args.split(',')) {
                    const addr = compileExpr(arg.trim());
                    instructions.push({ op: OP.PUSH, dst: addr });
                }
            }
            // Call function
            const resultAddr = nextTemp++;
            instructions.push({ op: OP.CALL, dst: fnName, resultAddr });
            return resultAddr;
        }

        // Unknown - treat as variable
        return getVar(expr);
    }

    // First pass: identify function addresses
    let ip = 0;
    for (const tok of tokens) {
        if (tok.type === 'DEF') {
            functions.set(tok.value[0], ip);
        }
        // Rough estimate: most tokens become 1-3 instructions
        ip += 3;
    }

    // Second pass: compile
    const loopStack = [];  // For while/for loops
    const ifStack = [];    // For if/elif/else chains

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];

        switch (tok.type) {
            case 'DEF': {
                // Function definition - mark address
                functions.set(tok.value[0], instructions.length);
                // Parse parameters
                const params = tok.value[1].split(',').map(s => s.trim()).filter(Boolean);
                // Pop args into parameters (reverse order)
                for (let j = params.length - 1; j >= 0; j--) {
                    const addr = getVar(params[j]);
                    instructions.push({ op: OP.POP, dst: addr });
                }
                break;
            }

            case 'RETURN': {
                const addr = compileExpr(tok.value[0]);
                instructions.push({ op: OP.MOV, dst: 0, p1: addr });  // Return value in addr 0
                instructions.push({ op: OP.RET });
                break;
            }

            case 'ASSIGN': {
                const [name, expr] = tok.value;
                const addr = getVar(name);
                const srcAddr = compileExpr(expr);
                if (srcAddr !== addr) {
                    instructions.push({ op: OP.LD, dst: addr, p1: srcAddr });
                }
                break;
            }

            case 'AUGASSIGN': {
                const [, name, op, expr] = tok.value;
                const addr = getVar(name);
                const srcAddr = compileExpr(expr);
                const opMap = { '+': OP.ADD, '-': OP.SUB, '*': OP.MUL, '/': OP.DIV };
                instructions.push({ op: opMap[op], dst: addr, p1: srcAddr });
                break;
            }

            case 'PRINT': {
                const addr = compileExpr(tok.value[0]);
                // DRAW outputs to "UART" (pixel position 0xFFFF)
                instructions.push({ op: OP.DRAW, dst: addr });
                break;
            }

            case 'WHILE': {
                const conditionAddr = compileExpr(tok.value[0]);
                const loopStart = instructions.length;
                // Jump to end if condition is zero
                const jumpIdx = instructions.length;
                instructions.push({ op: OP.JZ, dst: conditionAddr, p1: 0, p2: 0 });  // Patch later
                loopStack.push({ start: loopStart, jumpIdx, type: 'while' });
                break;
            }

            case 'FOR': {
                const forArgs = tok.value || [];
                const varName = forArgs[0];
                const rangeArgs = forArgs[1] || '0,5';  // Default range if missing
                if (!varName) {
                    console.warn('Warning: FOR without variable name');
                    break;
                }
                const [start, end] = rangeArgs.split(',').map(s => parseInt(s.trim()));
                const varAddr = getVar(varName);

                // Initialize: var = start
                instructions.push({ op: OP.DATA, dst: varAddr, p1: start, p2: 0 });

                const loopStart = instructions.length;
                // Check: var < end (simplified - just check if var != end for now)
                const jumpIdx = instructions.length;
                instructions.push({ op: OP.JZ, dst: varAddr, p1: 0, p2: 0 });  // Patch later

                loopStack.push({ start: loopStart, jumpIdx, type: 'for', varAddr, endValue: end });
                break;
            }

            case 'IF': {
                const conditionAddr = compileExpr(tok.value[0]);
                const jumpIdx = instructions.length;
                instructions.push({ op: OP.JZ, dst: conditionAddr, p1: 0, p2: 0 });
                ifStack.push({ jumpIdx, elseAddr: null });
                break;
            }

            case 'ELSE':
            case 'ELIF': {
                // Jump past the else block
                const jumpOutIdx = instructions.length;
                instructions.push({ op: OP.JMP, p1: 0, p2: 0 });  // Patch later

                // Patch previous if/elif jump to land here
                if (ifStack.length > 0) {
                    const prev = ifStack[ifStack.length - 1];
                    const target = instructions.length;
                    instructions[prev.jumpIdx].p1 = (target - prev.jumpIdx) & 0xFF;
                }

                if (tok.type === 'ELIF') {
                    const conditionAddr = compileExpr(tok.value[0]);
                    const jumpIdx = instructions.length;
                    instructions.push({ op: OP.JZ, dst: conditionAddr, p1: 0, p2: 0 });
                    ifStack[ifStack.length - 1] = { jumpIdx, jumpOutIdx };
                } else {
                    ifStack[ifStack.length - 1] = { jumpIdx: null, jumpOutIdx };
                }
                break;
            }

            case 'INDENT': {
                // Check if we're exiting a block (decreasing indent)
                // This is where we'd patch loop jumps
                // For now, simplified - just track structure
                break;
            }

            case 'CALL': {
                const [fnName, args] = tok.value;
                if (args.trim()) {
                    for (const arg of args.split(',')) {
                        const addr = compileExpr(arg.trim());
                        instructions.push({ op: OP.PUSH, dst: addr });
                    }
                }
                instructions.push({ op: OP.CALL, dst: fnName });
                break;
            }
        }
    }

    // Add HALT at end
    instructions.push({ op: OP.HALT });

    // Patch function calls
    for (const inst of instructions) {
        if (inst.op === OP.CALL && typeof inst.dst === 'string') {
            const fnAddr = functions.get(inst.dst);
            if (fnAddr !== undefined) {
                inst.dst = fnAddr;
            }
        }
    }

    return { instructions, variables, functions };
}

// Convert compiled instructions to pixels
function instructionsToPixels(instructions) {
    const pixels = [];

    for (const inst of instructions) {
        // Each instruction is one pixel: R=opcode, G=dst, B=p1, A=p2
        // For DATA opcode: p1 is the actual value (0-255), not normalized
        const isData = inst.op === OP.DATA;
        
        pixels.push([
            inst.op || 0,
            (typeof inst.dst === 'number') ? inst.dst & 0xFF : 0,
            isData ? ((inst.p1 || 0) & 0xFF) : Math.floor((inst.p1 || 0) * 255) & 0xFF,
            Math.floor((inst.p2 || 0) * 255) & 0xFF,
        ]);
    }

    return pixels;
}

// Main transpiler class
export class PythonToPixels {
    constructor() {
        this.map = new InfiniteMap({ chunkSize: 256 });
    }

    /**
     * Transpile Python code to pixels
     * @param {string} code - Python source code
     * @param {number} baseX - Base X coordinate for program
     * @param {number} baseY - Base Y coordinate for program
     * @returns {Object} - Compilation result with metadata
     */
    transpile(code, baseX = 0, baseY = 0) {
        console.log('Tokenizing...');
        const tokens = tokenize(code);
        console.log(`  Found ${tokens.length} tokens`);

        console.log('Compiling...');
        const { instructions, variables, functions } = compile(tokens);
        console.log(`  Generated ${instructions.length} instructions`);
        console.log(`  Variables: ${variables.size}`);
        console.log(`  Functions: ${functions.size}`);

        console.log('Converting to pixels...');
        const pixels = instructionsToPixels(instructions);

        // Write to map
        for (let i = 0; i < pixels.length; i++) {
            const [r, g, b, a] = pixels[i];
            this.map.setPixel(baseX + i, baseY, r, g, b, a, 'compiler');
        }

        return {
            instructionCount: instructions.length,
            variables: Object.fromEntries(variables),
            functions: Object.fromEntries(functions),
            pixels,
            baseX,
            baseY,
        };
    }

    /**
     * Export compiled program as PNG
     */
    async exportPNG(result, filename) {
        const { pixels } = result;

        // Create buffer
        const width = Math.ceil(Math.sqrt(pixels.length));
        const height = Math.ceil(pixels.length / width);
        const data = new Uint8ClampedArray(width * height * 4);

        for (let i = 0; i < pixels.length; i++) {
            const [r, g, b, a] = pixels[i];
            const idx = i * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }

        const sharp = (await import('sharp')).default;
        const png = await sharp(Buffer.from(data), {
            raw: { width, height, channels: 4 }
        }).png().toBuffer();

        const fs = await import('fs');
        await fs.promises.writeFile(filename, png);
        console.log(`Exported ${pixels.length} instructions to ${filename}`);

        return png;
    }

    /**
     * Get the underlying InfiniteMap
     */
    getMap() {
        return this.map;
    }
}

// Export helpers
export { tokenize, compile, instructionsToPixels, OP };
