// sync/spatial-manager.js
// Spatial Quadtree Manager for Geometry OS
// "The Screen is the Hard Drive" — Files are regions of space.

export class SpatialNode {
    constructor(x, y, size, data = null) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.data = data; // File metadata, color, or shader type
        this.children = null; // [TL, TR, BL, BR]
        this.isDivided = false;
    }

    subdivide() {
        const half = this.size / 2;
        this.children = [
            new SpatialNode(this.x, this.y, half), // Top-Left
            new SpatialNode(this.x + half, this.y, half), // Top-Right
            new SpatialNode(this.x, this.y + half, half), // Bottom-Left
            new SpatialNode(this.x + half, this.y + half, half) // Bottom-Right
        ];
        this.isDivided = true;
    }

    insert(x, y, data) {
        // If the point is not in this node, return
        if (x < this.x || x >= this.x + this.size || y < this.y || y >= this.y + this.size) {
            return false;
        }

        // If this is a leaf and too big, subdivide (simplified threshold: 1 item per leaf)
        if (!this.isDivided && this.data === null) {
            this.data = data;
            return true;
        }

        if (!this.isDivided) {
            this.subdivide();
            // Move existing data to children
            const oldData = this.data;
            this.data = null;
            this.insert(oldData.x, oldData.y, oldData);
        }

        for (const child of this.children) {
            if (child.insert(x, y, data)) return true;
        }

        return false;
    }

    /**
     * Query nodes within a rectangular range
     */
    query(rangeX, rangeY, rangeW, rangeH, found = []) {
        // If range doesn't intersect this node, return
        if (rangeX + rangeW < this.x || rangeX >= this.x + this.size ||
            rangeY + rangeH < this.y || rangeY >= this.y + this.size) {
            return found;
        }

        if (this.isDivided) {
            for (const child of this.children) {
                child.query(rangeX, rangeY, rangeW, rangeH, found);
            }
        } else if (this.data) {
            found.push(this.data);
        }

        return found;
    }
}

export class SpatialManager {
    constructor(worldSize = 1048576) { // 2^20 virtual world size
        this.root = new SpatialNode(0, 0, worldSize);
        this.worldSize = worldSize;
        
        // Camera state
        this.cameraX = worldSize / 2;
        this.cameraY = worldSize / 2;
        this.zoom = 1.0;
    }

    addFile(x, y, name, color = [0, 255, 255]) {
        this.root.insert(x, y, { x, y, name, color });
    }

    /**
     * Get visible nodes based on camera
     */
    getVisible(viewportW, viewportH) {
        const viewW = viewportW / this.zoom;
        const viewH = viewportH / this.zoom;
        const x = this.cameraX - viewW / 2;
        const y = this.cameraY - viewH / 2;
        
        return this.root.query(x, y, viewW, viewH);
    }

    moveCamera(dx, dy) {
        this.cameraX += dx / this.zoom;
        this.cameraY += dy / this.zoom;
    }

    adjustZoom(factor) {
        this.zoom *= factor;
    }
}
