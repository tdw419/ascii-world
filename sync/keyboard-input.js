// keyboard-input.js — Raw terminal input with ANSI escape sequence state machine
//
// From research doc: "In raw mode, Node.js provides every keystroke as a raw byte
// sequence immediately. This presents a significant parsing challenge, as a single
// logical keypress may correspond to one or many bytes."
//
// State machine: GROUND -> ESC_WAIT -> CSI_PARAM -> emit key event

import { EventEmitter } from 'events';

// Key constants
export const KEY = {
    ENTER: 'enter',
    BACKSPACE: 'backspace',
    TAB: 'tab',
    ESCAPE: 'escape',
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right',
    HOME: 'home',
    END: 'end',
    PAGE_UP: 'pageup',
    PAGE_DOWN: 'pagedown',
    INSERT: 'insert',
    DELETE: 'delete',
    CTRL_C: 'ctrl+c',
    CTRL_D: 'ctrl+d',
    CTRL_L: 'ctrl+l',
    CTRL_Z: 'ctrl+z',
    CTRL_A: 'ctrl+a',
    CTRL_E: 'ctrl+e',
    CTRL_K: 'ctrl+k',
    CTRL_U: 'ctrl+u',
    CTRL_W: 'ctrl+w',
    F1: 'f1', F2: 'f2', F3: 'f3', F4: 'f4',
    F5: 'f5', F6: 'f6', F7: 'f7', F8: 'f8',
    F9: 'f9', F10: 'f10', F11: 'f11', F12: 'f12',
};

// Parser states
const GROUND = 0;
const ESC_WAIT = 1;
const CSI_PARAM = 2;
const SS3_WAIT = 3;

// CSI sequence mappings: final byte + params -> key
const CSI_MAP = {
    'A': KEY.UP,
    'B': KEY.DOWN,
    'C': KEY.RIGHT,
    'D': KEY.LEFT,
    'H': KEY.HOME,
    'F': KEY.END,
};

// CSI tilde sequences: ESC [ N ~
const CSI_TILDE_MAP = {
    1: KEY.HOME,
    2: KEY.INSERT,
    3: KEY.DELETE,
    4: KEY.END,
    5: KEY.PAGE_UP,
    6: KEY.PAGE_DOWN,
    11: KEY.F1, 12: KEY.F2, 13: KEY.F3, 14: KEY.F4,
    15: KEY.F5,
    17: KEY.F5, 18: KEY.F6, 19: KEY.F7, 20: KEY.F8,
    21: KEY.F9,
    23: KEY.F10, 24: KEY.F11, 25: KEY.F12,
};

// SS3 mappings (ESC O ...)
const SS3_MAP = {
    'P': KEY.F1, 'Q': KEY.F2, 'R': KEY.F3, 'S': KEY.F4,
    'H': KEY.HOME, 'F': KEY.END,
};

// Ctrl key mappings (0x01-0x1A)
const CTRL_MAP = {
    0x01: KEY.CTRL_A,
    0x03: KEY.CTRL_C,
    0x04: KEY.CTRL_D,
    0x05: KEY.CTRL_E,
    0x0B: KEY.CTRL_K,
    0x0C: KEY.CTRL_L,
    0x15: KEY.CTRL_U,
    0x17: KEY.CTRL_W,
    0x1A: KEY.CTRL_Z,
};

export class KeyboardInput extends EventEmitter {
    constructor(options = {}) {
        super();
        this._state = GROUND;
        this._paramBuf = '';
        this._stream = options.stdin || process.stdin;
        this._wasRaw = false;
        this._bound = null;
        this._escTimer = null;
        this._escTimeout = options.escTimeout || 50; // ms to wait for escape sequence
    }

    /**
     * Start listening for raw keyboard input
     */
    start() {
        if (this._bound) return;

        // Save and set raw mode
        if (this._stream.isTTY) {
            this._wasRaw = this._stream.isRaw;
            this._stream.setRawMode(true);
        }
        this._stream.resume();

        this._bound = (data) => this._onData(data);
        this._stream.on('data', this._bound);
    }

    /**
     * Stop listening and restore terminal mode
     */
    stop() {
        if (!this._bound) return;

        this._stream.removeListener('data', this._bound);
        this._bound = null;

        if (this._stream.isTTY) {
            this._stream.setRawMode(this._wasRaw);
        }
        this._stream.pause();

        if (this._escTimer) {
            clearTimeout(this._escTimer);
            this._escTimer = null;
        }
    }

