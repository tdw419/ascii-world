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


@click.group()
@click.version_option('1.0.0')
@click.option('--json', 'json_output', is_flag=True, help='Output in JSON format')
@click.pass_context
def cli(ctx, json_output):
    """Pattern CLI - ASCII Pattern Recognition for AI Agents"""
    global _json_output
    _json_output = json_output
    ctx.ensure_object(dict)


if __name__ == '__main__':
    cli()
