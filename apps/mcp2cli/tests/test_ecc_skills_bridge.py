#!/usr/bin/env python3
"""
Tests for ECC Skills Bridge - Phase 4 of ECC Integration

Tests:
- Skill registry loading
- Category filtering
- Trigger matching
- Spatial state generation
- MCP tool dispatch
- Skill execution (CPU mode)
"""

import pytest
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

# Add src to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ecc_skills_bridge import (
    ECCSkillsBridge,
    ECCSkill,
    ECCSkillCategory,
    ECC_SKILL_REGISTRY,
    get_bridge,
    dispatch_skills_tool,
)


class TestECCSkillCategory:
    """Test skill category enum."""

    def test_categories_exist(self):
        """All expected categories should exist."""
        expected = {"testing", "patterns", "review", "planning", "domain", "bmad", "superpowers", "unknown"}
        actual = {c.value for c in ECCSkillCategory}
        assert expected.issubset(actual)

    def test_category_values(self):
        """Category values should be lowercase strings."""
        for cat in ECCSkillCategory:
            assert cat.value == cat.value.lower()


class TestECCSkill:
    """Test ECCSkill dataclass."""

    def test_skill_creation(self):
        """Skills should be created with all fields."""
        skill = ECCSkill(
            name="test-skill",
            category=ECCSkillCategory.TESTING,
            hilbert_sector_start=20_000_000,
            hilbert_sector_end=20_050_000,
            description="Test skill",
            triggers=["test", "testing"]
        )
        assert skill.name == "test-skill"
        assert skill.category == ECCSkillCategory.TESTING
        assert skill.hilbert_sector_start == 20_000_000
        assert skill.execution_mode == "cpu"  # default

    def test_skill_to_dict(self):
        """Skills should serialize to dict correctly."""
        skill = ECCSkill(
            name="test-skill",
            category=ECCSkillCategory.TESTING,
            hilbert_sector_start=20_000_000,
            hilbert_sector_end=20_050_000,
            description="Test skill"
        )
        d = skill.to_dict()
        assert d["name"] == "test-skill"
        assert d["category"] == "testing"  # enum converted to value
        assert d["hilbert_sector_start"] == 20_000_000


class TestECCSkillRegistry:
    """Test the skill registry."""

    def test_registry_not_empty(self):
        """Registry should contain skills."""
        assert len(ECC_SKILL_REGISTRY) > 0

    def test_testing_skills_present(self):
        """Registry should contain testing skills."""
        testing_skills = [s for s in ECC_SKILL_REGISTRY if s.category == ECCSkillCategory.TESTING]
        assert len(testing_skills) > 0
        names = [s.name for s in testing_skills]
        assert "tdd-workflow" in names

    def test_skills_in_sectors(self):
        """Skills should be in their assigned sectors."""
        for skill in ECC_SKILL_REGISTRY:
            # Testing: 20M-21M
            if skill.category == ECCSkillCategory.TESTING:
                assert 20_000_000 <= skill.hilbert_sector_start < 21_000_000
            # Patterns: 21M-22M
            elif skill.category == ECCSkillCategory.PATTERNS:
                assert 21_000_000 <= skill.hilbert_sector_start < 22_000_000
            # Review: 22M-23M
            elif skill.category == ECCSkillCategory.REVIEW:
                assert 22_000_000 <= skill.hilbert_sector_start < 23_000_000
            # Planning: 23M-24M
            elif skill.category == ECCSkillCategory.PLANNING:
                assert 23_000_000 <= skill.hilbert_sector_start < 24_000_000
            # Domain: 24M-25M
            elif skill.category == ECCSkillCategory.DOMAIN:
                assert 24_000_000 <= skill.hilbert_sector_start < 25_000_000
            # Superpowers: 25M-26M
            elif skill.category == ECCSkillCategory.SUPERPOWERS:
                assert 25_000_000 <= skill.hilbert_sector_start < 26_000_000
            # BMAD: 26M-27M
            elif skill.category == ECCSkillCategory.BMAD:
                assert 26_000_000 <= skill.hilbert_sector_start < 27_000_000

    def test_no_sector_overlap(self):
        """Skills should not overlap in sectors."""
        sectors = []
        for skill in ECC_SKILL_REGISTRY:
            sectors.append((skill.hilbert_sector_start, skill.hilbert_sector_end, skill.name))

        # Sort by start
        sectors.sort()
        for i in range(1, len(sectors)):
            prev_start, prev_end, prev_name = sectors[i-1]
            curr_start, curr_end, curr_name = sectors[i]
            # Allow touching but not overlapping
            assert prev_end <= curr_start, f"Sectors overlap: {prev_name} and {curr_name}"


