# Pattern CLI - CLI-Anything Plugin

ASCII Pattern Recognition CLI for AI Agents.

## Installation

```bash
cd apps/CLI-Anything/pattern-cli/agent-harness
pip install -e .
```

## Usage

```bash
# Parse an ASCII file
pattern-cli parse template.ascii

# JSON output (for AI agents)
pattern-cli parse template.ascii --json

# Interactive REPL
pattern-cli repl
```

## Development

Run tests:
```bash
pytest tests/
```
