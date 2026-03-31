# security.py - Core Security & Memory Layer
# Handles token validation and entropic heartbeats for Geometry OS

import time
import hashlib

def validate_token(agent_id, token):
    """
    Validates an agent's signature token.
    In Phase 1, this is a placeholder for the Entropic Heartbeat.
    """
    # Simple entropic hash-based validation
    expected = hashlib.sha256(f"{agent_id}-geometry-os".encode()).hexdigest()[:16]
    return token == expected

def get_heartbeat():
    """
    Returns a normalized heartbeat value (0.0 to 1.0) based on current system time.
    Used for the Signature Pulse visual in the renderer.
    """
    # 2Hz sine wave for the pulse
    t = time.time()
    return (1.0 + 0.5 * (1.0 + (t * 2 * 3.14159) % 2 * 3.14159)) / 2.0 # Placeholder logic

if __name__ == "__main__":
    print(f"Heartbeat: {get_heartbeat()}")