class TestECCSkillsBridge:
    """Test ECCSkillsBridge class."""

    @pytest.fixture
    def bridge(self):
        """Create a fresh bridge instance."""
        return ECCSkillsBridge()

    def test_get_status(self, bridge):
        """Status should return bridge info."""
        status = bridge.get_status()
        assert status["status"] == "active"
        assert status["total_skills"] > 0
        assert "categories" in status

    def test_list_skills_all(self, bridge):
        """List all skills without filter."""
        skills = bridge.list_skills()
        assert len(skills) > 0

    def test_list_skills_by_category(self, bridge):
        """List skills filtered by category."""
        skills = bridge.list_skills("testing")
        assert len(skills) > 0
        for skill in skills:
            assert skill["category"] == "testing"

    def test_list_skills_invalid_category(self, bridge):
        """Invalid category should return all skills."""
        skills = bridge.list_skills("invalid_category")
        # Should return all skills (filter doesn't match)
        assert len(skills) > 0

    def test_get_skill(self, bridge):
        """Get a skill by name."""
        skill = bridge.get_skill("tdd-workflow")
        assert skill is not None
        assert skill.name == "tdd-workflow"

    def test_get_skill_not_found(self, bridge):
        """Get a non-existent skill."""
        skill = bridge.get_skill("non-existent-skill")
        assert skill is None

    def test_find_skill_by_trigger(self, bridge):
        """Find skill by trigger phrase."""
        skill = bridge.find_skill_by_trigger("write tests first")
        assert skill is not None
        assert skill.name == "tdd-workflow"

    def test_find_skill_by_trigger_no_match(self, bridge):
        """Find skill when no trigger matches."""
        skill = bridge.find_skill_by_trigger("xyzzy nothing matches this")
        assert skill is None

    def test_get_spatial_state(self, bridge):
        """Get spatial state for visualization."""
        state = bridge.get_spatial_state()
        assert "skill_sectors" in state
        assert "recent_executions" in state

        # Check sectors are present
        assert len(state["skill_sectors"]) > 0

        # Each sector should have start, end, count
        for sector_name, sector in state["skill_sectors"].items():
            assert "start" in sector
            assert "end" in sector
            assert "count" in sector

    @pytest.mark.asyncio
    async def test_execute_skill_cpu(self, bridge):
        """Execute skill in CPU mode."""
        result = await bridge.execute_skill("tdd-workflow", {"feature": "test"})
        assert result["status"] == "completed"
        assert result["skill"] == "tdd-workflow"
        assert result["mode"] == "cpu"

    @pytest.mark.asyncio
    async def test_execute_skill_not_found(self, bridge):
        """Execute non-existent skill."""
        result = await bridge.execute_skill("non-existent-skill")
        assert result["status"] == "error"
        assert "Unknown skill" in result["error"]

    @pytest.mark.asyncio
    async def test_execute_skill_gpu(self, bridge):
        """Execute skill in GPU mode (simulated)."""
        result = await bridge.execute_skill("tdd-workflow", {"feature": "test"}, mode="gpu")
        assert result["status"] == "completed"
        assert result["mode"] == "gpu"

    def test_generate_skill_glyph(self, bridge):
        """Generate glyph program for a skill."""
        skill = bridge.get_skill("tdd-workflow")
        glyph = bridge._generate_skill_glyph(skill)

        assert "ECC Skill: tdd-workflow" in glyph
        assert str(skill.hilbert_sector_start) in glyph
        assert ":main" in glyph
        assert "HALT" in glyph


