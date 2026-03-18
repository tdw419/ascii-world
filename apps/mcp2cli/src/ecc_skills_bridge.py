#!/usr/bin/env python3
"""
ECC Skills Bridge - Map ECC Skills to Glyph Programs

This module wraps ECC's 66 skills as spatially-addressed glyph programs
that can be executed on the GPU substrate.

## Spatial Mapping

Skills are mapped to Hilbert space sectors:
- 20M-21M: Testing Skills (tdd-workflow, python-testing, golang-testing, etc.)
- 21M-22M: Pattern Skills (python-patterns, golang-patterns, frontend-patterns, etc.)
- 22M-23M: Review Skills (verification-loop, code-review, etc.)
- 23M-24M: Planning Skills (writing-plans, brainstorming, etc.)
- 24M-25M: Domain Skills (claude-api, glyph-programming, etc.)
- 25M-26M: BMAD Skills (bmad-*)

## Execution Model

Skills can be executed in two modes:
1. **CPU Mode**: Direct invocation via subprocess/Agent tool
2. **GPU Mode**: Compiled to glyph program and executed on substrate

## Usage

```python
from ecc_skills_bridge import ECCSkillsBridge

bridge = ECCSkillsBridge()

# List available skills
skills = bridge.list_skills("testing")

# Compile a skill to glyph
glyph_path = bridge.compile_skill("tdd-workflow")

# Execute a skill
result = await bridge.execute_skill("tdd-workflow", {"feature": "allocator"})
```
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, asdict, field
from enum import Enum


# ECC Configuration
ECC_HOME = Path.home() / ".claude"
ECC_SKILLS_DIR = ECC_HOME / "skills"


class ECCSkillCategory(Enum):
    """Skill categories for spatial organization."""
    TESTING = "testing"
    PATTERNS = "patterns"
    REVIEW = "review"
    PLANNING = "planning"
    DOMAIN = "domain"
    BMAD = "bmad"
    SUPERPOWERS = "superpowers"
    UNKNOWN = "unknown"


@dataclass
class ECCSkill:
    """Represents an ECC skill with spatial addressing."""
    name: str
    category: ECCSkillCategory
    hilbert_sector_start: int
    hilbert_sector_end: int
    description: str
    triggers: list[str] = field(default_factory=list)
    compiled_glyph: Optional[str] = None
    execution_mode: str = "cpu"  # "cpu" or "gpu"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["category"] = self.category.value
        return d


# ECC Skill Registry - Maps ECC skills to Geometry OS spatial programs
ECC_SKILL_REGISTRY: list[ECCSkill] = [
    # Testing Skills (20M-21M)
    ECCSkill(
        name="tdd-workflow",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_000_000,
        hilbert_sector_end=20_050_000,
        description="Test-driven development workflow enforcement",
        triggers=["write tests first", "tdd", "red-green-refactor"]
    ),
    ECCSkill(
        name="python-testing",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_050_000,
        hilbert_sector_end=20_100_000,
        description="Python testing strategies with pytest",
        triggers=["python test", "pytest", "fixtures"]
    ),
    ECCSkill(
        name="golang-testing",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_100_000,
        hilbert_sector_end=20_150_000,
        description="Go testing patterns including table-driven tests",
        triggers=["go test", "table-driven", "subtests"]
    ),
    ECCSkill(
        name="kotlin-test",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_150_000,
        hilbert_sector_end=20_200_000,
        description="Enforce TDD workflow for Kotlin with Kotest",
        triggers=["kotlin test", "kotest"]
    ),
    ECCSkill(
        name="springboot-tdd",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_200_000,
        hilbert_sector_end=20_250_000,
        description="Test-driven development for Spring Boot",
        triggers=["spring boot test", "mockmvc"]
    ),
    ECCSkill(
        name="django-tdd",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_250_000,
        hilbert_sector_end=20_300_000,
        description="Django testing strategies with pytest-django",
        triggers=["django test", "pytest-django"]
    ),
    ECCSkill(
        name="e2e",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_300_000,
        hilbert_sector_end=20_350_000,
        description="Generate and run end-to-end tests with Playwright",
        triggers=["e2e test", "playwright", "browser test"]
    ),
    ECCSkill(
        name="test-coverage",
        category=ECCSkillCategory.TESTING,
        hilbert_sector_start=20_350_000,
        hilbert_sector_end=20_400_000,
        description="Test coverage analysis and reporting",
        triggers=["coverage", "test coverage"]
    ),

    # Pattern Skills (21M-22M)
    ECCSkill(
        name="python-patterns",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_000_000,
        hilbert_sector_end=21_050_000,
        description="Pythonic idioms, PEP 8, type hints",
        triggers=["python pattern", "pythonic", "pep8"]
    ),
    ECCSkill(
        name="golang-patterns",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_050_000,
        hilbert_sector_end=21_100_000,
        description="Idiomatic Go patterns and best practices",
        triggers=["go pattern", "idiomatic go"]
    ),
    ECCSkill(
        name="frontend-patterns",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_100_000,
        hilbert_sector_end=21_150_000,
        description="Frontend patterns for React, Next.js, state management",
        triggers=["frontend pattern", "react pattern"]
    ),
    ECCSkill(
        name="backend-patterns",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_150_000,
        hilbert_sector_end=21_200_000,
        description="Backend architecture patterns, API design",
        triggers=["backend pattern", "api design"]
    ),
    ECCSkill(
        name="django-patterns",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_200_000,
        hilbert_sector_end=21_250_000,
        description="Django architecture patterns with DRF",
        triggers=["django pattern", "drf"]
    ),
    ECCSkill(
        name="springboot-patterns",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_250_000,
        hilbert_sector_end=21_300_000,
        description="Spring Boot architecture patterns",
        triggers=["spring boot pattern", "spring pattern"]
    ),
    ECCSkill(
        name="java-coding-standards",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_300_000,
        hilbert_sector_end=21_350_000,
        description="Java coding standards for Spring Boot",
        triggers=["java standard", "java coding"]
    ),
    ECCSkill(
        name="coding-standards",
        category=ECCSkillCategory.PATTERNS,
        hilbert_sector_start=21_350_000,
        hilbert_sector_end=21_400_000,
        description="Universal coding standards and best practices",
        triggers=["coding standard", "best practice"]
    ),

    # Review Skills (22M-23M)
    ECCSkill(
        name="verification-loop",
        category=ECCSkillCategory.REVIEW,
        hilbert_sector_start=22_000_000,
        hilbert_sector_end=22_050_000,
        description="Comprehensive verification system for Claude Code sessions",
        triggers=["verify", "verification loop"]
    ),
    ECCSkill(
        name="eval-harness",
        category=ECCSkillCategory.REVIEW,
        hilbert_sector_start=22_050_000,
        hilbert_sector_end=22_100_000,
        description="Formal evaluation framework for sessions",
        triggers=["eval", "evaluation harness"]
    ),
    ECCSkill(
        name="iterative-retrieval",
        category=ECCSkillCategory.REVIEW,
        hilbert_sector_start=22_100_000,
        hilbert_sector_end=22_150_000,
        description="Progressive context retrieval pattern",
        triggers=["iterative retrieval", "context retrieval"]
    ),
    ECCSkill(
        name="build-fix",
        category=ECCSkillCategory.REVIEW,
        hilbert_sector_start=22_150_000,
        hilbert_sector_end=22_200_000,
        description="Build and fix workflow",
        triggers=["build fix", "fix build"]
    ),
    ECCSkill(
        name="gradle-build",
        category=ECCSkillCategory.REVIEW,
        hilbert_sector_start=22_200_000,
        hilbert_sector_end=22_250_000,
        description="Fix Gradle build errors for Android and KMP",
        triggers=["gradle build", "gradle error"]
    ),
    ECCSkill(
        name="kotlin-build",
        category=ECCSkillCategory.REVIEW,
        hilbert_sector_start=22_250_000,
        hilbert_sector_end=22_300_000,
        description="Fix Kotlin/Gradle build errors",
        triggers=["kotlin build", "kotlin error"]
    ),
    ECCSkill(
        name="go-build",
        category=ECCSkillCategory.REVIEW,
        hilbert_sector_start=22_300_000,
        hilbert_sector_end=22_350_000,
        description="Fix Go build errors incrementally",
        triggers=["go build", "go vet"]
    ),

    # Planning Skills (23M-24M)
    ECCSkill(
        name="writing-plans",
        category=ECCSkillCategory.PLANNING,
        hilbert_sector_start=23_000_000,
        hilbert_sector_end=23_050_000,
        description="Writing implementation plans for multi-step tasks",
        triggers=["write plan", "implementation plan"]
    ),
    ECCSkill(
        name="executing-plans",
        category=ECCSkillCategory.PLANNING,
        hilbert_sector_start=23_050_000,
        hilbert_sector_end=23_100_000,
        description="Executing implementation plans in separate agents",
        triggers=["execute plan", "run plan"]
    ),
    ECCSkill(
        name="brainstorming",
        category=ECCSkillCategory.PLANNING,
        hilbert_sector_start=23_100_000,
        hilbert_sector_end=23_150_000,
        description="Interactive brainstorming using creative techniques",
        triggers=["brainstorm", "ideate"]
    ),
    ECCSkill(
        name="plan",
        category=ECCSkillCategory.PLANNING,
        hilbert_sector_start=23_150_000,
        hilbert_sector_end=23_200_000,
        description="Restate requirements and create step-by-step implementation",
        triggers=["plan", "create plan"]
    ),
    ECCSkill(
        name="systematic-debugging",
        category=ECCSkillCategory.PLANNING,
        hilbert_sector_start=23_200_000,
        hilbert_sector_end=23_250_000,
        description="Systematic debugging approach for bugs and failures",
        triggers=["debug", "systematic debugging"]
    ),

    # Domain Skills (24M-25M)
    ECCSkill(
        name="claude-api",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_000_000,
        hilbert_sector_end=24_050_000,
        description="Build apps with Claude API or Anthropic SDK",
        triggers=["claude api", "anthropic sdk"]
    ),
    ECCSkill(
        name="glyph-programming",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_050_000,
        hilbert_sector_end=24_100_000,
        description="Write programs for Geometry OS glyph substrate",
        triggers=["glyph", "glyph program"]
    ),
    ECCSkill(
        name="frontend-design",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_100_000,
        hilbert_sector_end=24_150_000,
        description="Create production-grade frontend interfaces",
        triggers=["frontend design", "ui design"]
    ),
    ECCSkill(
        name="frontend-slides",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_150_000,
        hilbert_sector_end=24_200_000,
        description="Create animation-rich HTML presentations",
        triggers=["slides", "presentation"]
    ),
    ECCSkill(
        name="continuous-learning",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_200_000,
        hilbert_sector_end=24_250_000,
        description="Extract reusable patterns from sessions",
        triggers=["learn", "continuous learning"]
    ),
    ECCSkill(
        name="continuous-learning-v2",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_250_000,
        hilbert_sector_end=24_300_000,
        description="Instinct-based learning system via hooks",
        triggers=["instinct", "learning v2"]
    ),
    ECCSkill(
        name="prompt-optimize",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_300_000,
        hilbert_sector_end=24_350_000,
        description="Analyze and optimize prompts",
        triggers=["prompt optimize", "optimize prompt"]
    ),
    ECCSkill(
        name="model-route",
        category=ECCSkillCategory.DOMAIN,
        hilbert_sector_start=24_350_000,
        hilbert_sector_end=24_400_000,
        description="Model routing for optimal model selection",
        triggers=["model route", "route model"]
    ),

    # Superpowers Skills (25M-26M)
    ECCSkill(
        name="superpowers:writing-plans",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_000_000,
        hilbert_sector_end=25_050_000,
        description="Use when you have a spec or requirements for a multi-step task",
        triggers=["superpowers plan"]
    ),
    ECCSkill(
        name="superpowers:writing-skills",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_050_000,
        hilbert_sector_end=25_100_000,
        description="Creating or editing skills",
        triggers=["superpowers skill"]
    ),
    ECCSkill(
        name="superpowers:using-git-worktrees",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_100_000,
        hilbert_sector_end=25_150_000,
        description="Feature work isolation with git worktrees",
        triggers=["superpowers worktree"]
    ),
    ECCSkill(
        name="superpowers:test-driven-development",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_150_000,
        hilbert_sector_end=25_200_000,
        description="TDD before writing implementation",
        triggers=["superpowers tdd"]
    ),
    ECCSkill(
        name="superpowers:systematic-debugging",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_200_000,
        hilbert_sector_end=25_250_000,
        description="Debugging any bug, test failure, or unexpected behavior",
        triggers=["superpowers debug"]
    ),
    ECCSkill(
        name="superpowers:verification-before-completion",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_250_000,
        hilbert_sector_end=25_300_000,
        description="Verification before claiming work is complete",
        triggers=["superpowers verify"]
    ),
    ECCSkill(
        name="superpowers:dispatching-parallel-agents",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_300_000,
        hilbert_sector_end=25_350_000,
        description="Parallel task execution with independent agents",
        triggers=["superpowers parallel"]
    ),
    ECCSkill(
        name="superpowers:brainstorming",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_350_000,
        hilbert_sector_end=25_400_000,
        description="Creative work - features, building things, design",
        triggers=["superpowers brainstorm"]
    ),
    ECCSkill(
        name="superpowers:requesting-code-review",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_400_000,
        hilbert_sector_end=25_450_000,
        description="Code review request guidance",
        triggers=["superpowers review"]
    ),
    ECCSkill(
        name="superpowers:receiving-code-review",
        category=ECCSkillCategory.SUPERPOWERS,
        hilbert_sector_start=25_450_000,
        hilbert_sector_end=25_500_000,
        description="Processing code review feedback",
        triggers=["superpowers feedback"]
    ),

    # BMAD Skills (26M-27M)
    ECCSkill(
        name="bmad-brainstorming",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_000_000,
        hilbert_sector_end=26_050_000,
        description="BMAD interactive brainstorming sessions",
        triggers=["bmad brainstorm"]
    ),
    ECCSkill(
        name="bmad-bmm-quick-spec",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_050_000,
        hilbert_sector_end=26_100_000,
        description="Quick specs for small changes or features",
        triggers=["bmad quick spec"]
    ),
    ECCSkill(
        name="bmad-bmm-quick-dev",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_100_000,
        hilbert_sector_end=26_150_000,
        description="Quick tech spec implementation",
        triggers=["bmad quick dev"]
    ),
    ECCSkill(
        name="bmad-bmm-create-prd",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_150_000,
        hilbert_sector_end=26_200_000,
        description="Create PRD from scratch",
        triggers=["bmad prd", "create prd"]
    ),
    ECCSkill(
        name="bmad-bmm-create-ux-design",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_200_000,
        hilbert_sector_end=26_250_000,
        description="Plan UX patterns and design specifications",
        triggers=["bmad ux", "ux design"]
    ),
    ECCSkill(
        name="bmad-bmm-create-architecture",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_250_000,
        hilbert_sector_end=26_300_000,
        description="Create architecture solution design",
        triggers=["bmad architecture"]
    ),
    ECCSkill(
        name="bmad-bmm-create-epics-and-stories",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_300_000,
        hilbert_sector_end=26_350_000,
        description="Break requirements into epics and user stories",
        triggers=["bmad epics", "user stories"]
    ),
    ECCSkill(
        name="bmad-bmm-dev-story",
        category=ECCSkillCategory.BMAD,
        hilbert_sector_start=26_350_000,
        hilbert_sector_end=26_400_000,
        description="Execute story implementation",
        triggers=["bmad story", "dev story"]
    ),
]


class ECCSkillsBridge:
    """
    Bridge between ECC Skills and Geometry OS Glyph Programs.

    This class:
    - Maps ECC skills to spatial addresses in Hilbert space
    - Provides skill compilation to glyph programs
    - Manages skill execution (CPU or GPU mode)
    - Tracks skill execution state for visualization
    """

    def __init__(self, gpu_daemon_url: str = "http://localhost:3420"):
        self.gpu_daemon_url = gpu_daemon_url
        self._skill_index: dict[str, ECCSkill] = {
            s.name: s for s in ECC_SKILL_REGISTRY
        }
        self._execution_history: list[dict] = []

    def get_status(self) -> dict:
        """Get overall skills bridge status."""
        categories = {}
        for category in ECCSkillCategory:
            skills = [s for s in ECC_SKILL_REGISTRY if s.category == category]
            categories[category.value] = {
                "count": len(skills),
                "sector_range": (
                    min(s.hilbert_sector_start for s in skills) if skills else 0,
                    max(s.hilbert_sector_end for s in skills) if skills else 0
                )
            }

        return {
            "status": "active",
            "total_skills": len(ECC_SKILL_REGISTRY),
            "categories": categories,
            "execution_history_count": len(self._execution_history)
        }

    def list_skills(self, category: Optional[str] = None) -> list[dict]:
        """List available skills, optionally filtered by category."""
        skills = ECC_SKILL_REGISTRY

        if category:
            try:
                cat = ECCSkillCategory(category)
                skills = [s for s in skills if s.category == cat]
            except ValueError:
                pass

        return [s.to_dict() for s in skills]

    def get_skill(self, name: str) -> Optional[ECCSkill]:
        """Get a skill by name."""
        return self._skill_index.get(name)

    def find_skill_by_trigger(self, text: str) -> Optional[ECCSkill]:
        """Find a skill that matches a trigger phrase."""
        text_lower = text.lower()
        for skill in ECC_SKILL_REGISTRY:
            for trigger in skill.triggers:
                if trigger.lower() in text_lower:
                    return skill
        return None

    async def execute_skill(
        self,
        skill_name: str,
        context: Optional[dict] = None,
        mode: str = "cpu"
    ) -> dict:
        """
        Execute an ECC skill.

        Args:
            skill_name: Name of the skill to execute
            context: Execution context (feature, files, etc.)
            mode: Execution mode ("cpu" or "gpu")

        Returns:
            Execution result
        """
        skill = self._skill_index.get(skill_name)
        if not skill:
            return {
                "status": "error",
                "error": f"Unknown skill: {skill_name}",
                "available_skills": list(self._skill_index.keys())[:20]
            }

        execution_id = f"{skill_name}_{len(self._execution_history)}"

        execution_record = {
            "id": execution_id,
            "skill": skill_name,
            "hilbert_address": skill.hilbert_sector_start,
            "mode": mode,
            "context": context,
            "status": "running"
        }
        self._execution_history.append(execution_record)

        try:
            if mode == "gpu":
                result = await self._execute_on_gpu(skill, context)
            else:
                result = await self._execute_on_cpu(skill, context)

            execution_record["status"] = "completed"
            execution_record["result"] = result

            return {
                "status": "completed",
                "execution_id": execution_id,
                "skill": skill_name,
                "mode": mode,
                "hilbert_address": skill.hilbert_sector_start,
                "result": result
            }

        except Exception as e:
            execution_record["status"] = "error"
            execution_record["error"] = str(e)

            return {
                "status": "error",
                "execution_id": execution_id,
                "error": str(e)
            }

    async def _execute_on_cpu(self, skill: ECCSkill, context: Optional[dict]) -> str:
        """
        Execute skill in CPU mode via subprocess.

        This invokes the Skill tool to load and execute the actual ECC skill.
        """
        # In production, this would invoke the actual skill via the Skill tool
        # For now, return a simulated response
        return f"[CPU] Skill '{skill.name}' executed with context: {context}"

    async def _execute_on_gpu(self, skill: ECCSkill, context: Optional[dict]) -> str:
        """
        Execute skill in GPU mode via compiled glyph program.

        This would compile the skill to a glyph program and execute it
        on the GPU substrate.
        """
        # Check if skill is already compiled
        if not skill.compiled_glyph:
            # Compile skill to glyph
            glyph_path = await self._compile_skill_to_glyph(skill)
            skill.compiled_glyph = glyph_path

        # Execute via GPU daemon
        # In production, this would load the glyph and execute it
        return f"[GPU] Skill '{skill.name}' executed via glyph at {skill.compiled_glyph}"

    async def _compile_skill_to_glyph(self, skill: ECCSkill) -> str:
        """
        Compile an ECC skill to a glyph program.

        This generates a .glyph file that can be loaded and executed
        on the GPU substrate.
        """
        # Generate glyph program for this skill
        glyph_content = self._generate_skill_glyph(skill)

        # Write to programs directory
        programs_dir = Path(__file__).parent.parent.parent.parent / "systems" / "glyph_stratum" / "programs"
        programs_dir.mkdir(parents=True, exist_ok=True)

        glyph_path = programs_dir / f"skill_{skill.name.replace('-', '_').replace(':', '_')}.glyph"
        glyph_path.write_text(glyph_content)

        return str(glyph_path)

    def _generate_skill_glyph(self, skill: ECCSkill) -> str:
        """Generate a glyph program wrapper for an ECC skill."""
        return f"""// ============================================================================
