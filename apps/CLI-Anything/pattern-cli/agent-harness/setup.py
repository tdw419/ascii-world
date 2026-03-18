"""Setup for Pattern CLI plugin."""

from setuptools import setup, find_packages

setup(
    name="cli-anything-pattern",
    version="1.0.0",
    description="Pattern Recognition CLI - ASCII pattern detection for AI agents",
    packages=find_packages(),
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
