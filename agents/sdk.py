#!/usr/bin/env python3
"""
pxOS Agent SDK

Provides a Python client for registering with the pxOS Agent Registry,
sending heartbeats, and reporting metrics via the time-series store.

Usage:
    from sdk import AgentSDK

    sdk = AgentSDK(base_url="http://localhost:3839")
    sdk.register("my-agent", capabilities=["monitor"], config={"region": "us-east"})
    sdk.start_heartbeat(interval=30)

    # Later...
    sdk.report_metric("cpu", 0.75)
"""

import json
import threading
import urllib.request
import urllib.error
import time


class AgentSDK:
    """Client SDK for the pxOS Agent Registry API."""

    def __init__(self, base_url="http://localhost:3839"):
        """
        Initialize the SDK.

        Args:
            base_url: Base URL of the pxOS server.
        """
        self.base_url = base_url.rstrip("/")
        self.agent_id = None
        self.agent_data = None
        self._heartbeat_timer = None

    def _request(self, method, path, body=None):
        """
        Make an HTTP request to the server.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE).
            path: URL path (e.g., /api/v1/agents).
            body: Optional dict body to send as JSON.

        Returns:
            Parsed JSON response body, or None on error.

        Raises:
            RuntimeError: If the server returns an error status.
        """
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None

        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method=method,
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                raw = response.read().decode("utf-8")
                if raw:
                    return json.loads(raw)
                return None
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8") if e.fp else ""
            try:
                detail = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                detail = {"error": raw}
            raise RuntimeError(
                f"HTTP {e.code} on {method} {path}: {detail}"
            ) from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Connection error on {method} {path}: {e}") from e

    def register(self, name, capabilities=None, config=None):
        """
        Register this agent with the server.

        POSTs to /api/v1/agents with the agent's name, capabilities, and config.
        On success, stores the returned agent id for subsequent calls.

        Args:
            name: Agent display name.
            capabilities: Optional list of capability strings.
            config: Optional dict of agent configuration.

        Returns:
            dict with the full agent data returned by the server.

        Raises:
            RuntimeError: If registration fails.
        """
        payload = {"name": name}
        if capabilities is not None:
            payload["capabilities"] = capabilities
        if config is not None:
            payload["config"] = config

        result = self._request("POST", "/api/v1/agents", payload)
        self.agent_id = result["id"]
        self.agent_data = result
        return result

    def heartbeat(self):
        """
        Send a heartbeat ping to the server for the registered agent.

        PUTs to /api/v1/agents/:id/heartbeat.

        Returns:
            True if heartbeat was accepted.

        Raises:
            RuntimeError: If the agent is not registered or the request fails.
        """
        if not self.agent_id:
            raise RuntimeError("Agent not registered. Call register() first.")
        self._request("PUT", f"/api/v1/agents/{self.agent_id}/heartbeat")
        return True

    def start_heartbeat(self, interval=30):
        """
        Start an automatic heartbeat loop on a background daemon thread.

        Args:
            interval: Seconds between heartbeat pings (default 30).

        Raises:
            RuntimeError: If the agent is not registered.
        """
        if not self.agent_id:
            raise RuntimeError("Agent not registered. Call register() first.")

        self.stop_heartbeat()

        def _loop():
            while self._heartbeat_timer is not None:
                try:
                    self.heartbeat()
                except Exception:
                    pass  # Heartbeat failures are non-fatal
                time.sleep(interval)

        self._heartbeat_timer = threading.Thread(target=_loop, daemon=True)
        self._heartbeat_timer.start()

    def stop_heartbeat(self):
        """Stop the automatic heartbeat loop."""
        self._heartbeat_timer = None

    def report_metric(self, key, value):
        """
        Report a metric value to the time-series store.

        POSTs to /api/v1/cells with an agent-scoped key (agent:{id}:{key}).
        The server's cell subscription automatically records it into the
        time-series store.

        Args:
            key: Metric name (e.g., "cpu", "memory").
            value: Metric value (number or string).

        Returns:
            dict with the server response.

        Raises:
            RuntimeError: If the agent is not registered or the request fails.
        """
        if not self.agent_id:
            raise RuntimeError("Agent not registered. Call register() first.")

        scoped_key = f"agent:{self.agent_id}:{key}"
        return self._request("POST", "/api/v1/cells", {scoped_key: value})
