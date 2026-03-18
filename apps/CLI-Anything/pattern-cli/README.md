# Pattern CLI - ASCII Pattern Recognition for AI Agents

A CLI tool that detects UI patterns in ASCII templates, designed for AI agent consumption.

## Installation

```bash
cd apps/CLI-Anything/pattern-cli/agent-harness
pip install -e .
```

### Prerequisites

- Python 3.8+
- [Bun](https://bun.sh) runtime (for TypeScript backend)

## Usage

### Parse Command

Parse an ASCII file and detect all patterns:

```bash
# Parse an ASCII file
pattern-cli parse template.ascii

# JSON output (for AI agents)
pattern-cli parse template.ascii --json

# Read from stdin
cat template.ascii | pattern-cli parse

# Filter by pattern type
pattern-cli parse template.ascii --patterns button status
```

### Detect Subcommands

Detect specific pattern types with dedicated subcommands:

```bash
# Detect only buttons
pattern-cli detect buttons template.ascii --json

# Detect only status indicators
pattern-cli detect status template.ascii --json

# Detect only containers
pattern-cli detect containers template.ascii --json

# Detect only tables
pattern-cli detect tables template.ascii --json
```

### Validate Command

Validate expected pattern count for testing:

```bash
# Validate expected pattern count
pattern-cli validate template.ascii --expected 10

# Returns exit code 0 if count matches, 1 if not
```

### REPL Mode

Start interactive mode for real-time pattern detection:

```bash
# Start interactive mode
pattern-cli repl

# Example session:
# pattern> [A] Tasks  [B] Settings
# Detected 2 patterns:
#   [1] type=button, id=button-0
#   [2] type=button, id=button-1
#
# pattern> exit
# Goodbye!
```

### Global Options

```bash
--json, -j    Output in JSON format (for AI agent consumption)
--verbose, -v Enable verbose output
--version     Show version information
--help        Show help message
```

## JSON Output Format

When using `--json`, the output is structured for AI agent consumption:

```json
[
  {
    "id": "button-0",
    "type": "button",
    "position": {"row": 0, "col": 0},
    "content": "[A] Tasks",
    "label": "A",
    "text": "Tasks"
  },
  {
    "id": "status-0",
    "type": "status-indicator",
    "position": {"row": 1, "col": 0},
    "content": "● running",
    "state": "running",
    "indicator": "●"
  }
]
```

## Pattern Types

| Type              | Description        | Example              |
|-------------------|--------------------|----------------------|
| button            | Clickable button   | `[A] Label`          |
| status-indicator  | Status state       | `● running`          |
| container         | Box container      | `╔═╗║`               |
| table             | Data table         | `│ Col1 │ Col2 │`    |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Python    │────>│  Click CLI  │────>│  TypeScript │
│   CLI       │     │  (this CLI) │     │  Backend    │
└─────────────┘     └─────────────┘     └─────────────┘
```

The Python CLI wraps the existing TypeScript pattern-cli.ts for agent-friendly consumption:

- **Python CLI**: User-facing interface with Click framework
- **TypeScript Backend**: Core pattern detection engine (via Bun runtime)
- **JSON Bridge**: Structured communication between layers

## Integration with AI Agents

This CLI is designed for AI agent consumption:

1. **JSON Output**: Structured data for parsing with `--json` flag
2. **Error Handling**: Consistent error format with exit codes
3. **Validation**: Built-in expectation checking for testing
4. **REPL Mode**: Interactive exploration for debugging
5. **Stdin Support**: Pipe content directly for workflow integration

### Example AI Agent Usage

```python
import subprocess
import json

# Parse ASCII content
result = subprocess.run(
    ['pattern-cli', 'parse', '--json'],
    input=ascii_content,
    capture_output=True,
    text=True
)
patterns = json.loads(result.stdout)

# Validate expected count
result = subprocess.run(
    ['pattern-cli', 'validate', 'template.ascii', '--expected', '5']
)
if result.returncode == 0:
    print("Validation passed!")
```

## Environment Variables

| Variable          | Description                           | Default                        |
|-------------------|---------------------------------------|--------------------------------|
| `PATTERN_CLI_PATH`| Override TypeScript CLI path          | Auto-detected from project root|

## Error Handling

The CLI returns consistent error codes:

| Exit Code | Meaning                    |
|-----------|----------------------------|
| 0         | Success                    |
| 1         | Error or validation failed |

Errors are output to stderr in JSON format when `--json` is used:

```json
{
  "error": "TypeScript CLI not found at /path/to/cli. Set PATTERN_CLI_PATH env var."
}
```

## Development

### Run Tests

```bash
pytest tests/
```

### Project Structure

```
pattern-cli/
├── agent-harness/
│   ├── cli_anything/
│   │   └── pattern_cli/
│   │       ├── __init__.py
│   │       ├── __main__.py
│   │       └── pattern_cli.py    # Main CLI implementation
│   └── setup.py
├── tests/
│   └── test_pattern_cli.py
└── README.md
```

## License

Part of the ASCII Interface project.
