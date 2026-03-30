// sync/mouse-input.js — Simple mouse driver for Linux framebuffer
// Reads from /dev/input/mice (Standard PS/2 protocol)
//
// Supports:
// - PS/2 3-byte packet parsing (ImPS/2 protocol)
// - 4-byte scroll wheel packets (ImPS/2 extension)
// - Button events: left, right, middle
// - Scroll events: scrollup, scrolldown
// - Double-click detection
// - feedPacket() for programmatic/testing input

import { EventEmitter } from 'events';
import * as fs from 'fs';

export class MouseInput extends EventEmitter {
    constructor(options = {}) {
        super();
        this.device = options.device || '/dev/input/mice';
        this.fd = null;
        this.protocol = options.protocol || 'ps2'; // 'ps2' or 'imps2'

        // State
        this.x = options.startX || 0;
        this.y = options.startY || 0;
        this.width = options.width || 1920;
        this.height = options.height || 1080;

        this.leftButton = false;
        this.rightButton = false;
        this.middleButton = false;

        // Scroll tracking
        this.scrollY = 0;

        // Double-click detection
        this._lastClickTime = 0;
        this._lastClickButton = '';
        this._doubleClickThreshold = options.doubleClickThreshold || 400;

        // Drag detection
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._isDragging = false;

        this._buffer = Buffer.alloc(this.protocol === 'imps2' ? 4 : 3);
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

        const bufLen = this.protocol === 'imps2' ? 4 : 3;
        fs.read(this.fd, this._buffer, 0, bufLen, null, (err, bytesRead) => {
            if (err) {
                if (err.code !== 'EAGAIN') {
                    this.emit('error', err);
                }
                setTimeout(() => this._read(), 10);
                return;
            }

            if (bytesRead === bufLen) {
                this._parsePacket(this._buffer);
            }

            this._read();
        });
    }

    /**
     * Feed a raw packet directly (for testing or programmatic input).
     * Accepts a Buffer or array of bytes.
     */
    feedPacket(data) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        this._parsePacket(buf);
    }

    /**
     * Move the cursor to an absolute position programmatically.
     * Emits a 'move' event.
     */
    moveTo(x, y) {
        const oldX = this.x;
        const oldY = this.y;
        this.x = Math.max(0, Math.min(this.width - 1, x));
        this.y = Math.max(0, Math.min(this.height - 1, y));
        if (this.x !== oldX || this.y !== oldY) {
            this.emit('move', { x: this.x, y: this.y, dx: this.x - oldX, dy: this.y - oldY });
        }
    }

    _parsePacket(buf) {
        // Byte 0: Button states + overflow/sign bits
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

        // Scroll wheel (ImPS/2 protocol: byte 3)
        if (buf.length >= 4 && this.protocol === 'imps2') {
            let scrollDelta = buf[3];
            // Scroll values are signed (-1 or +1 typically)
            if (scrollDelta > 127) scrollDelta -= 256;
            if (scrollDelta !== 0) {
                this.scrollY += scrollDelta;
                this.emit('scroll', { delta: scrollDelta, x: this.x, y: this.y });
                if (scrollDelta > 0) {
                    this.emit('scrollup', { delta: scrollDelta, x: this.x, y: this.y });
                } else {
                    this.emit('scrolldown', { delta: scrollDelta, x: this.x, y: this.y });
                }
            }
        }

        // Left button
        if (left !== this.leftButton) {
            this.leftButton = left;
            this.emit(left ? 'mousedown' : 'mouseup', { button: 'left', x: this.x, y: this.y });

            if (left) {
                // Start potential drag
                this._dragStartX = this.x;
                this._dragStartY = this.y;
                this._isDragging = false;
            } else {
                if (this._isDragging) {
                    this.emit('dragend', {
                        button: 'left',
                        x: this.x, y: this.y,
                        startX: this._dragStartX, startY: this._dragStartY,
                    });
                    this._isDragging = false;
                }
                this.emit('click', { button: 'left', x: this.x, y: this.y });

                // Double-click detection
                const now = Date.now();
                if (this._lastClickButton === 'left' &&
                    now - this._lastClickTime < this._doubleClickThreshold) {
                    this.emit('dblclick', { button: 'left', x: this.x, y: this.y });
                }
                this._lastClickTime = now;
                this._lastClickButton = 'left';
            }
        }

        // Drag detection (movement while left button held)
        if (left && this.leftButton && moved) {
            const dragDist = Math.abs(this.x - this._dragStartX) + Math.abs(this.y - this._dragStartY);
            if (dragDist > 3) {
                this._isDragging = true;
                this.emit('drag', {
                    button: 'left',
                    x: this.x, y: this.y,
                    startX: this._dragStartX, startY: this._dragStartY,
                });
            }
        }

        // Right button
        if (right !== this.rightButton) {
            this.rightButton = right;
            this.emit(right ? 'mousedown' : 'mouseup', { button: 'right', x: this.x, y: this.y });
            if (!right) {
                this.emit('rightclick', { button: 'right', x: this.x, y: this.y });
            }
        }

        // Middle button
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
