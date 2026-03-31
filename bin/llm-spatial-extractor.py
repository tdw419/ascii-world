#!/usr/bin/env python3
import torch
import torch.nn as nn
import json
import numpy as np
import os
from pathlib import Path

# Configuration for the "Glass Box" LLM
CONFIG = {
    "name": "MicroGPT-Spatial",
    "layers": 4,
    "embed_dim": 128,
    "heads": 4,
    "vocab_size": 1000,
    "tile_memory_bytes": 4096, # 4KB per RISC-V tile
    "total_tiles": 10000,
    "grid_size": 100 # 100x100 grid
}

class LLMSpatialExtractor:
    def __init__(self, config):
        self.config = config
        self.output_dir = Path("./.ouroboros/spatial_llm")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Unit of data: 1 float32 = 4 bytes. 4KB tile = 1024 float32s.
        self.floats_per_tile = self.config["tile_memory_bytes"] // 4

    def generate_hilbert_path(self, n):
        """Simple Hilbert curve generator for 2D mapping (locality preservation)"""
        def rot(n, x, y, rx, ry):
            if ry == 0:
                if rx == 1:
                    x = n - 1 - x
                    y = n - 1 - y
                return y, x
            return x, y

        path = []
        for i in range(n * n):
            x, y = 0, 0
            t = i
            s = 1
            while s < n:
                rx = 1 & (t // 2)
                ry = 1 & (t ^ rx)
                x, y = rot(s, x, y, rx, ry)
                x += s * rx
                y += s * ry
                t //= 4
                s *= 2
            path.append((x, y))
        return path

    def extract_weights(self):
        print(f"Extracting weights for {self.config['name']}...")
        
        # Create a mock model with the specified architecture
        # In a real scenario, we would load a state_dict here.
        model = nn.ModuleDict({
            "embedding": nn.Embedding(self.config["vocab_size"], self.config["embed_dim"]),
            "layers": nn.ModuleList([
                nn.ModuleDict({
                    "attn": nn.Linear(self.config["embed_dim"], self.config["embed_dim"] * 3),
                    "mlp": nn.Sequential(
                        nn.Linear(self.config["embed_dim"], self.config["embed_dim"] * 4),
                        nn.ReLU(),
                        nn.Linear(self.config["embed_dim"] * 4, self.config["embed_dim"])
                    )
                }) for _ in range(self.config["layers"])
            ])
        })

        manifest = {
            "metadata": self.config,
            "tiles": []
        }

        # Hilbert path for mapping tile IDs to 2D coordinates
        hilbert_path = self.generate_hilbert_path(self.config["grid_size"])
        
        current_tile_id = 0

        def process_tensor(name, tensor):
            nonlocal current_tile_id
            flat_data = tensor.detach().numpy().flatten()
            num_tiles = (len(flat_data) + self.floats_per_tile - 1) // self.floats_per_tile
            
            print(f"  Mapping {name}: {len(flat_data)} params -> {num_tiles} tiles")
            
            for i in range(num_tiles):
                start = i * self.floats_per_tile
                end = min(start + self.floats_per_tile, len(flat_data))
                chunk = flat_data[start:end]
                
                # Zero-pad if needed
                if len(chunk) < self.floats_per_tile:
                    chunk = np.pad(chunk, (0, self.floats_per_tile - len(chunk)))
                
                # Save chunk to disk
                chunk_filename = f"tile_{current_tile_id}.bin"
                with open(self.output_dir / chunk_filename, "wb") as f:
                    f.write(chunk.tobytes())
                
                # Map tile ID to 2D coordinate via Hilbert path
                coords = hilbert_path[current_tile_id]
                
                manifest["tiles"].append({
                    "id": current_tile_id,
                    "x": coords[0],
                    "y": coords[1],
                    "parameter": name,
                    "offset": i,
                    "file": chunk_filename
                })
                
                current_tile_id += 1

        # Map the Embedding layer
        process_tensor("embeddings", model["embedding"].weight)

        # Map Transformer Layers
        for i, layer in enumerate(model["layers"]):
            process_tensor(f"layer_{i}_attn", layer["attn"].weight)
            process_tensor(f"layer_{i}_mlp_up", layer["mlp"][0].weight)
            process_tensor(f"layer_{i}_mlp_down", layer["mlp"][2].weight)

        # Write the manifest
        with open(self.output_dir / "spatial_manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"\nExtraction complete! {current_tile_id} tiles allocated.")
        print(f"Manifest saved to {self.output_dir}/spatial_manifest.json")

if __name__ == "__main__":
    extractor = LLMSpatialExtractor(CONFIG)
    extractor.extract_weights()
