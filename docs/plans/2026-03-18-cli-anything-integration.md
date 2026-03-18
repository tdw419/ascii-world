# CLI-Anything Integration for Pattern Recognition CLI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Python-based CLI tool using the CLI-Anything framework that wraps the TypeScript pattern recognition system for agent-friendly consumption.

**Architecture:** Create a Python CLI wrapper using the CLI-Anything patterns (Click, JSON output, REPL mode) that calls the existing TypeScript pattern-cli.ts via subprocess. The CLI provides structured JSON output for AI agents, interactive REPL mode, and command groups for different operations.

**Tech Stack:** Python 3, Click, subprocess calls, TypeScript/Bun pattern detection backend

---

## Task 1: Create CLI-Anything Plugin Structure

**Files:**
- Create: `apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/__init__.py`
- Create: `apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/pattern_cli.py`

**Step 1: Create plugin directory structure**

Run: `mkdir -p apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli`
Expected: Directory created

**Step 2: Write the __init__.py file**

```python
"""Pattern Recognition CLI - ASCII pattern detection for AI agents."""

from .pattern_cli import cli

__all__ = ["cli"]
```

**Step 3: Write the main CLI file (Part 1 - imports and setup)**

```python
#!/usr/bin/env python3
"""Pattern CLI - Detect patterns in ASCII templates.

This CLI wraps the TypeScript pattern recognition system to provide
agent-friendly JSON output and interactive REPL mode.

Usage:
    # Parse an ASCII file and output detected patterns
    pattern-cli parse template.ascii --json

    # Interactive REPL mode
    pattern-cli repl

    # Detect specific pattern types
    pattern-cli detect buttons template.ascii
    pattern-cli detect status template.ascii

    # Validate pattern detection
    pattern-cli validate template.ascii
"""

import sys
import os
import json
import subprocess
import click
from typing import Optional, Dict, List, Any

# Path to the TypeScript CLI
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))
TS_CLI_PATH = os.path.join(PROJECT_ROOT, "src", "cli", "pattern-cli.ts")

# Global state
_json_output = False
_repl_mode = False
```

**Step 4: Verify file is created**

Run: `ls -la apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/`
Expected: Files exist

**Step 5: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "feat(cli): create pattern-cli plugin structure"
```

---

## Task 2: Implement Core Functions

**Files:**
- Modify: `apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/pattern_cli.py`

**Step 1: Add output helper functions**

```python
def output(data: Any, message: str = "") -> None:
    """Print output in JSON or human-readable format."""
    if _json_output:
        click.echo(json.dumps(data, indent=2, default=str))
    else:
        if message:
            click.echo(message)
        if isinstance(data, dict):
            _print_dict(data)
        elif isinstance(data, list):
            _print_list(data)
        else:
            click.echo(str(data))


def _print_dict(d: dict, indent: int = 0) -> None:
    """Pretty print a dictionary."""
    prefix = "  " * indent
    for k, v in d.items():
        if isinstance(v, dict):
            click.echo(f"{prefix}{k}:")
            _print_dict(v, indent + 1)
        elif isinstance(v, list):
            click.echo(f"{prefix}{k}:")
            _print_list(v, indent + 1)
        else:
            click.echo(f"{prefix}{k}: {v}")


def _print_list(items: list, indent: int = 0) -> None:
    """Pretty print a list."""
    prefix = "  " * indent
    for i, item in enumerate(items):
        if isinstance(item, dict):
            click.echo(f"{prefix}[{i}]")
            _print_dict(item, indent + 1)
        else:
            click.echo(f"{prefix}- {item}")


def run_ts_cli(args: List[str], input_data: Optional[str] = None) -> Dict[str, Any]:
    """Run the TypeScript CLI and return parsed output."""
    cmd = ["bun", "run", TS_CLI_PATH] + args

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            input=input_data,
            cwd=PROJECT_ROOT,
            timeout=30
        )

        if result.returncode != 0:
            return {"error": result.stderr, "exit_code": result.returncode}

        # Try to parse as JSON
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"raw_output": result.stdout}
    except subprocess.TimeoutExpired:
        return {"error": "CLI timeout after 30 seconds"}
    except FileNotFoundError:
        return {"error": f"CLI not found at {TS_CLI_PATH}"}
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Verify syntax by importing**

