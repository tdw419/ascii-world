#!/usr/bin/env node
// text-to-fb.js — Write text directly to framebuffer
// Simple abstraction: text → glyph atlas → hex → /dev/fb0

import { GlyphAtlas } from '../sync/glyph-atlas.js';
import { PixelBuffer } from '../sync/pixel-buffer.js';
import * as fs from 'fs';

const FRAMEBUFFER = '/dev/fb0';
const WIDTH = 1920;
const HEIGHT = 1080;

/**
 * TextWriter - Simple text-to-framebuffer abstraction
 * 
 * Usage:
 *   const writer = new TextWriter();
 *   writer.clear();
 *   writer.print("hello", 10, 10, 0xFFFFFF);  // white text at (10,10)
 *   writer.print("world", 10, 20, 0x00FF00);  // green text at (10,20)
 *   writer.flush();  // write to /dev/fb0
 */
export class TextWriter {
    constructor(options = {}) {
        this.width = options.width || WIDTH;
        this.height = options.height || HEIGHT;
        this.device = options.device || FRAMEBUFFER;
        
        this.buffer = new PixelBuffer(this.width, this.height);
        this.atlas = new GlyphAtlas(6, 10);
        
        // Text cursor
        this.cursorX = 0;
        this.cursorY = 0;
        this.defaultColor = 0xFFFFFF;
        
        // Clear to dark
        this.buffer.clear(0x0a0a12);
    }
    
    /**
     * Write text at position
     */
    print(text, x, y, color) {
        if (x === undefined) x = this.cursorX;
        if (y === undefined) y = this.cursorY;
        if (color === undefined) color = this.defaultColor;
        
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        
        this.atlas.drawText(this.buffer, x, y, text, [r, g, b, 255]);
        
        // Advance cursor
        this.cursorX = x + text.length * this.atlas.glyphW + 2;
        this.cursorY = y;
        
        return this;
    }
    
    /**
     * Print with newline (advance to next line)
     */
    println(text, x, y, color) {
        this.print(text, x, y, color);
        this.cursorX = x || 0;
        this.cursorY += this.atlas.glyphH + 2;
        return this;
    }
    
    /**
     * Clear screen
     */
    clear(color = 0x0a0a12) {
        this.buffer.clear(color);
        this.cursorX = 0;
        this.cursorY = 0;
        return this;
    }
    
    /**
     * Fill rectangle
     */
    fillRect(x, y, w, h, color) {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        this.buffer.drawRect(x, y, w, h, r, g, b, 255);
        return this;
    }
    
    /**
     * Fill rectangle
     */
    fillRect(x, y, w, h, color) {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        this.buffer.drawRect(x, y, w, h, r, g, b, 255);
        return this;
    }
    
    /**
     * Set cursor position
     */
    setCursor(x, y) {
        this.cursorX = x;
        this.cursorY = y;
        return this;
    }
    
    /**
     * Set default color
     */
    setColor(color) {
        this.defaultColor = color;
        return this;
    }
    
    /**
     * Get raw RGBA bytes
     */
    toRGBA() {
        return Buffer.from(this.buffer.data);
    }
    
    /**
     * Get as hex string (for debugging)
     */
    toHex() {
        return this.toRGBA().toString('hex');
    }
    
    /**
     * Write to framebuffer (requires sudo)
     */
    flush() {
        try {
            const fd = fs.openSync(this.device, 'w');
            fs.writeSync(fd, this.toRGBA(), 0, this.buffer.data.length, 0);
            fs.closeSync(fd);
            return true;
        } catch (e) {
            if (e.code === 'EACCES') {
                console.error('Permission denied. Run with sudo.');
            } else if (e.code === 'ENOENT') {
                console.error(`Framebuffer not found: ${this.device}`);
            } else {
                console.error('Write failed:', e.message);
            }
            return false;
        }
    }
    
    /**
     * Save to PNG file
     */
    async savePNG(filename) {
        const sharp = (await import('sharp')).default;
        const png = await sharp(this.toRGBA(), {
            raw: { width: this.width, height: this.height, channels: 4 }
        }).png().toBuffer();
        
        await fs.promises.writeFile(filename, png);
        return png;
    }
}

// CLI usage - only run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    async function main() {
        const args = process.argv.slice(2);
        
        const writer = new TextWriter();
        
        if (args.length === 0) {
            // Demo mode
            writer.clear()
                .print("PIXEL FRAMEBUFFER", 10, 10, 0x00FFFF)
                .println("v0.1", 130, 10, 0x888888)
                .setCursor(10, 30)
                .println("Hello, World!", 0, undefined, 0xFFFFFF)
                .println("The quick brown fox", 0, undefined, 0xFF8800)
                .println("jumps over the lazy dog", 0, undefined, 0x88FF00);
            
            // Save to file
            await writer.savePNG('/tmp/text-to-fb.png');
            console.log('Demo saved to /tmp/text-to-fb.png');
            console.log('To write to framebuffer: sudo node text-to-fb.js --flush "Hello"');
            return;
        }
        
        // Parse args
        let text = '';
        let x = 10, y = 10;
        let color = 0xFFFFFF;
        let doFlush = false;
        let outputFile = null;
        
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--flush' || args[i] === '-f') {
                doFlush = true;
            } else if (args[i] === '--output' || args[i] === '-o') {
                outputFile = args[++i];
            } else if (args[i] === '--x') {
                x = parseInt(args[++i]);
            } else if (args[i] === '--y') {
                y = parseInt(args[++i]);
            } else if (args[i] === '--color' || args[i] === '-c') {
                color = parseInt(args[++i], 16);
            } else if (!args[i].startsWith('-')) {
                text = args[i];
            }
        }
        
        if (!text) {
            console.log('Usage: node text-to-fb.js [options] "text"');
            console.log('  --flush, -f      Write to /dev/fb0 (requires sudo)');
            console.log('  --output, -o FN  Save to PNG file');
            console.log('  --x N            X position (default 10)');
            console.log('  --y N            Y position (default 10)');
            console.log('  --color, -c HEX  Color as hex (default FFFFFF)');
            process.exit(1);
        }
        
        writer.print(text, x, y, color);
        
        if (outputFile) {
            await writer.savePNG(outputFile);
            console.log(`Saved to ${outputFile}`);
        }
        
        if (doFlush) {
            if (writer.flush()) {
                console.log('Written to framebuffer');
            } else {
                process.exit(1);
            }
        }
    }
    
    main().catch(e => {
        console.error('Error:', e.message);
        process.exit(1);
    });
}
