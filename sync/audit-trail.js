// sync/audit-trail.js
// Append-only JSONL audit trail writer

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class AuditTrail {
    /**
     * @param {object} [options]
     * @param {string} [options.filePath] - Path to the JSONL file.
     * @param {number} [options.maxReadEntries=200] - Max entries returned by default from query().
     */
    constructor(options = {}) {
        this.filePath = options.filePath || 'data/audit.jsonl';
        this.maxReadEntries = options.maxReadEntries || 200;
    }

    /**
     * Append an audit entry to the JSONL file.
     * @param {string} event - Event type (e.g. 'agent.registered').
     * @param {object} [data={}] - Event payload.
     * @returns {{ timestamp: string, event: string, data: object }}
     */
    append(event, data = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            event,
            data,
        };
        try {
            const dir = dirname(this.filePath);
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            appendFileSync(this.filePath, JSON.stringify(entry) + '\n');
        } catch {
            // Write failure is non-fatal; entry is still returned for in-memory use
        }
        return entry;
    }

    /**
     * Query recent audit entries.
     * @param {object} [options]
     * @param {string} [options.agentId] - Filter entries where data.agentId matches.
     * @param {number} [options.limit] - Max entries to return (default: maxReadEntries).
     * @returns {Array<{ timestamp: string, event: string, data: object }>}
     */
    query(options = {}) {
        const limit = options.limit || this.maxReadEntries;

        if (!existsSync(this.filePath)) return [];

        let lines;
        try {
            const raw = readFileSync(this.filePath, 'utf-8');
            lines = raw.split('\n').filter(l => l.trim() !== '');
        } catch {
            return [];
        }

        let entries = lines.map(line => {
            try { return JSON.parse(line); }
            catch { return null; }
        }).filter(Boolean);

        if (options.agentId) {
            entries = entries.filter(e => e.data && e.data.agentId === options.agentId);
        }

        // Return the most recent `limit` entries
        return entries.slice(-limit);
    }
}
