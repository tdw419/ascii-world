#!/usr/bin/env python3
"""Pattern CLI - ASCII Pattern Recognition for AI Agents

This CLI wraps the TypeScript pattern-cli.ts for AI agent consumption.
It provides structured JSON output and interactive REPL mode.

Usage:
    # Parse an ASCII file
    pattern-cli parse template.ascii

    # JSON output (for AI agents)
    pattern-cli parse template.ascii --json

    # Interactive REPL
    pattern-cli repl
"""

import sys
import os
import json
import subprocess
from pathlib import Path
import click

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Global state
_json_output = False
_repl_mode = False

# Path to TypeScript CLI
TS_CLI_PATH = Path(__file__).parent.parent.parent.parent.parent.parent / "src" / "cli" / "pattern-cli.ts"


def output(data, message: str = "") -> None:
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


def run_ts_cli(args: list, input_data: str = None) -> dict:
    """Run the TypeScript CLI and return parsed output.

    Args:
        args: List of arguments to pass to pattern-cli.ts
        input_data: Optional stdin data

    Returns:
        Parsed JSON output or error dict
    """
    cmd = ["bun", "run", str(TS_CLI_PATH)] + args

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            input=input_data,
            cwd=str(TS_CLI_PATH.parent.parent.parent.parent.parent.parent),
            timeout=30
        )

        if result.returncode != 0:
            return {"error": result.stderr, "returncode": result.returncode}

        # Try to parse JSON output
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"raw": result.stdout}

    except subprocess.TimeoutExpired:
        return {"error": "Command timed out after 30 seconds"}
    except Exception as e:
        return {"error": str(e)}


@click.group()
@click.version_option('1.0.0')
@click.option('--json', 'json_output', is_flag=True, help='Output in JSON format')
@click.option('--verbose', '-v', is_flag=True, default=False, help='Enable verbose output')
@click.pass_context
def cli(ctx, json_output, verbose):
    """Pattern CLI - ASCII Pattern Recognition for AI Agents"""
    global _json_output
    _json_output = json_output
    ctx.ensure_object(dict)
    ctx.obj['verbose'] = verbose


@cli.command()
@click.argument('file', type=click.File('r'), default='-')
@click.option('--patterns', '-p', multiple=True, help='Filter by pattern type (button, status, container, table)')
def parse(file, patterns):
    """Parse ASCII file and detect patterns.

    FILE is the ASCII template to parse (use - for stdin)
    """
    ascii_content = file.read()

    # Build args for TS CLI
    args = ["--format", "json"]
    if patterns:
        args.extend(["--patterns", ",".join(patterns)])

    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    output(result)


@cli.group()
def detect():
    """Detect specific pattern types."""
    pass


@detect.command()
@click.argument('file', type=click.File('r'))
def buttons(file):
    """Detect button patterns only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "button"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    output(result, f"Found {len(result)} buttons")


@detect.command()
@click.argument('file', type=click.File('r'))
def status(file):
    """Detect status indicators only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "status-indicator"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    output(result, f"Found {len(result)} status indicators")


@detect.command()
@click.argument('file', type=click.File('r'))
def containers(file):
    """Detect container patterns only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "container"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    output(result, f"Found {len(result)} containers")


@detect.command()
@click.argument('file', type=click.File('r'))
def tables(file):
    """Detect table patterns only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "table"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    output(result, f"Found {len(result)} tables")


if __name__ == '__main__':
    cli()
