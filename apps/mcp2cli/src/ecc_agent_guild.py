#!/usr/bin/env python3
"""
ECC Agent Guild - Bridge ECC Agents to Geometry OS Spatial System

This module maps ECC's 46 agents to Geometry OS guild members with spatial
addressing via Hilbert coordinates. Each ECC agent type is assigned a sector
in the agency tile system.

## Guild Structure

ECC agents are organized into guilds by division:
- Engineering Guild: planner, architect, tdd-guide, refactor-cleaner
- Review Guild: code-reviewer, security-reviewer, database-reviewer
- Testing Guild: tdd-guide, e2e-runner, build-error-resolver
- Analysis Guild: explore, doc-updater
- BMAD Guild: All BMAD agents (bmad-*)

## Spatial Mapping

Each guild occupies a 1M-unit sector in Hilbert space:
- 8M-9M: Engineering Guild
- 9M-10M: Review Guild
- 10M-11M: Testing Guild
- 11M-12M: Analysis Guild
- 12M-13M: BMAD Guild
"""

import asyncio
import json
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, asdict, field
from enum import Enum
import subprocess
import os


# ECC Configuration
ECC_HOME = Path.home() / ".claude"
ECC_AGENTS_DIR = ECC_HOME / "agents"


class ECCGuildDivision(Enum):
    """Guild divisions matching AgencyDivision."""
    ENGINEERING = "engineering"
    REVIEW = "review"
    TESTING = "testing"
    ANALYSIS = "analysis"
    BMAD = "bmad"
    DEFAULT = "default"


@dataclass
class ECCAgentProfile:
    """Profile for an ECC agent wrapped as a Geometry OS guild member."""
    agent_name: str
    guild: ECCGuildDivision
    hilbert_sector_start: int
    hilbert_sector_end: int
    description: str
    capabilities: list[str] = field(default_factory=list)
    color_hex: int = 0x888888

    def to_dict(self) -> dict:
        d = asdict(self)
        # Convert enum to string value
        d["guild"] = self.guild.value
        return d


@dataclass
class ECCGuildMember:
    """Active guild member instance."""
    profile: ECCAgentProfile
    instance_id: str
    status: str = "idle"
    current_task: Optional[str] = None
    hilbert_position: int = 0
    tasks_completed: int = 0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["profile"] = self.profile.to_dict()
        return d


