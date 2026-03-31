#!/usr/bin/env python3
import json
import math
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path("/home/jericho/zion/projects/ascii_world/ascii_world")
ATTENTION_DATA = PROJECT_ROOT / ".ouroboros" / "visualizations" / "real_attention.json"
OUTPUT_PATH = PROJECT_ROOT / ".ouroboros" / "visualizations" / "neural_paths.json"

def lerp(a, b, t):
    return a + (b - a) * t

def get_bezier_point(p0, p1, p2, t):
    """Quadratic Bezier curve calculation."""
    # B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    x = (1-t)**2 * p0[0] + 2*(1-t)*t * p1[0] + t**2 * p2[0]
    y = (1-t)**2 * p0[1] + 2*(1-t)*t * p1[1] + t**2 * p2[1]
    return (x, y)

def generate_neural_path(start, end, effort=0.5):
    """
    Generate a neural saccade path using a Bezier curve.
    'effort' (0.0 to 1.0) controls how much the path arcs.
    Low effort = direct line. High effort = wide arc (deliberation).
    """
    sx, sy = start['x'], start['y']
    ex, ey = end['x'], end['y']
    
    # Calculate midpoint
    mx, my = (sx + ex) / 2, (sy + ey) / 2
    
    # Calculate perpendicular vector for control point offset
    dx, dy = ex - sx, ey - sy
    dist = math.sqrt(dx*dx + dy*dy)
    if dist == 0: return [start, end]
    
    # Perpendicular vector (unit)
    px, py = -dy / dist, dx / dist
    
    # Offset control point based on effort
    # High effort = more "searching" = wider arc
    offset_magnitude = dist * 0.5 * effort
    cx, cy = mx + px * offset_magnitude, my + py * offset_magnitude
    
    # Sample points along the curve
    # Higher effort = more points for smoother erratic movement
    num_points = int(lerp(5, 20, effort))
    path = []
    for i in range(num_points + 1):
        t = i / num_points
        px, py = get_bezier_point((sx, sy), (cx, cy), (ex, ey), t)
        path.append({"x": px, "y": py})
        
    return path

def process_attention_to_paths():
    if not ATTENTION_DATA.exists():
        print(f"Error: {ATTENTION_DATA} not found. Run inference first.")
        return

    print(f"Reading attention data from {ATTENTION_DATA}...")
    data = json.loads(ATTENTION_DATA.read_text())
    
    saccades = data.get("saccades", [])
    print(f"Processing {len(saccades)} saccades into neural paths...")
    
    neural_paths = []
    for s in saccades:
        # Map 'semantic_similarity' to 'effort'
        # High similarity = Low effort (direct connection)
        # Low similarity = High effort (searching/deliberating)
        sim = s.get("semantic_similarity", 0.5)
        effort = 1.0 - sim
        
        path = generate_neural_path(s["tile_coords"], s["doc_coords"], effort)
        
        neural_paths.append({
            "tile_id": s["tile_id"],
            "doc_id": s["doc_id"],
            "intensity": s["intensity"],
            "similarity": sim,
            "effort": effort,
            "path": path,
            "from_token": s.get("from_token_text", "?"),
            "to_token": s.get("to_token_text", "?"),
            "layer": s["layer"]
        })
        
    # Save the processed paths
    OUTPUT_PATH.write_text(json.dumps({
        "input_text": data["input_text"],
        "paths": neural_paths
    }, indent=2))
    print(f"Neural paths saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    process_attention_to_paths()
