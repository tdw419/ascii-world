// sync/cartridge-store.js
// Manages GeosASCII cartridges for pxOS

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const WIDTH = 80;
const HEIGHT = 24;
const STATE_SLOTS = 320;

const OP = {
    NOP: 0, TOGGLE: 3, SET: 6, CLEAR: 7, INC: 8, DEC: 9,
    LD: 3, ST: 4, ADD: 5, SUB: 6, JZ: 10, RET: 12, HALT: 13,
    LDI: 204, MOV: 206, JMP: 209, CMP: 214, DRAW: 215,
    AND: 220, OR: 221, XOR: 222, NOT: 223, SHL: 224, SHR: 225
};

const OP_NAMES = {};
for (const [k, v] of Object.entries(OP)) OP_NAMES[v] = k;

export class CartridgeStore {
    constructor(options = {}) {
        this.cartridgesDir = options.cartridgesDir || '../apps/geos-ascii/examples';
        this.cartridges = new Map();
        this.activeCartridge = null;
        this.state = new Uint8Array(STATE_SLOTS * 4);
        this.listeners = new Set();
    }

    // Load all cartridges from directory
    loadAll() {
        if (!existsSync(this.cartridgesDir)) {
            console.warn(`Cartridges directory not found: ${this.cartridgesDir}`);
            return [];
        }

        const files = readdirSync(this.cartridgesDir)
            .filter(f => f.endsWith('.rts.png'));

        for (const file of files) {
            const name = file.replace('.rts.png', '');
            const path = join(this.cartridgesDir, file);
            try {
                const buffer = readFileSync(path);
                this.cartridges.set(name, {
                    name,
                    path,
                    buffer,
                    size: buffer.length
                });
            } catch (e) {
                console.error(`Failed to load cartridge ${name}:`, e.message);
            }
        }

        console.log(`Loaded ${this.cartridges.size} cartridges`);
        return Array.from(this.cartridges.keys());
    }

    // List available cartridges
    list() {
        return Array.from(this.cartridges.entries()).map(([name, cart]) => ({
            name,
            size: cart.size,
            path: cart.path
        }));
    }

    // Get cartridge buffer
    get(name) {
        return this.cartridges.get(name);
    }

    // Set active cartridge and parse its state
    setActive(name) {
        const cart = this.cartridges.get(name);
        if (!cart) return null;

        this.activeCartridge = cart;
        this.parseCartridge(cart.buffer);
        this.notifyListeners({ type: 'cartridge_loaded', name });
        return cart;
    }

    // Parse cartridge into memory structures
    parseCartridge(buffer) {
        // For now, just reset state
        // Full parsing happens in browser with ImageData
        this.state = new Uint8Array(STATE_SLOTS * 4);
        return {
            width: 80,
            height: 54,
            stateSlots: STATE_SLOTS
        };
    }

    // Get state value
    getState(slot) {
        if (slot < 0 || slot >= STATE_SLOTS) return 0;
        return this.state[slot * 4];
    }

    // Set state value
    setState(slot, value) {
        if (slot < 0 || slot >= STATE_SLOTS) return;
        const oldVal = this.state[slot * 4];
        this.state[slot * 4] = value & 0xFF;

        if (oldVal !== (value & 0xFF)) {
            this.notifyListeners({
                type: 'state_change',
                slot,
                oldValue: oldVal,
                newValue: value & 0xFF
            });
        }
    }

    // Execute an opcode (server-side, for testing)
    executeOpcode(opcode, target, flags = 0) {
        switch (opcode) {
            case OP.TOGGLE: {
                const cur = this.getState(target);
                this.setState(target, cur ? 0 : 255);
                return { executed: 'TOGGLE', result: this.getState(target) };
            }
            case OP.SET:
                this.setState(target, 255);
                return { executed: 'SET' };
            case OP.CLEAR:
                this.setState(target, 0);
                return { executed: 'CLEAR' };
            case OP.INC: {
                const cur = this.getState(target);
                this.setState(target, Math.min(cur + 1, 255));
                return { executed: 'INC', result: this.getState(target) };
            }
            case OP.DEC: {
                const cur = this.getState(target);
                this.setState(target, Math.max(cur - 1, 0));
                return { executed: 'DEC', result: this.getState(target) };
            }
            case OP.LDI:
                this.setState(target, flags);
                return { executed: 'LDI', value: flags };
            case OP.ADD: {
                const cur = this.getState(target);
                this.setState(target, (cur + (flags || 1)) & 0xFF);
                return { executed: 'ADD', result: this.getState(target) };
            }
            case OP.SUB: {
                const cur = this.getState(target);
                this.setState(target, (cur - (flags || 1)) & 0xFF);
                return { executed: 'SUB', result: this.getState(target) };
            }
            default:
                return { executed: 'UNKNOWN', opcode };
        }
    }

    // Get all state as object
    getAllState() {
        const result = {};
        for (let i = 0; i < STATE_SLOTS; i++) {
            const val = this.getState(i);
            if (val !== 0) result[i] = val;
        }
        return result;
    }

    // Subscribe to changes
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyListeners(event) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}
