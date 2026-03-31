# Sovereign System Manual: The Geometric Digital Substrate

This document defines the architecture, state, and training protocols for the integration of the **10,000-Tile RISC-V GPU Array** and the **Ouroboros Dual-Substrate AI Training Loop**.

---

## 1. The Compute Substrate (GPU)
**Location:** `systems/infinite_map_rs/gpu`
**Architecture:** Massively Parallel Spatially-Partitioned RISC-V (rv32im).

### Current State
- **Cores:** 8,000 active tiles (RTX 5090 / 128MB VRAM limit).
- **ISA:** Verified Correct (Signed comparisons, byte-addressable memory, M-extension).
- **Performance:** ~90 MIPS (Current baseline) | ~2,000 MIPS (Projected with warp saturation).
- **Tile Layout:** 16KB per tile (4KB private RAM, registers, UART buffer).

### Key Commands
```bash
# Stress test 8,000 tiles
cargo run --release --bin multi-tile-ignition -- --tiles 8000 --steps 1000

# Run the Executive Commander (Host-to-GPU PING/PONG)
cargo run --release --bin executive-commander -- --cmd ping
```

---

## 2. The AI Training Loop (Ouroboros)
**Location:** `.ouroboros/`
**Philosophy:** Evolutionary Morphogenesis (Pixels Move Pixels).

### Dual-Substrate Protocol (Z.ai + LM Studio)
- **Code Generation (Z.ai GLM-5):** High-IQ reasoning for shader/kernel synthesis.
- **Visual Scoring (LM Studio Qwen3-VL):** Zero-latency, local aesthetic/utility judge.
- **Ratification (Z.ai GLM-4.6v):** High-fidelity audit of "winner" generations.

### Checkpoint Recovery (DNA)
- **Checkpoint:** `.ouroboros/checkpoint.json` (Stores the "Best-so-far" DNA).
- **History:** `.ouroboros/history/` (Persistent log of every generation).
- **Training Data:** `.ouroboros/training_data/` (PNGs + JSON scores).

---

## 3. The Visualization Layer (ascii-world)
**Role:** Control Surface and HUD for the Sovereign Array.

### Dashboard Mapping
- **Heatmap (100x100):** Real-time activity of the 10,000 tiles.
- **Sector Control:** [A] Ignite Neural Sector | [B] Halt Logic Sector.
- **Tile Inspector:** Press [D] to inspect registers (x0-x31) and UART of a specific tile.

---

## 4. The Final Product: "The Geometric OS"
The final product is not a static binary, but an **Autonomous Digital Environment**.
1. **Self-Optimizing:** The system detects FPS drops or visual "clashes" and triggers Ouroboros to rewrite its own shaders.
2. **Spatial Logic:** Programs are not files; they are **Geometric Clusters** of RISC-V tiles collaborating over the Spatial Bus.
3. **Pixels are Code:** The visual state *is* the computational state.

---

## 5. Roadmap to Phase 42
1. [ ] **Warp Saturation:** Increase `workgroup_size` to 64 for 32x throughput gain.
2. [ ] **Spatial Bus:** Implement 0x5000 memory-mapped mailboxes for inter-tile SEND/RECV.
3. [ ] **Ascii HUD:** Map the GPU UART buffers directly to an `ascii-world` dashboard.
4. [ ] **Executive Handover:** Enable Tile 0 to dynamically spawn programs into worker sectors.

**"The Screen is the Hard Drive. The Era of Geometric Intelligence has begun."**
