#!/usr/bin/env python3
"""
pxOS System Monitor Agent

Collects system metrics and posts them to the pxOS server for visualization.

Usage:
    python system_monitor.py
    python system_monitor.py --url http://localhost:8080
    python system_monitor.py --interval 2
"""

import argparse
import time
import json
import urllib.request
import urllib.error

try:
    import psutil
except ImportError:
    print("Error: psutil not installed. Run: pip install psutil")
    exit(1)


def collect_metrics():
    """Collect system metrics using psutil."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.1) / 100
    
    # Memory
    mem = psutil.virtual_memory()
    mem_percent = mem.percent / 100
    mem_gb = mem.used / 1e9
    mem_total_gb = mem.total / 1e9
    
    # Disk
    disk = psutil.disk_usage('/')
    disk_percent = disk.percent / 100
    disk_gb = disk.used / 1e9
    disk_total_gb = disk.total / 1e9
    
    # Network
    net = psutil.net_io_counters()
    net_sent_mb = net.bytes_sent / 1e6
    net_recv_mb = net.bytes_recv / 1e6
    
    # Process count
    process_count = len(psutil.pids())
    
    return {
        'title': 'System Monitor',
        'cpu': round(cpu_percent, 2),
        'cpu_label': 'CPU',
        'mem': round(mem_percent, 2),
        'mem_gb': round(mem_gb, 1),
        'mem_total_gb': round(mem_total_gb, 1),
        'mem_label': 'Memory',
        'disk': round(disk_percent, 2),
        'disk_gb': round(disk_gb, 1),
        'disk_total_gb': round(disk_total_gb, 1),
        'disk_label': 'Disk',
        'net_sent': round(net_sent_mb, 1),
        'net_recv': round(net_recv_mb, 1),
        'process_count': process_count,
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
            result = json.loads(response.read().decode('utf-8'))
            return result
    except urllib.error.URLError as e:
        print(f"Error connecting to {endpoint}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing response: {e}")
        return None


def set_template(url, template):
    """Set the render template on the server."""
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
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        print(f"Error setting template: {e}")
        return None


def get_default_template():
    """Get the default system monitoring template."""
    return [
        # Title
        {"fn": "TEXT", "args": [0, 0, "title"]},
        {"fn": "LINE", "args": [0, 1, 80, "h", "border"]},
        
        # CPU
        {"fn": "TEXT", "args": [0, 2, "cpu_label"]},
        {"fn": "BAR", "args": [10, 2, "cpu", 30]},
        {"fn": "NUMBER", "args": [42, 2, "cpu", "0%"]},
        
        # Memory
        {"fn": "TEXT", "args": [0, 3, "mem_label"]},
        {"fn": "BAR", "args": [10, 3, "mem", 30]},
        {"fn": "NUMBER", "args": [42, 3, "mem_gb", "0.0 GB"]},
        
        # Disk
        {"fn": "TEXT", "args": [0, 4, "disk_label"]},
        {"fn": "BAR", "args": [10, 4, "disk", 30]},
        {"fn": "NUMBER", "args": [42, 4, "disk_gb", "0.0 GB"]},
        
        # Time
        {"fn": "TIME", "args": [70, 0, "HH:mm:ss"]},
        
        # Status
        {"fn": "TEXT", "args": [0, 5, "status_label"]},
        {"fn": "STATUS", "args": [10, 5, "cpu", 0.8, "◉ HIGH", 0.5, "● MED", "○ OK"]},
    ]


def main():
    parser = argparse.ArgumentParser(description='pxOS System Monitor Agent')
    parser.add_argument('--url', default='http://localhost:3839', 
                        help='pxOS server URL (default: http://localhost:3839)')
    parser.add_argument('--interval', type=float, default=1.0,
                        help='Update interval in seconds (default: 1.0)')
    parser.add_argument('--template', type=str, default=None,
                        help='Path to template JSON file (optional)')
    parser.add_argument('--once', action='store_true',
                        help='Run once and exit (for testing)')
    args = parser.parse_args()
    
    print(f"pxOS System Monitor Agent")
    print(f"Server: {args.url}")
    print(f"Interval: {args.interval}s")
    print()
    
    # Load template
    if args.template:
        try:
            with open(args.template, 'r') as f:
                template = json.load(f)
            print(f"Loaded template from {args.template}")
        except (IOError, json.JSONDecodeError) as e:
            print(f"Error loading template: {e}")
            print("Using default template")
            template = get_default_template()
    else:
        template = get_default_template()
        print("Using default template")
    
    # Set template on server
    result = set_template(args.url, template)
    if result:
        print(f"Template set ({result.get('templateSize', 0)} operations)")
    print()
    
    # Main loop
    print("Starting monitor... (Ctrl+C to stop)")
    print("-" * 50)
    
    try:
        while True:
            # Collect metrics
            cells = collect_metrics()
            
            # Post to server
            result = post_cells(args.url, cells)
            
            if result:
                changes = result.get('changes', {})
                changed_keys = list(changes.keys())
                print(f"[{time.strftime('%H:%M:%S')}] "
                      f"CPU: {cells['cpu']*100:5.1f}% | "
                      f"MEM: {cells['mem_gb']:5.1f}/{cells['mem_total_gb']:.0f}GB | "
                      f"DISK: {cells['disk_gb']:5.1f}/{cells['disk_total_gb']:.0f}GB")
            
            if args.once:
                break
            
            time.sleep(args.interval)
            
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == '__main__':
    main()
