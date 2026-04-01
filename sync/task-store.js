// sync/task-store.js
// In-memory task store with persistence for the agent task queue

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { Task } from './task-model.js';

const DEFAULT_DATA_PATH = join(process.cwd(), 'data', 'tasks.json');

export class TaskStore {
    /**
     * @param {object} [options]
     * @param {string} [options.dataPath] - Path to the JSON file for persist/load.
     */
    constructor(options = {}) {
        this._tasks = new Map();
        this._dataPath = options.dataPath || DEFAULT_DATA_PATH;
    }

    /**
     * Create a new pending task.
     * @param {object} payload - JSON-serializable task payload.
     * @param {number} [priority=1] - 0=low, 1=normal, 2=high.
     * @returns {Task}
     */
    create(payload, priority = 1) {
        const task = new Task({ payload, priority, status: 'pending' });
        this._tasks.set(task.id, task);
        return task;
    }

    /**
     * Get a task by ID.
     * @param {string} id
     * @returns {Task|null}
     */
    get(id) {
        return this._tasks.get(id) || null;
    }

    /**
     * List tasks, optionally filtered and sorted.
     * Sort order: priority descending, then createdAt ascending.
     * @param {object} [filters]
     * @param {string} [filters.status] - Filter by status.
     * @param {string} [filters.agentId] - Filter by agentId.
     * @returns {Task[]}
     */
    list(filters = {}) {
        let results = [...this._tasks.values()];

        if (filters.status !== undefined) {
            results = results.filter(t => t.status === filters.status);
        }
        if (filters.agentId !== undefined) {
            results = results.filter(t => t.agentId === filters.agentId);
        }

        // Sort: priority desc, then createdAt asc
        results.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.createdAt.localeCompare(b.createdAt);
        });

        return results;
    }

    /**
     * Atomically claim the highest-priority pending task for an agent.
     * @param {string} agentId - The agent claiming the task.
     * @returns {Task|null} - The claimed task, or null if none available.
     */
    claim(agentId) {
        const pending = this.list({ status: 'pending' });
        if (pending.length === 0) return null;

        const task = pending[0]; // highest priority, oldest first
        task.status = 'running';
        task.agentId = agentId;
        task.startedAt = new Date().toISOString();
        return task;
    }

    /**
     * Mark a task as completed with a result.
     * @param {string} id
     * @param {*} result - JSON-serializable result.
     * @returns {Task|null}
     */
    complete(id, result) {
        const task = this._tasks.get(id);
        if (!task) return null;

        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date().toISOString();
        return task;
    }

    /**
     * Mark a task as failed with an error message.
     * @param {string} id
     * @param {string} error
     * @returns {Task|null}
     */
    fail(id, error) {
        const task = this._tasks.get(id);
        if (!task) return null;

        task.status = 'failed';
        task.error = typeof error === 'string' ? error : String(error);
        task.completedAt = new Date().toISOString();
        return task;
    }

    /**
     * Persist all tasks to the data file.
     * @returns {Promise<void>}
     */
    async persist() {
        const tasks = [...this._tasks.values()].map(t => t.toJSON());
        const data = JSON.stringify({ version: 1, tasks }, null, 2);
        await mkdir(dirname(this._dataPath), { recursive: true });
        await writeFile(this._dataPath, data, 'utf8');
    }

    /**
     * Load tasks from the data file, replacing any in-memory tasks.
     * @returns {Promise<void>}
     */
    async load() {
        try {
            const raw = await readFile(this._dataPath, 'utf8');
            const data = JSON.parse(raw);
            this._tasks.clear();
            if (data && Array.isArray(data.tasks)) {
                for (const row of data.tasks) {
                    const task = Task.fromJSON(row);
                    if (task) this._tasks.set(task.id, task);
                }
            }
        } catch {
            // File doesn't exist or is invalid -- start empty
            this._tasks.clear();
        }
    }

    /**
     * Return counts by status.
     * @returns {{pending: number, running: number, completed: number, failed: number}}
     */
    getStats() {
        const stats = { pending: 0, running: 0, completed: 0, failed: 0 };
        for (const task of this._tasks.values()) {
            if (stats[task.status] !== undefined) {
                stats[task.status]++;
            }
        }
        return stats;
    }
}
