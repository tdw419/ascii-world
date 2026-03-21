#!/bin/bash
# test-sync.sh - Test ASCII-GUI sync

cd "$(dirname "$0")/.."

echo "=== ASCII-GUI Sync Test ==="
echo ""

# Check if server is running
if pgrep -f "sync-server.js" > /dev/null; then
    echo "✓ Sync server is running"
else
    echo "Starting sync server..."
    cd sync && node sync-server.js &
    sleep 2
fi

# Test hash computation
echo ""
echo "Testing hash computation:"
node -e "
import { contentHash, extractHash, verifyHash } from './sync/hash-utils.js';
import fs from 'fs';

const content = fs.readFileSync('./data/dashboard.ascii', 'utf-8');
const result = verifyHash(content);
console.log('  Embedded hash:', result.embedded);
console.log('  Computed hash:', result.computed);
console.log('  Valid:', result.valid ? '✓ YES' : '✗ NO');
"

echo ""
echo "Files being watched:"
ls -la data/*.ascii 2>/dev/null || echo "  No .ascii files in data/"

echo ""
echo "To test in browser:"
echo "  1. Open: file://$(pwd)/ascii_world_template.html"
echo "  2. Watch sync status in the UI"
echo "  3. Edit data/dashboard.ascii"
echo "  4. See GUI update in real-time"
echo ""
echo "WebSocket URL: ws://localhost:3839"
