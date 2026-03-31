#!/bin/bash
# Full pipeline: OpenMind Query → Neural Paths → Ratification
# Usage: ./run_openmind_pipeline.sh "Your query here"

QUERY="${1:-What is a prime number?}"
OPENMIND_DIR="/home/jericho/zion/projects/openmind"
ASCII_WORLD_DIR="/home/jericho/zion/projects/ascii_world/ascii_world"

echo "════════════════════════════════════════════════════════════"
echo "  OpenMind → Ratification Pipeline"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Query: $QUERY"
echo ""

# Step 1: Run OpenMind inference
echo "▶ Step 1: Running OpenMind inference..."
cd "$OPENMIND_DIR"
source venv/bin/activate
python bin/inference-engine.py --query "$QUERY"
if [ $? -ne 0 ]; then
    echo "Error: OpenMind inference failed"
    exit 1
fi
echo ""

# Copy output to ascii_world
cp "$OPENMIND_DIR/visualizations/real_attention.json" "$ASCII_WORLD_DIR/.ouroboros/visualizations/"

# Step 2: Bridge attention to neural paths
echo "▶ Step 2: Bridging to neural paths..."
cd "$ASCII_WORLD_DIR"
python bin/bridge.py
if [ $? -ne 0 ]; then
    echo "Error: Bridge failed"
    exit 1
fi
echo ""

# Step 3: Run ratification
echo "▶ Step 3: Evaluating ratification..."
python bin/ratification.py
if [ $? -ne 0 ]; then
    echo "Error: Ratification failed"
    exit 1
fi
echo ""

# Step 4: Show result
echo "════════════════════════════════════════════════════════════"
echo "  Pipeline Complete"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Results:"
echo "  - Attention data: .ouroboros/visualizations/real_attention.json"
echo "  - Neural paths:  .ouroboros/visualizations/neural_paths.json"
echo "  - Decision:      .ouroboros/visualizations/ratified_decision.json"
echo ""
echo "To visualize: Upload neural_paths.json to GPU + use openmind_shimmer.wgsl"
echo ""