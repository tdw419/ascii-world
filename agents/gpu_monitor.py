#!/usr/bin/env python3
"""
pxOS Geometry OS Monitor Agent (GPU-Native)

Monitors Geometry OS GPU execution via gpu_dev_daemon.rs /stats endpoint
and posts metrics to pxOS for visualization.

Usage:
    python gpu_monitor.py --daemon-url http://localhost:8769 --pxos-url http://localhost:3839
"""

import argparse
import time
import json
import urllib.request
import urllib.error

class GPUMonitor:
    def __init__(self, daemon_url, mock=False):
        self.daemon_url = daemon_url.rstrip('/')
        self.mock = mock
        
    def fetch_stats(self):
        """Fetch stats from gpu_dev_daemon."""
        if self.mock:
            return [
                {"vm_id": 0, "state": 1, "pc": 0x1234, "cycles": 1000, "halted": 0, "parent_id": 255},
                {"vm_id": 1, "state": 2, "pc": 0x5678, "cycles": 500, "halted": 1, "parent_id": 0},
            ]
            
        try:
            with urllib.request.urlopen(f"{self.daemon_url}/stats", timeout=2) as response:
                return json.loads(response.read().decode('utf-8'))
        except (urllib.error.URLError, json.JSONDecodeError) as e:
            # Fallback to /status if /stats is not available yet
            try:
                with urllib.request.urlopen(f"{self.daemon_url}/status", timeout=2) as response:
                    status = json.loads(response.read().decode('utf-8'))
                    return [{"vm_id": 0, "state": 1, "pc": 0, "cycles": 0, "halted": 0, "parent_id": 255}] if status.get("vms", 0) > 0 else []
            except:
                return None

    def format_for_pxos(self, stats):
        """Format GPU stats for pxOS cells."""
        if stats is None:
            return {
                "title": "GPU: DISCONNECTED",
                "gpu_status": "OFFLINE",
                "vm_count": 0,
                "vm_count_pct": 0,
                "total_cycles": 0,
                "avg_pc": "0x0",
                "error_count": 0,
                "error_badge": 0
            }
            
        active_vms = [s for s in stats if s['state'] == 1] # 1 = RUNNING
        halted_vms = [s for s in stats if s['halted'] == 1]
        total_cycles = sum(s['cycles'] for s in stats)
        
        # We only show the first active VM's PC as primary
        primary_pc = hex(active_vms[0]['pc']) if active_vms else "0x0"
        
        return {
            "title": "GEOMETRY OS GPU MONITOR",
            "gpu_status": "ACTIVE" if active_vms else "IDLE",
            "vm_count": len(active_vms),
            "vm_count_pct": len(active_vms) / 8.0,
            "total_cycles": total_cycles,
            "avg_pc": primary_pc,
            "error_count": len(halted_vms),
            "error_badge": 1 if halted_vms else 0
        }

def post_to_pxos(pxos_url, cells):
    endpoint = f"{pxos_url.rstrip('/')}/api/v1/cells"
    data = json.dumps(cells).encode('utf-8')
    req = urllib.request.Request(endpoint, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            return True
    except:
        return False

def set_pxos_template(pxos_url):
    endpoint = f"{pxos_url.rstrip('/')}/api/v1/template"
    template = [
        {"fn": "TEXT", "args": [0, 0, "title"]},
        {"fn": "TIME", "args": [70, 0, "HH:mm:ss"]},
        {"fn": "LINE", "args": [0, 1, 80, "h", "borderHighlight"]},
        
        {"fn": "TEXT", "args": [0, 3, "STATUS:"]},
        {"fn": "TEXT", "args": [10, 3, "gpu_status"]},
        
        {"fn": "TEXT", "args": [0, 5, "ACTIVE VMS:"]},
        {"fn": "BAR", "args": [12, 5, "vm_count_pct", 20]},
        {"fn": "NUMBER", "args": [35, 5, "vm_count", " VMs"]},
        
        {"fn": "TEXT", "args": [0, 7, "PRIMARY PC:"]},
        {"fn": "TEXT", "args": [12, 7, "avg_pc"]},
        
        {"fn": "TEXT", "args": [0, 9, "TOTAL CYCLES:"]},
        {"fn": "NUMBER", "args": [14, 9, "total_cycles", " cycles"]},
        
        {"fn": "TEXT", "args": [0, 11, "HALTED:"]},
        {"fn": "BADGE", "args": [10, 11, "error_count", "HALT"]},
        
        {"fn": "LINE", "args": [0, 13, 80, "h", "border"]},
    ]
    data = json.dumps(template).encode('utf-8')
    req = urllib.request.Request(endpoint, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            return True
    except:
        return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--daemon-url', default='http://localhost:8769')
    parser.add_argument('--pxos-url', default='http://localhost:3839')
    parser.add_argument('--mock', action='store_true')
    args = parser.parse_args()
    
    monitor = GPUMonitor(args.daemon_url, args.mock)
    
    print(f"Starting GPU Monitor -> pxOS")
    print(f"Daemon: {args.daemon_url}")
    print(f"pxOS: {args.pxos_url}")
    
    set_pxos_template(args.pxos_url)
    
    try:
        while True:
            stats = monitor.fetch_stats()
            cells = monitor.format_for_pxos(stats)
            post_to_pxos(args.pxos_url, cells)
            
            status_line = f"VMS: {cells['vm_count']} | CYCLES: {cells['total_cycles']} | PC: {cells['avg_pc']} | HALTED: {cells['error_count']}"
            print(f"[{time.strftime('%H:%M:%S')}] {status_line}", end='\r')
            
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == '__main__':
    main()
