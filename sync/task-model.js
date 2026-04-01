// sync/task-model.js
// Task data model for the agent task queue

import { randomUUID } from 'node:crypto';

const VALID_STATUSES = ['pending', 'running', 'completed', 'failed'];
const VALID_PRIORITIES = [0, 1, 2];

export class Task {
    constructor(data = {}) {
        this.id = data.id || randomUUID();
        this.agentId = data.agentId || null;
        this.status = data.status || 'pending';
        this.payload = data.payload && typeof data.payload === 'object' ? { ...data.payload } : {};
        this.result = data.result !== undefined ? data.result : null;
        this.error = data.error || null;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.startedAt = data.startedAt || null;
        this.completedAt = data.completedAt || null;
        this.priority = data.priority !== undefined ? data.priority : 1;
    }

    /**
     * Validate task data, returning an array of error strings.
     * Empty array means valid.
     */
    static validate(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            errors.push('data is required and must be an object');
            return errors;
        }

        if (!data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) {
            errors.push('payload is required and must be a valid JSON object');
        } else {
            // Verify it's serializable (valid JSON)
            try {
                JSON.stringify(data.payload);
            } catch {
                errors.push('payload must be serializable to JSON');
            }
        }

        if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
            errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
        }

        if (data.priority !== undefined && !VALID_PRIORITIES.includes(data.priority)) {
            errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
        }

        if (data.agentId !== undefined && data.agentId !== null && typeof data.agentId !== 'string') {
            errors.push('agentId must be a string or null');
        }

        return errors;
    }

    /**
     * Serialize task to a plain JSON-compatible object.
     */
    toJSON() {
        return {
            id: this.id,
            agentId: this.agentId,
            status: this.status,
            payload: { ...this.payload },
            result: this.result,
            error: this.error,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            priority: this.priority,
        };
    }

    /**
     * Deserialize a plain object into a Task instance.
     */
    static fromJSON(row) {
        if (!row || typeof row !== 'object') return null;
        return new Task({
            id: row.id,
            agentId: row.agentId,
            status: row.status,
            payload: row.payload,
            result: row.result,
            error: row.error,
            createdAt: row.createdAt,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            priority: row.priority,
        });
    }

    /**
     * Check if this task has exceeded the given timeout.
     * Only meaningful for tasks with status 'running'.
     * @param {number} timeoutMs - Timeout in milliseconds.
     * @returns {boolean}
     */
    isExpired(timeoutMs) {
        if (this.status !== 'running' || !this.startedAt) return false;
        const elapsed = Date.now() - new Date(this.startedAt).getTime();
        return elapsed > timeoutMs;
    }
}
