# ASCII-Visual Pattern: Neural-Reality Dual Substrate

This document defines the canonical visual and architectural standard for ASCII World Portals.

## 1. The Manifesto
"The ASCII is the source code; the GUI is the projection." 

Every interface must maintain transparency between the machine-readable substrate (ASCII) and the human-readable experience (GUI).

## 2. Layout: The Dual Pane
- **Pane 1: Neural Map (Left - 40%)**
  - **Aesthetic:** Terminal-style, black background, pulsating green (`#00ff41`) text.
  - **Content:** The raw, unformatted ASCII grid exactly as the AI sees it.
  - **Purpose:** Verifies spatial locality and token efficiency.
- **Pane 2: Rendered Reality (Right - 60%)**
  - **Aesthetic:** Glassmorphism, backdrop blur (10px), neon borders.
  - **Content:** Interactive cards using `AutoRenderer` to transform labels into buttons.
  - **Purpose:** High-fidelity human interaction.

## 3. Visual Specifications
- **Background:** Radial gradient from `#1a1a2e` (top-right) to `#050508` (bottom-left).
- **Accents:** 
  - **System Core:** Neon Blue (`#00d9ff`).
  - **Active Substrate:** Neon Green (`#00ff88`).
- **Typography:** 'JetBrains Mono' or 'Fira Code' for both panes.

## 4. Interaction Logic
- **Global Keys:** Standardized navigation (A, B, R, H, M, X) routed to the System Manager.
- **Local Keys:** Bubbled down to the active "Hero" substrate.
- **Latency:** Substrate polling must occur at ≥ 1Hz.
