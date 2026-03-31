#!/usr/bin/env python3
"""
Framebuffer Runner - Execute PixelVM bytecode directly to /dev/fb0

This is the "main file" that lives in the framebuffer.
It takes pixel bytecode, executes via PixelVM (Node.js), and writes to hardware.

Usage:
    sudo python3 framebuffer-runner.py --test          # Test mode (virtual buffer)
    sudo python3 framebuffer-runner.py --run code.pix  # Execute bytecode file
    sudo python3 framebuffer-runner.py --python "x=10; print(x)"  # Execute Python
"""

import os
import sys
import mmap
import struct
import json
import subprocess
import argparse
from pathlib import Path
from typing import Optional, Tuple


class FramebufferRunner:
    """
    Executes pixel bytecode and writes output to /dev/fb0.
    
    The bridge between:
    - PixelVM (JavaScript execution engine)
    - Hardware framebuffer (Linux /dev/fb0)
    """
    
    def __init__(self, device: str = "/dev/fb0"):
        self.device = device
        self.fb_fd = None
        self.buffer = None
        
        # Framebuffer properties
        self.width = 1920
        self.height = 1080
        self.bpp = 32
        
        # PixelVM bridge path
        self.pixelvm_bridge = Path(__file__).parent.parent / "sync" / "pixelvm-bridge.js"
        self.server_url = "http://localhost:3839"
    
    def detect_framebuffer(self) -> bool:
        """Detect and configure framebuffer device."""
        print("=" * 60)
        print("FRAMEBUFFER DETECTION")
        print("=" * 60)
        
        if not Path(self.device).exists():
            print(f"✗ Device not found: {self.device}")
            return False
        
        print(f"✓ Device found: {self.device}")
        
        # Get resolution
        try:
            with open("/sys/class/graphics/fb0/virtual_size", "r") as f:
                size = f.read().strip().split(',')
                self.width, self.height = int(size[0]), int(size[1])
                print(f"✓ Resolution: {self.width}x{self.height}")
        except Exception as e:
            print(f"  Using default: {self.width}x{self.height} ({e})")
        
        # Get bpp
        try:
            with open("/sys/class/graphics/fb0/bits_per_pixel", "r") as f:
                self.bpp = int(f.read().strip())
                print(f"✓ Bits per pixel: {self.bpp}")
        except:
            print(f"  Using default: {self.bpp}")
        
        return True
    
    def execute_python(self, code: str) -> dict:
        """
        Execute Python code via PixelVM server.
        
        Args:
            code: Python code string
            
        Returns:
            Execution result with transpile info, execution stats
        """
        import urllib.request
        
        url = f"{self.server_url}/api/v1/pixelvm/python"
        data = json.dumps({"code": code}).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def execute_pixels(self, pixels: list) -> dict:
        """
        Execute raw pixel bytecode via PixelVM server.
        
        Args:
            pixels: List of [R, G, B, A] instructions
            
        Returns:
            Execution result
        """
        import urllib.request
        
        url = f"{self.server_url}/api/v1/pixelvm/pixels"
        data = json.dumps({"pixels": pixels}).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            return {"error": str(e)}
    
    def get_viewport_png(self) -> Optional[bytes]:
        """Get current viewport as PNG from PixelVM server."""
        import urllib.request
        
        url = f"{self.server_url}/api/v1/pixelvm/viewport"
        
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                return response.read()
        except Exception as e:
            print(f"Error getting viewport: {e}")
            return None
    
    def write_to_framebuffer(self, rgba_data: bytes) -> bool:
        """
        Write RGBA data directly to framebuffer.
        
        Args:
            rgba_data: Raw RGBA bytes (width * height * 4)
            
        Returns:
            True if successful
        """
        buffer_size = self.width * self.height * 4
        
        if len(rgba_data) < buffer_size:
            # Pad with zeros
            rgba_data = rgba_data + b'\x00' * (buffer_size - len(rgba_data))
        elif len(rgba_data) > buffer_size:
            # Truncate
            rgba_data = rgba_data[:buffer_size]
        
        try:
            self.fb_fd = os.open(self.device, os.O_RDWR)
            self.buffer = mmap.mmap(
                self.fb_fd,
                buffer_size,
                mmap.MAP_SHARED,
                mmap.PROT_WRITE
            )
            
            self.buffer.seek(0)
            self.buffer.write(rgba_data)
            self.buffer.flush()
            
            return True
            
        except PermissionError:
            print("✗ Permission denied. Run with sudo.")
            return False
        except Exception as e:
            print(f"✗ Write failed: {e}")
            return False
        finally:
            if self.buffer:
                self.buffer.close()
            if self.fb_fd:
                os.close(self.fb_fd)
        
        return False
    
    def write_png_to_framebuffer(self, png_data: bytes) -> bool:
        """
        Convert PNG to RGBA and write to framebuffer.
        
        Args:
            png_data: PNG image bytes
            
        Returns:
            True if successful
        """
        try:
            from PIL import Image
            import io
            
            # Decode PNG
            img = Image.open(io.BytesIO(png_data))
            
            # Convert to RGBA
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Resize to match framebuffer
            if img.size != (self.width, self.height):
                img = img.resize((self.width, self.height), Image.LANCZOS)
            
            # Get RGBA bytes
            rgba_data = img.tobytes()
            
            return self.write_to_framebuffer(rgba_data)
            
        except ImportError:
            print("✗ PIL not installed. Run: pip install Pillow")
            return False
        except Exception as e:
            print(f"✗ PNG conversion failed: {e}")
            return False
    
    def run_test_pattern(self) -> bool:
        """
        Run a test pattern to verify framebuffer output.
        """
        print("\n" + "=" * 60)
        print("TEST PATTERN")
        print("=" * 60)
        
        # Create test pattern in memory
        rgba = bytearray(self.width * self.height * 4)
        
        # Gradient pattern
        for y in range(self.height):
            for x in range(self.width):
                offset = (y * self.width + x) * 4
                
                # Red gradient horizontal
                rgba[offset + 0] = int(255 * x / self.width)
                # Green gradient vertical
                rgba[offset + 1] = int(255 * y / self.height)
                # Blue fixed
                rgba[offset + 2] = 128
                # Alpha
                rgba[offset + 3] = 255
        
        print(f"Writing {len(rgba):,} bytes to {self.device}...")
        return self.write_to_framebuffer(bytes(rgba))
    
    def run_layer1_test(self) -> bool:
        """
        Layer 1 test: Execute DRAW opcode directly, write to framebuffer.
        Bypasses server - pure local execution.
        """
        print("\n" + "=" * 60)
        print("LAYER 1 TEST: DRAW → Viewport → /dev/fb0")
        print("=" * 60)
        
        # This would need Node.js subprocess, so let's use the server for now
        # But first check if server has updated code by hitting reset + direct pixels
        
        print("\nSending raw DRAW instruction via server...")
        
        # DRAW opcode = 215
        # Send raw pixels: [DRAW dst=0, HALT]
        pixels = [
            [215, 0, 0, 0],  # DRAW dst=0 (mem[0]=value, mem[1]=x, mem[2]=y, mem[3]=color)
            [141, 0, 0, 0],  # HALT
        ]
        
        # First, we need to set memory values via DATA instructions
        # Let's use the execute_pixels with a full program
        program = [
            [128, 0, 30, 0],    # DATA dst=0, value=30
            [128, 1, 10, 0],    # DATA dst=1, value=10 (x)
            [128, 2, 10, 0],    # DATA dst=2, value=10 (y)
            [128, 3, 255, 255], # DATA dst=3, value=0xFFFFFF (white) - B=255, A=255
            [215, 0, 0, 0],     # DRAW dst=0
            [141, 0, 0, 0],     # HALT
        ]
        
        result = self.execute_pixels(program)
        
        if not result.get("success"):
            print(f"✗ Execution failed: {result.get('error')}")
            return False
        
        print(f"✓ Executed: {result.get('execution', {}).get('cycles', 0)} cycles")
        
        # Get viewport
        viewport = self.get_viewport_png()
        if viewport:
            print(f"✓ Viewport PNG: {len(viewport):,} bytes")
            
            # Save for inspection
            with open('/tmp/fb_layer1.png', 'wb') as f:
                f.write(viewport)
            print("  Saved to /tmp/fb_layer1.png")
            
            # Check for white pixels
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(viewport))
            pixels = img.load()
            white = sum(1 for y in range(img.height) for x in range(img.width) 
                       if pixels[x, y][0] > 200)
            print(f"  White pixels: {white}")
            
            return white > 0
        else:
            print("✗ No viewport data")
            return False

    def run_virtual_test(self) -> bool:
        """
        Test execution in virtual buffer (no hardware).
        """
        print("\n" + "=" * 60)
        print("VIRTUAL BUFFER TEST")
        print("=" * 60)
        
        # Test Python execution
        print("\nTesting Python → PixelVM execution...")
        code = "x = 10\ny = 20\nz = x + y\nprint(z)"
        result = self.execute_python(code)
        
        if not result.get("success"):
            print(f"✗ Execution failed: {result.get('error', 'Unknown error')}")
            print("  Make sure PixelVM server is running: cd sync && node server.js")
            return False
        
        transpile = result.get('transpile', {})
        execution = result.get('execution', {})
        
        print(f"✓ Executed successfully")
        print(f"  Instructions: {transpile.get('instructionCount', 'N/A')}")
        print(f"  Cycles: {execution.get('cycles', 'N/A')}")
        print(f"  Halted: {execution.get('halted', 'N/A')}")
        print(f"  Elapsed: {result.get('elapsed', 'N/A')}ms")
        
        # Show variables
        variables = transpile.get('variables', {})
        if variables:
            print(f"\n  Variables:")
            for name, idx in variables.items():
                print(f"    {name} → reg[{idx}]")
        
        # Test viewport endpoint
        print("\nTesting viewport endpoint...")
        viewport = self.get_viewport_png()
        if viewport:
            print(f"✓ Viewport PNG: {len(viewport):,} bytes")
        else:
            print("  (Viewport not available - may need PNG encoder)")
        
        return True
    
    def run_python_to_framebuffer(self, code: str) -> bool:
        """
        Execute Python code and write result to framebuffer.
        """
        print("\n" + "=" * 60)
        print("PYTHON → FRAMEBUFFER")
        print("=" * 60)
        
        print(f"\nCode: {code[:50]}{'...' if len(code) > 50 else ''}")
        
        # Execute
        result = self.execute_python(code)
        
        if "error" in result:
            print(f"✗ Execution failed: {result['error']}")
            return False
        
        print(f"✓ Executed in {result.get('cycles', 0)} cycles")
        print(f"  Output: {result.get('output', '')}")
        
        # Get viewport PNG
        print("\nGetting viewport from PixelVM...")
        png_data = self.get_viewport_png()
        
        if not png_data:
            print("✗ Failed to get viewport")
            return False
        
        print(f"✓ Got viewport PNG ({len(png_data):,} bytes)")
        
        # Write to framebuffer
        print(f"\nWriting to {self.device}...")
        return self.write_png_to_framebuffer(png_data)


