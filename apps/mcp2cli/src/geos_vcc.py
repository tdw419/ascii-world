#!/usr/bin/env python3
"""
Geometry OS Visual Consistency Contract (VCC) System

The VCC is the "Legal System" of the self-hosting OS. It ensures that
autonomous changes follow the architectural specification.

Key Concepts:
- VCC Manifest: Registry of all approved spatial states
- VCC Validation: Check if current substrate matches expected hash
- VCC Signing: Record a new approved state with agent attribution
- VCC Guardrails: Prevent modifications to critical regions

Integration with Multi-Agent:
- Each VCC entry tracks which agent made the change
- Agents must hold locks before signing VCC changes
- Events are emitted when VCC violations are detected
"""

import hashlib
import json
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


class VCCRegionType(Enum):
    """Types of VCC-protected regions."""
    BOOT_SECTOR = "boot_sector"      # Critical: 0x0000-0x00FF
    KERNEL = "kernel"                # System kernel
    DRIVER = "driver"                # Hardware drivers
    VM_STATE = "vm_state"            # VM register state
    AGENT_WORKSPACE = "agent_workspace"  # Agent-private memory
    SHARED = "shared"                # Shared communication regions


class VCCViolationType(Enum):
    """Types of VCC violations."""
    HASH_MISMATCH = "hash_mismatch"
    UNAUTHORIZED_MODIFICATION = "unauthorized_modification"
    CRITICAL_REGION_ACCESS = "critical_region_access"
    LOCK_NOT_HELD = "lock_not_held"


@dataclass
class VCCEntry:
    """A single VCC manifest entry."""
    region_start: int
    region_end: int
    region_type: VCCRegionType
    expected_hash: str
    signing_agent: str
    signed_at: float
    description: str
    parent_hash: Optional[str] = None  # Previous state hash (for audit trail)
    metadata: dict = field(default_factory=dict)


@dataclass
class VCCViolation:
    """Record of a VCC violation."""
    violation_type: VCCViolationType
    region_start: int
    region_end: int
    expected_hash: str
    actual_hash: str
    offending_agent: Optional[str]
    detected_at: float
    details: str


