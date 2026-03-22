// sync/gpu-bridge.js
// JS-native bridge between Geometry OS (Rust) and pxOS (JS)
// No Python intermediate required.

import http from 'http';

export class GpuBridge {
    constructor(cellStore, daemonUrl = 'http://localhost:8769') {
        this.cellStore = cellStore;
        this.daemonUrl = new URL(daemonUrl);
        this.interval = null;
        this.isPolling = false;
    }

    start(ms = 500) {
        console.log(`[GPU-BRIDGE] Starting JS bridge to ${this.daemonUrl}...`);
        this.interval = setInterval(() => this.poll(), ms);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async poll() {
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            const stats = await this.fetchStats();
            this.updateCells(stats);
        } catch (err) {
            this.cellStore.setCells({
                gpu_status: 'OFFLINE',
                gpu_status_color: 'critical',
                gpu_vms: 0,
                gpu_vms_pct: 0
            });
        } finally {
            this.isPolling = false;
        }
    }

    fetchStats() {
        return new Promise((resolve, reject) => {
            const req = http.get(`${this.daemonUrl}status`, { timeout: 1000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    updateCells(stats) {
        // Map Rust stats to JS pxOS cells
        const changes = {
            gpu_status: stats.status === 'running' ? 'ACTIVE' : 'IDLE',
            gpu_status_color: stats.status === 'running' ? 'active' : 'idle',
            gpu_vms: stats.vms || 0,
            gpu_vms_pct: (stats.vms || 0) / 8.0,
            gpu_title: 'GEOMETRY OS (JS-NATIVE MONITOR)',
            last_sync: new Date().toLocaleTimeString()
        };

        this.cellStore.setCells(changes);
    }
}
