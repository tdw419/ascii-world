// agents/sdk.js
// pxOS Agent SDK for JavaScript/Node.js
//
// Provides a client for registering with the pxOS Agent Registry,
// sending heartbeats, reporting metrics, and working with the task queue.

import { randomUUID } from 'node:crypto';

export class AgentSDK {
    /**
     * @param {object} [options]
     * @param {string} [options.baseUrl='http://localhost:3839']
     * @param {typeof fetch} [options.fetch] - Custom fetch implementation (for testing).
     */
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl || 'http://localhost:3839').replace(/\/+$/, '');
        this._fetch = options.fetch || globalThis.fetch;
        this.agentId = null;
        this.agentData = null;
    }

    /**
     * Make an HTTP request to the pxOS server.
     * @param {string} method
     * @param {string} path
     * @param {object} [body]
     * @returns {Promise<object|null>}
     */
    async _request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body !== undefined) {
            opts.body = JSON.stringify(body);
        }

        const res = await this._fetch(url, opts);
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch {}

        if (!res.ok) {
            const detail = data || { error: text };
            throw new Error(`HTTP ${res.status} on ${method} ${path}: ${JSON.stringify(detail)}`);
        }
        return data;
    }

    /**
     * Register this agent with the server.
     * @param {string} name
     * @param {object} [options]
     * @param {string[]} [options.capabilities]
     * @param {object} [options.config]
     * @returns {Promise<object>}
     */
    async register(name, options = {}) {
        const payload = { name };
        if (options.capabilities) payload.capabilities = options.capabilities;
        if (options.config) payload.config = options.config;

        const result = await this._request('POST', '/api/v1/agents', payload);
        this.agentId = result.id;
        this.agentData = result;
        return result;
    }

    /**
     * Send a heartbeat for the registered agent.
     * @returns {Promise<boolean>}
     */
    async heartbeat() {
        this._requireRegistered();
        await this._request('PUT', `/api/v1/agents/${this.agentId}/heartbeat`);
        return true;
    }

    /**
     * Report a metric value.
     * @param {string} key
     * @param {number|string} value
     * @returns {Promise<object>}
     */
    async reportMetric(key, value) {
        this._requireRegistered();
        const scopedKey = `agent:${this.agentId}:${key}`;
        return this._request('POST', '/api/v1/cells', { [scopedKey]: value });
    }

    /**
     * Claim the highest-priority pending task.
     * GETs pending tasks, then PUTs claim on the first one.
     * @returns {Promise<object|null>} The claimed task, or null if none available.
     */
    async claimTask() {
        this._requireRegistered();
        const tasks = await this._request('GET', '/api/v1/tasks?status=pending');
        if (!tasks || tasks.length === 0) return null;

        const taskId = tasks[0].id;
        return this._request('PUT', `/api/v1/tasks/${taskId}/claim`, {
            agentId: this.agentId,
        });
    }

    /**
     * Mark a task as completed.
     * @param {string} taskId
     * @param {*} [result]
     * @returns {Promise<object>}
     */
    async completeTask(taskId, result) {
        return this._request('PUT', `/api/v1/tasks/${taskId}/complete`, { result });
    }

    /**
     * Mark a task as failed.
     * @param {string} taskId
     * @param {string} error
     * @returns {Promise<object>}
     */
    async failTask(taskId, error) {
        return this._request('PUT', `/api/v1/tasks/${taskId}/fail`, { error });
    }

    /**
     * Create a new task in the queue.
     * @param {object} payload
     * @param {number} [priority]
     * @returns {Promise<object>}
     */
    async createTask(payload, priority) {
        const body = { payload };
        if (priority !== undefined) body.priority = priority;
        return this._request('POST', '/api/v1/tasks', body);
    }

    _requireRegistered() {
        if (!this.agentId) {
            throw new Error('Agent not registered. Call register() first.');
        }
    }
}