    /**
     * Process incoming raw bytes through the state machine
     */
    _onData(data) {
        for (let i = 0; i < data.length; i++) {
            const byte = data[i];
            this._processByte(byte);
        }
    }

    _processByte(byte) {
        switch (this._state) {
            case GROUND:
                this._processGround(byte);
                break;
            case ESC_WAIT:
                this._processEscWait(byte);
                break;
            case CSI_PARAM:
                this._processCsiParam(byte);
                break;
            case SS3_WAIT:
                this._processSs3Wait(byte);
                break;
        }
    }

    _processGround(byte) {
        if (byte === 0x1B) {
            // ESC received — wait for next byte to determine sequence type
            this._state = ESC_WAIT;
            this._paramBuf = '';
            // Set timer: if no follow-up byte, emit standalone Escape
            if (this._escTimer) clearTimeout(this._escTimer);
            this._escTimer = setTimeout(() => {
                if (this._state === ESC_WAIT) {
                    this._state = GROUND;
                    this._emitKey(KEY.ESCAPE);
                }
            }, this._escTimeout);
            return;
        }

        // Control characters
        if (byte < 0x20) {
            if (byte === 0x0D || byte === 0x0A) {
                this._emitKey(KEY.ENTER);
            } else if (byte === 0x09) {
                this._emitKey(KEY.TAB);
            } else if (CTRL_MAP[byte]) {
                this._emitKey(CTRL_MAP[byte]);
            }
            return;
        }

        // Backspace (DEL)
        if (byte === 0x7F) {
            this._emitKey(KEY.BACKSPACE);
            return;
        }

        // Printable ASCII
        if (byte >= 0x20 && byte <= 0x7E) {
            this._emitKey('char', String.fromCharCode(byte));
            return;
        }

        // UTF-8 multi-byte (pass through as character)
        if (byte >= 0x80) {
            // Simplified: emit as raw byte for now
            this._emitKey('char', String.fromCharCode(byte));
        }
    }

    _processEscWait(byte) {
        if (this._escTimer) {
            clearTimeout(this._escTimer);
            this._escTimer = null;
        }

        if (byte === 0x5B) {
            // ESC [ — CSI sequence
            this._state = CSI_PARAM;
            this._paramBuf = '';
            return;
        }

        if (byte === 0x4F) {
            // ESC O — SS3 sequence
            this._state = SS3_WAIT;
            return;
        }

        // ESC + printable = Alt+key
        this._state = GROUND;
        if (byte >= 0x20 && byte <= 0x7E) {
            this._emitKey('alt+char', String.fromCharCode(byte));
        } else {
            this._emitKey(KEY.ESCAPE);
            this._processByte(byte); // re-process in GROUND
        }
    }

    _processCsiParam(byte) {
        // Collect parameter bytes (digits, semicolons)
        if ((byte >= 0x30 && byte <= 0x39) || byte === 0x3B) {
            this._paramBuf += String.fromCharCode(byte);
            return;
        }

        // Final byte — determine the key
        this._state = GROUND;
        const finalChar = String.fromCharCode(byte);

        if (finalChar === '~') {
            // Tilde sequences: ESC [ N ~
            const num = parseInt(this._paramBuf) || 0;
            const key = CSI_TILDE_MAP[num];
            if (key) {
                this._emitKey(key, null, this._parseModifiers(this._paramBuf));
            }
            return;
        }

        // Arrow keys, Home, End
        const key = CSI_MAP[finalChar];
        if (key) {
            this._emitKey(key, null, this._parseModifiers(this._paramBuf));
            return;
        }

        // Mouse events, other CSI — emit raw
        this.emit('raw_csi', { params: this._paramBuf, final: finalChar });
    }

    _processSs3Wait(byte) {
        this._state = GROUND;
        const ch = String.fromCharCode(byte);
        const key = SS3_MAP[ch];
        if (key) {
            this._emitKey(key);
        }
    }

    /**
     * Parse CSI modifier byte (e.g., "1;5" means Ctrl)
     */
    _parseModifiers(params) {
        const parts = params.split(';');
        if (parts.length < 2) return {};
        const mod = parseInt(parts[1]) || 0;
        return {
            shift: !!(mod & 1),
            alt: !!(mod & 2),
            ctrl: !!(mod & 4),
            meta: !!(mod & 8),
        };
    }

    _emitKey(name, value = null, modifiers = {}) {
        this.emit('key', {
            name,
            value,
            shift: modifiers.shift || false,
            alt: modifiers.alt || false,
            ctrl: modifiers.ctrl || false,
        });
    }
}

