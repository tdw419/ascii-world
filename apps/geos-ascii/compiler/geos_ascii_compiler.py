#!/usr/bin/env python3
"""
GeosASCII Compiler v2
Compiles ASCII templates into GPU-native .rts.png cartridges.

The cartridge format (4-segment vertical PNG, all 80px wide):
  - Segment 1: Glyph Grid  (80×24 RGBA) - ASCII characters as pixel values
  - Segment 2: SIT          (80×24 RGBA) - Spatial Instruction Table, 1:1 with grid
                             R=opcode, G=target_low, B=target_high, A=flags
  - Segment 3: State Buffer (80×4 RGBA)  - 320 state slots (R=value, GBA=metadata)
  - Segment 4: Bootstrap    (80×2 RGBA)  - name, version, pattern count, magic
"""

import sys
import json
import re
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Error: PIL and numpy required. Install with: pip install pillow numpy")
    sys.exit(1)

WIDTH = 80
HEIGHT = 24
STATE_ROWS = 4       # 80*4 = 320 state slots
BOOTSTRAP_ROWS = 2

OPCODES = {
    # UI Opcodes (GeosASCII extensions)
    "NOP": 0,
    "JUMP": 1,
    "CALL": 2,
    "TOGGLE": 3,
    "INPUT": 4,
    "OUTPUT": 5,
    "SET": 6,
    "CLEAR": 7,
    "INC": 8,
    "DEC": 9,
    "COPY": 10,
    "COMPARE": 11,
    "ADD_UI": 12,
    "SUB_UI": 13,
    "EXIT": 255,

    # Core Glyph VM Opcodes (from glyph_microcode.wgsl)
    "LD": 3,       # Load from Memory
    "ST": 4,       # Store to Memory
    "ADD": 5,      # Addition
    "SUB": 6,      # Subtraction
    "JZ": 10,      # Jump if Zero
    "RET": 12,     # Return
    "HALT": 13,    # Halt
    "LDI": 204,    # Load Immediate
    "MOV": 206,    # Move
    "JMP": 209,    # Unconditional Jump
    "CMP": 214,    # Compare
    "DRAW": 215,   # Substrate Write

    # Bitwise Stratum (220-231)
    "AND": 220,
    "OR": 221,
    "XOR": 222,
    "NOT": 223,
    "SHL": 224,
    "SHR": 225,
}

# Flags (stored in A channel of SIT)
FLAGS = {
    "NONE": 0,
    "CONDITIONAL": 1,      # Only execute if state[target] != 0
    "CONDITIONAL_NOT": 2,  # Only execute if state[target] == 0
    "REPEAT": 4,           # Keep executing while held
}

ACTION_PATTERN = re.compile(r"\[([A-Z0-9])\]\s*([\w+\-]+)")

# State-reactive rendering markers in glyph grid
# If glyph grid A channel has these flags, rendering is conditional
GLYPH_FLAG_NORMAL = 255
GLYPH_FLAG_SHOW_IF_STATE = 128    # Show glyph only if state[G] != 0
GLYPH_FLAG_HIDE_IF_STATE = 64     # Hide glyph if state[G] != 0
GLYPH_FLAG_SWAP_IF_STATE = 192    # Show B channel char if state[G] != 0


def substitute_variables(ascii_content: str, variables: Dict[str, Any]) -> str:
    """Replace {{variable}} syntax with actual values."""
    def replace(match):
        key = match.group(1)
        return str(variables.get(key, ''))
    return re.sub(r'{{(\w+)}}', replace, ascii_content)


def create_glyph_grid(ascii_content: str) -> np.ndarray:
    """Convert ASCII text to RGBA glyph grid (80×24).
    
    R = character code (primary)
    G = character code (alternate, for SWAP)
    B = state slot index (for conditional rendering)
    A = glyph flags (255=normal, 128=show-if, 64=hide-if, 192=swap-if)
    """
    grid = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    lines = ascii_content.split("\n")

    for y, line in enumerate(lines):
        if y >= HEIGHT:
            break
        for x, char in enumerate(line[:WIDTH]):
            if x >= WIDTH:
                break
            code = ord(char) if char else 0
            # Clamp to 0-255 (Unicode box-drawing maps to ASCII equivalents)
            if code > 255:
                # Map common Unicode box-drawing to ASCII
                BOX_MAP = {
                    0x250C: ord('+'), 0x2510: ord('+'),  # ┌ ┐
                    0x2514: ord('+'), 0x2518: ord('+'),  # └ ┘
                    0x2500: ord('-'), 0x2502: ord('|'),   # ─ │
                    0x251C: ord('+'), 0x2524: ord('+'),  # ├ ┤
                    0x2534: ord('+'), 0x252C: ord('+'),  # ┴ ┬
                    0x253C: ord('+'),                     # ┼
                    0x2550: ord('='), 0x2551: ord('|'),   # ═ ║
                    0x2554: ord('+'), 0x2557: ord('+'),  # ╔ ╗
                    0x255A: ord('+'), 0x255D: ord('+'),  # ╚ ╝
                    0x2014: ord('-'),                      # —
                    0x25CB: ord('o'), 0x25CF: ord('*'),   # ○ ●
                }
                code = BOX_MAP.get(code, ord('?'))
            # R=char, G=0 (alt char), B=0 (state ref), A=255 (normal)
            grid[y, x] = [code, 0, 0, GLYPH_FLAG_NORMAL]

    return grid