# ECC Agent Registry - Maps ECC agents to Geometry OS guilds
ECC_AGENT_REGISTRY: list[ECCAgentProfile] = [
    # Engineering Guild (8M-9M)
    ECCAgentProfile(
        agent_name="planner",
        guild=ECCGuildDivision.ENGINEERING,
        hilbert_sector_start=8_000_000,
        hilbert_sector_end=8_100_000,
        description="Implementation planning specialist",
        capabilities=["planning", "task_breakdown", "dependency_analysis"],
        color_hex=0x4ECDC4
    ),
    ECCAgentProfile(
        agent_name="architect",
        guild=ECCGuildDivision.ENGINEERING,
        hilbert_sector_start=8_100_000,
        hilbert_sector_end=8_200_000,
        description="System design and architecture specialist",
        capabilities=["architecture", "system_design", "scalability"],
        color_hex=0x95E1D3
    ),
    ECCAgentProfile(
        agent_name="tdd-guide",
        guild=ECCGuildDivision.ENGINEERING,
        hilbert_sector_start=8_200_000,
        hilbert_sector_end=8_300_000,
        description="Test-driven development enforcer",
        capabilities=["tdd", "testing", "coverage"],
        color_hex=0xA8E6CF
    ),
    ECCAgentProfile(
        agent_name="refactor-cleaner",
        guild=ECCGuildDivision.ENGINEERING,
        hilbert_sector_start=8_300_000,
        hilbert_sector_end=8_400_000,
        description="Dead code cleanup and consolidation",
        capabilities=["refactoring", "cleanup", "optimization"],
        color_hex=0xFFD93D
    ),

    # Review Guild (9M-10M)
    ECCAgentProfile(
        agent_name="code-reviewer",
        guild=ECCGuildDivision.REVIEW,
        hilbert_sector_start=9_000_000,
        hilbert_sector_end=9_200_000,
        description="Expert code review specialist",
        capabilities=["review", "quality", "maintainability"],
        color_hex=0xFF6B6B
    ),
    ECCAgentProfile(
        agent_name="security-reviewer",
        guild=ECCGuildDivision.REVIEW,
        hilbert_sector_start=9_200_000,
        hilbert_sector_end=9_400_000,
        description="Security vulnerability detection",
        capabilities=["security", "owasp", "vulnerability"],
        color_hex=0xFF4757
    ),
    ECCAgentProfile(
        agent_name="database-reviewer",
        guild=ECCGuildDivision.REVIEW,
        hilbert_sector_start=9_400_000,
        hilbert_sector_end=9_600_000,
        description="Database query optimization",
        capabilities=["database", "sql", "query_optimization"],
        color_hex=0x5352ED
    ),
    ECCAgentProfile(
        agent_name="python-reviewer",
        guild=ECCGuildDivision.REVIEW,
        hilbert_sector_start=9_600_000,
        hilbert_sector_end=9_700_000,
        description="Python code review",
        capabilities=["python", "pep8", "type_hints"],
        color_hex=0x3742FA
    ),
    ECCAgentProfile(
        agent_name="go-reviewer",
        guild=ECCGuildDivision.REVIEW,
        hilbert_sector_start=9_700_000,
        hilbert_sector_end=9_800_000,
        description="Go code review",
        capabilities=["go", "idiomatic", "concurrency"],
        color_hex=0x2ED573
    ),
    ECCAgentProfile(
        agent_name="kotlin-reviewer",
        guild=ECCGuildDivision.REVIEW,
        hilbert_sector_start=9_800_000,
        hilbert_sector_end=9_900_000,
        description="Kotlin code review",
        capabilities=["kotlin", "android", "compose"],
        color_hex=0xFF6348
    ),

    # Testing Guild (10M-11M)
    ECCAgentProfile(
        agent_name="e2e-runner",
        guild=ECCGuildDivision.TESTING,
        hilbert_sector_start=10_000_000,
        hilbert_sector_end=10_300_000,
        description="End-to-end testing specialist",
        capabilities=["e2e", "playwright", "browser_testing"],
        color_hex=0xFFE66D
    ),
    ECCAgentProfile(
        agent_name="build-error-resolver",
        guild=ECCGuildDivision.TESTING,
        hilbert_sector_start=10_300_000,
        hilbert_sector_end=10_600_000,
        description="Build and compilation error fixer",
        capabilities=["build", "compilation", "error_resolution"],
        color_hex=0xF9CA24
    ),
    ECCAgentProfile(
        agent_name="go-build-resolver",
        guild=ECCGuildDivision.TESTING,
        hilbert_sector_start=10_600_000,
        hilbert_sector_end=10_700_000,
        description="Go build error resolution",
        capabilities=["go", "build", "vet"],
        color_hex=0x1E90FF
    ),
    ECCAgentProfile(
        agent_name="kotlin-build-resolver",
        guild=ECCGuildDivision.TESTING,
        hilbert_sector_start=10_700_000,
        hilbert_sector_end=10_800_000,
        description="Kotlin/Gradle build resolution",
        capabilities=["kotlin", "gradle", "compilation"],
        color_hex=0x9B59B6
    ),

    # Analysis Guild (11M-12M)
    ECCAgentProfile(
        agent_name="Explore",
        guild=ECCGuildDivision.ANALYSIS,
        hilbert_sector_start=11_000_000,
        hilbert_sector_end=11_300_000,
        description="Fast codebase exploration",
        capabilities=["explore", "search", "discovery"],
        color_hex=0x00D2D3
    ),
    ECCAgentProfile(
        agent_name="doc-updater",
        guild=ECCGuildDivision.ANALYSIS,
        hilbert_sector_start=11_300_000,
        hilbert_sector_end=11_600_000,
        description="Documentation and codemap updates",
        capabilities=["documentation", "codemaps", "readme"],
        color_hex=0x54A0FF
    ),

    # BMAD Guild (12M-13M) - All BMAD agents share this sector
    ECCAgentProfile(
        agent_name="bmad-master",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_000_000,
        hilbert_sector_end=12_050_000,
        description="BMAD orchestration master",
        capabilities=["orchestration", "bmad", "coordination"],
        color_hex=0x6C5CE7
    ),
    ECCAgentProfile(
        agent_name="bmad-analyst-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_050_000,
        hilbert_sector_end=12_100_000,
        description="Business analyst router",
        capabilities=["analysis", "market_research", "discovery"],
        color_hex=0xA29BFE
    ),
    ECCAgentProfile(
        agent_name="bmad-architect-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_100_000,
        hilbert_sector_end=12_150_000,
        description="Architecture router",
        capabilities=["architecture", "design", "tech_selection"],
        color_hex=0xFD79A8
    ),
    ECCAgentProfile(
        agent_name="bmad-dev-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_150_000,
        hilbert_sector_end=12_200_000,
        description="Full stack developer router",
        capabilities=["development", "coding", "implementation"],
        color_hex=0xFDCB6E
    ),
    ECCAgentProfile(
        agent_name="bmad-pm-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_200_000,
        hilbert_sector_end=12_250_000,
        description="Product manager router",
        capabilities=["product", "roadmap", "prioritization"],
        color_hex=0x00B894
    ),
    ECCAgentProfile(
        agent_name="bmad-qa-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_250_000,
        hilbert_sector_end=12_300_000,
        description="QA and senior developer router",
        capabilities=["qa", "testing", "review"],
        color_hex=0xE17055
    ),
    ECCAgentProfile(
        agent_name="bmad-sm-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_300_000,
        hilbert_sector_end=12_350_000,
        description="Scrum master router",
        capabilities=["scrum", "agile", "sprints"],
        color_hex=0x74B9FF
    ),
    ECCAgentProfile(
        agent_name="bmad-ux-expert-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_350_000,
        hilbert_sector_end=12_400_000,
        description="UX expert router",
        capabilities=["ux", "design", "wireframes"],
        color_hex=0xFF7675
    ),
    ECCAgentProfile(
        agent_name="bmad-po-router",
        guild=ECCGuildDivision.BMAD,
        hilbert_sector_start=12_400_000,
        hilbert_sector_end=12_450_000,
        description="Product owner router",
        capabilities=["backlog", "stories", "acceptance"],
        color_hex=0x81ECEC
    ),
]