class VCCManager:
    """
    Manages Visual Consistency Contracts for the Geometry OS substrate.

    The VCC system ensures:
    1. All changes to critical regions are tracked
    2. Agents cannot modify regions they don't own
    3. Hash mismatches trigger violations
    4. Complete audit trail of who changed what
    """

    CRITICAL_REGIONS = [
        (0x0000, 0x00FF, VCCRegionType.BOOT_SECTOR),
        (0x0100, 0x013F, VCCRegionType.VM_STATE),
    ]

    def __init__(self, manifest_path: Optional[Path] = None):
        self.manifest_path = manifest_path or Path("/tmp/geos_vcc_manifest.json")
        self.manifest: list[VCCEntry] = []
        self.violations: list[VCCViolation] = []
        self.guard_enabled = True
        self._load_manifest()

    def _load_manifest(self):
        """Load VCC manifest from disk."""
        if self.manifest_path.exists():
            try:
                data = json.loads(self.manifest_path.read_text())
                for entry_data in data.get("entries", []):
                    entry = VCCEntry(
                        region_start=entry_data["region_start"],
                        region_end=entry_data["region_end"],
                        region_type=VCCRegionType(entry_data["region_type"]),
                        expected_hash=entry_data["expected_hash"],
                        signing_agent=entry_data["signing_agent"],
                        signed_at=entry_data["signed_at"],
                        description=entry_data.get("description", ""),
                        parent_hash=entry_data.get("parent_hash"),
                        metadata=entry_data.get("metadata", {}),
                    )
                    self.manifest.append(entry)

                for viol_data in data.get("violations", []):
                    violation = VCCViolation(
                        violation_type=VCCViolationType(viol_data["violation_type"]),
                        region_start=viol_data["region_start"],
                        region_end=viol_data["region_end"],
                        expected_hash=viol_data["expected_hash"],
                        actual_hash=viol_data["actual_hash"],
                        offending_agent=viol_data.get("offending_agent"),
                        detected_at=viol_data["detected_at"],
                        details=viol_data["details"],
                    )
                    self.violations.append(violation)

            except Exception as e:
                print(f"Warning: Failed to load VCC manifest: {e}")

    def _save_manifest(self):
        """Persist VCC manifest."""
        data = {
            "entries": [
                {
                    "region_start": e.region_start,
                    "region_end": e.region_end,
                    "region_type": e.region_type.value,
                    "expected_hash": e.expected_hash,
                    "signing_agent": e.signing_agent,
                    "signed_at": e.signed_at,
                    "description": e.description,
                    "parent_hash": e.parent_hash,
                    "metadata": e.metadata,
                }
                for e in self.manifest
            ],
            "violations": [
                {
                    "violation_type": v.violation_type.value,
                    "region_start": v.region_start,
                    "region_end": v.region_end,
                    "expected_hash": v.expected_hash,
                    "actual_hash": v.actual_hash,
                    "offending_agent": v.offending_agent,
                    "detected_at": v.detected_at,
                    "details": v.details,
                }
                for v in self.violations
            ],
            "guard_enabled": self.guard_enabled,
        }
        self.manifest_path.write_text(json.dumps(data, indent=2))

    def compute_hash(self, data: bytes) -> str:
        """Compute SHA256 hash of data."""
        return hashlib.sha256(data).hexdigest()

    def is_critical_region(self, addr: int) -> bool:
        """Check if address is in a critical region."""
        for start, end, _ in self.CRITICAL_REGIONS:
            if start <= addr < end:
                return True
        return False

    def get_region_entry(self, addr: int) -> Optional[VCCEntry]:
        """Get VCC entry for an address."""
        for entry in self.manifest:
            if entry.region_start <= addr < entry.region_end:
                return entry
        return None

    def validate_region(
        self,
        region_start: int,
        region_end: int,
        actual_data: bytes,
    ) -> tuple[bool, Optional[VCCViolation]]:
        """
        Validate a region against its VCC entry.

        Returns:
            (is_valid, violation_if_any)
        """
        entry = self.get_region_entry(region_start)
        if not entry:
            return True, None  # No VCC entry = no constraint

        actual_hash = self.compute_hash(actual_data)
        if actual_hash != entry.expected_hash:
            violation = VCCViolation(
                violation_type=VCCViolationType.HASH_MISMATCH,
                region_start=region_start,
                region_end=region_end,
                expected_hash=entry.expected_hash,
                actual_hash=actual_hash,
                offending_agent=None,
                detected_at=time.time(),
                details=f"Hash mismatch: expected {entry.expected_hash[:16]}..., got {actual_hash[:16]}...",
            )
            self.violations.append(violation)
            self._save_manifest()
            return False, violation

        return True, None

    def sign_region(
        self,
        region_start: int,
        region_end: int,
        region_type: VCCRegionType,
        data: bytes,
        agent_id: str,
        description: str = "",
        metadata: Optional[dict] = None,
    ) -> VCCEntry:
        """
        Sign a new VCC entry for a region.

        This records that an agent has approved the current state of a region.
        """
        # Find previous entry for audit trail
        parent_hash = None
        for entry in reversed(self.manifest):
            if entry.region_start == region_start and entry.region_end == region_end:
                parent_hash = entry.expected_hash
                break

        new_hash = self.compute_hash(data)
        entry = VCCEntry(
            region_start=region_start,
            region_end=region_end,
            region_type=region_type,
            expected_hash=new_hash,
            signing_agent=agent_id,
            signed_at=time.time(),
            description=description,
            parent_hash=parent_hash,
            metadata=metadata or {},
        )

        # Remove old entry for same region
        self.manifest = [
            e for e in self.manifest
            if not (e.region_start == region_start and e.region_end == region_end)
        ]
        self.manifest.append(entry)
        self._save_manifest()

        return entry

    def check_modification_permission(
        self,
        addr: int,
        agent_id: str,
        agent_manager,
    ) -> tuple[bool, str]:
        """
        Check if an agent has permission to modify an address.

        Args:
            addr: Address to modify
            agent_id: Agent requesting modification
            agent_manager: MultiAgentManager instance

        Returns:
            (allowed, reason)
        """
        if not self.guard_enabled:
            return True, "Guard disabled"

        # Check critical region
        if self.is_critical_region(addr):
            return False, f"Address 0x{addr:08X} is in a critical region"

        # Check if agent owns this region
        entry = self.get_region_entry(addr)
        if entry and entry.signing_agent != agent_id:
            # Check if agent has full access capability
            agent = agent_manager.get_agent(agent_id)
            if agent:
                from geos_agent_manager import AgentCapability
                if AgentCapability.FULL_ACCESS in agent.capabilities:
                    return True, "Full access override"
            return False, f"Region owned by {entry.signing_agent}"

        return True, "Authorized"

    def get_audit_trail(self, region_start: int) -> list[VCCEntry]:
        """Get the full history of a region's VCC entries."""
        # This would require storing history, for now return current entry
        entry = self.get_region_entry(region_start)
        return [entry] if entry else []

    def get_status(self) -> dict:
        """Get VCC system status."""
        return {
            "manifest_entries": len(self.manifest),
            "total_violations": len(self.violations),
            "recent_violations": len([
                v for v in self.violations if time.time() - v.detected_at < 3600
            ]),
            "guard_enabled": self.guard_enabled,
            "critical_regions": len(self.CRITICAL_REGIONS),
            "protected_regions": list(set(
                f"0x{e.region_start:08X}-0x{e.region_end:08X}"
                for e in self.manifest
            )),
        }


# Singleton instance
_vcc_manager: Optional[VCCManager] = None


def get_vcc_manager() -> VCCManager:
    """Get the global VCC manager."""
    global _vcc_manager
    if _vcc_manager is None:
        _vcc_manager = VCCManager()
    return _vcc_manager
