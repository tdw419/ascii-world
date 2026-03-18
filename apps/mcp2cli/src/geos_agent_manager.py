#!/usr/bin/env python3
"""
Geometry OS Multi-Agent Manager

Provides session management and coordination for multiple AI agents
accessing the Geometry OS substrate simultaneously.

Architecture:
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │   Claude    │  │   Gemini    │  │   Other AI  │
  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
         │                │                │
         ▼                ▼                ▼
  ┌───────────────────────────────────────────────┐
  │           Multi-Agent Manager                  │
  │  - Agent Registry (ID, capabilities, session) │
  │  - Memory Region Allocation (per-agent VRAM)  │
  │  - Lock Manager (conflict prevention)         │
  │  - Event Bus (inter-agent communication)      │
  └───────────────────────────────────────────────┘
         │
         ▼
  ┌───────────────────────────────────────────────┐
  │           Ouroboros HAL (Port 8769)           │
  │           GPU Substrate (VRAM)                │
  └───────────────────────────────────────────────┘
"""

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional
from contextvars import ContextVar


class AgentCapability(Enum):
    """Capabilities an agent can have."""
    READ = "read"
    WRITE = "write"
    EXECUTE = "execute"
    SPAWN_VM = "spawn_vm"
    MODIFY_KERNEL = "modify_kernel"
    FULL_ACCESS = "full_access"


@dataclass
class MemoryRegion:
    """A reserved memory region in the substrate."""
    start_addr: int
    end_addr: int
    owner_id: str
    purpose: str
    created_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None  # None = never expires


@dataclass
class AgentSession:
    """Active session for an AI agent."""
    agent_id: str
    agent_type: str  # "claude", "gemini", "custom"
    capabilities: set[AgentCapability]
    memory_regions: list[MemoryRegion] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    def touch(self):
        """Update last activity timestamp."""
        self.last_activity = time.time()


@dataclass
class AgentEvent:
    """Event for inter-agent communication."""
    event_id: str
    event_type: str
    source_agent: str
    target_agent: Optional[str]  # None = broadcast
    payload: dict
    timestamp: float = field(default_factory=time.time)


