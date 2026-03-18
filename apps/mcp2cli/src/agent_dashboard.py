#!/usr/bin/env python3
"""
Geometry OS Multi-Agent Dashboard

Real-time monitoring terminal for multi-agent collaboration on the GPU substrate.

Usage:
    python3 agent_dashboard.py

Controls:
    q - Quit
    r - Refresh
    e - Show events
    a - Show agents
    m - Show memory map
"""

import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime

# Try to import curses, fall back to basic output if not available
try:
    import curses
    HAS_CURSES = True
except ImportError:
    HAS_CURSES = False

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from geos_agent_manager import get_manager, AgentCapability
except ImportError:
    print("Error: geos_agent_manager not found. Make sure it's in the same directory.")
    sys.exit(1)

DAEMON_URL = "http://127.0.0.1:8769"


class AgentDashboard:
    """Terminal-based dashboard for monitoring multi-agent system."""

    def __init__(self):
        self.manager = get_manager()
        self.running = True
        self.selected_view = "overview"
        self.events_scroll = 0

    def get_daemon_status(self) -> dict:
        """Check if Ouroboros daemon is responding."""
        try:
            import requests
            resp = requests.get(f"{DAEMON_URL}/peek?addr=0x00000000&size=1", timeout=1)
            return {"online": resp.status_code == 200, "url": DAEMON_URL}
        except Exception as e:
            return {"online": False, "error": str(e), "url": DAEMON_URL}

    def format_bytes(self, n: int) -> str:
        """Format bytes in human-readable form."""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if n < 1024:
                return f"{n:.1f}{unit}"
            n /= 1024
        return f"{n:.1f}TB"

    def render_overview(self) -> str:
        """Render overview panel."""
        status = self.manager.get_status()
        daemon = self.get_daemon_status()

        lines = []
        lines.append("┌" + "─" * 58 + "┐")
        lines.append("│" + " GEOMETRY OS - MULTI-AGENT DASHBOARD ".center(58) + "│")
        lines.append("├" + "─" * 58 + "┤")
        lines.append("│" + f" Daemon: {daemon['url']}".ljust(58) + "│")
        lines.append("│" + f" Status: {'🟢 ONLINE' if daemon.get('online') else '🔴 OFFLINE'}".ljust(58) + "│")
        lines.append("├" + "─" * 58 + "┤")

        # Agent summary
        agents = status.get("agents", {})
        lines.append("│" + f" Active Agents: {len(agents)}".ljust(58) + "│")

        if agents:
            lines.append("├" + "─" * 58 + "┤")
            for agent_id, info in list(agents.items())[:5]:
                agent_type = info.get("type", "unknown")
                caps = ", ".join(info.get("capabilities", []))
                activity = datetime.fromtimestamp(info.get("last_activity", 0)).strftime("%H:%M:%S")
                line = f"  [{activity}] {agent_type}: {caps[:30]}"
                lines.append("│" + line.ljust(58) + "│")

        # Resource summary
        lines.append("├" + "─" * 58 + "┤")
        lines.append("│" + f" Memory Regions: {status.get('total_memory_regions', 0)}".ljust(58) + "│")
        lines.append("│" + f" Active Locks: {status.get('active_locks', 0)}".ljust(58) + "│")
        lines.append("│" + f" Recent Events: {status.get('recent_events', 0)}".ljust(58) + "│")
        lines.append("└" + "─" * 58 + "┘")

        return "\n".join(lines)

    def render_memory_map(self) -> str:
        """Render Hilbert memory map."""
        regions = self.manager.memory_regions

        lines = []
        lines.append("┌" + "─" * 58 + "┐")
        lines.append("│" + " HILBERT MEMORY MAP ".center(58) + "│")
        lines.append("├" + "─" * 58 + "┤")

        # System regions
        lines.append("│" + " SYSTEM REGIONS ".center(58) + "│")
        lines.append("│" + f"  0x00000000 - 0x0000FFFF : Kernel/Emulator State".ljust(58) + "│")
        lines.append("│" + f"  0x00010000 - 0x0001FFFF : Guest Registers".ljust(58) + "│")
        lines.append("│" + f"  0x00020000 - 0x0002FFFF : I/O Bridge".ljust(58) + "│")
        lines.append("│" + f"  0x00100000 - 0x0010FFFF : MMIO Devices".ljust(58) + "│")
        lines.append("├" + "─" * 58 + "┤")

        # Agent regions
        lines.append("│" + " AGENT REGIONS ".center(58) + "│")

        if regions:
            for region in sorted(regions, key=lambda r: r.start_addr):
                size = region.end_addr - region.start_addr
                owner = region.owner_id[:16]
                purpose = region.purpose[:20]
                line = f"  0x{region.start_addr:08X} - 0x{region.end_addr:08X} : {self.format_bytes(size)} [{owner}] {purpose}"
                lines.append("│" + line.ljust(58) + "│")
        else:
            lines.append("│" + "  No agent regions allocated".ljust(58) + "│")

        lines.append("└" + "─" * 58 + "┘")

        return "\n".join(lines)

    def render_agents(self) -> str:
        """Render detailed agent list."""
        agents = self.manager.list_agents()

        lines = []
        lines.append("┌" + "─" * 58 + "┐")
        lines.append("│" + " REGISTERED AGENTS ".center(58) + "│")
        lines.append("├" + "─" * 58 + "┤")

        if not agents:
            lines.append("│" + "  No agents registered".ljust(58) + "│")
        else:
            for agent in agents:
                lines.append("│" + f"  Agent: {agent.agent_id}".ljust(58) + "│")
                lines.append("│" + f"    Type: {agent.agent_type}".ljust(58) + "│")
                caps = ", ".join(c.value for c in agent.capabilities)
                lines.append("│" + f"    Capabilities: {caps}".ljust(58)[:58] + "│")
                created = datetime.fromtimestamp(agent.created_at).strftime("%Y-%m-%d %H:%M:%S")
                activity = datetime.fromtimestamp(agent.last_activity).strftime("%H:%M:%S")
                lines.append("│" + f"    Created: {created} | Last Active: {activity}".ljust(58) + "│")
                regions = self.manager.get_agent_regions(agent.agent_id)
                if regions:
                    total_size = sum(r.end_addr - r.start_addr for r in regions)
                    lines.append("│" + f"    Memory: {len(regions)} regions, {self.format_bytes(total_size)}".ljust(58) + "│")
                lines.append("├" + "─" * 58 + "┤")

        lines.append("└" + "─" * 58 + "┘")

        return "\n".join(lines)

    def render_events(self) -> str:
        """Render recent events."""
        events = list(reversed(self.manager.events[-20:]))

        lines = []
        lines.append("┌" + "─" * 58 + "┐")
        lines.append("│" + " RECENT EVENTS ".center(58) + "│")
        lines.append("├" + "─" * 58 + "┤")

        if not events:
            lines.append("│" + "  No events recorded".ljust(58) + "│")
        else:
            for event in events:
                ts = datetime.fromtimestamp(event.timestamp).strftime("%H:%M:%S")
                source = event.source_agent[:12]
                target = event.target_agent[:12] if event.target_agent else "broadcast"
                line = f"  [{ts}] {event.event_type} from {source} to {target}"
                lines.append("│" + line.ljust(58) + "│")

        lines.append("└" + "─" * 58 + "┘")

        return "\n".join(lines)

    def render(self) -> str:
        """Render current view."""
        if self.selected_view == "overview":
            return self.render_overview()
        elif self.selected_view == "memory":
            return self.render_memory_map()
        elif self.selected_view == "agents":
            return self.render_agents()
        elif self.selected_view == "events":
            return self.render_events()
        return self.render_overview()

    def run_simple(self):
        """Run dashboard in simple (non-curses) mode."""
        print("\033[2J\033[H", end="")  # Clear screen
        print(self.render())
        print("\nControls: [o]verview [a]gents [m]emory [e]vents [r]efresh [q]uit")

        try:
            import select
            while self.running:
                # Check for input
                if select.select([sys.stdin], [], [], 1.0)[0]:
                    char = sys.stdin.read(1).lower()
                    if char == 'q':
                        self.running = False
                    elif char == 'r':
                        print("\033[2J\033[H", end="")
                        print(self.render())
                    elif char == 'a':
                        self.selected_view = "agents"
                        print("\033[2J\033[H", end="")
                        print(self.render())
                    elif char == 'm':
                        self.selected_view = "memory"
                        print("\033[2J\033[H", end="")
                        print(self.render())
                    elif char == 'e':
                        self.selected_view = "events"
                        print("\033[2J\033[H", end="")
                        print(self.render())
                    elif char == 'o':
                        self.selected_view = "overview"
                        print("\033[2J\033[H", end="")
                        print(self.render())
                else:
                    # Refresh display
                    print("\033[2J\033[H", end="")
                    print(self.render())
                print("\nControls: [o]verview [a]gents [m]emory [e]vents [r]efresh [q]uit")
        except ImportError:
            # Fallback without select
            while self.running:
                time.sleep(2)
                print("\033[2J\033[H", end="")
                print(self.render())

    def run_curses(self, stdscr):
        """Run dashboard in curses mode."""
        curses.curs_set(0)  # Hide cursor
        stdscr.nodelay(1)  # Non-blocking input

        while self.running:
            stdscr.clear()

            # Render content
            content = self.render()
            for i, line in enumerate(content.split("\n")):
                if i < curses.LINES - 2:
                    stdscr.addstr(i, 0, line[:curses.COLS])

            # Controls
            stdscr.addstr(curses.LINES - 1, 0, "Controls: [o]verview [a]gents [m]emory [e]vents [r]efresh [q]uit")

            stdscr.refresh()

            # Handle input
            try:
                char = stdscr.getch()
                if char == ord('q'):
                    self.running = False
                elif char == ord('r'):
                    pass  # Refresh
                elif char == ord('a'):
                    self.selected_view = "agents"
                elif char == ord('m'):
                    self.selected_view = "memory"
                elif char == ord('e'):
                    self.selected_view = "events"
                elif char == ord('o'):
                    self.selected_view = "overview"
            except:
                pass

            time.sleep(0.5)

    def run(self):
        """Run the dashboard."""
        if HAS_CURSES:
            curses.wrapper(self.run_curses)
        else:
            print("Note: curses not available, using simple mode")
            self.run_simple()


def main():
    dashboard = AgentDashboard()
    print("Starting Geometry OS Multi-Agent Dashboard...")
    print("Press 'q' to quit\n")
    dashboard.run()


if __name__ == "__main__":
    main()
