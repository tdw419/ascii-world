// python-to-pixels.test.js — Test Python subset transpilation to pixels

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PythonToPixels, tokenize, compile, OP } from '../sync/python-to-pixels.js';

describe('PythonToPixels', () => {
    it('tokenizes simple assignment', () => {
        const code = 'x = 5';
        const tokens = tokenize(code);
        assert.ok(tokens.some(t => t.type === 'ASSIGN'));
    });

    it('tokenizes print statement', () => {
        const code = 'print(x)';
        const tokens = tokenize(code);
        assert.ok(tokens.some(t => t.type === 'PRINT'));
    });

    it('tokenizes while loop', () => {
        const code = `
while x < 10:
    x = x + 1
`;
        const tokens = tokenize(code);
        assert.ok(tokens.some(t => t.type === 'WHILE'));
        assert.ok(tokens.some(t => t.type === 'ASSIGN'));
    });

    it('tokenizes function definition', () => {
        const code = `
def add(a, b):
    return a + b
`;
        const tokens = tokenize(code);
        assert.ok(tokens.some(t => t.type === 'DEF'));
        assert.ok(tokens.some(t => t.type === 'RETURN'));
    });

    it('compiles assignment to instruction', () => {
        const tokens = tokenize('x = 5');
        const { instructions } = compile(tokens);
        assert.ok(instructions.length > 0);
    });

    it('compiles print to DRAW instruction', () => {
        const tokens = tokenize('print(42)');
        const { instructions } = compile(tokens);
        // Print should generate a DRAW instruction
        assert.ok(instructions.some(i => i.op === OP.DRAW));
    });

    it('transpiles simple program to pixels', () => {
        const transpiler = new PythonToPixels();
        const code = `
x = 10
print(x)
`;
        const result = transpiler.transpile(code);
        assert.ok(result.instructionCount > 0);
        assert.ok(result.pixels.length > 0);
    });

    it('writes pixels to InfiniteMap', () => {
        const transpiler = new PythonToPixels();
        const code = 'x = 5';
        const result = transpiler.transpile(code, 100, 100);

        const map = transpiler.getMap();
        const pixel = map.getPixel(100, 100);
        // First pixel should be an instruction (not all zeros)
        assert.ok(pixel[0] !== 0 || pixel[1] !== 0 || pixel[2] !== 0 || pixel[3] !== 0);
    });

    it('handles for loop', () => {
        const transpiler = new PythonToPixels();
        const code = `
for i in range(0, 10):
    print(i)
`;
        const result = transpiler.transpile(code);
        assert.ok(result.instructionCount > 0);
    });

    it('handles arithmetic expressions', () => {
        const transpiler = new PythonToPixels();
        const code = `
x = 5
y = 3
z = x + y
print(z)
`;
        const result = transpiler.transpile(code);
        assert.ok(result.instructionCount > 0);
        // Should have ADD instruction
        const { instructions } = compile(tokenize(code));
        assert.ok(instructions.some(i => i.op === OP.ADD));
    });

    it('exports to PNG', async () => {
        const transpiler = new PythonToPixels();
        const code = 'x = 5';
        const result = transpiler.transpile(code);

        const fs = await import('fs');
        const filename = '/tmp/python-test.png';

        await transpiler.exportPNG(result, filename);

        const stats = await fs.promises.stat(filename);
        assert.ok(stats.size > 0);

        // Cleanup
        await fs.promises.unlink(filename);
    });
});