class ECCAgentGuild:
    """
    Manager for ECC agents wrapped as Geometry OS guild members.

    This class provides:
    - Agent discovery and registration
    - Spatial positioning via Hilbert coordinates
    - Task dispatch to appropriate guild members
    - Integration with GPU daemon for visualization
    """

    def __init__(self, gpu_daemon_url: str = "http://localhost:3420"):
        self.gpu_daemon_url = gpu_daemon_url
        self.active_members: dict[str, ECCGuildMember] = {}
        self._agent_index: dict[str, ECCAgentProfile] = {
            p.agent_name: p for p in ECC_AGENT_REGISTRY
        }

    def get_guild_status(self) -> dict:
        """Get overall guild status."""
        guilds = {}
        for division in ECCGuildDivision:
            members = [p for p in ECC_AGENT_REGISTRY if p.guild == division]
            guilds[division.value] = {
                "member_count": len(members),
                "sector_range": (
                    min(m.hilbert_sector_start for m in members) if members else 0,
                    max(m.hilbert_sector_end for m in members) if members else 0
                ),
                "members": [m.agent_name for m in members]
            }

        return {
            "status": "active",
            "total_agents": len(ECC_AGENT_REGISTRY),
            "active_instances": len(self.active_members),
            "guilds": guilds
        }

    def list_agents(self, guild: Optional[str] = None) -> list[dict]:
        """List all available ECC agents, optionally filtered by guild."""
        agents = ECC_AGENT_REGISTRY
        if guild:
            try:
                division = ECCGuildDivision(guild)
                agents = [a for a in agents if a.guild == division]
            except ValueError:
                pass

        return [a.to_dict() for a in agents]

    def get_agent(self, agent_name: str) -> Optional[ECCAgentProfile]:
        """Get an agent profile by name."""
        return self._agent_index.get(agent_name)

    def spawn_agent(self, agent_name: str, hilbert_position: Optional[int] = None) -> dict:
        """
        Spawn an ECC agent as a guild member.

        Args:
            agent_name: Name of the ECC agent to spawn
            hilbert_position: Optional specific position (default: sector start)

        Returns:
            Spawned member info or error
        """
        profile = self._agent_index.get(agent_name)
        if not profile:
            # Try to discover the agent dynamically
            profile = self._discover_agent(agent_name)

        if not profile:
            return {
                "status": "error",
                "error": f"Unknown agent: {agent_name}",
                "available_agents": list(self._agent_index.keys())
            }

        import uuid
        instance_id = f"{agent_name}_{uuid.uuid4().hex[:8]}"

        # Default to sector start if no position specified
        if hilbert_position is None:
            hilbert_position = profile.hilbert_sector_start

        member = ECCGuildMember(
            profile=profile,
            instance_id=instance_id,
            status="idle",
            hilbert_position=hilbert_position
        )

        self.active_members[instance_id] = member

        return {
            "status": "spawned",
            "instance": member.to_dict(),
            "message": f"Agent '{agent_name}' spawned as guild member"
        }

    def despawn_agent(self, instance_id: str) -> dict:
        """Remove an agent instance from the guild."""
        if instance_id in self.active_members:
            member = self.active_members.pop(instance_id)
            return {
                "status": "despawned",
                "instance_id": instance_id,
                "agent_name": member.profile.agent_name
            }
        return {
            "status": "error",
            "error": f"Instance not found: {instance_id}"
        }

    async def dispatch_task(
        self,
        instance_id: str,
        task: str,
        context: Optional[dict] = None
    ) -> dict:
        """
        Dispatch a task to an ECC agent instance.

        This invokes the actual ECC agent via the Agent tool.
        """
        member = self.active_members.get(instance_id)
        if not member:
            return {
                "status": "error",
                "error": f"Instance not found: {instance_id}"
            }

        member.status = "working"
        member.current_task = task

        try:
            # Invoke the ECC agent via subprocess
            # In a real implementation, this would use the Agent tool
            result = await self._invoke_ecc_agent(
                member.profile.agent_name,
                task,
                context
            )

            member.status = "idle"
            member.current_task = None
            member.tasks_completed += 1

            return {
                "status": "completed",
                "instance_id": instance_id,
                "task": task,
                "result": result,
                "tasks_completed": member.tasks_completed
            }

        except Exception as e:
            member.status = "error"
            return {
                "status": "error",
                "instance_id": instance_id,
                "error": str(e)
            }

    async def _invoke_ecc_agent(
        self,
        agent_name: str,
        task: str,
        context: Optional[dict] = None
    ) -> str:
        """
        Invoke an ECC agent.

        In production, this would use the Agent tool to spawn the actual agent.
        For now, we return a simulated response.
        """
        # This is a placeholder - in production we'd use:
        # from anthropic import Agent
        # agent = Agent(agent_name, ...)
        # return await agent.run(task)

        return f"[{agent_name}] Task processed: {task[:100]}..."

    def _discover_agent(self, agent_name: str) -> Optional[ECCAgentProfile]:
        """
        Dynamically discover an ECC agent not in the registry.

        Creates a profile on-the-fly for unknown agents.
        """
        agent_file = ECC_AGENTS_DIR / f"{agent_name}.md"
        if not agent_file.exists():
            # Check subdirectories
            for subdir in ECC_AGENTS_DIR.iterdir():
                if subdir.is_dir():
                    candidate = subdir / f"{agent_name}.md"
                    if candidate.exists():
                        agent_file = candidate
                        break

        if not agent_file.exists():
            return None

        # Create a default profile for discovered agent
        # Assign to Analysis guild by default with a unique sector
        existing_sectors = [p.hilbert_sector_end for p in ECC_AGENT_REGISTRY]
        next_sector = max(existing_sectors) + 100_000 if existing_sectors else 13_000_000

        profile = ECCAgentProfile(
            agent_name=agent_name,
            guild=ECCGuildDivision.ANALYSIS,
            hilbert_sector_start=next_sector,
            hilbert_sector_end=next_sector + 100_000,
            description=f"Discovered agent: {agent_name}",
            capabilities=["discovered"],
            color_hex=0x888888
        )

        # Add to registry
        ECC_AGENT_REGISTRY.append(profile)
        self._agent_index[agent_name] = profile

        return profile

    def get_spatial_state(self) -> dict:
        """
        Get spatial state for visualization on the Infinite Map.

        Returns agent positions in Hilbert space for rendering.
        """
        return {
            "timestamp": asyncio.get_event_loop().time() if asyncio.get_event_loop().is_running() else 0,
            "guild_sectors": {
                division.value: {
                    "start": min(p.hilbert_sector_start for p in ECC_AGENT_REGISTRY if p.guild == division),
                    "end": max(p.hilbert_sector_end for p in ECC_AGENT_REGISTRY if p.guild == division),
                }
                for division in ECCGuildDivision
                if any(p.guild == division for p in ECC_AGENT_REGISTRY)
            },
            "active_instances": [
                {
                    "instance_id": m.instance_id,
                    "agent_name": m.profile.agent_name,
                    "guild": m.profile.guild.value,
                    "hilbert_position": m.hilbert_position,
                    "status": m.status,
                    "color_hex": m.profile.color_hex
                }
                for m in self.active_members.values()
            ]
        }

    def discover_all_ecc_agents(self) -> dict:
        """
        Scan ECC agents directory and discover all available agents.

        Returns a mapping of agent names to their locations.
        """
        discovered = {}

        if not ECC_AGENTS_DIR.exists():
            return {"error": "ECC agents directory not found", "path": str(ECC_AGENTS_DIR)}

        for item in ECC_AGENTS_DIR.rglob("*.md"):
            if item.is_file():
                agent_name = item.stem
                if agent_name not in self._agent_index:
                    # New agent discovered
                    profile = self._discover_agent(agent_name)
                    if profile:
                        discovered[agent_name] = {
                            "path": str(item),
                            "guild": profile.guild.value,
                            "sector": (profile.hilbert_sector_start, profile.hilbert_sector_end)
                        }

        return {
            "total_known": len(self._agent_index),
            "newly_discovered": len(discovered),
            "discovered": discovered
        }


