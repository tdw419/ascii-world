#!/usr/bin/env python3
"""
PHP Site ASCII Bridge
Exposes a local PHP site as an ASCII World substrate.
Port: 3480
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import re

PORT = 3480
PHP_URL = "http://localhost:8000/index.php"

# State
state = {
    "page": "home",
    "title": "PHP Site",
    "content": "Loading...",
    "status": "online"
}

def fetch_php_content():
    """Fetch content from PHP site and convert to ASCII."""
    try:
        result = subprocess.run(
            ["curl", "-s", PHP_URL],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            html = result.stdout
            # Extract title
            title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
            title = title_match.group(1) if title_match else "PHP Site"

            # Extract main content (simplified)
            content_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
            content = content_match.group(1) if content_match else html

            # Strip HTML tags for ASCII display
            content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
            content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
            content = re.sub(r'<[^>]+>', ' ', content)
            content = re.sub(r'\s+', ' ', content).strip()

            # Truncate for display
            if len(content) > 200:
                content = content[:200] + "..."

            return title, content
    except Exception as e:
        print(f"Error fetching PHP content: {e}")
    return "PHP Site", "Unable to fetch content"

def render_ascii():
    """Render ASCII view of the PHP site."""
    title, content = fetch_php_content()

    # Build ASCII template
    ascii_output = f"""╔══════════════════════════════════════════════════════════╗
║  PHP SITE BRIDGE: {title[:30]:<30} ║
╠══════════════════════════════════════════════════════════╣
║  [H] Home    [A] About    [C] Contact    [R] Refresh      ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  CONTENT PREVIEW:                                        ║
║  ┌──────────────────────────────────────────────────────┐║
║  │ {content[:52]:<52} │║
║  │ {content[52:104]:<52} │║
║  │ {content[104:156]:<156} │║
║  └──────────────────────────────────────────────────────┘║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  Source: http://localhost:8000/index.php                 ║
║  Status: ● Online                                        ║
╚══════════════════════════════════════════════════════════╝"""
    return ascii_output


class PHPBridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[PHP-Bridge:3480] {args[0]}")

    def do_GET(self):
        if self.path == '/' or self.path == '/view':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(render_ascii().encode('utf-8'))

        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy", "port": PORT}).encode())

        elif self.path == '/state':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(state).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/control':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                label = data.get('label', '').upper()
            except:
                label = ''

            action = "unknown"

            # Handle controls
            if label == 'H':
                state['page'] = 'home'
                action = "goto_home"
            elif label == 'A':
                state['page'] = 'about'
                action = "goto_about"
            elif label == 'C':
                state['page'] = 'contact'
                action = "goto_contact"
            elif label == 'R':
                action = "refresh"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "action": action,
                "state": state
            }).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    print(f"Starting PHP Site Bridge on port {PORT}...")
    server = HTTPServer(('0.0.0.0', PORT), PHPBridgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
