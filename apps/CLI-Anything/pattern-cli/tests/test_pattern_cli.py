#!/usr/bin/env python3
"""Tests for Pattern CLI"""

import pytest
from click.testing import CliRunner
from cli_anything.pattern_cli import cli


class TestPatternCLI:
    """Test suite for Pattern CLI"""

    def setup_method(self):
        self.runner = CliRunner()

    def test_version(self):
        """Test version output"""
        result = self.runner.invoke(cli, ['--version'])
        assert result.exit_code == 0
        assert '1.0.0' in result.output

    def test_help(self):
        """Test help output"""
        result = self.runner.invoke(cli, ['--help'])
        assert result.exit_code == 0
        assert 'Pattern CLI' in result.output

    def test_json_flag(self):
        """Test JSON flag is accepted"""
        result = self.runner.invoke(cli, ['--json', '--help'])
        assert result.exit_code == 0
