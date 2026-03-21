// sync/dashboard-store.js
// Save/load visualization templates as named dashboards
// Supports file persistence for survival across server restarts

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class DashboardStore {
    constructor(options = {}) {
        this.dashboards = new Map(); // name -> {template, alerts, created}
        this.filePath = options.filePath;
        this.saveTimeout = null;
        this.saveDelay = options.saveDelay || 1000; // Debounce saves
        
        if (this.filePath) {
            this.loadFromFile();
        }
    }

    /**
     * Save a dashboard.
     */
    save(name, template, alerts = []) {
        this.dashboards.set(name, {
            name,
            template: [...template],
            alerts: [...alerts],
            created: Date.now(),
        });
        this.scheduleSave();
        return this.dashboards.get(name);
    }

    /**
     * Load a dashboard by name.
     */
    load(name) {
        return this.dashboards.get(name) || null;
    }

    /**
     * List all dashboards.
     */
    list() {
        return Array.from(this.dashboards.values()).map(d => ({
            name: d.name,
            created: d.created,
            templateSize: d.template.length,
            alertCount: d.alerts.length,
        }));
    }

    /**
     * Delete a dashboard.
     */
    delete(name) {
        const result = this.dashboards.delete(name);
        this.scheduleSave();
        return result;
    }

    /**
     * Check if dashboard exists.
     */
    has(name) {
        return this.dashboards.has(name);
    }

    /**
     * Clear all dashboards.
     */
    clear() {
        this.dashboards.clear();
        this.scheduleSave();
    }

    /**
     * Schedule a debounced save to file.
     */
    scheduleSave() {
        if (!this.filePath) return;
        
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveToFile();
        }, this.saveDelay);
    }

    /**
     * Save all dashboards to file.
     */
    saveToFile() {
        if (!this.filePath) return false;

        try {
            const data = {
                version: 1,
                dashboards: Object.fromEntries(this.dashboards),
            };

            // Ensure directory exists
            const dir = dirname(this.filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }

            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (err) {
            console.error('Failed to save dashboards:', err.message);
            return false;
        }
    }

    /**
     * Load dashboards from file.
     */
    loadFromFile() {
        if (!this.filePath || !existsSync(this.filePath)) {
            return false;
        }

        try {
            const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
            
            if (data.version === 1 && data.dashboards) {
                this.dashboards = new Map(Object.entries(data.dashboards));
                return true;
            }
            
            return false;
        } catch (err) {
            console.error('Failed to load dashboards:', err.message);
            return false;
        }
    }
}
