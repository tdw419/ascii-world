// sync/cell-store.js
// Reactive cell store with change notification

export class CellStore {
    constructor() {
        this.cells = {};
        this.subscribers = new Set();
    }

    setCells(cells) {
        const changes = {};
        for (const [key, value] of Object.entries(cells)) {
            if (this.cells[key] !== value) {
                this.cells[key] = value;
                changes[key] = value;
            }
        }
        if (Object.keys(changes).length > 0) {
            this.notify(changes);
        }
        return changes;
    }

    getCells() {
        return { ...this.cells };
    }

    getCell(key) {
        return this.cells[key];
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.unsubscribe(callback);
    }

    unsubscribe(callback) {
        this.subscribers.delete(callback);
    }

    notify(changes) {
        for (const callback of this.subscribers) {
            callback(changes, this.cells);
        }
    }
}
