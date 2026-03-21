// sync/alert-engine.js
// Threshold-based alerting system

export class AlertEngine {
    constructor() {
        this.rules = [];
        this.history = [];
        this.cooldowns = new Map(); // rule name -> last trigger time
        this.notifiers = [];
        this.maxHistory = 100;
    }

    /**
     * Add a notification handler.
     */
    addNotifier(fn) {
        this.notifiers.push(fn);
    }

    /**
     * Set alert rules.
     */
    setRules(rules) {
        this.rules = rules.map(r => ({
            name: r.name || 'unnamed',
            cell: r.cell,
            operator: r.operator || '>',
            threshold: r.threshold,
            severity: r.severity || 'warning',
            message: r.message || `Alert: ${r.cell} ${r.operator} ${r.threshold}`,
            cooldown: r.cooldown || 60, // seconds
            webhook: r.webhook,
            enabled: r.enabled !== false,
        }));
        return this.rules;
    }

    /**
     * Get current rules.
     */
    getRules() {
        return this.rules;
    }

    /**
     * Get alert history.
     */
    getHistory(limit = 50) {
        return this.history.slice(-limit);
    }

    /**
     * Check cells against rules and trigger alerts.
     */
    check(cells) {
        const triggered = [];

        for (const rule of this.rules) {
            if (!rule.enabled) continue;

            const value = cells[rule.cell];
            if (value === undefined) continue;

            if (this.evaluateRule(rule, value)) {
                // Check cooldown
                const lastTrigger = this.cooldowns.get(rule.name) || 0;
                const now = Date.now();
                const cooldownMs = rule.cooldown * 1000;

                if (now - lastTrigger < cooldownMs) {
                    continue; // Still in cooldown
                }

                // Trigger alert
                const alert = {
                    rule: rule.name,
                    cell: rule.cell,
                    value,
                    threshold: rule.threshold,
                    operator: rule.operator,
                    severity: rule.severity,
                    message: rule.message,
                    timestamp: now,
                };

                triggered.push(alert);
                this.history.push(alert);
                this.cooldowns.set(rule.name, now);

                // Trim history
                if (this.history.length > this.maxHistory) {
                    this.history = this.history.slice(-this.maxHistory);
                }

                // Notify
                this.notify(alert, rule);
            }
        }

        return triggered;
    }

    /**
     * Evaluate a single rule against a value.
     */
    evaluateRule(rule, value) {
        const num = Number(value);
        const threshold = Number(rule.threshold);

        switch (rule.operator) {
            case '>': return num > threshold;
            case '>=': return num >= threshold;
            case '<': return num < threshold;
            case '<=': return num <= threshold;
            case '==': return num === threshold;
            case '!=': return num !== threshold;
            default: return false;
        }
    }

    /**
     * Send alert to all notifiers.
     */
    notify(alert, rule) {
        for (const notifier of this.notifiers) {
            try {
                notifier(alert, rule);
            } catch (err) {
                console.error('Notifier error:', err);
            }
        }
    }

    /**
     * Clear cooldown for a rule.
     */
    clearCooldown(ruleName) {
        this.cooldowns.delete(ruleName);
    }

    /**
     * Clear all cooldowns.
     */
    clearAllCooldowns() {
        this.cooldowns.clear();
    }
}
