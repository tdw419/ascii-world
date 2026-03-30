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

    /**
     * Push pixels (SIT bonds) directly to the hardware VRAM via Hilbert Clock poke.
     * @param {Array<{x: number, y: number, r: number, g: number, b: number}>} pixels 
     */
    async pushPixels(pixels) {
        console.log(`[GPU-BRIDGE] Pushing ${pixels.length} pixels to hardware...`);
        
        for (const px of pixels) {
            // Calculate 1D address (simple linear mapping for now, or Hilbert if required)
            // Infinite Map uses linear addresses for pokes
            const addr = px.y * 2560 + px.x; 
            
            // Pack RGBA (8-bit each) into 32-bit uint
            // Format: 0xRRGGBBAA
            const val = (px.r << 24) | (px.g << 16) | (px.b << 8) | 0xFF;
            
            try {
                await this.poke(addr, val);
            } catch (err) {
                console.error(`[GPU-BRIDGE] Poke failed at ${px.x},${px.y}:`, err.message);
            }
        }
    }

    /**
     * Call the /poke endpoint on the Rust daemon.
     */
    poke(addr, val) {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.daemonUrl}poke`);
            url.searchParams.set('addr', `0x${addr.toString(16)}`);
            
            const req = http.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                }
            }, (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve());
            });

            req.on('error', reject);
            req.write(`0x${val.toString(16).padStart(8, '0')}`);
            req.end();
        });
    }
}