class TestDispatchSkillsTool:
    """Test MCP tool dispatch."""

    @pytest.mark.asyncio
    async def test_dispatch_status(self):
        """Dispatch ecc_skills_status."""
        result = await dispatch_skills_tool("ecc_skills_status", {})
        assert result["status"] == "active"
        assert result["total_skills"] > 0

    @pytest.mark.asyncio
    async def test_dispatch_list(self):
        """Dispatch ecc_skills_list."""
        result = await dispatch_skills_tool("ecc_skills_list", {})
        assert result["status"] == "success"
        assert len(result["skills"]) > 0

    @pytest.mark.asyncio
    async def test_dispatch_list_with_category(self):
        """Dispatch ecc_skills_list with category filter."""
        result = await dispatch_skills_tool("ecc_skills_list", {"category": "testing"})
        assert result["status"] == "success"
        for skill in result["skills"]:
            assert skill["category"] == "testing"

    @pytest.mark.asyncio
    async def test_dispatch_execute(self):
        """Dispatch ecc_skills_execute."""
        result = await dispatch_skills_tool("ecc_skills_execute", {
            "skill_name": "tdd-workflow",
            "context": {"feature": "test"},
            "mode": "cpu"
        })
        assert result["status"] == "completed"
        assert result["skill"] == "tdd-workflow"

    @pytest.mark.asyncio
    async def test_dispatch_find(self):
        """Dispatch ecc_skills_find."""
        result = await dispatch_skills_tool("ecc_skills_find", {
            "text": "write tests first"
        })
        assert result["status"] == "found"
        assert result["skill"]["name"] == "tdd-workflow"

    @pytest.mark.asyncio
    async def test_dispatch_find_not_found(self):
        """Dispatch ecc_skills_find with no match."""
        result = await dispatch_skills_tool("ecc_skills_find", {
            "text": "nothing matches this"
        })
        assert result["status"] == "not_found"

    @pytest.mark.asyncio
    async def test_dispatch_spatial(self):
        """Dispatch ecc_skills_spatial."""
        result = await dispatch_skills_tool("ecc_skills_spatial", {})
        assert "skill_sectors" in result
        assert "recent_executions" in result

    @pytest.mark.asyncio
    async def test_dispatch_unknown(self):
        """Dispatch unknown tool."""
        result = await dispatch_skills_tool("ecc_skills_unknown", {})
        assert result["status"] == "error"


class TestGetBridge:
    """Test singleton bridge getter."""

    def test_singleton(self):
        """get_bridge should return the same instance."""
        b1 = get_bridge()
        b2 = get_bridge()
        assert b1 is b2


class TestSkillTriggers:
    """Test skill trigger matching."""

    def test_tdd_triggers(self):
        """TDD skill should match expected triggers."""
        bridge = get_bridge()

        # Test various trigger phrases
        triggers = [
            "write tests first",
            "use tdd approach",
            "red-green-refactor cycle"
        ]

        for trigger in triggers:
            skill = bridge.find_skill_by_trigger(trigger)
            assert skill is not None, f"Trigger '{trigger}' didn't match"
            assert skill.name == "tdd-workflow"

    def test_python_patterns_triggers(self):
        """Python patterns skill should match expected triggers."""
        bridge = get_bridge()

        triggers = [
            "pythonic code",
            "pep8 style",
            "python pattern"
        ]

        for trigger in triggers:
            skill = bridge.find_skill_by_trigger(trigger)
            assert skill is not None, f"Trigger '{trigger}' didn't match"
            assert skill.name == "python-patterns"

    def test_brainstorming_triggers(self):
        """Brainstorming skill should match expected triggers."""
        bridge = get_bridge()

        triggers = [
            "brainstorm ideas",
            "ideate on this"
        ]

        for trigger in triggers:
            skill = bridge.find_skill_by_trigger(trigger)
            assert skill is not None, f"Trigger '{trigger}' didn't match"
            assert skill.name == "brainstorming"


class TestGlyphGeneration:
    """Test glyph program generation."""

    def test_glyph_has_structure(self):
        """Generated glyph should have proper structure."""
        bridge = get_bridge()
        skill = bridge.get_skill("tdd-workflow")
        glyph = bridge._generate_skill_glyph(skill)

        # Should have header
        assert "// Geometry OS - ECC Skill:" in glyph

        # Should have equ directives
        assert ".equ SKILL_BASE" in glyph
        assert ".equ SKILL_STATUS" in glyph

        # Should have main label
        assert ":main" in glyph

        # Should have halt
        assert "HALT" in glyph

    def test_glyph_has_skill_info(self):
        """Generated glyph should include skill info."""
        bridge = get_bridge()
        skill = bridge.get_skill("brainstorming")
        glyph = bridge._generate_skill_glyph(skill)

        assert skill.name in glyph
        assert skill.description in glyph
        assert str(skill.hilbert_sector_start) in glyph


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
