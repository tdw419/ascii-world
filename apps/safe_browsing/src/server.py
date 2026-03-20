#!/usr/bin/env python3
"""
Safe YouTube ASCII Server
Exposes /view and /control endpoints for the ASCII World portal.
Port: 3470
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import os
import re

PORT = 3470
STATE_FILE = "/tmp/safe_youtube_state.json"

# Default state
DEFAULT_STATE = {
    "videos": [
        {"label": "1", "id": "dQw4w9WgXcQ", "title": "Rick Astley - Never Gonna"},
        {"label": "2", "id": "jNQXAC9IVRw", "title": "Me at the zoo (First YouTube)"},
        {"label": "3", "id": "9bZkp7q19f0", "title": "PSY - Gangnam Style"},
    ],
    "now_playing": {"title": "Nothing", "id": ""},
    "status": "stopped",
    "volume": 75
}

playback_process = None


def load_state():
    """Load state from file or return default."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except:
            pass
    return DEFAULT_STATE.copy()


def save_state(state):
    """Save state to file."""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)


def render_ascii(state):
    """Render the ASCII template with current state."""
    videos = state.get("videos", [])
    now_playing = state.get("now_playing", {})
    status = state.get("status", "stopped")
    volume = state.get("volume", 75)

    # Build volume bar
    filled = int(volume / 5)
    volume_bar = "█" * filled + "░" * (20 - filled)

    # Build video list
    video_lines = ""
    for v in videos:
        video_lines += f"│   [{v['label']}] {v['title'][:35]:<35} │\n"

    # Status indicator
    status_icon = "▶" if status == "playing" else "■"

    ascii_output = f"""╔══════════════════════════════════════════════════════════╗
║  SAFE YOUTUBE - AUDIO ONLY MODE                          ║
╠══════════════════════════════════════════════════════════╣
{video_lines}╠══════════════════════════════════════════════════════════╣
║  NOW PLAYING: {now_playing.get('title', 'Nothing')[:40]:<40} ║
║  STATUS: [{status_icon}] {status:<10}                                      ║
║                                                          ║
║  [1-3] Select   [P] Play   [S] Stop   [M] Mute           ║
╠══════════════════════════════════════════════════════════╣
║  Volume: {volume_bar} ({volume}%)                       ║
╚══════════════════════════════════════════════════════════╝"""
    return ascii_output


class SafeYouTubeHandler(BaseHTTPRequestHandler):
    global playback_process

    def log_message(self, format, *args):
        print(f"[SafeYouTube:3470] {args[0]}")

    def do_GET(self):
        state = load_state()

        if self.path == '/' or self.path == '/view':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(render_ascii(state).encode('utf-8'))

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
        global playback_process

        if self.path == '/control':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                label = data.get('label', '').upper()
            except:
                label = ''

            state = load_state()
            action = "unknown"

            # Handle controls
            if label in ['1', '2', '3']:
                # Select video
                for v in state['videos']:
                    if v['label'] == label:
                        state['now_playing'] = {"title": v['title'], "id": v['id']}
                        state['status'] = "selected"
                        action = f"selected_{label}"
                        break

            elif label == 'P':
                # Play
                if state['now_playing'].get('id'):
                    state['status'] = "playing"
                    action = "play"
                    # Start actual playback (commented for safety)
                    # if playback_process:
                    #     playback_process.terminate()
                    # playback_process = subprocess.Popen([
                    #     "ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet",
                    #     f"https://www.youtube.com/watch?v={state['now_playing']['id']}"
                    # ])

            elif label == 'S':
                # Stop
                state['status'] = "stopped"
                action = "stop"
                # if playback_process:
                #     playback_process.terminate()
                #     playback_process = None

            elif label == 'M':
                # Mute toggle (simplified)
                if state['volume'] > 0:
                    state['volume'] = 0
                else:
                    state['volume'] = 75
                action = "mute_toggle"

            elif label in ['+', '=']:
                state['volume'] = min(100, state['volume'] + 5)
                action = "volume_up"

            elif label == '-':
                state['volume'] = max(0, state['volume'] - 5)
                action = "volume_down"

            save_state(state)

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
    print(f"Starting Safe YouTube ASCII Server on port {PORT}...")
    server = HTTPServer(('0.0.0.0', PORT), SafeYouTubeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
