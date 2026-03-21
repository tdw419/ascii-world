#!/usr/bin/env python3
"""
pxOS Geometry OS Monitor Agent

Monitors Geometry OS internals and posts metrics to pxOS for visualization.

Usage:
    python geometry_os_monitor.py
    python geometry_os_monitor.py --geometry-os-path ~/zion/projects/geometry_os
    python geometry_os_monitor.py --mock  # Use mock data for testing
"""

import argparse
import time
import json
import os
import urllib.request
import urllib.error

try:
    import psutil
except ImportError:
    print("Error: psutil not installed. Run: pip install psutil")
    exit(1)


class GeometryOSMonitor:
    def __init__(self, geometry_os_path=None, mock=False):
        self.geometry_os_path = geometry_os_path
        self.mock = mock
        
        # Mock data for testing without Geometry OS
        self.mock_data = {
            'neb_rate': 134200,
            'neb_total': 847293847,
            'gpu_tiles': 25,
            'gpu_tiles_max': 64,
            'gpu_pc': 0x80001234,
            'ctrm_facts': 32847,
            'ctrm_verified': 32100,
            'swarm_agents': 12,
            'guilds_active': 3,
        }
    
    def collect_neb_stats(self):
        """Collect NEB (Neural Event Bus) statistics."""
        if self.mock:
            return {
                'neb_rate': self.mock_data['neb_rate'],
                'neb_total': self.mock_data['neb_total'],
            }
        
        # Try to read from NEB stats file or API
        neb_stats_path = os.path.join(self.geometry_os_path or '', 'data/neb_stats.json')
        
        if os.path.exists(neb_stats_path):
            try:
                with open(neb_stats_path, 'r') as f:
                    stats = json.load(f)
                    return {
                        'neb_rate': stats.get('events_per_sec', 0),
                        'neb_total': stats.get('total_events', 0),
                    }
            except (IOError, json.JSONDecodeError):
                pass
        
        # Fallback: estimate from process activity
        return {
            'neb_rate': 0,
            'neb_total': 0,
        }
    
    def collect_gpu_stats(self):
        """Collect GPU VM execution statistics."""
        if self.mock:
            return {
                'gpu_tiles': self.mock_data['gpu_tiles'],
                'gpu_tiles_max': self.mock_data['gpu_tiles_max'],
                'gpu_pc': self.mock_data['gpu_pc'],
            }
        
        # Try to read from GPU status
        gpu_status_path = os.path.join(self.geometry_os_path or '', 'data/gpu_status.json')
        
        if os.path.exists(gpu_status_path):
            try:
                with open(gpu_status_path, 'r') as f:
                    stats = json.load(f)
                    return {
                        'gpu_tiles': stats.get('tiles_loaded', 0),
                        'gpu_tiles_max': stats.get('tiles_max', 64),
                        'gpu_pc': stats.get('program_counter', 0),
                    }
            except (IOError, json.JSONDecodeError):
                pass
        
        return {
            'gpu_tiles': 0,
            'gpu_tiles_max': 64,
            'gpu_pc': 0,
        }
    
    def collect_ctrm_stats(self):
        """Collect CTRM (truth management) statistics."""
        if self.mock:
            return {
                'ctrm_facts': self.mock_data['ctrm_facts'],
                'ctrm_verified': self.mock_data['ctrm_verified'],
            }
        
        # Try to read from CTRM database
        ctrm_path = os.path.join(self.geometry_os_path or '', 'data/ctrm_stats.json')
        
        if os.path.exists(ctrm_path):
            try:
                with open(ctrm_path, 'r') as f:
                    stats = json.load(f)
                    return {
                        'ctrm_facts': stats.get('total_facts', 0),
                        'ctrm_verified': stats.get('verified_facts', 0),
                    }
            except (IOError, json.JSONDecodeError):
                pass
        
        return {
            'ctrm_facts': 0,
            'ctrm_verified': 0,
        }
    
    def collect_swarm_stats(self):
        """Collect swarm/guild statistics."""
        if self.mock:
            return {
                'swarm_agents': self.mock_data['swarm_agents'],
                'guilds_active': self.mock_data['guilds_active'],
            }
        
        # Try to read from swarm status
        swarm_path = os.path.join(self.geometry_os_path or '', 'data/swarm_status.json')
        
        if os.path.exists(swarm_path):
            try:
                with open(swarm_path, 'r') as f:
                    stats = json.load(f)
                    return {
                        'swarm_agents': stats.get('active_agents', 0),
                        'guilds_active': stats.get('active_guilds', 0),
                    }
            except (IOError, json.JSONDecodeError):
                pass
        
        return {
            'swarm_agents': 0,
            'guilds_active': 0,
        }
    
    def collect_system_stats(self):
        """Collect general system statistics."""
        return {
            'cpu': psutil.cpu_percent() / 100,
            'mem': psutil.virtual_memory().percent / 100,
            'mem_gb': round(psutil.virtual_memory().used / 1e9, 1),
            'processes': len(psutil.pids()),
        }
    
    def collect_all(self):
        """Collect all metrics."""
        neb = self.collect_neb_stats()
        gpu = self.collect_gpu_stats()
        ctrm = self.collect_ctrm_stats()
        swarm = self.collect_swarm_stats()
        system = self.collect_system_stats()
        
        # Calculate percentages
        neb_rate_pct = min(1.0, neb['neb_rate'] / 200000)  # 200k events/sec = 100%
        gpu_tiles_pct = gpu['gpu_tiles'] / max(1, gpu['gpu_tiles_max'])
        ctrm_pct = ctrm['ctrm_verified'] / max(1, ctrm['ctrm_facts'])
        
        return {
            # Labels
            'title': 'Geometry OS Monitor',
            'neb_label': 'NEB',
            'gpu_label': 'GPU',
            'ctrm_label': 'CTRM',
            'sys_label': 'SYS',
            'swarm_label': 'SWARM',
            
            # NEB
            'neb_rate': neb['neb_rate'],
            'neb_rate_pct': round(neb_rate_pct, 2),
            'neb_total': neb['neb_total'],
            
            # GPU
            'gpu_tiles': gpu['gpu_tiles'],
            'gpu_tiles_max': gpu['gpu_tiles_max'],
            'gpu_tiles_pct': round(gpu_tiles_pct, 2),
            'gpu_pc': hex(gpu['gpu_pc']),
            
            # CTRM
            'ctrm_facts': ctrm['ctrm_facts'],
            'ctrm_verified': ctrm['ctrm_verified'],
            'ctrm_pct': round(ctrm_pct, 2),
            
            # Swarm
            'swarm_agents': swarm['swarm_agents'],
            'guilds': swarm['guilds_active'],
            
            # System
            'cpu': system['cpu'],
            'mem': system['mem'],
            'mem_gb': system['mem_gb'],
            'processes': system['processes'],
        }


