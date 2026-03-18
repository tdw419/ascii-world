#!/usr/bin/env python3
"""
Tests for ECC Agent Guild integration.

These tests verify the ECC Agent Guild system that bridges ECC's 46 agents
to Geometry OS spatial agents with Hilbert coordinate addressing.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest
from ecc_agent_guild import (
    ECCAgentGuild,
    ECCAgentProfile,
    ECCGuildMember,
    ECCGuildDivision,
    ECC_AGENT_REGISTRY,
    get_guild,
    dispatch_guild_tool,
)


class TestECCAgentProfile:
    """Tests for ECCAgentProfile dataclass."""

    def test_profile_creation(self):
        """Test creating an agent profile."""
        profile = ECCAgentProfile(
            agent_name="test-agent",
            guild=ECCGuildDivision.ENGINEERING,
            hilbert_sector_start=8_000_000,
            hilbert_sector_end=8_100_000,
            description="Test agent",
            capabilities=["test"],
            color_hex=0xFFFFFF
        )

        assert profile.agent_name == "test-agent"
        assert profile.guild == ECCGuildDivision.ENGINEERING
        assert profile.hilbert_sector_start == 8_000_000
        assert profile.to_dict()["agent_name"] == "test-agent"

    def test_profile_defaults(self):
        """Test profile with default values."""
        profile = ECCAgentProfile(
            agent_name="minimal",
            guild=ECCGuildDivision.DEFAULT,
            hilbert_sector_start=0,
            hilbert_sector_end=100,
            description="Minimal agent"
        )

        assert profile.capabilities == []
        assert profile.color_hex == 0x888888


class TestECCGuildDivision:
    """Tests for ECCGuildDivision enum."""

    def test_all_divisions(self):
        """Test that all expected divisions exist."""
        divisions = [d.value for d in ECCGuildDivision]
        assert "engineering" in divisions
        assert "review" in divisions
        assert "testing" in divisions
        assert "analysis" in divisions
        assert "bmad" in divisions
        assert "default" in divisions


class TestECCAgentRegistry:
    """Tests for the ECC agent registry."""

    def test_registry_not_empty(self):
        """Test that the registry has agents."""
        assert len(ECC_AGENT_REGISTRY) > 0

    def test_engineering_guild_exists(self):
        """Test that engineering guild has agents."""
        engineering = [a for a in ECC_AGENT_REGISTRY if a.guild == ECCGuildDivision.ENGINEERING]
        assert len(engineering) > 0

        # Check for expected agents
        agent_names = [a.agent_name for a in engineering]
        assert "planner" in agent_names
        assert "architect" in agent_names
        assert "tdd-guide" in agent_names

    def test_review_guild_exists(self):
        """Test that review guild has agents."""
        review = [a for a in ECC_AGENT_REGISTRY if a.guild == ECCGuildDivision.REVIEW]
        assert len(review) > 0

        agent_names = [a.agent_name for a in review]
        assert "code-reviewer" in agent_names
        assert "security-reviewer" in agent_names

    def test_bmad_guild_exists(self):
        """Test that BMAD guild has agents."""
        bmad = [a for a in ECC_AGENT_REGISTRY if a.guild == ECCGuildDivision.BMAD]
        assert len(bmad) > 0

        agent_names = [a.agent_name for a in bmad]
        assert "bmad-master" in agent_names

    def test_no_overlapping_sectors(self):
        """Test that agent sectors don't overlap within guilds."""
        # Group by guild
        guilds = {}
        for agent in ECC_AGENT_REGISTRY:
            if agent.guild not in guilds:
                guilds[agent.guild] = []
            guilds[agent.guild].append(agent)

        # Check for overlaps within each guild
        for guild_name, agents in guilds.items():
            for i, a1 in enumerate(agents):
                for a2 in agents[i+1:]:
                    # Sectors should not overlap
                    overlap = (
                        a1.hilbert_sector_start < a2.hilbert_sector_end and
                        a1.hilbert_sector_end > a2.hilbert_sector_start
                    )
                    assert not overlap, f"Overlap between {a1.agent_name} and {a2.agent_name}"


