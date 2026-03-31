#!/bin/bash
# Rhythmbox Remote Launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3840
LOG_FILE="/tmp/rhythmbox-remote.log"

# Check if already running
if ss -tlnp 2>/dev/null | grep -q ":$PORT"; then
    echo "Server already running on port $PORT"
else
    echo "Starting Rhythmbox Remote server..."
    cd "$SCRIPT_DIR"
    nohup node server.js > "$LOG_FILE" 2>&1 &
    # Wait for server to start
    for i in {1..10}; do
        if ss -tlnp 2>/dev/null | grep -q ":$PORT"; then
            echo "Server started"
            break
        fi
        sleep 0.5
    done
fi

# Open in browser
echo "Opening browser..."
xdg-open "http://localhost:$PORT"
