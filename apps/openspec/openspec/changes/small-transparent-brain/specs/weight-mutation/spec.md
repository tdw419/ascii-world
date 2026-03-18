# Weight Mutation Specification

## Overview

Enable the Evolution Daemon to physically mutate model weights in the Brain Atlas, creating an "Evolutionary Surface" where the system can self-modify.

## Interface

### WeightMutator API

```python
# systems/evolution_daemon/weight_mutator.py

@dataclass
class MutationRecord:
    mutation_id: str
    mutation_type: str
    hilbert_start: int
    hilbert_end: int
    pixels_affected: int
    intensity: float
    checksum_before: str
    checksum_after: str

class WeightMutator:
    def __init__(self, atlas: np.ndarray, hilbert_lut: list = None);

    def mutate_sector(self, config: Dict) -> Tuple[np.ndarray, MutationRecord]:
        """
        Mutate a sector of weights.

        Args:
            config: {
                "hilbert_start": int,
                "hilbert_end": int,
                "mutation_type": "radiation" | "crossover" | "noise",
                "intensity": float (0-1),
                "source_sector": int (for crossover)
            }

        Returns:
            (mutated_atlas, mutation_record)
        """
        pass
```

### EvolutionDaemon Integration

```python
# systems/evolution_daemon/evolution_daemon.py

def propose_weight_mutation(
    self,
    sector: str,
    mutation_type: str,
    intensity: float,
    reason: str
) -> dict:
    """
    Propose a mutation to the brain's weight atlas.

    Args:
        sector: Named sector (e.g., "attention_layer_0", "embeddings")
        mutation_type: "radiation", "crossover", "noise"
        intensity: 0-1 scale
        reason: Why this mutation is proposed

    Returns:
        {"status": "proposed"|"applied"|"rejected", "mutation_id": str}
    """
    pass
```

## Behavior

### Mutation Types

| Type | Algorithm | Use Case |
|------|-----------|----------|
| `radiation` | `weight += randn() × intensity` | Exploration, random search |
| `crossover` | Copy from `source_sector` | Combining learned capabilities |
| `noise` | `weight += randn() × intensity × 0.1` | Fine-tuning, subtle adjustment |

### Sector Mapping

Named sectors map to Hilbert bounds:

```python
sectors = {
    "embeddings": {"start": 0, "end": vocab_size × hidden_dim // 4},
    "attention_layer_0": {"start": embed_end, "end": embed_end + 4 × 64 × 64 // 4},
    "ffn_layer_0": {"start": attn_end, "end": attn_end + 3 × 64 × 256 // 4},
    # ... more layers
}
```

### Safety

- Checksums before/after for verification
- Mutation record logged for rollback
- Bounds checking on Hilbert indices

## Tests

```python
def test_mutate_weight_sector():
    """Test that weight mutation modifies atlas correctly."""
    pass

def test_evolution_daemon_can_mutate_brain():
    """Test that EvolutionDaemon can trigger brain mutations."""
    pass

def test_weight_mutation_affects_inference():
    """Test that weight mutations actually change model behavior."""
    pass
```

## Dependencies

- NumPy for array operations
- HilbertCurve for coordinate mapping
- EvolutionDaemon (existing)

## Status

- [ ] Specification reviewed
- [ ] WeightMutator implemented
- [ ] EvolutionDaemon integration complete
- [ ] Tests passing