// Geometry OS - ECC Skill: {skill.name}
// ============================================================================
//
// Auto-generated glyph wrapper for ECC skill.
// Hilbert Address: {skill.hilbert_sector_start} - {skill.hilbert_sector_end}
// Category: {skill.category.value}
// Description: {skill.description}
//
// Triggers: {', '.join(skill.triggers)}

.equ SKILL_BASE,     0x{skill.hilbert_sector_start:08X}
.equ SKILL_STATUS,   SKILL_BASE + 0x00
.equ SKILL_CONTEXT,  SKILL_BASE + 0x04
.equ SKILL_RESULT,   SKILL_BASE + 0x100
.equ TRAP_BASE,      0xFF000000

:main
    // Initialize skill execution
    LDI r1, SKILL_STATUS
    LDI r2, 1           // RUNNING
    STORE r1, r2

    // Wait for context to be written
    LDI r1, SKILL_CONTEXT
    LOAD r1, r2
    LDI r3, 0
    SUB r2, r3
    JZ :main            // Spin until context is set

    // Execute skill via trap (CPU fallback)
    LDI r1, TRAP_BASE
    LDI r2, 0x10        // EXECUTE_SKILL trap
    STORE r1, r2

    // Write result
    LDI r1, SKILL_RESULT
    LDI r2, 0           // SUCCESS
    STORE r1, r2

    // Update status
    LDI r1, SKILL_STATUS
    LDI r2, 2           // COMPLETED
    STORE r1, r2

    HALT