def detect_patterns(ascii_content: str) -> List[Tuple[int, int, str, str]]:
    """Detect [A] Action patterns, return (x, y, label, action) tuples."""
    patterns = []
    lines = ascii_content.split("\n")

    for y, line in enumerate(lines):
        matches = ACTION_PATTERN.findall(line)
        for label, action in matches:
            x = line.index(f"[{label}]")
            patterns.append((x, y, label, action))

    return patterns


def create_sit(patterns: List[Tuple[int, int, str, str]], mapping: Dict,
               glyph_grid: np.ndarray) -> np.ndarray:
    """Create Spatial Instruction Table (80×24 RGBA), 1:1 with glyph grid.
    
    R = opcode
    G = target_low (state slot index or jump target)
    B = target_high
    A = flags
    """
    sit = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)

    for x, y, label, action in patterns:
        action_lower = action.lower()
        action_def = mapping.get(action_lower, mapping.get(action, {}))
        
        opcode_name = action_def.get("opcode", "TOGGLE")
        opcode_val = OPCODES.get(opcode_name.upper(), OPCODES["NOP"])
        
        target = action_def.get("target", "0")
        flags = FLAGS.get(action_def.get("flags", "NONE"), FLAGS["NONE"])
        
        # Target can be a state slot number or a string
        if isinstance(target, int):
            target_int = target
        elif target.isdigit():
            target_int = int(target)
        else:
            # Hash string to state slot
            target_int = sum(ord(c) for c in target) % 320
        
        target_low = target_int & 0xFF
        target_high = (target_int >> 8) & 0xFF
        
        # Set opcode on [X] bracket characters (3 cells: [, letter, ])
        for dx in range(3):
            if x + dx < WIDTH:
                sit[y, x + dx] = [opcode_val, target_low, target_high, flags]
        
        # Also set up conditional rendering on related glyphs if mapping says so
        render_target = action_def.get("render_target", None)
        if render_target:
            rx, ry = render_target.get("x", 0), render_target.get("y", 0)
            alt_char = render_target.get("alt_char", ord("*"))
            if isinstance(alt_char, str):
                alt_char = ord(alt_char[0])
            if alt_char > 255:
                alt_char = ord('*')  # Fallback for Unicode
            if ry < HEIGHT and rx < WIDTH:
                glyph_grid[ry, rx, 1] = alt_char  # G = alternate char
                glyph_grid[ry, rx, 2] = target_int & 0xFF  # B = state slot
                glyph_grid[ry, rx, 3] = GLYPH_FLAG_SWAP_IF_STATE

    return sit


def create_state_buffer() -> np.ndarray:
    """Create State Buffer (80×STATE_ROWS RGBA) = 320 state slots.
    
    R = current value (0-255)
    G = min value
    B = max value  
    A = flags (0=normal, 1=persistent)
    """
    state = np.zeros((STATE_ROWS, WIDTH, 4), dtype=np.uint8)
    # Set max to 255 by default so TOGGLE can flip 0↔255
    state[:, :, 2] = 255
    return state


