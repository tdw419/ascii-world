#!/usr/bin/env python3
"""
Tests for ECC HTTP API - Phase 5 of ECC Integration

Tests:
- Server startup and health check
- Status endpoints
- Tool execution
- Guild operations
- Skills operations
"""

import pytest
import json
import threading
import time
import socket
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def find_free_port():
    """Find a free port for testing."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


class TestECCHTTPHandler:
    """Test HTTP handler logic without server."""

    def test_handler_exists(self):
        """Handler class should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert ECCHTTPHandler is not None

    def test_config_defaults(self):
        """Config should have sensible defaults."""
        from ecc_http_api import ECCHTTPConfig
        config = ECCHTTPConfig()
        assert config.port == 3421
        assert config.host == "0.0.0.0"
        assert "*" in config.cors_origins


class TestStatusEndpoints:
    """Test status endpoint logic."""

    def test_status_method_exists(self):
        """Status handler method should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert hasattr(ECCHTTPHandler, '_handle_status')

    def test_list_tools_method_exists(self):
        """List tools handler method should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert hasattr(ECCHTTPHandler, '_handle_list_tools')


class TestGuildEndpoints:
    """Test guild endpoint logic."""

    def test_guild_status_method_exists(self):
        """Guild status handler method should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert hasattr(ECCHTTPHandler, '_handle_guild_status')

    def test_guild_list_agents_method_exists(self):
        """Guild list agents handler method should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert hasattr(ECCHTTPHandler, '_handle_guild_list_agents')


class TestSkillsEndpoints:
    """Test skills endpoint logic."""

    def test_skills_status_handler(self):
        """Skills status should return status dict."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler._send_json = MagicMock()

        ECCHTTPHandler._handle_skills_status(handler)

        assert handler._send_json.called

    def test_skills_list_handler(self):
        """Skills list should accept category filter."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler._send_json = MagicMock()

        ECCHTTPHandler._handle_skills_list(handler, {"category": ["testing"]})

        assert handler._send_json.called


class TestECCBridgeEndpoints:
    """Test ECC bridge endpoint logic."""

    def test_plan_handler_requires_task(self):
        """Plan endpoint should require task parameter."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler._send_error = MagicMock()

        ECCHTTPHandler._handle_ecc_plan(handler, {})

        # Should send error for missing task
        assert handler._send_error.called
        assert "Missing task" in handler._send_error.call_args[0][0]

    def test_tdd_handler_requires_feature(self):
        """TDD endpoint should require feature parameter."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler._send_error = MagicMock()

        ECCHTTPHandler._handle_ecc_tdd(handler, {})

        assert handler._send_error.called
        assert "Missing feature" in handler._send_error.call_args[0][0]

    def test_brainstorm_handler_requires_topic(self):
        """Brainstorm endpoint should require topic parameter."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler._send_error = MagicMock()

        ECCHTTPHandler._handle_ecc_brainstorm(handler, {})

        assert handler._send_error.called
        assert "Missing topic" in handler._send_error.call_args[0][0]

    def test_debug_handler_requires_issue(self):
        """Debug endpoint should require issue parameter."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler._send_error = MagicMock()

        ECCHTTPHandler._handle_ecc_debug(handler, {})

        assert handler._send_error.called
        assert "Missing issue" in handler._send_error.call_args[0][0]


class TestJSONParsing:
    """Test JSON body parsing."""

    def test_read_empty_body(self):
        """Reading empty body should return empty dict."""
        from ecc_http_api import ECCHTTPHandler
        from io import BytesIO

        handler = MagicMock(spec=ECCHTTPHandler)
        handler.headers = {"Content-Length": "0"}
        handler.rfile = BytesIO(b"")

        result = ECCHTTPHandler._read_json_body(handler)
        assert result == {}


class TestErrorHandling:
    """Test error response handling."""

    def test_send_error_format(self):
        """Error response should have correct format."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler._send_json = MagicMock()

        ECCHTTPHandler._send_error(handler, "Test error", 400)

        handler._send_json.assert_called_with(
            {"status": "error", "error": "Test error"},
            400
        )


class TestEndpointRouting:
    """Test endpoint routing logic."""

    def test_do_get_method_exists(self):
        """do_GET method should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert hasattr(ECCHTTPHandler, 'do_GET')

    def test_do_post_method_exists(self):
        """do_POST method should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert hasattr(ECCHTTPHandler, 'do_POST')


class TestCORS:
    """Test CORS handling."""

    def test_options_method_exists(self):
        """OPTIONS method should exist."""
        from ecc_http_api import ECCHTTPHandler
        assert hasattr(ECCHTTPHandler, 'do_OPTIONS')

    def test_send_json_includes_cors(self):
        """_send_json should include CORS headers."""
        from ecc_http_api import ECCHTTPHandler

        handler = MagicMock(spec=ECCHTTPHandler)
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()
        handler.wfile = MagicMock()
        handler.wfile.write = MagicMock()

        ECCHTTPHandler._send_json(handler, {"status": "ok"})

        # Verify CORS header was set
        cors_found = False
        for call in handler.send_header.call_args_list:
            if "Access-Control-Allow-Origin" in str(call):
                cors_found = True
                break
        assert cors_found, "CORS header not found"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
