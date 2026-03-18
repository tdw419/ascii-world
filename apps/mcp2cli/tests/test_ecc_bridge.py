#!/usr/bin/env python3
"""
Tests for ECC Bridge Integration

Tests the ECC (Everything Claude Code) bridge that exposes
ECC commands as MCP tools for AI assistants.
"""

import asyncio
import pytest
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ecc_bridge import (
    get_ecc_status,
    ECCStatus,
    ECCResult,
    execute_ecc_command,
    dispatch_ecc_tool,
    ecc_plan,
    ecc_verify,
    ecc_instinct_status,
)


class TestECCStatus:
    """Test ECC status retrieval."""

    def test_get_ecc_status_returns_status_object(self):
        """Should return an ECCStatus object."""
        status = get_ecc_status()
        assert isinstance(status, ECCStatus)

    def test_ecc_status_has_required_fields(self):
        """Should have all required fields."""
        status = get_ecc_status()
        assert hasattr(status, "commands_available")
        assert hasattr(status, "skills_available")
        assert hasattr(status, "agents_available")
        assert hasattr(status, "rules_available")
        assert hasattr(status, "memory_entries")
        assert hasattr(status, "instincts_count")

    def test_ecc_status_values_are_integers(self):
        """All values should be non-negative integers."""
        status = get_ecc_status()
        assert status.commands_available >= 0
        assert status.skills_available >= 0
        assert status.agents_available >= 0
        assert status.rules_available >= 0
        assert status.memory_entries >= 0
        assert status.instincts_count >= 0

    def test_ecc_status_to_dict(self):
        """Should convert to dictionary."""
        status = get_ecc_status()
        d = status.to_dict()
        assert isinstance(d, dict)
        assert "commands_available" in d

    def test_ecc_detects_installed_components(self):
        """Should detect ECC installation."""
        status = get_ecc_status()
        # If ECC is installed, we should have at least some components
        total = (
            status.commands_available +
            status.skills_available +
            status.agents_available +
            status.rules_available
        )
        assert total > 0, "ECC components not found. Is ECC installed?"


class TestECCResult:
    """Test ECC result structure."""

    def test_ecc_result_success(self):
        """Create a successful result."""
        result = ECCResult(
            command="/test",
            success=True,
            output="Test output"
        )
        assert result.success is True
        assert result.error is None

    def test_ecc_result_failure(self):
        """Create a failed result."""
        result = ECCResult(
            command="/test",
            success=False,
            output="",
            error="Test error"
        )
        assert result.success is False
        assert result.error == "Test error"

    def test_ecc_result_to_dict(self):
        """Should convert to dictionary."""
        result = ECCResult(
            command="/test",
            success=True,
            output="Test",
            metadata={"key": "value"}
        )
        d = result.to_dict()
        assert d["command"] == "/test"
        assert d["success"] is True
        assert d["metadata"]["key"] == "value"


class TestECCDispatch:
    """Test ECC tool dispatch."""

    @pytest.mark.asyncio
    async def test_dispatch_ecc_status(self):
        """Dispatch ecc_status tool."""
        result = await dispatch_ecc_tool("ecc_status", {})
        assert result["status"] == "success"
        assert "commands_available" in result

    @pytest.mark.asyncio
    async def test_dispatch_unknown_tool_returns_error(self):
        """Unknown tools should return error."""
        result = await dispatch_ecc_tool("ecc_unknown", {})
        assert result["status"] == "error"
        assert "Unknown ECC tool" in result["error"]

    @pytest.mark.asyncio
    async def test_dispatch_ecc_instincts(self):
        """Dispatch ecc_instincts tool."""
        result = await dispatch_ecc_tool("ecc_instincts", {})
        assert "status" in result


class TestECCCommands:
    """Test individual ECC command wrappers."""

    @pytest.mark.asyncio
    async def test_ecc_plan_structure(self):
        """Test ecc_plan returns proper structure."""
        # Note: This may fail if claude CLI not available
        result = await ecc_plan("test task", scope="test")
        assert "status" in result
        assert "task" in result
        assert result["task"] == "test task"

    @pytest.mark.asyncio
    async def test_ecc_verify_structure(self):
        """Test ecc_verify returns proper structure."""
        result = await ecc_verify(
            run_tests=True,
            run_lint=True,
            run_build=True,
            auto_fix=False
        )
        assert "status" in result
        assert "checks" in result
        assert result["checks"]["tests"] is True

    @pytest.mark.asyncio
    async def test_ecc_instinct_status(self):
        """Test ecc_instinct_status returns proper structure."""
        result = await ecc_instinct_status()
        assert "status" in result


class TestECCMCPIntegration:
    """Test ECC integration with MCP server."""

    def test_ecc_bridge_importable(self):
        """ECC bridge should be importable."""
        from ecc_bridge import ECC_MCP_TOOLS
        assert len(ECC_MCP_TOOLS) > 0

    def test_ecc_tools_have_required_fields(self):
        """Each ECC tool should have required fields."""
        from ecc_bridge import ECC_MCP_TOOLS
        for tool in ECC_MCP_TOOLS:
            assert "name" in tool
            assert "description" in tool
            assert "inputSchema" in tool
            assert tool["name"].startswith("ecc_")

    def test_ecc_tool_names_are_unique(self):
        """All tool names should be unique."""
        from ecc_bridge import ECC_MCP_TOOLS
        names = [t["name"] for t in ECC_MCP_TOOLS]
        assert len(names) == len(set(names))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