Run: `cd apps/CLI-Anything/pattern-cli && python3 -c "from cli_anything.pattern_cli.pattern_cli import *" 2>&1`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "feat(cli): add core output and subprocess functions"
```

---

## Task 3: Implement CLI Commands

**Files:**
- Modify: `apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/pattern_cli.py`

**Step 1: Add the CLI group and options**

```python
@click.group()
@click.option('--json', 'json_output', is_flag=True, default=False,
              help='Output in JSON format for AI agent consumption')
@click.option('--verbose', '-v', is_flag=True, default=False,
              help='Enable verbose output')
@click.pass()
def cli():
    """Pattern Recognition CLI - Detect UI patterns in ASCII templates."""
    global _json_output, _repl_mode
    _json_output = cli.params.get('json_output', False)
    pass


@cli.command()
@click.argument('file', type=click.Path(exists=True), required=False)
@click.option('--patterns', '-p', multiple=True,
              help='Pattern types to detect (button, status, container, table)')
def parse(file: Optional[str], patterns: Optional[List[str]]) -> None:
    """Parse an ASCII file and detect all patterns.

    If FILE is not provided, reads from stdin.
    """
    args = ["-f", "json"]

    if file:
        args.extend(["-i", str(file)])
    else:
        # Read from stdin
        import sys
        input_data = sys.stdin.read()
        result = run_ts_cli(args, input_data)
        output(result)
        return

    if patterns:
        args.extend(["-p", ",".join(patterns)])

    result = run_ts_cli(args)
    output(result, f"Detected {len(result)} patterns in {file}")
```

**Step 2: Add detect command**

```python
@cli.group()
def detect():
    """Detect specific pattern types."""
    pass


@detect.command()
@click.argument('file', type=click.Path(exists=True))
def buttons(file: str) -> None:
    """Detect button patterns only."""
    args = ["-f", "json", "-p", "button", "-i", str(file)]
    result = run_ts_cli(args)
    output(result, f"Found {len(result)} buttons")