class MultiAgentManager:
    """
    Manages multiple AI agents accessing the Geometry OS substrate.

    Features:
    - Agent registration and tracking
    - Memory region allocation with conflict prevention
    - Lock management for critical sections
    - Event bus for inter-agent communication
    - Session persistence
    """

    # Memory layout for multi-agent allocation
    AGENT_MEMORY_BASE = 0x200000  # Base address for agent-allocated memory
    AGENT_MEMORY_SIZE = 0x100000  # 1MB per agent max
    MAX_AGENTS = 16

    def __init__(self, state_file: Optional[Path] = None):
        self.agents: dict[str, AgentSession] = {}
        self.memory_regions: list[MemoryRegion] = []
        self.locks: dict[str, str] = {}  # resource -> owner_id
        self.events: list[AgentEvent] = []
        self.event_subscribers: dict[str, list[asyncio.Queue]] = {}

        self.state_file = state_file or Path("/tmp/geos_agents.json")
        self._load_state()

    def _load_state(self):
        """Load persisted agent state."""
        if self.state_file.exists():
            try:
                # Use a simple lock file for cross-process synchronization
                lock_file = Path(str(self.state_file) + ".lock")
                while lock_file.exists() and time.time() - lock_file.stat().st_mtime < 2:
                    time.sleep(0.05)
                
                data = json.loads(self.state_file.read_text())
                
                # Load agents
                self.agents = {}
                for agent_data in data.get("agents", []):
                    agent = AgentSession(
                        agent_id=agent_data["agent_id"],
                        agent_type=agent_data["agent_type"],
                        capabilities={AgentCapability(c) for c in agent_data.get("capabilities", [])},
                        metadata=agent_data.get("metadata", {}),
                    )
                    self.agents[agent.agent_id] = agent
                
                # Load memory regions
                self.memory_regions = []
                for region_data in data.get("memory_regions", []):
                    region = MemoryRegion(
                        start_addr=region_data["start_addr"],
                        end_addr=region_data["end_addr"],
                        owner_id=region_data["owner_id"],
                        purpose=region_data["purpose"],
                    )
                    self.memory_regions.append(region)
                
                # Load locks
                self.locks = data.get("locks", {})
                
            except Exception as e:
                print(f"Warning: Failed to load agent state: {e}")

    def _save_state(self):
        """Persist agent state."""
        try:
            lock_file = Path(str(self.state_file) + ".lock")
            lock_file.touch()
            
            data = {
                "agents": [
                    {
                        "agent_id": a.agent_id,
                        "agent_type": a.agent_type,
                        "capabilities": [c.value for c in a.capabilities],
                        "metadata": a.metadata,
                    }
                    for a in self.agents.values()
                ],
                "memory_regions": [
                    {
                        "start_addr": r.start_addr,
                        "end_addr": r.end_addr,
                        "owner_id": r.owner_id,
                        "purpose": r.purpose,
                    }
                    for r in self.memory_regions
                ],
                "locks": self.locks,
            }
            self.state_file.write_text(json.dumps(data, indent=2))
        finally:
            if lock_file.exists():
                lock_file.unlink()

    # === Agent Management ===

    def register_agent(
        self,
        agent_type: str,
        capabilities: Optional[set[AgentCapability]] = None,
        agent_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> AgentSession:
        """
        Register a new AI agent session.

        Args:
            agent_type: Type of agent ("claude", "gemini", "custom")
            capabilities: Set of capabilities this agent has
            agent_id: Optional custom ID (auto-generated if not provided)
            metadata: Additional agent metadata

        Returns:
            AgentSession with the new agent's details
        """
        agent_id = agent_id or f"{agent_type}_{uuid.uuid4().hex[:8]}"
        capabilities = capabilities or {AgentCapability.READ, AgentCapability.WRITE}

        session = AgentSession(
            agent_id=agent_id,
            agent_type=agent_type,
            capabilities=capabilities,
            metadata=metadata or {},
        )

        self.agents[agent_id] = session
        self._save_state()

        # Emit registration event
        self._emit_event(AgentEvent(
            event_id=uuid.uuid4().hex,
            event_type="agent_registered",
            source_agent="system",
            target_agent=None,
            payload={"agent_id": agent_id, "agent_type": agent_type},
        ))

        return session

    def unregister_agent(self, agent_id: str) -> bool:
        """Unregister an agent and release its resources."""
        if agent_id not in self.agents:
            return False

        # Release all memory regions
        self.memory_regions = [
            r for r in self.memory_regions if r.owner_id != agent_id
        ]

        # Release all locks
        self.locks = {k: v for k, v in self.locks.items() if v != agent_id}

        # Remove agent
        del self.agents[agent_id]
        self._save_state()

        return True

    def get_agent(self, agent_id: str) -> Optional[AgentSession]:
        """Get an agent's session."""
        agent = self.agents.get(agent_id)
        if agent:
            agent.touch()
        return agent

    def list_agents(self) -> list[AgentSession]:
        """List all registered agents."""
        return list(self.agents.values())

    # === Memory Region Management ===

    def allocate_memory(
        self,
        agent_id: str,
        size: int,
        purpose: str = "general",
        expires_in: Optional[float] = None,
    ) -> Optional[MemoryRegion]:
        """
        Allocate a memory region for an agent.

        Args:
            agent_id: The agent requesting allocation
            size: Size in bytes
            purpose: Description of what this memory is for
            expires_in: Optional timeout in seconds

        Returns:
            MemoryRegion if allocation succeeded, None otherwise
        """
        if agent_id not in self.agents:
            return None

        # Find free region
        current_end = self.AGENT_MEMORY_BASE
        for region in sorted(self.memory_regions, key=lambda r: r.start_addr):
            if region.start_addr >= current_end + size:
                break
            current_end = max(current_end, region.end_addr)

        if current_end + size > self.AGENT_MEMORY_BASE + self.AGENT_MEMORY_SIZE * self.MAX_AGENTS:
            return None  # Out of space

        region = MemoryRegion(
            start_addr=current_end,
            end_addr=current_end + size,
            owner_id=agent_id,
            purpose=purpose,
            expires_at=time.time() + expires_in if expires_in else None,
        )

        self.memory_regions.append(region)
        self._save_state()

        return region

    def release_memory(self, agent_id: str, start_addr: int) -> bool:
        """Release a memory region."""
        for i, region in enumerate(self.memory_regions):
            if region.start_addr == start_addr and region.owner_id == agent_id:
                del self.memory_regions[i]
                self._save_state()
                return True
        return False

    def get_agent_regions(self, agent_id: str) -> list[MemoryRegion]:
        """Get all memory regions owned by an agent."""
        return [r for r in self.memory_regions if r.owner_id == agent_id]

    def check_access(self, agent_id: str, addr: int, write: bool = False) -> bool:
        """
        Check if an agent has access to a memory address.

        Args:
            agent_id: The agent requesting access
            addr: The memory address
            write: True if write access required

        Returns:
            True if access is allowed
        """
        agent = self.agents.get(agent_id)
        if not agent:
            return False

        # Check capabilities
        if write and AgentCapability.WRITE not in agent.capabilities:
            if AgentCapability.FULL_ACCESS not in agent.capabilities:
                return False

        # Check if address is in agent's allocated regions or public space
        if addr < self.AGENT_MEMORY_BASE:
            return True  # Public space (kernel, etc.)

        for region in self.memory_regions:
            if region.start_addr <= addr < region.end_addr:
                return region.owner_id == agent_id

        return False  # Unallocated region

    # === Lock Management ===

    def acquire_lock(self, agent_id: str, resource: str, timeout: float = 30.0) -> bool:
        """
        Acquire a lock on a resource.

        Args:
            agent_id: The agent requesting the lock
            resource: Resource identifier (e.g., "vm:0", "addr:0x1000")
            timeout: Lock timeout in seconds

        Returns:
            True if lock acquired
        """
        current_owner = self.locks.get(resource)
        if current_owner and current_owner != agent_id:
            return False

        self.locks[resource] = agent_id
        return True

    def release_lock(self, agent_id: str, resource: str) -> bool:
        """Release a lock on a resource."""
        if self.locks.get(resource) == agent_id:
            del self.locks[resource]
            return True
        return False

    def get_locks(self, agent_id: Optional[str] = None) -> dict[str, str]:
        """Get all locks, optionally filtered by owner."""
        if agent_id:
            return {k: v for k, v in self.locks.items() if v == agent_id}
        return dict(self.locks)

    # === Event Bus ===

    def _emit_event(self, event: AgentEvent):
        """Emit an event to subscribers."""
        self.events.append(event)

        # Notify subscribers
        queues = self.event_subscribers.get(event.event_type, [])
        queues.extend(self.event_subscribers.get("*", []))

        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def subscribe_events(
        self,
        agent_id: str,
        event_types: list[str] = None,
    ) -> asyncio.Queue:
        """
        Subscribe to events.

        Args:
            agent_id: The agent subscribing
            event_types: List of event types to subscribe to (["*"] for all)

        Returns:
            Queue that will receive events
        """
        event_types = event_types or ["*"]
        queue = asyncio.Queue(maxsize=100)

        for event_type in event_types:
            if event_type not in self.event_subscribers:
                self.event_subscribers[event_type] = []
            self.event_subscribers[event_type].append(queue)

        return queue

    def send_event(
        self,
        source_agent: str,
        event_type: str,
        payload: dict,
        target_agent: Optional[str] = None,
    ):
        """
        Send an event to other agents.

        Args:
            source_agent: The agent sending the event
            event_type: Type of event
            payload: Event data
            target_agent: Optional specific target (None = broadcast)
        """
        event = AgentEvent(
            event_id=uuid.uuid4().hex,
            event_type=event_type,
            source_agent=source_agent,
            target_agent=target_agent,
            payload=payload,
        )
        self._emit_event(event)

    # === Status ===

    def get_status(self) -> dict:
        """Get multi-agent system status."""
        return {
            "agents": {
                a.agent_id: {
                    "type": a.agent_type,
                    "capabilities": [c.value for c in a.capabilities],
                    "memory_regions": len(self.get_agent_regions(a.agent_id)),
                    "last_activity": a.last_activity,
                }
                for a in self.agents.values()
            },
            "total_memory_regions": len(self.memory_regions),
            "active_locks": len(self.locks),
            "recent_events": len([e for e in self.events if time.time() - e.timestamp < 60]),
        }


# Context variable for current agent
current_agent: ContextVar[Optional[AgentSession]] = ContextVar("current_agent", default=None)


# Singleton instance
_manager: Optional[MultiAgentManager] = None


def get_manager() -> MultiAgentManager:
    """Get the global multi-agent manager."""
    global _manager
    if _manager is None:
        _manager = MultiAgentManager()
    return _manager

class AgentEventType:
    BUILD_READY = "geos:build_ready"
    VM_SPAWNED = "geos:vm_spawned"
    MEMORY_LOW = "geos:memory_low"
    REFINEMENT = "geos:refine_source"
    LOCK_CONFLICT = "geos:lock_conflict"
    VLM_VITALITY = "geos:vlm_vitality"
    COMPILER_BUSY = "geos:compiler_busy"
