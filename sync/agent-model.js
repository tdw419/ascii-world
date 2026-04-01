// sync/agent-model.js
// Agent data model for the agent registry

import { randomUUID } from 'node:crypto';

const VALID_STATUSES = ['online', 'offline', 'error'];

export class Agent {
    constructor(data = {}) {
        this.id = data.id || randomUUID();
        this.name = data.name || '';
        this.status = data.status || 'offline';
        this.capabilities = Array.isArray(data.capabilities) ? [...data.capabilities] : [];
        this.lastHeartbeat = data.lastHeartbeat || null;
        this.config = data.config && typeof data.config === 'object' ? { ...data.config } : {};
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    /**
     * Validate agent data, returning an array of error strings.
     * Empty array means valid.
     */
    static validate(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            errors.push('data is required and must be an object');
            return errors;
        }

        if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
            errors.push('name is required');
        }

        if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
            errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
        }

        if (data.capabilities !== undefined && !Array.isArray(data.capabilities)) {
            errors.push('capabilities must be an array');
        }

        if (data.config !== undefined && (data.config === null || typeof data.config !== 'object' || Array.isArray(data.config))) {
            errors.push('config must be an object');
        }

        return errors;
    }

    /**
     * Serialize agent to a plain JSON-compatible object.
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            capabilities: [...this.capabilities],
            lastHeartbeat: this.lastHeartbeat,
            config: { ...this.config },
            createdAt: this.createdAt,
        };
    }

    /**
     * Deserialize a plain object (e.g. a database row) into an Agent instance.
     */
    static fromJSON(row) {
        if (!row || typeof row !== 'object') return null;
        return new Agent({
            id: row.id,
            name: row.name,
            status: row.status,
            capabilities: row.capabilities,
            lastHeartbeat: row.lastHeartbeat,
            config: row.config,
            createdAt: row.createdAt,
        });
    }
}
