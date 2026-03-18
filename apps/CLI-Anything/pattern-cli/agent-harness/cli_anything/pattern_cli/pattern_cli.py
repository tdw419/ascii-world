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
import shutil
from pathlib import Path
import click


def _find_project_root() -> Path:
    """Find project root by looking for package.json."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "package.json").exists():
            return parent
    # Fallback to relative path
    return Path(__file__).parent.parent.parent.parent.parent.parent


def _find_ts_cli() -> Path:
    """Find TypeScript CLI, checking environment variable first."""
    # Check environment variable override
    env_path = os.environ.get("PATTERN_CLI_PATH")
    if env_path:
        return Path(env_path)

    # Default location relative to project root
    return _find_project_root() / "src" / "cli" / "pattern-cli.ts"


# Path to TypeScript CLI
TS_CLI_PATH = _find_ts_cli()
PROJECT_ROOT = _find_project_root()


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


def _get_result_count(result) -> int:
    """Get count of items in result, handling both list and dict."""
    if isinstance(result, list):
        return len(result)
    elif isinstance(result, dict) and "error" not in result:
        return 1
    return 0


def run_ts_cli(args: list, input_data: str = None) -> dict:
    """Run the TypeScript CLI and return parsed output.

    Args:
        args: List of arguments to pass to pattern-cli.ts
        input_data: Optional stdin data

    Returns:
        Parsed JSON output or error dict
    """
    # Validate bun is available
    if not shutil.which("bun"):
        return {"error": "'bun' is not installed. Install from https://bun.sh"}

    # Validate TypeScript CLI exists
    if not TS_CLI_PATH.exists():
        return {"error": f"TypeScript CLI not found at {TS_CLI_PATH}. Set PATTERN_CLI_PATH env var."}

    cmd = ["bun", "run", str(TS_CLI_PATH)] + args

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            input=input_data,
            cwd=str(PROJECT_ROOT),
            timeout=30
        )

        if result.returncode != 0:
            return {"error": result.stderr.strip() or "Unknown error", "returncode": result.returncode}

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
    ctx.ensure_object(dict)
    ctx.obj['json_output'] = json_output
    ctx.obj['verbose'] = verbose


def output(ctx, data, message: str = "") -> None:
    """Print output in JSON or human-readable format."""
    if ctx.obj.get('json_output', False):
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


@cli.command()
@click.argument('file', type=click.File('r'), default='-')
@click.option('--patterns', '-p', multiple=True, help='Filter by pattern type (button, status, container, table)')
@click.pass_context
def parse(ctx, file, patterns):
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

    count = _get_result_count(result)
    output(ctx, result, f"Detected {count} patterns")


@cli.group()
def detect():
    """Detect specific pattern types."""
    pass


@detect.command()
@click.argument('file', type=click.File('r'))
@click.pass_context
def buttons(ctx, file):
    """Detect button patterns only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "button"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    count = _get_result_count(result)
    output(ctx, result, f"Found {count} buttons")


@detect.command()
@click.argument('file', type=click.File('r'))
@click.pass_context
def status(ctx, file):
    """Detect status indicators only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "status-indicator"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    count = _get_result_count(result)
    output(ctx, result, f"Found {count} status indicators")


@detect.command()
@click.argument('file', type=click.File('r'))
@click.pass_context
def containers(ctx, file):
    """Detect container patterns only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "container"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    count = _get_result_count(result)
    output(ctx, result, f"Found {count} containers")


@detect.command()
@click.argument('file', type=click.File('r'))
@click.pass_context
def tables(ctx, file):
    """Detect table patterns only."""
    ascii_content = file.read()
    args = ["--format", "json", "--patterns", "table"]
    result = run_ts_cli(args, input_data=ascii_content)

    if "error" in result:
        click.echo(f"Error: {result['error']}", err=True)
        sys.exit(1)

    count = _get_result_count(result)
    output(ctx, result, f"Found {count} tables")


if __name__ == '__main__':
    cli()