# Singleton instance
_guild_instance: Optional[ECCAgentGuild] = None


def get_guild() -> ECCAgentGuild:
    """Get the singleton ECC Agent Guild instance."""
    global _guild_instance
    if _guild_instance is None:
        _guild_instance = ECCAgentGuild()
    return _guild_instance


# ============================================================================
# MCP Tool Definitions for ECC Agent Guild
# ============================================================================

ECC_GUILD_MCP_TOOLS = [
    {
        "name": "ecc_guild_status",
        "description": "Get ECC Agent Guild status and organization",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "ecc_guild_list_agents",
        "description": "List ECC agents available as guild members",
        "inputSchema": {
            "type": "object",
            "properties": {
                "guild": {
                    "type": "string",
                    "description": "Filter by guild (engineering, review, testing, analysis, bmad)",
                    "enum": ["engineering", "review", "testing", "analysis", "bmad"]
                }
            }
        }
    },
    {
        "name": "ecc_guild_spawn",
        "description": "Spawn an ECC agent as a guild member",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_name": {"type": "string", "description": "ECC agent to spawn"},
                "hilbert_position": {"type": "integer", "description": "Optional spatial position"}
            },
            "required": ["agent_name"]
        }
    },
    {
        "name": "ecc_guild_despawn",
        "description": "Remove an agent instance from the guild",
        "inputSchema": {
            "type": "object",
            "properties": {
                "instance_id": {"type": "string", "description": "Instance ID to remove"}
            },
            "required": ["instance_id"]
        }
    },
    {
        "name": "ecc_guild_dispatch",
        "description": "Dispatch a task to an ECC agent instance",
        "inputSchema": {
            "type": "object",
            "properties": {
                "instance_id": {"type": "string", "description": "Instance ID"},
                "task": {"type": "string", "description": "Task description"},
                "context": {"type": "object", "description": "Optional context"}
            },
            "required": ["instance_id", "task"]
        }
    },
    {
        "name": "ecc_guild_spatial_state",
        "description": "Get spatial state for Infinite Map visualization",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "ecc_guild_discover",
        "description": "Discover all ECC agents and register them",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]


