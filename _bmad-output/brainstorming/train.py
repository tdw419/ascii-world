#!/usr/bin/env python3
"""Mock training script for testing"""
import time
import random

print("Starting training...")
time.sleep(0.5)  # Simulate work
val_bpb = round(random.uniform(0.6, 0.9), 4)
print(f"Training complete.")
print(f"Final val_bpb: {val_bpb}")