class TestECCAgentGuild:
    """Tests for ECCAgentGuild class."""

    def test_guild_creation(self):
        """Test creating a guild instance."""
        guild = ECCAgentGuild()
        status = guild.get_guild_status()

        assert status["status"] == "active"
        assert "total_agents" in status
        assert "guilds" in status

    def test_list_all_agents(self):
        """Test listing all agents."""
        guild = ECCAgentGuild()
        agents = guild.list_agents()

        assert len(agents) > 0
        assert all("agent_name" in a for a in agents)

    def test_list_agents_by_guild(self):
        """Test filtering agents by guild."""
        guild = ECCAgentGuild()

        engineering = guild.list_agents("engineering")
        assert len(engineering) > 0
        assert all(a["guild"] == "engineering" for a in engineering)

        review = guild.list_agents("review")
        assert len(review) > 0
        assert all(a["guild"] == "review" for a in review)

    def test_spawn_agent(self):
        """Test spawning an agent."""
        guild = ECCAgentGuild()
        result = guild.spawn_agent("planner")

        assert result["status"] == "spawned"
        assert "instance" in result
        assert result["instance"]["profile"]["agent_name"] == "planner"

    def test_spawn_agent_with_position(self):
        """Test spawning an agent at a specific position."""
        guild = ECCAgentGuild()
        result = guild.spawn_agent("planner", hilbert_position=8_050_000)

        assert result["status"] == "spawned"
        assert result["instance"]["hilbert_position"] == 8_050_000

    def test_spawn_unknown_agent(self):
        """Test spawning an unknown agent."""
        guild = ECCAgentGuild()
        result = guild.spawn_agent("nonexistent-agent")

        assert result["status"] == "error"
        assert "error" in result

    def test_despawn_agent(self):
        """Test despawning an agent."""
        guild = ECCAgentGuild()

        # Spawn then despawn
        spawn_result = guild.spawn_agent("planner")
        instance_id = spawn_result["instance"]["instance_id"]

        despawn_result = guild.despawn_agent(instance_id)
        assert despawn_result["status"] == "despawned"
        assert despawn_result["instance_id"] == instance_id

    def test_despawn_nonexistent(self):
        """Test despawning a non-existent agent."""
        guild = ECCAgentGuild()
        result = guild.despawn_agent("nonexistent-instance")

        assert result["status"] == "error"

    def test_get_agent(self):
        """Test getting an agent profile."""
        guild = ECCAgentGuild()
        profile = guild.get_agent("planner")

        assert profile is not None
        assert profile.agent_name == "planner"

    def test_get_unknown_agent(self):
        """Test getting an unknown agent profile."""
        guild = ECCAgentGuild()
        profile = guild.get_agent("nonexistent")

        assert profile is None

    def test_spatial_state(self):
        """Test getting spatial state."""
        guild = ECCAgentGuild()

        # Spawn an agent first
        guild.spawn_agent("planner")

        state = guild.get_spatial_state()

        assert "guild_sectors" in state
        assert "active_instances" in state
        assert len(state["active_instances"]) == 1

    def test_singleton_pattern(self):
        """Test that get_guild returns a singleton."""
        guild1 = get_guild()
        guild2 = get_guild()

        assert guild1 is guild2


class TestECCGuildMCPTools:
    """Tests for MCP tool dispatch."""

    @pytest.mark.asyncio
    async def test_dispatch_guild_status(self):
        """Test dispatching guild status tool."""
        result = await dispatch_guild_tool("ecc_guild_status", {})

        assert result["status"] == "active"
        assert "total_agents" in result

    @pytest.mark.asyncio
    async def test_dispatch_list_agents(self):
        """Test dispatching list agents tool."""
        result = await dispatch_guild_tool("ecc_guild_list_agents", {})

        assert result["status"] == "success"
        assert "agents" in result
        assert len(result["agents"]) > 0

    @pytest.mark.asyncio
    async def test_dispatch_list_agents_filtered(self):
        """Test dispatching list agents tool with filter."""
        result = await dispatch_guild_tool("ecc_guild_list_agents", {"guild": "engineering"})

        assert result["status"] == "success"
        assert all(a["guild"] == "engineering" for a in result["agents"])

    @pytest.mark.asyncio
    async def test_dispatch_spawn(self):
        """Test dispatching spawn tool."""
        result = await dispatch_guild_tool("ecc_guild_spawn", {"agent_name": "planner"})

        assert result["status"] == "spawned"
        assert "instance" in result

    @pytest.mark.asyncio
    async def test_dispatch_despawn(self):
        """Test dispatching despawn tool."""
        # Spawn first
        spawn_result = await dispatch_guild_tool("ecc_guild_spawn", {"agent_name": "architect"})
        instance_id = spawn_result["instance"]["instance_id"]

        # Then despawn
        result = await dispatch_guild_tool("ecc_guild_despawn", {"instance_id": instance_id})

        assert result["status"] == "despawned"

    @pytest.mark.asyncio
    async def test_dispatch_spatial_state(self):
        """Test dispatching spatial state tool."""
        result = await dispatch_guild_tool("ecc_guild_spatial_state", {})

        assert "guild_sectors" in result
        assert "active_instances" in result

    @pytest.mark.asyncio
    async def test_dispatch_unknown_tool(self):
        """Test dispatching an unknown tool."""
        result = await dispatch_guild_tool("ecc_guild_unknown", {})

        assert result["status"] == "error"
        assert "Unknown guild tool" in result["error"]


class TestECCGuildMember:
    """Tests for ECCGuildMember dataclass."""

    def test_member_creation(self):
        """Test creating a guild member."""
        profile = ECCAgentProfile(
            agent_name="test",
            guild=ECCGuildDivision.ENGINEERING,
            hilbert_sector_start=0,
            hilbert_sector_end=100,
            description="Test"
        )

        member = ECCGuildMember(
            profile=profile,
            instance_id="test_123",
            hilbert_position=50
        )

        assert member.profile.agent_name == "test"
        assert member.instance_id == "test_123"
        assert member.status == "idle"
        assert member.hilbert_position == 50

    def test_member_to_dict(self):
        """Test converting member to dict."""
        profile = ECCAgentProfile(
            agent_name="test",
            guild=ECCGuildDivision.ENGINEERING,
            hilbert_sector_start=0,
            hilbert_sector_end=100,
            description="Test"
        )

        member = ECCGuildMember(
            profile=profile,
            instance_id="test_123",
            hilbert_position=50,
            tasks_completed=5
        )

        d = member.to_dict()

        assert d["instance_id"] == "test_123"
        assert d["hilbert_position"] == 50
        assert d["tasks_completed"] == 5
        assert d["profile"]["agent_name"] == "test"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
