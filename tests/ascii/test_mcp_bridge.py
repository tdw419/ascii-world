#!/usr/bin/env python3
"""
MCP Bridge Integration Test

Tests that the MCP bridge tools work correctly with the ASCII World server.
"""

import subprocess
import time
import httpx
import pytest

ASCII_API_URL = "http://localhost:3421"
SERVER_PROCESS = None


@pytest.fixture(scope="session", autouse=True)
def server():
    """Start ASCII World server for tests."""
    global SERVER_PROCESS
    # Start the server
    SERVER_PROCESS = subprocess.Popen(
        ["bun", "run", "src/ascii/cli.ts"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    # Wait for server to start
    max_wait = 5
    for i in range(max_wait * 10):
        try:
            response = httpx.get(f"{ASCII_API_URL}/health")
            if response.status_code == 200:
                break
        except:
            pass
        time.sleep(0.1)

    yield

    # Cleanup
    SERVER_PROCESS.terminate()
    SERVER_PROCESS.wait()


class TestMCPView:
    """Test ascii_view MCP tool functionality."""

    def test_view_returns_ascii(self):
        """ascii_view should return ASCII content."""
        response = httpx.get(f"{ASCII_API_URL}/view")
        assert response.status_code == 200
        assert len(response.text) > 0
        # Should contain state marker (matches existing TypeScript tests)
        assert "# State:" in response.text


class TestMCPControl:
    """Test ascii_control MCP tool functionality."""

    def test_control_navigates_state(self):
        """ascii_control should navigate to new state."""
        # Navigate to SOURCES
        response = httpx.post(
            f"{ASCII_API_URL}/control",
            json={"label": "B"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("state") == "SOURCES"

    def test_control_returns_action(self):
        """ascii_control should return action if applicable."""
        # H is refresh action
        response = httpx.post(
            f"{ASCII_API_URL}/control",
            json={"label": "H"}
        )
        assert response.status_code == 200
        data = response.json()
        # Action may be returned
        assert "action" in data


class TestMCPNavigate:
    """Test ascii_navigate MCP tool functionality."""

    def test_navigate_to_config(self):
        """ascii_navigate should navigate to target state."""
        response = httpx.post(
            f"{ASCII_API_URL}/control",
            json={"label": "C"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True


class TestMCPState:
    """Test ascii_state MCP tool functionality."""

    def test_state_returns_json(self):
        """ascii_state should return current state as JSON."""
        response = httpx.get(f"{ASCII_API_URL}/state")
        assert response.status_code == 200
        data = response.json()
        # State field is always present (matches existing TypeScript tests)
        assert "state" in data


class TestMCPBindings:
    """Test ascii_bindings MCP tool functionality."""

    def test_bindings_returns_config(self):
        """ascii_bindings should return label mappings."""
        response = httpx.get(f"{ASCII_API_URL}/bindings")
        assert response.status_code == 200
        data = response.json()
        assert "stateTransitions" in data
        assert "actions" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
