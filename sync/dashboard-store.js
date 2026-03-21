// sync/dashboard-store.js
// Save/load visualization templates as named dashboards

export class DashboardStore {
    constructor() {
        this.dashboards = new Map(); // name -> {template, alerts, created}
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
        return this.dashboards.delete(name);
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
    }
}