def main():
    parser = argparse.ArgumentParser(
        description="Framebuffer Runner - Execute PixelVM bytecode to /dev/fb0"
    )
    parser.add_argument("--test", action="store_true", help="Run virtual test (no hardware)")
    parser.add_argument("--layer1", action="store_true", help="Layer 1 test: DRAW → viewport")
    parser.add_argument("--pattern", action="store_true", help="Run test pattern to framebuffer")
    parser.add_argument("--python", type=str, help="Execute Python code")
    parser.add_argument("--run", type=str, help="Execute bytecode file")
    parser.add_argument("--device", type=str, default="/dev/fb0", help="Framebuffer device")
    
    args = parser.parse_args()
    
    runner = FramebufferRunner(device=args.device)
    
    # Default: virtual test
    if not (args.pattern or args.python or args.run or args.layer1):
        args.test = True
    
    if args.layer1:
        if not runner.run_layer1_test():
            sys.exit(1)
    
    elif args.test:
        if not runner.run_virtual_test():
            sys.exit(1)
    
    elif args.pattern:
        if not runner.detect_framebuffer():
            print("\n✗ Framebuffer detection failed")
            sys.exit(1)
        
        print("\n⚠ WARNING: This will overwrite your display!")
        print("Press Ctrl+C to abort, or wait 3 seconds...")
        import time
        time.sleep(3)
        
        if not runner.run_test_pattern():
            sys.exit(1)
        
        print("\n✓ Test pattern written to framebuffer")
    
    elif args.python:
        if not runner.detect_framebuffer():
            print("\n✗ Framebuffer detection failed")
            sys.exit(1)
        
        print("\n⚠ WARNING: This will overwrite your display!")
        print("Press Ctrl+C to abort, or wait 3 seconds...")
        import time
        time.sleep(3)
        
        if not runner.run_python_to_framebuffer(args.python):
            sys.exit(1)
        
        print("\n✓ Python output written to framebuffer")
    
    elif args.run:
        print(f"Bytecode execution not yet implemented: {args.run}")
        sys.exit(1)


if __name__ == "__main__":
    main()
