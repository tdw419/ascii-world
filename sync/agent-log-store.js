// sync/agent-log-store.js
// In-memory ring buffer per agent for log aggregation

export class AgentLogStore {
    /**
     * @param {object} [options]
     * @param {number} [options.maxEntries=1000] - Max log entries per agent ring buffer.
     */
    constructor(options = {}) {
        this.maxEntries = options.maxEntries || 1000;
        this._buffers = new Map(); // agentId -> Array<{timestamp, level, message}>
    }

    /**
     * Append a log entry for an agent.
     * @param {string} agentId
     * @param {{ level?: string, message: string }} entry
     * @returns {{ timestamp: number, level: string, message: string }}
     */
    append(agentId, entry) {
        if (!this._buffers.has(agentId)) {
            this._buffers.set(agentId, []);
        }
        const buf = this._buffers.get(agentId);
        const record = {
            timestamp: Date.now(),
            level: entry.level || 'info',
            message: entry.message || '',
        };
        buf.push(record);
        // Ring buffer: trim from the front if over capacity
        if (buf.length > this.maxEntries) {
            buf.splice(0, buf.length - this.maxEntries);
        }
        return record;
    }

    /**
     * Get recent log entries for an agent.
     * @param {string} agentId
     * @param {object} [options]
     * @param {number} [options.limit=50] - Max entries to return.
     * @param {string} [options.level] - Filter by log level (error|warn|info).
     * @returns {Array<{timestamp: number, level: string, message: string}>}
     */
    getLogs(agentId, options = {}) {
        const buf = this._buffers.get(agentId);
        if (!buf) return [];

        let entries = buf;
        if (options.level) {
            entries = entries.filter(e => e.level === options.level);
        }

        const limit = options.limit || 50;
        // Return last N entries
        return entries.slice(-limit);
    }

    /**
     * Clear all log entries for an agent.
     * @param {string} agentId
     */
    clear(agentId) {
        this._buffers.delete(agentId);
    }

    /**
     * Clear all log entries for all agents.
     */
    clearAll() {
        this._buffers.clear();
    }
}
