# Spatial Tectonics Specification

## Overview

Spatial Tectonics is Phase 28 of Geometry OS, implementing morphologically reactive layout realignment. Districts that frequently exchange NeuralPulses become physically proximal, reducing cognitive load on Area Agents.

## Architecture

### Data Flow

```
NeuralPulseSystem.js
        │
        ▼ tectonic_pulse (WebSocket)
ConsensusEngine.py
        │ 60s aggregation window
        ▼ TectonicProposal
TectonicHandler.py
        │ File-based IPC
        ▼ .geometry/tectonic/proposal.json
TectonicSimulator.rs
        │ Force-directed layout + Hilbert constraint
        ▼ LayoutDelta
VATManager.py
        │
        ▼
Tile Positions Updated
```

### Components

#### 1. ConsensusEngine (Python)

- **File**: `systems/evolution_daemon/spatial_tectonics.py`
- **Purpose**: Aggregates NeuralPulse events into TectonicProposals
- **Window**: 60-second sliding window
- **Threshold**: Min 10 pulses, min bond strength 0.1

#### 2. TectonicWSClient (Python)

- **File**: `systems/evolution_daemon/tectonic_ws_client.py`
- **Purpose**: Submits proposals to Visual Bridge
- **Protocol**: WebSocket message `{type: "tectonic_proposal", ...}`

#### 3. TectonicHandler (Python)

- **File**: `systems/visual_shell/api/tectonic_handler.py`
- **Purpose**: Bridges Python to Rust TectonicSimulator
- **IPC**: File-based via `.geometry/tectonic/` directory

#### 4. VATManager (Python)

- **File**: `systems/visual_shell/api/vat_manager.py`
- **Purpose**: Manages Visual Allocation Table
- **Operations**: Load, save, set_tile_position, apply_delta

#### 5. TectonicSimulator (Rust)

- **Files**: `systems/infinite_map_rs/src/tectonic/`
- **Algorithm**: Modified Fruchterman-Reingold with Hilbert constraint
- **Output**: LayoutDelta with tile movements

## Data Structures

### PulseEvent

```python
@dataclass
class PulseEvent:
    source_tile: int
    dest_tile: int
    pulse_type: str  # 'violet' | 'cyan'
    volume: float
    timestamp: float
```

### TectonicProposal

```python
@dataclass
class TectonicProposal:
    proposal_id: str
    edges: List[Tuple[int, int, float]]  # (source, dest, strength)
    tile_activity: Dict[int, float]
    created_at: float
```

### LayoutDelta

```rust
pub struct LayoutDelta {
    pub movements: Vec<TileMovement>,
    pub bond_strength: f64,
    pub cycle: u64,
}

pub struct TileMovement {
    pub tile_id: TileId,
    pub old_coord: Coord,
    pub new_coord: Coord,
}
```

## HUD Display

### Tectonic Section

```
🌍 TECTONIC ACTIVITY
━━━━━━━━━━━━━━━━━━━
Status: ● ACTIVE
Cycle: 42
Top Bond: 15 ↔ 23 (0.85)
Last Realignment: 12s ago
```

## Success Criteria

| Metric | Target |
|--------|--------|
| Proposal Processing | 100% handled |
| VAT Updates | All movements applied |
| HUD Display | Section visible and updating |
| Tests | 10+ passing |
| End-to-end latency | <100ms proposal → VAT update |

## References

- Design: `docs/plans/2026-02-19-tectonic-realignment-design.md`
- Implementation Plan: `docs/plans/2026-02-19-spatial-tectonics-step2.md`
- Rust Module: `systems/infinite_map_rs/src/tectonic/`
