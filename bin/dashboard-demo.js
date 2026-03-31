#!/usr/bin/env node
// dashboard-demo.js — System dashboard using ScreenManager

import { ScreenManager } from '../sync/screen-manager.js';

async function main() {
    const screen = new ScreenManager();
    
    // 1. Draw Static Header
    const title = " GEOMETRY OS | SPATIAL SUBSTRATE | v0.1 ";
    const bar = "═".repeat(screen.cols);
    
    screen.write(bar, 0, 0, [0, 255, 255, 255]);
    screen.write(title, Math.floor((screen.cols - title.length)/2), 1, [255, 255, 255, 255], [0, 80, 80, 255]);
    screen.write(bar, 0, 2, [0, 255, 255, 255]);

    // 2. Setup Log Area
    const logStartRow = 4;
    const logMaxRows = screen.rows - 6;
    let logRow = logStartRow;

    function log(msg, color = [0, 255, 0, 255]) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const line = `[${timestamp}] ${msg}`;
        
        if (logRow >= logStartRow + logMaxRows) {
            // Simple scroll logic for the log area
            // For now, let's just clear and restart (real scrolling would shift grid)
            for(let r = logStartRow; r < logStartRow + logMaxRows; r++) {
                for(let c = 0; c < screen.cols; c++) screen.setCell(c, r, ' ');
            }
            logRow = logStartRow;
        }
        
        screen.write(line, 2, logRow, color);
        logRow++;
        screen.flush();
    }

    // 3. Draw some initial content
    log("Initializing GPU Bridge...");
    log("Loading Glyph Atlas (6x10 bitmaps)...", [255, 255, 0, 255]);
    log("Mapping /dev/fb0 to PixelBuffer...", [0, 255, 255, 255]);
    log("System Ready.", [255, 255, 255, 255]);

    // 4. Simulate activity
    let count = 0;
    const interval = setInterval(() => {
        const colors = [
            [0, 255, 0, 255],
            [255, 255, 0, 255],
            [0, 255, 255, 255],
            [255, 0, 255, 255]
        ];
        log(`Packet received: SEQ=${count} LEN=${Math.floor(Math.random()*1024)}`, colors[count % colors.length]);
        
        // Update a "status" indicator in the corner
        const status = ` UPTIME: ${Math.floor(process.uptime())}s | PACKETS: ${count} `;
        screen.write(status, screen.cols - status.length - 1, 1, [0, 0, 0, 255], [0, 255, 0, 255]);
        
        count++;
        if (count > 50) {
            clearInterval(interval);
            console.log("Demo finished.");
        }
    }, 500);
}

main().catch(console.error);
