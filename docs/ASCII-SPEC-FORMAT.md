# ASCII Experiment Spec Format

## Overview

The ASCII spec format allows AI to naturally output experiment specifications that ARE executable programs. No Python, no JSON - just ASCII text.

## Format

### H/T/M/B Keys

| Key | Meaning | Example |
|-----|---------|---------|
| H | Hypothesis | "Cache OP_NAMES lookup" |
| T | Target file | "sync/synthetic-glyph-vm.js" |
| M | Metric | "tests pass" |
| B | Baseline | "100 iterations" |

### Layer 0: Minimal

```
H: Use AdamW optimizer
T: train.py
M: val_bpb < 0.7
B: 5m
```

### Layer 1: Boxed

```
┌──────────────────────────────────────────────────┐
│ H: Cache OP_NAMES lookup for faster dispatch     │
│ T: sync/synthetic-glyph-vm.js                    │
│ M: tests pass                                    │
│ B: 100 iterations                                │
└──────────────────────────────────────────────────┘
```

## Usage

### CLI

```bash
# Run single spec
node sync/ascii-cli.js .autoresearch/specs/my-experiment.ascii

# Run all specs in directory
node sync/ascii-cli.js --dir .autoresearch/specs
```

### API

```bash
# Get recent experiments
curl http://localhost:3839/api/v1/experiments

# Run experiment
curl -X POST http://localhost:3839/api/v1/experiments/run \
  -H "Content-Type: application/json" \
  -d '{"spec": "H: Test\\nT: file.js\\nM: tests pass\\nB: 10"}'

# Get available specs
curl http://localhost:3839/api/v1/experiments/specs
```

## Results

Results logged to `.autoresearch/results.tsv`:

```
timestamp    hypothesis    baseline    metric    status
1774179103   Cache OP      100         95        KEEP
```

## Integration

| File | Purpose |
|------|---------|
| `.autoresearch/specs/*.ascii` | Experiment specifications |
| `.autoresearch/results.tsv` | Results log |
| `/api/v1/experiments/*` | HTTP endpoints |
| `sync/ascii-cli.js` | CLI runner |

## Files

| Module | Purpose |
|--------|---------|
| `ascii-spec-parser.js` | Parse H/T/M/B format |
| `ascii-results-logger.js` | TSV logging |
| `ascii-experiment-runtime.js` | Execute specs |
| `ascii-result-formatter.js` | Format output |
| `ascii-cli.js` | Command-line interface |

## Example Output

```
╔═══════════════════════════════════════════════════════════════╗
║ RESULT: experiment                                            ║
║ STATUS: KEEP                                                  ✓║
║ METRIC: 95                                                    ║
║ TARGET: tests pass → KEEP                                     ║
║ ELAPSED: 0.2s                                                 ║
╚═══════════════════════════════════════════════════════════════╝
```

## Philosophy

The ASCII spec format aligns with the AI Native OS philosophy:

- **AI outputs text naturally** → ASCII is the native language
- **Specs ARE programs** → Not descriptions of programs
- **Fixed runtime** → Minimal, deterministic execution
- **Low-token control** → 4 keys control complex experiments