def post_cells(url, cells):
    """Post cell values to pxOS server."""
    endpoint = f"{url.rstrip('/')}/api/v1/cells"
    data = json.dumps(cells).encode('utf-8')
    
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.URLError as e:
        print(f"Error: {e}")
        return None


def set_template(url, template):
    """Set the render template."""
    endpoint = f"{url.rstrip('/')}/api/v1/template"
    data = json.dumps(template).encode('utf-8')
    
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.URLError as e:
        print(f"Error setting template: {e}")
        return None


def get_template():
    """Get the Geometry OS monitoring template."""
    return [
        # Header
        {"fn": "TEXT", "args": [0, 0, "title"]},
        {"fn": "TIME", "args": [70, 0, "HH:mm:ss"]},
        {"fn": "LINE", "args": [0, 1, 80, "h", "borderHighlight"]},
        
        # NEB
        {"fn": "TEXT", "args": [0, 2, "neb_label"]},
        {"fn": "BAR", "args": [8, 2, "neb_rate_pct", 25]},
        {"fn": "NUMBER", "args": [36, 2, "neb_rate", "0k/s"]},
        
        # GPU
        {"fn": "TEXT", "args": [0, 3, "gpu_label"]},
        {"fn": "BAR", "args": [8, 3, "gpu_tiles_pct", 25]},
        {"fn": "TEXT", "args": [36, 3, "gpu_pc"]},
        
        # CTRM
        {"fn": "TEXT", "args": [0, 4, "ctrm_label"]},
        {"fn": "BAR", "args": [8, 4, "ctrm_pct", 25]},
        {"fn": "NUMBER", "args": [36, 4, "ctrm_facts", "0 facts"]},
        
        # Swarm
        {"fn": "TEXT", "args": [0, 5, "swarm_label"]},
        {"fn": "TEXT", "args": [8, 5, "swarm_agents"]},
        {"fn": "TEXT", "args": [20, 5, "guilds"]},
        
        # System
        {"fn": "LINE", "args": [0, 6, 80, "h", "border"]},
        {"fn": "TEXT", "args": [0, 7, "sys_label"]},
        {"fn": "BAR", "args": [8, 7, "cpu", 15]},
        {"fn": "BAR", "args": [26, 7, "mem", 15]},
        {"fn": "NUMBER", "args": [44, 7, "mem_gb", "0.0 GB"]},
    ]


def main():
    parser = argparse.ArgumentParser(description='pxOS Geometry OS Monitor')
    parser.add_argument('--url', default='http://localhost:3839',
                        help='pxOS server URL')
    parser.add_argument('--geometry-os-path', type=str, default=None,
                        help='Path to Geometry OS installation')
    parser.add_argument('--interval', type=float, default=1.0,
                        help='Update interval')
    parser.add_argument('--mock', action='store_true',
                        help='Use mock data for testing')
    parser.add_argument('--once', action='store_true',
                        help='Run once and exit')
    args = parser.parse_args()
    
    monitor = GeometryOSMonitor(
        geometry_os_path=args.geometry_os_path,
        mock=args.mock
    )
    
    print("pxOS Geometry OS Monitor")
    print(f"Server: {args.url}")
    print(f"Geometry OS: {args.geometry_os_path or 'not specified (using mock)'}")
    print(f"Mode: {'mock' if args.mock else 'live'}")
    print()
    
    # Set template
    template = get_template()
    result = set_template(args.url, template)
    if result:
        print(f"Template set ({result.get('templateSize', 0)} operations)")
    print()
    
    print("Starting monitor... (Ctrl+C to stop)")
    print("-" * 60)
    
    try:
        while True:
            cells = monitor.collect_all()
            result = post_cells(args.url, cells)
            
            if result:
                print(f"[{time.strftime('%H:%M:%S')}] "
                      f"NEB: {cells['neb_rate']/1000:6.1f}k/s | "
                      f"GPU: {cells['gpu_tiles']:2}/{cells['gpu_tiles_max']} tiles | "
                      f"CTRM: {cells['ctrm_facts']:6,} facts | "
                      f"SWARM: {cells['swarm_agents']:2} agents")
            
            if args.once:
                break
            
            time.sleep(args.interval)
            
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == '__main__':
    main()
