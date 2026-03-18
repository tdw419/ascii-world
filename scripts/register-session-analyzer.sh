#!/bin/bash
# Register the Session Analyzer app with the ASCII Interface Manager

set -e

MANAGER_URL="http://localhost:3422"
PROJECT_PATH="/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app"
PROJECT_PORT=3421

echo "Registering Session Analyzer with Manager..."

# Check if manager is running
if ! curl -s "$MANAGER_URL/health" > /dev/null 2>&1; then
    echo "Error: Manager not running at $MANAGER_URL"
    echo "Start it with: bun run src/manager/manager-server.ts"
    exit 1
fi

# Register the project
RESPONSE=$(curl -s -X POST "$MANAGER_URL/projects" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$PROJECT_PATH\", \"port\": $PROJECT_PORT}")

echo "Response: $RESPONSE"

# Check if registration was successful
if echo "$RESPONSE" | grep -q '"id"'; then
    echo "✓ Session Analyzer registered successfully"
    echo ""
    echo "Available commands:"
    echo "  curl $MANAGER_URL/projects                    # List all projects"
    echo "  curl $MANAGER_URL/projects/session-analyzer-app/view     # View ASCII"
    echo "  curl -X POST $MANAGER_URL/projects/session-analyzer-app/control -d '{\"label\":\"A\"}'"
else
    echo "✗ Registration failed"
    exit 1
fi
