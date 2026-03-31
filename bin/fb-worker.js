// bin/fb-worker.js
// Worker thread for parallel pixel calculations (High-Performance Architecture)

import { parentPort, workerData } from 'worker_threads';

const { width, height, startY, endY, buffer } = workerData;
const view = new Uint32Array(buffer);

/**
 * Pack RGBA into a single Uint32 value (little-endian: ABGR in memory)
 */
function packRGBA(r, g, b, a = 255) {
    return (a << 24) | (b << 16) | (g << 8) | r;
}

function renderXOR(time) {
    for (let y = startY; y < endY; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
            // XOR pattern: (x ^ y ^ time)
            const gray = (x ^ y ^ time) & 0xFF;
            
            // Dynamic color shift based on time
            const r = gray;
            const g = (gray + (time % 255)) & 0xFF;
            const b = (gray + ((time / 2) % 255)) & 0xFF;
            
            view[rowOffset + x] = packRGBA(r, g, b, 255);
        }
    }
}

function renderPlasma(time) {
    const scale = 0.02;
    for (let y = startY; y < endY; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
            const v1 = Math.sin(x * scale + time);
            const v2 = Math.sin(y * scale + time);
            const v3 = Math.sin((x + y) * scale + time);
            const v4 = Math.sin(Math.sqrt(x * x + y * y) * scale + time);
            
            const v = (v1 + v2 + v3 + v4) / 4;
            const r = Math.floor((Math.sin(v * Math.PI) + 1) * 127);
            const g = Math.floor((Math.sin(v * Math.PI + 2 * Math.PI / 3) + 1) * 127);
            const b = Math.floor((Math.sin(v * Math.PI + 4 * Math.PI / 3) + 1) * 127);
            
            view[rowOffset + x] = packRGBA(r, g, b, 255);
        }
    }
}

function renderMandelbrot(time) {
    const maxIter = 100;
    const zoom = 1.0 + Math.sin(time / 50) * 0.5;
    const centerX = -0.5;
    const centerY = 0;
    
    for (let py = startY; py < endY; py++) {
        const rowOffset = py * width;
        const y0 = (py - height / 2) * (4.0 / (height * zoom)) + centerY;
        
        for (let px = 0; px < width; px++) {
            const x0 = (px - width / 2) * (4.0 / (width * zoom)) + centerX;
            
            let x = 0;
            let y = 0;
            let x2 = 0;
            let y2 = 0;
            let iter = 0;
            
            while (x2 + y2 <= 4 && iter < maxIter) {
                y = 2 * x * y + y0;
                x = x2 - y2 + x0;
                x2 = x * x;
                y2 = y * y;
                iter++;
            }
            
            // Smooth coloring
            if (iter < maxIter) {
                const logZn = Math.log(x2 + y2) / 2;
                const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
                const smoothIter = iter + 1 - nu;
                
                const r = Math.floor(128 + 127 * Math.sin(0.1 * smoothIter + 0));
                const g = Math.floor(128 + 127 * Math.sin(0.1 * smoothIter + 2));
                const b = Math.floor(128 + 127 * Math.sin(0.1 * smoothIter + 4));
                view[rowOffset + px] = packRGBA(r, g, b, 255);
            } else {
                view[rowOffset + px] = packRGBA(0, 0, 0, 255);
            }
        }
    }
}

function renderSpatialGrid(time, cameraX, cameraY, zoom) {
    const viewW = width / zoom;
    const viewH = height / zoom;
    const startWorldX = cameraX - viewW / 2;
    const startWorldY = cameraY - viewH / 2;

    for (let py = startY; py < endY; py++) {
        const rowOffset = py * width;
        const worldY = startWorldY + (py / zoom);
        
        for (let px = 0; px < width; px++) {
            const worldX = startWorldX + (px / zoom);
            
            // Draw grid lines at every 1024 world units
            const isGridX = Math.floor(worldX) % 1024 === 0;
            const isGridY = Math.floor(worldY) % 1024 === 0;
            
            let r = 10, g = 10, b = 20;
            if (isGridX || isGridY) {
                r = 0; g = 100; b = 150; // Cyan grid
            }
            
            // Overlay subtle XOR for spatial texture
            const xor = (Math.floor(worldX) ^ Math.floor(worldY)) & 0x1F;
            view[rowOffset + px] = packRGBA(r + xor, g + xor, b + xor, 255);
        }
    }
}

// Listen for render commands
parentPort.on('message', (msg) => {
    if (msg.type === 'render') {
        const { time, shader, cameraX, cameraY, zoom } = msg;
        if (shader === 'plasma') {
            renderPlasma(time);
        } else if (shader === 'mandelbrot') {
            renderMandelbrot(time);
        } else if (shader === 'spatial-grid') {
            renderSpatialGrid(time, cameraX || 0, cameraY || 0, zoom || 1.0);
        } else {
            renderXOR(time);
        }
        parentPort.postMessage({ type: 'done', threadId: workerData.threadId });
    }
});
