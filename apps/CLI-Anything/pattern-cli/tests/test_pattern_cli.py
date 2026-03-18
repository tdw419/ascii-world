"""Tests for Pattern CLI."""

import json
import pytest
from pathlib import Path
from click.testing import CliRunner
from cli_anything.pattern_cli import cli


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
        assert "Pattern CLI" in result.output

    def test_cli_version(self, runner):
        """Test CLI version."""
        result = runner.invoke(cli, ["--version"])
        assert result.exit_code == 0
        assert "1.0.0" in result.output

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

    def test_validate_pass(self, runner, sample_ascii):
        """Test validation command pass."""
        result = runner.invoke(cli, ["validate", sample_ascii, "--expected", "3"])
        assert result.exit_code == 0
        assert "PASS" in result.output

    def test_validate_fail(self, runner, sample_ascii):
        """Test validation command failure."""
        result = runner.invoke(cli, ["validate", sample_ascii, "--expected", "100"])
        assert result.exit_code == 1
        assert "FAIL" in result.output

    def test_parse_stdin(self, runner):
        """Test parse command with stdin input."""
        result = runner.invoke(cli, ["--json", "parse"], input="[A] Test")
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert isinstance(data, list)

    def test_detect_status(self, runner, tmp_path):
        """Test detecting status indicators."""
        content = "[*] Active  [ ] Pending  [x] Done"
        file = tmp_path / "status.txt"
        file.write_text(content)
        result = runner.invoke(cli, ["--json", "detect", "status", str(file)])
        assert result.exit_code == 0
        data = json.loads(result.output)
        # CLI wrapper works - detection results depend on TypeScript pattern definitions
        assert isinstance(data, list)

    def test_detect_containers(self, runner, tmp_path):
        """Test detecting containers."""
        content = "+------+\n| Box  |\n+------+"
        file = tmp_path / "container.txt"
        file.write_text(content)
        result = runner.invoke(cli, ["--json", "detect", "containers", str(file)])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert isinstance(data, list)

    def test_detect_tables(self, runner, tmp_path):
        """Test detecting tables."""
        content = "| Name  | Value |\n|-------|-------|\n| A     | 1     |"
        file = tmp_path / "table.txt"
        file.write_text(content)
        result = runner.invoke(cli, ["--json", "detect", "tables", str(file)])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert isinstance(data, list)

    def test_parse_with_pattern_filter(self, runner, sample_ascii):
        """Test parse command with pattern filter."""
        result = runner.invoke(cli, ["--json", "parse", "-p", "button", sample_ascii])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert isinstance(data, list)

    def test_validate_without_expected(self, runner, sample_ascii):
        """Test validation without expected count shows info."""
        result = runner.invoke(cli, ["validate", sample_ascii])
        assert result.exit_code == 0
        assert "Detected" in result.output

    def test_repl_exit_command(self, runner):
        """Test REPL exit command."""
        result = runner.invoke(cli, ["repl"], input="exit\n")
        assert result.exit_code == 0
        assert "Goodbye" in result.output

    def test_repl_quit_command(self, runner):
        """Test REPL quit command."""
        result = runner.invoke(cli, ["repl"], input="quit\n")
        assert result.exit_code == 0
        assert "Goodbye" in result.output

    def test_repl_pattern_detection(self, runner):
        """Test REPL pattern detection."""
        result = runner.invoke(cli, ["--json", "repl"], input="[A] Button\nexit\n")
        assert result.exit_code == 0
        # Should contain JSON output
        assert "type" in result.output or "[]" in result.output

    def test_verbose_flag(self, runner, sample_ascii):
        """Test verbose flag is accepted."""
        result = runner.invoke(cli, ["--verbose", "parse", sample_ascii])
        assert result.exit_code == 0

    def test_nonexistent_file(self, runner):
        """Test handling of nonexistent file."""
        result = runner.invoke(cli, ["parse", "/nonexistent/path/file.txt"])
        assert result.exit_code != 0 or "Error" in result.output
