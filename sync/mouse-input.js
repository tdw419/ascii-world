// sync/mouse-input.js — Simple mouse driver for Linux framebuffer
// Reads from /dev/input/mice (Standard PS/2 protocol)

import { EventEmitter } from 'events';
import * as fs from 'fs';

export class MouseInput extends EventEmitter {
    constructor(options = {}) {
        super();
        this.device = options.device || '/dev/input/mice';
        this.fd = null;
        
        // State
        this.x = options.startX || 0;
        this.y = options.startY || 0;
        this.width = options.width || 1920;
        this.height = options.height || 1080;
        
        this.leftButton = false;
        this.rightButton = false;
        this.middleButton = false;
        
        this._buffer = Buffer.alloc(3);
    }

    start() {
        try {
            this.fd = fs.openSync(this.device, 'r');
            this._read();
        } catch (e) {
            console.error(`Could not open mouse device ${this.device}: ${e.message}`);
        }
    }

    _read() {
        if (this.fd === null) return;

        fs.read(this.fd, this._buffer, 0, 3, null, (err, bytesRead) => {
            if (err) {
                if (err.code !== 'EAGAIN') {
                    this.emit('error', err);
                }
                setTimeout(() => this._read(), 10);
                return;
            }

            if (bytesRead === 3) {
                this._parsePacket(this._buffer);
            }

            this._read();
        });
    }

    _parsePacket(buf) {
        // Byte 0: Button states
        const b0 = buf[0];
        const left = !!(b0 & 0x01);
        const right = !!(b0 & 0x02);
        const middle = !!(b0 & 0x04);
        
        // Byte 1: Relative X (signed 8-bit)
        let dx = buf[1];
        if (b0 & 0x10) dx -= 256; // Sign bit X
        
        // Byte 2: Relative Y (signed 8-bit)
        let dy = buf[2];
        if (b0 & 0x20) dy -= 256; // Sign bit Y
        
        // Update position (mice dy is inverted compared to screen y)
        const oldX = this.x;
        const oldY = this.y;
        
        this.x = Math.max(0, Math.min(this.width - 1, this.x + dx));
        this.y = Math.max(0, Math.min(this.height - 1, this.y - dy));
        
        const moved = (this.x !== oldX || this.y !== oldY);
        
        if (moved) {
            this.emit('move', { x: this.x, y: this.y, dx, dy: -dy });
        }
        
        if (left !== this.leftButton) {
            this.leftButton = left;
            this.emit(left ? 'mousedown' : 'mouseup', { button: 'left', x: this.x, y: this.y });
            if (!left) this.emit('click', { button: 'left', x: this.x, y: this.y });
        }
        
        if (right !== this.rightButton) {
            this.rightButton = right;
            this.emit(right ? 'mousedown' : 'mouseup', { button: 'right', x: this.x, y: this.y });
        }
        
        if (middle !== this.middleButton) {
            this.middleButton = middle;
            this.emit(middle ? 'mousedown' : 'mouseup', { button: 'middle', x: this.x, y: this.y });
        }
    }

    stop() {
        if (this.fd !== null) {
            fs.closeSync(this.fd);
            this.fd = null;
        }
    }
}