async def dispatch_guild_tool(name: str, arguments: dict) -> dict:
    """Dispatch an ECC Guild tool call."""
    guild = get_guild()

    if name == "ecc_guild_status":
        return guild.get_guild_status()

    elif name == "ecc_guild_list_agents":
        return {
            "status": "success",
            "agents": guild.list_agents(arguments.get("guild"))
        }

    elif name == "ecc_guild_spawn":
        return guild.spawn_agent(
            arguments["agent_name"],
            arguments.get("hilbert_position")
        )

    elif name == "ecc_guild_despawn":
        return guild.despawn_agent(arguments["instance_id"])

    elif name == "ecc_guild_dispatch":
        return await guild.dispatch_task(
            arguments["instance_id"],
            arguments["task"],
            arguments.get("context")
        )

    elif name == "ecc_guild_spatial_state":
        return guild.get_spatial_state()

    elif name == "ecc_guild_discover":
        return guild.discover_all_ecc_agents()

    else:
        return {"status": "error", "error": f"Unknown guild tool: {name}"}


# ============================================================================
# CLI Entry Point
# ============================================================================

async def main():
    """Test ECC Agent Guild."""
    print("=== ECC Agent Guild Test ===\n")

    guild = get_guild()

    # Get status
    status = guild.get_guild_status()
    print(f"Guild Status:")
    print(f"  Total Agents: {status['total_agents']}")
    print(f"  Active Instances: {status['active_instances']}")
    print(f"  Guilds: {list(status['guilds'].keys())}")
    print()

    # List engineering agents
    print("Engineering Guild Agents:")
    for agent in guild.list_agents("engineering"):
        print(f"  - {agent['agent_name']}: {agent['description']}")
    print()

    # Spawn an agent
    print("Spawning planner agent...")
    result = guild.spawn_agent("planner")
    print(f"  Result: {result['status']}")
    if result['status'] == 'spawned':
        print(f"  Instance: {result['instance']['instance_id']}")
    print()

    # Get spatial state
    spatial = guild.get_spatial_state()
    print(f"Spatial State:")
    print(f"  Guild Sectors: {len(spatial['guild_sectors'])}")
    print(f"  Active Instances: {len(spatial['active_instances'])}")


if __name__ == "__main__":
    asyncio.run(main())