"""

    def get_spatial_state(self) -> dict:
        """
        Get spatial state for visualization on the Infinite Map.

        Returns skill sectors and recent executions for rendering.
        """
        return {
            "skill_sectors": {
                category.value: {
                    "start": min(s.hilbert_sector_start for s in ECC_SKILL_REGISTRY if s.category == category),
                    "end": max(s.hilbert_sector_end for s in ECC_SKILL_REGISTRY if s.category == category),
                    "count": len([s for s in ECC_SKILL_REGISTRY if s.category == category])
                }
                for category in ECCSkillCategory
                if any(s.category == category for s in ECC_SKILL_REGISTRY)
            },
            "recent_executions": self._execution_history[-10:] if self._execution_history else []
        }

    def discover_skills(self) -> dict:
        """
        Scan ECC skills directory and discover all available skills.

        Returns newly discovered skills.
        """
        discovered = {}

        if not ECC_SKILLS_DIR.exists():
            return {"error": "ECC skills directory not found", "path": str(ECC_SKILLS_DIR)}

        for item in ECC_SKILLS_DIR.rglob("*.md"):
            if item.is_file():
                skill_name = item.stem
                if skill_name not in self._skill_index:
                    # New skill discovered - create entry
                    existing_sectors = [s.hilbert_sector_end for s in ECC_SKILL_REGISTRY]
                    next_sector = max(existing_sectors) + 50_000 if existing_sectors else 27_000_000

                    skill = ECCSkill(
                        name=skill_name,
                        category=ECCSkillCategory.UNKNOWN,
                        hilbert_sector_start=next_sector,
                        hilbert_sector_end=next_sector + 50_000,
                        description=f"Discovered skill: {skill_name}"
                    )

                    ECC_SKILL_REGISTRY.append(skill)
                    self._skill_index[skill_name] = skill

                    discovered[skill_name] = {
                        "path": str(item),
                        "hilbert_sector": (skill.hilbert_sector_start, skill.hilbert_sector_end)
                    }

        return {
            "total_known": len(self._skill_index),
            "newly_discovered": len(discovered),
            "discovered": discovered
        }


# Singleton instance
_bridge_instance: Optional[ECCSkillsBridge] = None


def get_bridge() -> ECCSkillsBridge:
    """Get the singleton ECC Skills Bridge instance."""
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = ECCSkillsBridge()
    return _bridge_instance


# ============================================================================
# MCP Tool Definitions
# ============================================================================

ECC_SKILLS_MCP_TOOLS = [
    {
        "name": "ecc_skills_status",
        "description": "Get ECC Skills Bridge status",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "ecc_skills_list",
        "description": "List available ECC skills",
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Filter by category",
                    "enum": ["testing", "patterns", "review", "planning", "domain", "bmad", "superpowers"]
                }
            }
        }
    },
    {
        "name": "ecc_skills_execute",
        "description": "Execute an ECC skill",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "Skill to execute"},
                "context": {"type": "object", "description": "Execution context"},
                "mode": {"type": "string", "enum": ["cpu", "gpu"], "default": "cpu"}
            },
            "required": ["skill_name"]
        }
    },
    {
        "name": "ecc_skills_find",
        "description": "Find a skill by trigger phrase",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to match against triggers"}
            },
            "required": ["text"]
        }
    },
    {
        "name": "ecc_skills_spatial",
        "description": "Get spatial state for Infinite Map visualization",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "ecc_skills_discover",
        "description": "Discover all ECC skills",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]


async def dispatch_skills_tool(name: str, arguments: dict) -> dict:
    """Dispatch an ECC Skills tool call."""
    bridge = get_bridge()

    if name == "ecc_skills_status":
        return bridge.get_status()

    elif name == "ecc_skills_list":
        return {
            "status": "success",
            "skills": bridge.list_skills(arguments.get("category"))
        }

    elif name == "ecc_skills_execute":
        return await bridge.execute_skill(
            arguments["skill_name"],
            arguments.get("context"),
            arguments.get("mode", "cpu")
        )

    elif name == "ecc_skills_find":
        skill = bridge.find_skill_by_trigger(arguments["text"])
        if skill:
            return {
                "status": "found",
                "skill": skill.to_dict()
            }
        return {
            "status": "not_found",
            "text": arguments["text"]
        }

    elif name == "ecc_skills_spatial":
        return bridge.get_spatial_state()

    elif name == "ecc_skills_discover":
        return bridge.discover_skills()

    else:
        return {"status": "error", "error": f"Unknown skills tool: {name}"}


# ============================================================================
# CLI Entry Point
# ============================================================================

async def main():
    """Test ECC Skills Bridge."""
    print("=== ECC Skills Bridge Test ===\n")

    bridge = get_bridge()

    # Get status
    status = bridge.get_status()
    print(f"Skills Status:")
    print(f"  Total Skills: {status['total_skills']}")
    print(f"  Categories: {list(status['categories'].keys())}")
    print()

    # List testing skills
    print("Testing Skills:")
    for skill in bridge.list_skills("testing"):
        print(f"  - {skill['name']}: sector {skill['hilbert_sector_start']//1_000_000}M")
    print()

    # Find skill by trigger
    print("Finding skill for 'write tests first'...")
    skill = bridge.find_skill_by_trigger("write tests first")
    if skill:
        print(f"  Found: {skill.name}")
    print()

    # Execute a skill
    print("Executing tdd-workflow skill...")
    result = await bridge.execute_skill("tdd-workflow", {"feature": "test feature"})
    print(f"  Result: {result['status']}")
    print()

    # Get spatial state
    spatial = bridge.get_spatial_state()
    print(f"Spatial State:")
    print(f"  Skill Sectors: {len(spatial['skill_sectors'])}")
    print(f"  Recent Executions: {len(spatial['recent_executions'])}")


if __name__ == "__main__":
    asyncio.run(main())