/**
 * InputLine — Editable text buffer with cursor tracking
 * Emits 'enter' when the user presses Enter with the final string.
 */
export class InputLine extends EventEmitter {
    constructor() {
        super();
        this.buffer = '';
        this.cursor = 0;
        this.history = [];
        this.historyIdx = -1;
        this._tempBuffer = '';
    }

    /**
     * Process a key event from KeyboardInput
     */
    handleKey(event) {
        const { name, value } = event;

        switch (name) {
            case 'char':
                this.insert(value);
                break;
            case KEY.ENTER:
                this._submit();
                break;
            case KEY.BACKSPACE:
                this.backspace();
                break;
            case KEY.DELETE:
                this.deleteChar();
                break;
            case KEY.LEFT:
                this.moveCursor(-1);
                break;
            case KEY.RIGHT:
                this.moveCursor(1);
                break;
            case KEY.HOME:
            case KEY.CTRL_A:
                this.cursor = 0;
                this.emit('change', this.buffer, this.cursor);
                break;
            case KEY.END:
            case KEY.CTRL_E:
                this.cursor = this.buffer.length;
                this.emit('change', this.buffer, this.cursor);
                break;
            case KEY.UP:
                this._historyPrev();
                break;
            case KEY.DOWN:
                this._historyNext();
                break;
            case KEY.CTRL_K:
                // Kill to end of line
                this.buffer = this.buffer.slice(0, this.cursor);
                this.emit('change', this.buffer, this.cursor);
                break;
            case KEY.CTRL_U:
                // Kill to beginning of line
                this.buffer = this.buffer.slice(this.cursor);
                this.cursor = 0;
                this.emit('change', this.buffer, this.cursor);
                break;
            case KEY.CTRL_W:
                // Kill word backward
                this._killWordBack();
                break;
            case KEY.CTRL_L:
                this.emit('clear');
                break;
        }
    }

    insert(ch) {
        this.buffer = this.buffer.slice(0, this.cursor) + ch + this.buffer.slice(this.cursor);
        this.cursor += ch.length;
        this.emit('change', this.buffer, this.cursor);
    }

    backspace() {
        if (this.cursor <= 0) return;
        this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
        this.cursor--;
        this.emit('change', this.buffer, this.cursor);
    }

    deleteChar() {
        if (this.cursor >= this.buffer.length) return;
        this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
        this.emit('change', this.buffer, this.cursor);
    }

    moveCursor(delta) {
        const newPos = this.cursor + delta;
        if (newPos >= 0 && newPos <= this.buffer.length) {
            this.cursor = newPos;
            this.emit('change', this.buffer, this.cursor);
        }
    }

    _submit() {
        const line = this.buffer;
        if (line.trim()) {
            this.history.push(line);
        }
        this.historyIdx = -1;
        this.buffer = '';
        this.cursor = 0;
        this.emit('enter', line);
        this.emit('change', this.buffer, this.cursor);
    }

    _historyPrev() {
        if (this.history.length === 0) return;
        if (this.historyIdx === -1) {
            this._tempBuffer = this.buffer;
            this.historyIdx = this.history.length - 1;
        } else if (this.historyIdx > 0) {
            this.historyIdx--;
        } else {
            return;
        }
        this.buffer = this.history[this.historyIdx];
        this.cursor = this.buffer.length;
        this.emit('change', this.buffer, this.cursor);
    }

    _historyNext() {
        if (this.historyIdx === -1) return;
        if (this.historyIdx < this.history.length - 1) {
            this.historyIdx++;
            this.buffer = this.history[this.historyIdx];
        } else {
            this.historyIdx = -1;
            this.buffer = this._tempBuffer;
        }
        this.cursor = this.buffer.length;
        this.emit('change', this.buffer, this.cursor);
    }

    _killWordBack() {
        if (this.cursor === 0) return;
        let pos = this.cursor - 1;
        // Skip whitespace
        while (pos > 0 && this.buffer[pos] === ' ') pos--;
        // Skip word
        while (pos > 0 && this.buffer[pos - 1] !== ' ') pos--;
        this.buffer = this.buffer.slice(0, pos) + this.buffer.slice(this.cursor);
        this.cursor = pos;
        this.emit('change', this.buffer, this.cursor);
    }

    /**
     * Reset the input line
     */
    reset() {
        this.buffer = '';
        this.cursor = 0;
        this.emit('change', this.buffer, this.cursor);
    }
}
