import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AnsiParser, TextStyle, ansiToRGB, stripAnsi, PALETTE_256 } from '../sync/ansi-parser.js';

describe('AnsiParser', () => {
    describe('TextStyle', () => {
        it('has sensible defaults', () => {
            const s = new TextStyle();
            assert.deepStrictEqual(s.fg, [0xc9, 0xd1, 0xd9, 255]);
            assert.strictEqual(s.bold, false);
        });

        it('clone creates independent copy', () => {
            const s = new TextStyle();
            s.fg = [255, 0, 0, 255];
            s.bold = true;
            const c = s.clone();
            assert.deepStrictEqual(c.fg, [255, 0, 0, 255]);
            assert.strictEqual(c.bold, true);
            c.fg[0] = 0;
            assert.strictEqual(s.fg[0], 255); // original unchanged
        });

        it('getEffectiveColors handles inverse', () => {
            const s = new TextStyle();
            s.fg = [255, 0, 0, 255];
            s.bg = [0, 0, 255, 255];
            s.inverse = true;
            const { fg, bg } = s.getEffectiveColors();
            assert.deepStrictEqual(fg, [0, 0, 255, 255]); // swapped
            assert.deepStrictEqual(bg, [255, 0, 0, 255]);
        });
    });

    describe('parse', () => {
        it('parses plain text', () => {
            const parser = new AnsiParser();
            const result = parser.parse('Hello');
            assert.strictEqual(result.length, 5);
            assert.strictEqual(result[0].char, 'H');
            assert.strictEqual(result[4].char, 'o');
        });

        it('parses SGR reset', () => {
            const parser = new AnsiParser();
            parser.style.bold = true;
            const result = parser.parse('\x1b[0mHi');
            assert.strictEqual(result[0].style.bold, false);
        });

        it('parses standard foreground colors (30-37)', () => {
            const parser = new AnsiParser();
            const result = parser.parse('\x1b[31mR\x1b[32mG');
            // Red foreground
            assert.strictEqual(result[0].char, 'R');
            assert.strictEqual(result[0].style.fg[0], 0xf8); // red from palette
            // Green foreground
            assert.strictEqual(result[1].char, 'G');
            assert.strictEqual(result[1].style.fg[1], 0xb9); // green component
        });

        it('parses bright foreground colors (90-97)', () => {
            const parser = new AnsiParser();
            const result = parser.parse('\x1b[91mX');
            assert.strictEqual(result[0].style.fg[0], 0xff); // bright red
        });

        it('parses background colors (40-47)', () => {
            const parser = new AnsiParser();
            const result = parser.parse('\x1b[44mX');
            assert.strictEqual(result[0].style.bg[2], 0xff); // blue bg
        });

        it('parses 256-color foreground (38;5;N)', () => {
            const parser = new AnsiParser();
            // Color 196 = bright red in the 6×6×6 cube
            const result = parser.parse('\x1b[38;5;196mX');
            const expected = PALETTE_256[196];
            assert.strictEqual(result[0].style.fg[0], expected[0]);
            assert.strictEqual(result[0].style.fg[1], expected[1]);
            assert.strictEqual(result[0].style.fg[2], expected[2]);
        });

        it('parses TrueColor foreground (38;2;R;G;B)', () => {
            const parser = new AnsiParser();
            const result = parser.parse('\x1b[38;2;123;45;67mX');
            assert.deepStrictEqual(result[0].style.fg, [123, 45, 67, 255]);
        });

        it('parses TrueColor background (48;2;R;G;B)', () => {
            const parser = new AnsiParser();
            const result = parser.parse('\x1b[48;2;10;20;30mX');
            assert.deepStrictEqual(result[0].style.bg, [10, 20, 30, 255]);
        });

        it('parses bold/italic/underline attributes', () => {
            const parser = new AnsiParser();
            const result = parser.parse('\x1b[1;3;4mX');
            assert.strictEqual(result[0].style.bold, true);
            assert.strictEqual(result[0].style.italic, true);
            assert.strictEqual(result[0].style.underline, true);
        });

        it('handles combined sequences', () => {
            const parser = new AnsiParser();
            const result = parser.parse('\x1b[1;31mHello\x1b[0m World');
            assert.strictEqual(result.length, 11);
            // "Hello" is bold red
            assert.strictEqual(result[0].style.bold, true);
            assert.strictEqual(result[0].style.fg[0], 0xf8);
            // " World" is reset
            assert.strictEqual(result[5].style.bold, false);
        });

        it('skips control characters in text mode', () => {
            const parser = new AnsiParser();
            const result = parser.parse('A\x01B');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].char, 'A');
            assert.strictEqual(result[1].char, 'B');
        });
    });

    describe('256-color palette', () => {
        it('has 256 entries', () => {
            assert.strictEqual(PALETTE_256.length, 256);
        });

        it('system colors match palette16', () => {
            assert.deepStrictEqual(PALETTE_256[0], [0x0d, 0x11, 0x17]);
        });

        it('color cube entry 16 = [0,0,0]', () => {
            assert.deepStrictEqual(PALETTE_256[16], [0, 0, 0]);
        });

        it('color cube entry 231 = [255,255,255]', () => {
            assert.deepStrictEqual(PALETTE_256[231], [0xff, 0xff, 0xff]);
        });

        it('grayscale ramp starts at 232', () => {
            assert.deepStrictEqual(PALETTE_256[232], [8, 8, 8]);
            assert.deepStrictEqual(PALETTE_256[255], [238, 238, 238]);
        });
    });

    describe('utilities', () => {
        it('ansiToRGB returns correct color', () => {
            assert.deepStrictEqual(ansiToRGB(1), [0xf8, 0x51, 0x49]); // red
        });

        it('stripAnsi removes escape sequences', () => {
            assert.strictEqual(stripAnsi('\x1b[31mHello\x1b[0m'), 'Hello');
            assert.strictEqual(stripAnsi('\x1b[1;32;44mWorld\x1b[0m'), 'World');
        });
    });
});
