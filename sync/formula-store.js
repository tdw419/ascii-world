// sync/formula-store.js — Persistent storage for pixel formulas
// Part of Phase 3 Feature Enhancement: "Add formula history and recall"

import * as fs from 'fs';
import path from 'path';

export class FormulaStore {
    constructor(options = {}) {
        this.filePath = options.filePath || path.join(process.cwd(), '.formulas.json');
        this.formulas = new Map();
        this.load();
    }

    load() {
        if (fs.existsSync(this.filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
                for (const [name, formula] of Object.entries(data)) {
                    this.formulas.set(name, formula);
                }
            } catch (e) {
                console.error(`Error loading formulas: ${e.message}`);
            }
        }
    }

    save() {
        try {
            const data = Object.fromEntries(this.formulas);
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`Error saving formulas: ${e.message}`);
        }
    }

    set(name, formula) {
        this.formulas.set(name, formula);
        this.save();
    }

    get(name) {
        return this.formulas.get(name);
    }

    delete(name) {
        const existed = this.formulas.delete(name);
        if (existed) this.save();
        return existed;
    }

    list() {
        return Array.from(this.formulas.keys());
    }

    getHistory() {
        // Return entries sorted by name or timestamp (if added)
        return Array.from(this.formulas.entries());
    }
}
