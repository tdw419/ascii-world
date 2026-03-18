#!/usr/bin/env python3
"""Setup for Pattern CLI - CLI-Anything Plugin"""

from setuptools import setup, find_packages

setup(
    name="cli-anything-pattern-cli",
    version="1.0.0",
    description="ASCII Pattern Recognition CLI for AI Agents",
    author="Pattern CLI Team",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "pattern-cli=cli_anything.pattern_cli:cli",
        ],
    },
    python_requires=">=3.8",
)
