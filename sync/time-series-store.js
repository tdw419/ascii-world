// sync/time-series-store.js
// Time-series storage for historical cell values

export class TimeSeriesStore {
    constructor(options = {}) {
        this.maxPoints = options.maxPoints ?? 1000;
        this.minInterval = options.minInterval ?? 1000; // ms
        this.history = new Map(); // cell -> [{t, v}]
        this.lastRecord = new Map(); // cell -> timestamp
    }

    /**
     * Record a cell value with timestamp.
     */
    record(cell, value) {
        const now = Date.now();
        const last = this.lastRecord.get(cell) || 0;

        // Enforce minimum interval (skip if 0)
        if (this.minInterval > 0 && now - last < this.minInterval) {
            return false;
        }

        let points = this.history.get(cell);
        if (!points) {
            points = [];
            this.history.set(cell, points);
        }

        // Add new point
        points.push({ t: now, v: value });

        // Trim to max points
        if (points.length > this.maxPoints) {
            const trimmed = points.slice(-this.maxPoints);
            points.length = 0;
            points.push(...trimmed);
        }

        this.lastRecord.set(cell, now);
        return true;
    }

    /**
     * Record multiple cells at once.
     */
    recordAll(cells) {
        for (const [cell, value] of Object.entries(cells)) {
            this.record(cell, value);
        }
    }

    /**
     * Get history for a cell.
     */
    getHistory(cell, maxPoints = null) {
        const points = this.history.get(cell);
        if (!points) return [];

        if (maxPoints && points.length > maxPoints) {
            // Return evenly sampled points
            const step = points.length / maxPoints;
            const result = [];
            for (let i = 0; i < maxPoints; i++) {
                const idx = Math.floor(i * step);
                result.push(points[idx]);
            }
            return result;
        }

        return [...points];
    }

    /**
     * Get history for all cells.
     */
    getAllHistory(maxPoints = null) {
        const result = {};
        for (const cell of this.history.keys()) {
            result[cell] = this.getHistory(cell, maxPoints);
        }
        return result;
    }

    /**
     * Get latest values for all cells.
     */
    getLatest() {
        const result = {};
        for (const [cell, points] of this.history) {
            if (points.length > 0) {
                result[cell] = points[points.length - 1].v;
            }
        }
        return result;
    }

    /**
     * Get array of values for a cell (without timestamps).
     */
    getValues(cell, maxPoints = null) {
        const history = this.getHistory(cell, maxPoints);
        return history.map(p => p.v);
    }

    /**
     * Clear history for a cell.
     */
    clear(cell) {
        this.history.delete(cell);
        this.lastRecord.delete(cell);
    }

    /**
     * Clear all history.
     */
    clearAll() {
        this.history.clear();
        this.lastRecord.clear();
    }

    /**
     * Get stats about stored data.
     */
    getStats() {
        const cells = [];
        let totalPoints = 0;

        for (const [cell, points] of this.history) {
            cells.push({
                cell,
                points: points.length,
                first: points[0]?.t,
                last: points[points.length - 1]?.t,
            });
            totalPoints += points.length;
        }

        return {
            cellCount: this.history.size,
            totalPoints,
            maxPoints: this.maxPoints,
            cells,
        };
    }
}