@detect.command()
@click.argument('file', type=click.Path(exists=True)
def status(file: str) -> None:
    """Detect status indicators only."""
    args = ["-f", "json", "-p", "status-indicator", "-i", str(file)]
    result = run_ts_cli(args)
    output(result, f"Found {len(result)} status indicators")


@detect.command()
@click.argument('file', type=click.Path(exists=True)
def containers(file: str) -> None:
    """Detect container patterns only."""
    args = ["-f", "json", "-p", "container", "-i", str(file)]
    result = run_ts_cli(args)
    output(result, f"Found {len(result)} containers")


@detect.command()
@click.argument('file', type=click.Path(exists=True)
def tables(file: str) -> None:
    """Detect table patterns only."""
    args = ["-f", "json", "-p", "table", "-i", str(file)]
    result = run_ts_cli(args)
    output(result, f"Found {len(result)} tables")
```

**Step 3: Test the parse command**

Create a test file at `/tmp/test.txt`:
```
[A] Task 1  [B] Settings  [X] Quit
```

Run: `cd apps/CLI-Anything/pattern-cli && python3 -m cli_anything.pattern_cli.pattern_cli parse /tmp/test.txt 2>&1`
Expected: JSON output with 3 buttons

**Step 4: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "feat(cli): add parse and detect commands"
```

---

## Task 4: Add REPL Mode

**Files:**
- Modify: `apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/pattern_cli.py`

**Step 1: Add REPL command**

```python
@cli.command()
def repl() -> None:
    """Start interactive REPL mode for real-time pattern detection.

    In REPL mode, you can type ASCII strings and get immediate pattern detection.
    Type 'exit' or press Ctrl+D to quit.
    """
    global _repl_mode
    _repl_mode = True

    click.echo("Pattern Recognition REPL")
    click.echo("Type ASCII text and press Enter. Type 'exit' to quit.")
    click.echo("-" * 50)

    while True:
        try:
            line = input("pattern> ").strip()
            if line.lower() in ('exit', 'quit', 'q'):
                click.echo("Goodbye!")
                break

            if not line:
                continue

            # Parse the input
            result = run_ts_cli(["-f", "json"], input_data=line)

            if "error" in result:
                click.echo(f"Error: {result['error']}")
            else:
                patterns = result if isinstance(result, list) else []
                click.echo(f"Detected {len(patterns)} patterns:")
                for p in patterns[:5]:  # Show first 5
                    click.echo(f"  - [{p.get('type', 'unknown')}] {p.get('id', '')}")
                if len(patterns) > 5:
                    click.echo(f"  ... and {len(patterns) - 5} more")
        except EOFError:
            break
        except KeyboardInterrupt:
            click.echo("\nGoodbye!")
            break
```

**Step 2: Test REPL mode**

Run: `cd apps/CLI-Anything/pattern-cli && echo -e "exit" | python3 -m cli_anything.pattern_cli.pattern_cli repl 2>&1 | head -10`
Expected: REPL prompt appears

**Step 3: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "feat(cli): add interactive REPL mode"
```

---

## Task 5: Add Validation Command

**Files:**
- Modify: `apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/pattern_cli.py`

**Step 1: Add validate command**

```python
@cli.command()
@click.argument('file', type=click.Path(exists=True)
@click.option('--expected', '-e', help='Expected pattern count (for validation)')
def validate(file: str, expected: Optional[int]) -> None:
    """Validate pattern detection against expected results.

    Returns exit code 0 if validation fails.
    """
    args = ["-f", "json", "-i", str(file)]
    result = run_ts_cli(args)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        raise SystemExit(1)

    patterns = result if isinstance(result, list) else []
    detected_count = len(patterns)

    if expected is not None:
        if detected_count != expected:
            click.echo(f"FAIL: Expected {expected} patterns, got {detected_count}", err=True)
            raise SystemExit(1)
        else:
            click.echo(f"PASS: Detected {detected_count} patterns as expected")
    else:
        click.echo(f"Detected {detected_count} patterns")

        # Show breakdown by type
        by_type = {}
        for p in patterns:
            ptype = p.get('type', 'unknown')
            by_type[ptype] = by_type.get(ptype, 0) + 1

        click.echo("\nBy type:")
        for ptype, count in sorted(by_type.items()):
            click.echo(f"  {ptype}: {count}")
```

**Step 2: Test validation command**

Run: `cd apps/CLI-Anything/pattern-cli && python3 -m cli_anything.pattern_cli.pattern_cli validate /tmp/test.txt --expected 3 2>&1`
Expected: "PASS: Detected 3 patterns as expected"

**Step 3: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "feat(cli): add validate command with expected count"
```

---

## Task 6: Add Package Setup and Entry Points

**Files:**
- Create: `apps/CLI-Anything/pattern-cli/agent-harness/setup.py`
- Create: `apps/CLI-Anything/pattern-cli/agent-harness/cli_anything/pattern_cli/__main__.py`

**Step 1: Create setup.py**

```python
"""Setup for Pattern CLI plugin."""

from setuptools import setup, find_packages

setup(
    name="cli-anything-pattern",
    version="1.0.0",
    packages=find_packages(where="cli_anything"),
    install_requires=[
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "pattern-cli = cli_anything.pattern_cli.pattern_cli:cli",
        ]
    },
    python_requires=">=3.8",
)
```

**Step 2: Create __main__.py**

```python
"""Entry point for running pattern-cli as a module."""

from .pattern_cli import cli

if __name__ == "__main__":
    cli()
```

**Step 3: Test installation**

Run: `cd apps/CLI-Anything/pattern-cli/agent-harness && pip install -e . 2>&1 | tail -5`
Expected: Successfully installed pattern-cli

**Step 4: Test installed command**

Run: `pattern-cli --help 2>&1 | head -10`
Expected: Help text shows

**Step 5: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "feat(cli): add package setup and entry points"
```

---

## Task 7: Add Tests

**Files:**
- Create: `apps/CLI-Anything/pattern-cli/tests/test_pattern_cli.py`

**Step 1: Create test file**

```python
"""Tests for Pattern CLI."""

import pytest
import json
from click.testing import CliRunner
from cli_anything.pattern_cli.pattern_cli import cli


class TestPatternCLI:
    """Test suite for Pattern CLI."""

    @pytest.fixture
    def runner(self):
        """Create a Click CLI runner."""
        return CliRunner()

    @pytest.fixture
    def sample_ascii(self, tmp_path):
        """Create a sample ASCII file for testing."""
        content = "[A] Task 1  [B] Task 2  [X] Quit"
        file = tmp_path / "test.txt"
        file.write_text(content)
        return str(file)

    def test_cli_help(self, runner):
        """Test CLI help output."""
        result = runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "Pattern Recognition CLI" in result.output

    def test_parse_json_output(self, runner, sample_ascii):
        """Test parse command with JSON output."""
        result = runner.invoke(cli, ["--json", "parse", sample_ascii])
        assert result.exit_code == 0

        # Should be valid JSON
        data = json.loads(result.output)
        assert isinstance(data, list)

    def test_detect_buttons(self, runner, sample_ascii):
        """Test detecting buttons."""
        result = runner.invoke(cli, ["--json", "detect", "buttons", sample_ascii])
        assert result.exit_code == 0

        data = json.loads(result.output)
        assert len(data) == 3
        assert all(p["type"] == "button" for p in data)

    def test_validate_command(self, runner, sample_ascii):
        """Test validation command."""
        result = runner.invoke(cli, ["validate", sample_ascii, "--expected", "3"])
        assert result.exit_code == 0
        assert "PASS" in result.output

    def test_validate_fail(self, runner, sample_ascii):
        """Test validation command failure."""
        result = runner.invoke(cli, ["validate", sample_ascii, "--expected", "100"])
        assert result.exit_code == 1
        assert "FAIL" in result.output
```

**Step 2: Run tests**

Run: `cd apps/CLI-Anything/pattern-cli && python3 -m pytest tests/test_pattern_cli.py -v 2>&1 | tail -20`
Expected: All tests pass

**Step 3: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "test(cli): add CLI test suite"
```

---

## Task 8: Add Documentation

**Files:**
- Create: `apps/CLI-Anything/pattern-cli/README.md`

**Step 1: Create README**

```markdown
# Pattern CLI - ASCII Pattern Recognition for AI Agents

A CLI tool that detects UI patterns in ASCII templates, designed for AI agent consumption.

## Installation

```bash
cd apps/CLI-Anything/pattern-cli/agent-harness
pip install -e .
```

## Usage

### Parse Command

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

```bash
# Validate expected pattern count
pattern-cli validate template.ascii --expected 10

# Returns exit code 0 if count doesn't match
```

### REPL Mode

```bash
# Start interactive mode
pattern-cli repl

# Example session:
# pattern> [A] Tasks  [B] Settings
# Detected 2 patterns:
#   - [button] button-0
#   - [button] button-1
#
# pattern> exit
# Goodbye!
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
  }
]
```

## Pattern Types

| Type | Description | Example |
|------|-------------|---------|
| button | Clickable button | `[A] Label` |
| status-indicator | Status state | `● running` |
| container | Box container | `╔═╗║` |
| table | Data table | `│ Col1 │ Col2 │` |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Python    │────>│  Click CLI  │────>│  TypeScript │
│   CLI       │     │  (this CLI) │     │  Backend     │
└─────────────┘     └─────────────┘     └─────────────┘
```

The Python CLI wraps the existing TypeScript pattern-cli.ts
 for agent-friendly consumption.

## Integration with AI Agents

This CLI is designed for AI agent consumption:

1. **JSON Output**: Structured data for parsing
2. **Error Handling**: Consistent error format
3. **Validation**: Built-in expectation checking
4. **REPL Mode**: Interactive exploration
```

**Step 2: Commit**

```bash
git add apps/CLI-Anything/pattern-cli/
git commit -m "docs(cli): add comprehensive README"
```

---

## Summary

After completing all tasks, you will have:

1. **Python CLI** using CLI-Anything framework
2. **JSON output** for AI agent consumption
3. **Interactive REPL** for exploration
4. **Command groups** for organized operations
5. **Validation** for testing
6. **Tests** for quality assurance
7. **Documentation** for users and developers

**Total Tasks:** 8 tasks creating a complete CLI-Anything integration
