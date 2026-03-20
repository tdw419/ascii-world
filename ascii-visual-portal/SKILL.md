---
name: ascii-visual-portal
description: Guidelines and components for building high-fidelity ASCII World portals. Use when designing the "Neural-Reality" dual-pane layout with glassmorphism and neon accents.
---

# ASCII Visual Portal

This skill provides the design system and implementation logic for the canonical ASCII World index portal.

## The Standard: Neural-Reality Dual Substrate

Every portal must adhere to the 40/60 "Neural-Reality" split.

### 1. The Neural Pane (Left 40%)
- **Component:** A `<aside>` container with a black background.
- **Content:** Raw ASCII output from the manager or bridge.
- **Styling:** `color: #00ff41; font-family: monospace; text-shadow: 0 0 5px rgba(0, 255, 65, 0.5);`

### 2. The Reality Pane (Right 60%)
- **Component:** A `<section>` container using `glass-card` CSS classes.
- **Content:** High-fidelity GUI cards rendered via `AutoRenderer`.
- **Styling:** `backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1);`

## Aesthetic Constants
- **Gradient:** `radial-gradient(circle at top right, #1a1a2e, #050508)`
- **Core Accent:** `#00d9ff` (System)
- **Active Accent:** `#00ff88` (WordPress/Substrate)

## Implementation
1. **CSS:** Link to or import `MasterPortal.css`.
2. **Logic:** Use the `useAsciiState` hook for both manager and nested substrates.
3. **Routing:** Implement the `GLOBALS` filter to route keys between substrates.
