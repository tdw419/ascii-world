# Sovereign Shell & Swarm Evolution Plan (Phase 8)

## Background & Motivation
Geometry OS is advancing through Phase 7 and entering Phase 8 (The Visual Operating System). Currently, there are two highly successful parallel tracks:
1. **The Sovereign Shell (HUD/Vision Interface):** An autonomous Ouroboros V2 loop is actively evolving the WGSL shader (`sovereign_shell_hud.wgsl`). It is refining high-contrast, multi-line 5x7 bitmap fonts for Natural Language input so they can be extracted perfectly by vision models.
2. **The 64-Agent Collective (Swarm Engine):** A GPU-native swarm of 64 autonomous threads executing parallel VM instructions and communicating via the Hilbert-mapped framebuffer to demonstrate emergent Hive Mind behavior.

## Scope & Impact
The ultimate objective is to intersect these two tracks. We will allow the Sovereign Shell loop to finish "polishing the lens" (the HUD) and then pivot its attention to the 64-Agent Collective. This will empower the AI to autonomously rewrite and evolve the swarm's `.glyph` bytecode based on real-time visual performance scores.

## Proposed Solution: The Phase 8 Convergence

### Track A: Sovereign Shell Maturation (In Progress)
- **Action:** Allow the current loop to run eternally in the background.
- **Goal:** Perfect the INPUT ZONE OCR contrast, character spacing, and blinking cursor logic so that English commands can be extracted flawlessly by the vision model (`qwen3-vl-8b`).

### Track B: Swarm Integration (Preparation)
- **Action:** Continue manually exploring and stabilizing the 64-agent Hive Mind logic.
- **Goal:** Finalize the `.glyph` representation and the GPU workgroup saturation strategy for the swarm logic.

### Track C: Autonomous Evolution (The Pivot)
- **Action:** Once Track A reaches stability, we execute the pivot.
- **Steps:**
  1. Stop the current Ouroboros loop.
  2. Update `.ouroboros/goal.yaml` to target the Swarm's shader or `.glyph` bytecode instead of the HUD.
  3. Change the loop's objective from "text rendering" to "swarm performance optimization".
  4. Restart the Ouroboros loop to allow the AI to autonomously evolve the 64-Agent Collective.

## Alternatives Considered
- **Stopping the HUD loop now to work on the Swarm:** Rejected. Without a stable HUD, the Sovereign Shell cannot receive Natural Language commands reliably.

## Verification & Testing
- **HUD Verification:** Extract frames and pass them to `qwen3-vl-8b` to ensure 100% OCR accuracy on the INPUT ZONE.
- **Swarm Verification:** Monitor the `gpu_vms` and performance metrics while the 64-agent collective runs.
- **Convergence Verification:** The Ouroboros loop successfully modifies the swarm bytecode and measures a validated improvement in spatial clustering or instruction efficiency.