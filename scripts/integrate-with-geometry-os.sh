#!/bin/bash
# integrate-with-geometry-os.sh
# Sets up pxOS integration with Geometry OS

set -e

GEOMETRY_OS_PATH="${1:-$HOME/zion/projects/geometry_os}"
PXOS_PATH="$(dirname "$0")/.."

echo "pxOS → Geometry OS Integration"
echo "=============================="
echo "pxOS: $PXOS_PATH"
echo "Geometry OS: $GEOMETRY_OS_PATH"
echo ""

# Check paths exist
if [ ! -d "$GEOMETRY_OS_PATH" ]; then
    echo "Error: Geometry OS not found at $GEOMETRY_OS_PATH"
    exit 1
fi

# Create monitoring directory in Geometry OS
MONITORING_DIR="$GEOMETRY_OS_PATH/monitoring"
mkdir -p "$MONITORING_DIR"

# Create symlink to pxOS viewer
if [ ! -e "$MONITORING_DIR/pxos-viewer" ]; then
    ln -s "$PXOS_PATH/viewer" "$MONITORING_DIR/pxos-viewer"
    echo "Created: $MONITORING_DIR/pxos-viewer → $PXOS_PATH/viewer"
else
    echo "Exists: $MONITORING_DIR/pxos-viewer"
fi

# Create symlink to geometry_os_monitor.py
if [ ! -e "$MONITORING_DIR/geometry_os_monitor.py" ]; then
    ln -s "$PXOS_PATH/agents/geometry_os_monitor.py" "$MONITORING_DIR/geometry_os_monitor.py"
    echo "Created: $MONITORING_DIR/geometry_os_monitor.py"
else
    echo "Exists: $MONITORING_DIR/geometry_os_monitor.py"
fi

echo ""
echo "Integration complete!"
echo ""
echo "Usage:"
echo "  # Start pxOS server"
echo "  cd $PXOS_PATH && npm start"
echo ""
echo "  # Start Geometry OS monitor"
echo "  python agents/geometry_os_monitor.py --geometry-os-path $GEOMETRY_OS_PATH"
echo ""
echo "  # Or with mock data (no Geometry OS needed)"
echo "  python agents/geometry_os_monitor.py --mock"
echo ""
echo "  # Open viewer"
echo "  open viewer/viewer.html"
