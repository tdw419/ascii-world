// infinite-map.js — Sparse chunked pixel storage for infinite coordinate space
// Part of the "pixels move pixels" vision: any (x, y) coordinate, chunks allocated on demand

/**
 * A single chunk of the infinite map (e.g., 256×256 pixels)
 */
class Chunk {
    constructor(chunkX, chunkY, size = 256) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.size = size;
        this.data = new Uint8ClampedArray(size * size * 4);
        // Initialize to transparent black
        this.data.fill(0);
        this.lastAccess = Date.now();
        this.writerId = null; // For sovereignty tracking
    }

    worldToChunk(wx, wy) {
        return {
            x: ((wx % this.size) + this.size) % this.size,
            y: ((wy % this.size) + this.size) % this.size
        };
    }

    setPixel(wx, wy, r, g, b, a = 255) {
        const { x, y } = this.worldToChunk(wx, wy);
        const idx = (y * this.size + x) * 4;
        this.data[idx] = r;
        this.data[idx + 1] = g;
        this.data[idx + 2] = b;
        this.data[idx + 3] = a;
        this.lastAccess = Date.now();
    }

    getPixel(wx, wy) {
        const { x, y } = this.worldToChunk(wx, wy);
        const idx = (y * this.size + x) * 4;
        return [
            this.data[idx],
            this.data[idx + 1],
            this.data[idx + 2],
            this.data[idx + 3]
        ];
    }

    // Get region for reading as instructions
    getRegion(sx, sy, w, h) {
        const region = new Uint8ClampedArray(w * h * 4);
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const cx = ((sx + dx) % this.size + this.size) % this.size;
                const cy = ((sy + dy) % this.size + this.size) % this.size;
                const srcIdx = (cy * this.size + cx) * 4;
                const dstIdx = (dy * w + dx) * 4;
                region[dstIdx] = this.data[srcIdx];
                region[dstIdx + 1] = this.data[srcIdx + 1];
                region[dstIdx + 2] = this.data[srcIdx + 2];
                region[dstIdx + 3] = this.data[srcIdx + 3];
            }
        }
        return region;
    }
}

/**
 * InfiniteMap — Sparse storage for any (x, y) coordinate
 * Chunks are allocated on first write, garbage collected when empty/old
 */
export class InfiniteMap {
    constructor(options = {}) {
        this.chunkSize = options.chunkSize || 256;
        this.chunks = new Map(); // "cx,cy" -> Chunk
        this.maxChunks = options.maxChunks || 1000;
        this.accessLog = []; // For sovereignty tracking
    }

    _chunkKey(cx, cy) {
        return `${cx},${cy}`;
    }

    _worldToChunk(wx, wy) {
        // Handle negative coordinates correctly
        const cx = Math.floor(wx / this.chunkSize);
        const cy = Math.floor(wy / this.chunkSize);
        return { cx, cy };
    }

    _getOrCreateChunk(cx, cy) {
        const key = this._chunkKey(cx, cy);
        let chunk = this.chunks.get(key);
        if (!chunk) {
            // Garbage collect if at limit
            if (this.chunks.size >= this.maxChunks) {
                this._gcOldestChunk();
            }
            chunk = new Chunk(cx, cy, this.chunkSize);
            this.chunks.set(key, chunk);
        }
        chunk.lastAccess = Date.now();
        return chunk;
    }

    _gcOldestChunk() {
        let oldest = null;
        let oldestKey = null;
        for (const [key, chunk] of this.chunks) {
            if (!oldest || chunk.lastAccess < oldest.lastAccess) {
                oldest = chunk;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.chunks.delete(oldestKey);
        }
    }

    // === PUBLIC API ===

    /**
     * Set a pixel at any world coordinate
     */
    setPixel(wx, wy, r, g, b, a = 255, writerId = null) {
        const { cx, cy } = this._worldToChunk(wx, wy);
        const chunk = this._getOrCreateChunk(cx, cy);
        chunk.setPixel(wx, wy, r, g, b, a);
        
        // Track writer for sovereignty
        if (writerId) {
            chunk.writerId = writerId;
            this.accessLog.push({ wx, wy, writerId, ts: Date.now() });
        }
    }

    /**
     * Get a pixel at any world coordinate (returns [0,0,0,0] if chunk doesn't exist)
     */
    getPixel(wx, wy) {
        const { cx, cy } = this._worldToChunk(wx, wy);
        const key = this._chunkKey(cx, cy);
        const chunk = this.chunks.get(key);
        if (!chunk) return [0, 0, 0, 0];
        return chunk.getPixel(wx, wy);
    }

    /**
     * Get a region of pixels (for reading as instructions)
     */
    getRegion(wx, wy, w, h) {
        // For now, only support single-chunk regions
        // TODO: Multi-chunk regions
        const { cx, cy } = this._worldToChunk(wx, wy);
        const key = this._chunkKey(cx, cy);
        const chunk = this.chunks.get(key);
        if (!chunk) {
            return new Uint8ClampedArray(w * h * 4);
        }
        
        const localX = ((wx % this.chunkSize) + this.chunkSize) % this.chunkSize;
        const localY = ((wy % this.chunkSize) + this.chunkSize) % this.chunkSize;
        return chunk.getRegion(localX, localY, w, h);
    }

    /**
     * Write a region of pixels (for VM output)
     */
    setRegion(wx, wy, w, h, data, writerId = null) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const srcIdx = (dy * w + dx) * 4;
                this.setPixel(
                    wx + dx, wy + dy,
                    data[srcIdx], data[srcIdx + 1], data[srcIdx + 2], data[srcIdx + 3],
                    writerId
                );
            }
        }
    }

    /**
     * Get chunk statistics (for sovereignty calculation)
     */
    getStats() {
        const writerCounts = new Map();
        let totalPixels = 0;
        
        for (const chunk of this.chunks.values()) {
            if (chunk.writerId) {
                writerCounts.set(chunk.writerId, (writerCounts.get(chunk.writerId) || 0) + 1);
            }
            totalPixels += this.chunkSize * this.chunkSize;
        }
        
        return {
            chunkCount: this.chunks.size,
            totalPixels,
            writerCounts: Object.fromEntries(writerCounts),
            maxChunks: this.maxChunks
        };
    }

    /**
     * Find who controls 51%+ of the map
     */
    getSovereign() {
        const stats = this.getStats();
        const total = stats.chunkCount;
        if (total === 0) return null;
        
        for (const [writerId, count] of Object.entries(stats.writerCounts)) {
            if (count / total > 0.51) {
                return writerId;
            }
        }
        return null; // No sovereign yet
    }

    /**
     * Export a chunk as PNG
     */
    async exportChunk(cx, cy) {
        const key = this._chunkKey(cx, cy);
        const chunk = this.chunks.get(key);
        if (!chunk) return null;
        
        const sharp = (await import('sharp')).default;
        return sharp(Buffer.from(chunk.data), {
            raw: { width: chunk.size, height: chunk.size, channels: 4 }
        }).png().toBuffer();
    }

    /**
     * List all chunks with coordinates
     */
    listChunks() {
        const list = [];
        for (const [key, chunk] of this.chunks) {
            list.push({
                key,
                x: chunk.chunkX * this.chunkSize,
                y: chunk.chunkY * this.chunkSize,
                size: chunk.size,
                writerId: chunk.writerId,
                lastAccess: chunk.lastAccess
            });
        }
        return list;
    }
}

export { Chunk };
