// sync/alert-engine.js
// Threshold-based alerting system

/**
 * Built-in agent alert rules.
 * @param {object} [config]
 * @param {number} [config.heartbeatThresholdMs=60000] - Max ms since last heartbeat before alerting.
 * @param {number} [config.errorSpikeWindowMs=300000]   - Window for counting errors (5 min).
 * @param {number} [config.errorSpikeThreshold=10]       - Error count in window that triggers.
 * @param {number} [config.taskTimeoutMs=3600000]        - Max task duration before timeout alert (1 hr).
 * @returns {object[]}
 */
export function builtinAgentRules(config = {}) {
    const heartbeatThresholdMs = config.heartbeatThresholdMs ?? 60_000;
    const errorSpikeWindowMs = config.errorSpikeWindowMs ?? 300_000;
    const errorSpikeThreshold = config.errorSpikeThreshold ?? 10;
    const taskTimeoutMs = config.taskTimeoutMs ?? 3_600_000;

    return [
        {
            name: 'agent-down',
            scope: 'agent',
            severity: 'critical',
            message: 'Agent status transitioned to offline or error',
            cooldown: 120,
            enabled: true,
            /**
             * @param {object} agent - Agent instance or plain object with .status
             */
            evaluate(agent) {
                return agent.status === 'offline' || agent.status === 'error';
            },
        },
        {
            name: 'agent-heartbeat-miss',
            scope: 'agent',
            severity: 'warning',
            message: `Agent heartbeat missing for > ${heartbeatThresholdMs / 1000}s`,
            cooldown: 60,
            enabled: true,
            heartbeatThresholdMs,
            evaluate(agent) {
                if (!agent.lastHeartbeat) return false;
                const age = Date.now() - new Date(agent.lastHeartbeat).getTime();
                return age > this.heartbeatThresholdMs;
            },
        },
        {
            name: 'agent-error-spike',
            scope: 'agent',
            severity: 'critical',
            message: `Agent error count exceeded ${errorSpikeThreshold} in last ${errorSpikeWindowMs / 1000}s`,
            cooldown: 300,
            enabled: true,
            errorSpikeWindowMs,
            errorSpikeThreshold,
            /**
             * @param {object} agent
             * @param {AgentLogStore} logStore
             */
            evaluate(agent, logStore) {
                if (!logStore) return false;
                const now = Date.now();
                const cutoff = now - this.errorSpikeWindowMs;
                const errors = logStore.getLogs(agent.id, {
                    level: 'error',
                    limit: 1000,
                });
                const recent = errors.filter(e => e.timestamp >= cutoff);
                return recent.length > this.errorSpikeThreshold;
            },
        },
        {
            name: 'agent-timeout',
            scope: 'agent',
            severity: 'critical',
            message: `Agent task exceeded ${taskTimeoutMs / 1000}s`,
            cooldown: 600,
            enabled: true,
            taskTimeoutMs,
            /**
             * @param {object} agent
             */
            evaluate(agent) {
                // Agent must be running a task (status === 'online') and have a taskStartedAt
                if (agent.status !== 'online' || !agent.taskStartedAt) return false;
                const elapsed = Date.now() - new Date(agent.taskStartedAt).getTime();
                return elapsed > this.taskTimeoutMs;
            },
        },
    ];
}

export class AlertEngine {
    constructor() {
        this.rules = [];
        this.history = [];
        this.cooldowns = new Map(); // "ruleName:agentId" or "ruleName" -> last trigger time
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
        this.rules = rules.map(r => {
            if (r.scope === 'agent') {
                // Agent-scoped rule: preserve custom evaluate, message defaults
                return {
                    name: r.name || 'unnamed',
                    scope: 'agent',
                    severity: r.severity || 'warning',
                    message: r.message || `Agent alert: ${r.name}`,
                    cooldown: r.cooldown || 60,
                    webhook: r.webhook,
                    enabled: r.enabled !== false,
                    evaluate: r.evaluate || (() => false),
                    // Preserve any config properties the rule carries
                    ...r,
                };
            }
            return {
                name: r.name || 'unnamed',
                cell: r.cell,
                operator: r.operator || '>',
                threshold: r.threshold,
                severity: r.severity || 'warning',
                message: r.message || `Alert: ${r.cell} ${r.operator} ${r.threshold}`,
                cooldown: r.cooldown || 60,
                webhook: r.webhook,
                enabled: r.enabled !== false,
            };
        });
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
     * Check cells against rules and trigger alerts (cell-scope rules only).
     */
    check(cells) {
        const triggered = [];

        for (const rule of this.rules) {
            if (!rule.enabled) continue;
            if (rule.scope === 'agent') continue; // skip agent rules in cell check

            const value = cells[rule.cell];
            if (value === undefined) continue;

            if (this.evaluateRule(rule, value)) {
                const cooldownKey = rule.name;
                const lastTrigger = this.cooldowns.get(cooldownKey) || 0;
                const now = Date.now();
                const cooldownMs = rule.cooldown * 1000;

                if (now - lastTrigger < cooldownMs) {
                    continue;
                }

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
                this.cooldowns.set(cooldownKey, now);

                if (this.history.length > this.maxHistory) {
                    this.history = this.history.slice(-this.maxHistory);
                }

                this.notify(alert, rule);
            }
        }

        return triggered;
    }

    /**
     * Check agents against agent-scoped rules.
     * @param {object[]} agents - Array of agent objects (each needs .id, .status, .lastHeartbeat, etc.)
     * @param {AgentLogStore} [logStore] - Optional log store for error-spike detection.
     * @returns {object[]} Triggered alerts.
     */
    checkAgents(agents, logStore) {
        const triggered = [];

        for (const rule of this.rules) {
            if (!rule.enabled) continue;
            if (rule.scope !== 'agent') continue;

            for (const agent of agents) {
                try {
                    if (!rule.evaluate(agent, logStore)) continue;
                } catch {
                    continue; // Rule evaluation error — skip silently
                }

                // Cooldown is per rule+agent
                const cooldownKey = `${rule.name}:${agent.id}`;
                const lastTrigger = this.cooldowns.get(cooldownKey) || 0;
                const now = Date.now();
                const cooldownMs = rule.cooldown * 1000;

                if (now - lastTrigger < cooldownMs) {
                    continue;
                }

                const alert = {
                    rule: rule.name,
                    scope: 'agent',
                    agentId: agent.id,
                    agentName: agent.name || agent.id,
                    severity: rule.severity,
                    message: rule.message,
                    timestamp: now,
                };

                triggered.push(alert);
                this.history.push(alert);
                this.cooldowns.set(cooldownKey, now);

                if (this.history.length > this.maxHistory) {
                    this.history = this.history.slice(-this.maxHistory);
                }

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

        // Send webhook if configured
        if (rule.webhook) {
            this.sendWebhook(alert, rule);
        }
    }

    /**
     * Send alert to webhook URL.
     */
    async sendWebhook(alert, rule) {
        const payload = {
            rule: alert.rule,
            cell: alert.cell,
            value: alert.value,
            threshold: alert.threshold,
            operator: alert.operator,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
        };

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(rule.webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.error(`Webhook failed: ${response.status} ${response.statusText}`);
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.error('Webhook timeout:', rule.webhook);
            } else {
                console.error('Webhook error:', err.message);
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