def create_bootstrap(name: str, version: str, pattern_count: int) -> np.ndarray:
    """Create Bootstrap header (80×BOOTSTRAP_ROWS RGBA)."""
    bootstrap = np.zeros((BOOTSTRAP_ROWS, WIDTH, 4), dtype=np.uint8)

    # Row 0: Name (up to 40 chars) + magic
    name_bytes = name.encode("utf-8")[:40]
    for i, b in enumerate(name_bytes):
        bootstrap[0, i, 0] = b
    bootstrap[0, :, 3] = 255
    
    # Magic marker at end of row 0
    magic = b"GEOS"
    for i, b in enumerate(magic):
        bootstrap[0, WIDTH - 4 + i, 0] = b

    # Row 1: Version + pattern count + format version
    version_parts = version.split(".")
    bootstrap[1, 0, 0] = int(version_parts[0]) if len(version_parts) > 0 else 1
    bootstrap[1, 1, 0] = int(version_parts[1]) if len(version_parts) > 1 else 0
    bootstrap[1, 2, 0] = int(version_parts[2]) if len(version_parts) > 2 else 0
    bootstrap[1, 3, 0] = pattern_count & 0xFF
    bootstrap[1, 4, 0] = (pattern_count >> 8) & 0xFF
    bootstrap[1, 5, 0] = 2  # Format version = 2 (v2 compiler)
    bootstrap[1, :, 3] = 255

    return bootstrap


def compile_cartridge(ascii_path: Path, mapping: Dict, output: Path,
                      variables: Dict[str, Any] = None) -> bool:
    """Compile ASCII file to .rts.png cartridge."""
    ascii_content = ascii_path.read_text()

    if variables:
        ascii_content = substitute_variables(ascii_content, variables)

    glyph_grid = create_glyph_grid(ascii_content)
    patterns = detect_patterns(ascii_content)
    sit = create_sit(patterns, mapping, glyph_grid)  # May modify glyph_grid
    state_buffer = create_state_buffer()
    bootstrap = create_bootstrap(ascii_path.stem, "1.0.0", len(patterns))

    # Stack vertically: grid(24) + SIT(24) + state(4) + bootstrap(2) = 54 rows
    cartridge = np.vstack([glyph_grid, sit, state_buffer, bootstrap])

    img = Image.fromarray(cartridge, mode="RGBA")
    img.save(output, "PNG")

    print(f"  Grid:      {WIDTH}×{HEIGHT} = {WIDTH*HEIGHT} cells")
    print(f"  SIT:       {WIDTH}×{HEIGHT} = {WIDTH*HEIGHT} instruction slots")
    print(f"  State:     {WIDTH}×{STATE_ROWS} = {WIDTH*STATE_ROWS} state slots")
    print(f"  Bootstrap: {WIDTH}×{BOOTSTRAP_ROWS}")
    print(f"  Total:     {WIDTH}×{24+24+STATE_ROWS+BOOTSTRAP_ROWS} pixels")
    print(f"  Patterns:  {len(patterns)} detected")
    for x, y, label, action in patterns:
        act = mapping.get(action.lower(), mapping.get(action, {}))
        print(f"    [{label}] @ ({x},{y}) → {act.get('opcode','TOGGLE')} target={act.get('target','0')}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="GeosASCII Compiler v2 - Compile ASCII to GPU cartridge"
    )
    parser.add_argument("input", type=Path, help="Input .ascii file")
    parser.add_argument("-m", "--mapping", type=Path, help="JSON mapping file")
    parser.add_argument("-o", "--output", type=Path, help="Output .rts.png file")
    parser.add_argument(
        "--generate-mapping", action="store_true", help="Generate default mapping.json"
    )
    parser.add_argument('--variables', type=str,
                        help='JSON string of variables for template substitution')

    args = parser.parse_args()

    if args.generate_mapping:
        default_mapping = {
            "run": {"opcode": "JUMP", "target": "0"},
            "stop": {"opcode": "EXIT", "target": "0"},
            "reset": {"opcode": "CLEAR", "target": "0"},
            "toggle": {"opcode": "TOGGLE", "target": "0"},
        }
        mapping_path = args.input.with_suffix(".mapping.json")
        mapping_path.write_text(json.dumps(default_mapping, indent=2))
        print(f"Generated mapping: {mapping_path}")
        return 0

    if not args.input.exists():
        print(f"Error: Input file not found: {args.input}")
        return 1

    mapping = {}
    if args.mapping:
        if args.mapping.exists():
            mapping = json.loads(args.mapping.read_text())
        else:
            print(f"Warning: Mapping file not found: {args.mapping}")
    else:
        mapping_path = args.input.with_suffix(".mapping.json")
        if mapping_path.exists():
            mapping = json.loads(mapping_path.read_text())

    output = args.output or args.input.with_suffix(".rts.png")

    variables = None
    if args.variables:
        try:
            variables = json.loads(args.variables)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in --variables")
            return 1

    if compile_cartridge(args.input, mapping, output, variables):
        print(f"\n✓ Compiled: {args.input} → {output}")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
