// sync/agent-registry.js
// Agent Registry — in-memory store backed by data/agents.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Agent } from './agent-model.js';

export class AgentRegistry extends EventTarget {
    /**
     * @param {object} [options]
     * @param {string} [options.filePath] - Path to the JSON persistence file.
     */
    constructor(options = {}) {
        super();
        this.filePath = options.filePath || 'data/agents.json';
        this._agents = new Map();
        this._livenessTimer = null;
    }

    /**
     * Register a new agent from raw data.
     * Validates the data, creates an Agent, stores it, and persists.
     * @param {object} data - Fields forwarded to the Agent constructor.
     * @returns {{ agent: Agent, errors: string[] }}
     */
    register(data) {
        const errors = Agent.validate(data);
        if (errors.length > 0) return { agent: null, errors };

        const agent = new Agent(data);
        this._agents.set(agent.id, agent);
        this._persist();
        return { agent, errors: [] };
    }

    /**
     * Retrieve an agent by id.
     * @param {string} id
     * @returns {Agent|null}
     */
    get(id) {
        return this._agents.get(id) || null;
    }

    /**
     * Return all registered agents as an array.
     * @returns {Agent[]}
     */
    list() {
        return Array.from(this._agents.values());
    }

    /**
     * Record a heartbeat for an agent, setting it online.
     * @param {string} id
     * @returns {boolean} true if the agent was found and updated.
     */
    heartbeat(id) {
        const agent = this._agents.get(id);
        if (!agent) return false;
        agent.lastHeartbeat = new Date().toISOString();
        agent.status = 'online';
        this._persist();
        return true;
    }

    /**
     * Patch an existing agent's fields.
     * @param {string} id
     * @param {object} changes - Partial fields to merge into the agent.
     * @returns {Agent|null} The updated agent, or null if not found.
     */
    update(id, changes) {
        const agent = this._agents.get(id);
        if (!agent) return null;

        if (changes.name !== undefined) agent.name = changes.name;
        if (changes.status !== undefined) agent.status = changes.status;
        if (changes.capabilities !== undefined) {
            agent.capabilities = Array.isArray(changes.capabilities)
                ? [...changes.capabilities]
                : agent.capabilities;
        }
        if (changes.config !== undefined) {
            agent.config = changes.config && typeof changes.config === 'object'
                ? { ...changes.config }
                : agent.config;
        }

        this._persist();
        return agent;
    }

    /**
     * Remove an agent by id.
     * @param {string} id
     * @returns {boolean} true if the agent existed and was removed.
     */
    remove(id) {
        const existed = this._agents.delete(id);
        if (existed) this._persist();
        return existed;
    }

    /**
     * Load agents from the JSON file. Merges into the in-memory map.
     */
    load() {
        if (!existsSync(this.filePath)) return;
        try {
            const raw = readFileSync(this.filePath, 'utf-8');
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return;
            for (const row of arr) {
                const agent = Agent.fromJSON(row);
                if (agent) this._agents.set(agent.id, agent);
            }
        } catch {
            // Corrupt or unreadable file — start empty
        }
    }

    /**
     * Start a periodic liveness check that marks agents as offline or error
     * based on how stale their lastHeartbeat is.
     *
     * - No heartbeat or >60s old → offline
     * - >120s old → error
     *
     * Emits 'agent:offline' and 'agent:error' events on status transitions.
     *
     * @param {number} [intervalMs=30000] - Check interval in milliseconds.
     */
    startLivenessCheck(intervalMs = 30000) {
        this.stopLivenessCheck();
        this._livenessTimer = setInterval(() => this._checkLiveness(), intervalMs);
        // Allow the process to exit even if the timer is running
        if (this._livenessTimer.unref) this._livenessTimer.unref();
    }

    /**
     * Stop the periodic liveness check.
     */
    stopLivenessCheck() {
        if (this._livenessTimer) {
            clearInterval(this._livenessTimer);
            this._livenessTimer = null;
        }
    }

    /**
     * Run a single liveness pass over all registered agents.
     * @private
     */
    _checkLiveness() {
        const now = Date.now();
        for (const agent of this._agents.values()) {
            if (!agent.lastHeartbeat) {
                // Never heartbeated — leave as-is (likely just registered)
                continue;
            }
            const ageMs = now - new Date(agent.lastHeartbeat).getTime();
            const prevStatus = agent.status;

            if (ageMs > 120_000 && prevStatus !== 'error') {
                agent.status = 'error';
                this._persist();
                this.dispatchEvent(new CustomEvent('agent:error', { detail: { agent } }));
            } else if (ageMs > 60_000 && prevStatus === 'online') {
                agent.status = 'offline';
                this._persist();
                this.dispatchEvent(new CustomEvent('agent:offline', { detail: { agent } }));
            }
        }
    }

    /**
     * Write the current map to disk as a JSON array.
     * @private
     */
    _persist() {
        try {
            const dir = dirname(this.filePath);
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            const arr = Array.from(this._agents.values()).map(a => a.toJSON());
            writeFileSync(this.filePath, JSON.stringify(arr, null, 2));
        } catch {
            // Persistence failure is non-fatal for an in-memory store
        }
    }
}
