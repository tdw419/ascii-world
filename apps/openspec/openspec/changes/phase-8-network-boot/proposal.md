# Phase 8: Network Boot Proposal

## Summary

Enable Geometry OS to boot remotely by streaming the 3D Holographic Substrate as a bootable PixelRTS v2 texture over WebSocket - proving "The Screen is the Hard Drive."

## Motivation

We have successfully built:
- **The Mind** (Evolution Daemon) - Self-improving intelligence
- **The Vision** (Volumetric Mind's Eye) - 3D semantic visualization

Now we need **The Boot** - the ability to transmit the entire OS as a live video stream that executes immediately upon arrival.

From the vision:
> "The OS is no longer a disk image; it is a live video stream."

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NETWORK BOOT PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Server (Python)                    Network              Client (Rust)     │
│   ┌──────────────┐                 ┌─────────┐          ┌──────────────┐   │
│   │ 3D Hilbert   │──▶ flatten ───▶│WebSocket│──▶ recv ─▶│ Reconstruct  │   │
│   │ VRAM         │    to 2D        │ Stream  │    frames │ Memory       │   │
│   │ (Hologram)   │    texture      │ SHA256  │    verify │ & Jump       │   │
│   └──────────────┘                 └─────────┘          └──────────────┘   │
│                                                                             │
│   Boot Bridge ◀─────────────────────────────────────────────────────────▶  │
│   (Chunked streaming with integrity validation)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| BootFrame | `boot_bridge.py` | Protocol frame with SHA256 integrity |
| stream_boot_texture | `boot_bridge.py` | Async generator for chunked streaming |
| flatten_coordinate | `holographic_flatten.py` | 3D-to-2D Z-order curve folding |
| flatten_texture | `holographic_flatten.py` | Full texture flattening |
| BootFrame (Rust) | `boot_frame.rs` | Native frame parsing |
| NetLoader | `net_loader.rs` | WebSocket client and memory reconstruction |

## Implementation Plan

See: `docs/plans/2026-03-09-phase-8-network-boot.md`

4 tasks, 23 tests, ~3 hours estimated.

## Team

See: `teams/network-boot-team.yaml`

4 specialized agents:
- boot-protocol-engineer
- flatten-shader-engineer
- rust-loader-engineer
- e2e-integration-engineer

## Success Criteria

- [ ] Live 3D substrate flattens to 2D RTS texture in <16ms
- [ ] WebSocket stream maintains 100MB/s throughput
- [ ] Remote client reconstructs 1D memory from stream
- [ ] All 23 tests passing
- [ ] System boots to "Hello Geometry OS" via network stream

## Dependencies

- Existing Holographic Substrate (Phase 7)
- WebSocket infrastructure (visual_bridge)
- Rust hypervisor crate

## Risk Mitigation

1. **Network latency** - Chunked streaming with configurable chunk size
2. **Data corruption** - SHA256 checksum per frame, retransmission logic
3. **Memory pressure** - Streaming reconstruction, not full buffer
4. **Performance** - Z-order curve preserves cache locality
