# Spec: The "Glass Box" LLM Substrate

## 1. Vision & Purpose
This spec details the architectural plan to convert an open-source, small-parameter LLM (Large Language Model) into a fully spatial, physical manifestation on the Geometry OS Infinite Map. 

**The Goal:** Eliminate the "Black Box" of AI. When a user queries the AI, they will not just receive text—they will watch a "Visual Saccade," observing the AI's attention physically sweeping across its mapped training data and neural weights in real-time.

## 2. The Model: `TinyLlama` or `llm.c`
We will use a highly transparent, small-parameter model (e.g., Karpathy's `llm.c` architecture or a heavily quantized `TinyStories` model).
- **Reason:** We need a model small enough that its entire weight matrix and a curated subset of its training data can fit comfortably within the memory limits of the 10,000-tile RTX 5090 array (approx 40MB - 128MB).
- **Transparency:** The model's weights and activations must be fully accessible at runtime to drive the visualizer.

## 3. Spatial Cartography (The Hilbert Mapping)

The 10,000-tile GPU Array will be partitioned into three primary "Continents":

### Continent 1: The Archive (Training Data)
- **Concept:** The AI's training data (text) is embedded directly into the pixels of the map.
- **Layout Algorithm:** We will use **UMAP** (Uniform Manifold Approximation and Projection) applied to the text embeddings to map semantic concepts to 2D coordinates. 
  - *Example:* All data about "Physics" clusters in the North-West quadrant. All data about "History" clusters in the South-East.
- **Visuals:** You can literally zoom into the map and read the text of the training data. 

### Continent 2: The Cortex (Neural Weights)
- **Concept:** The physical "brain" of the LLM. 
- **Layout:** The Transformer layers are mapped sequentially to RISC-V tiles.
  - **Tiles 0-99:** Token Embeddings
  - **Tiles 100-299:** Attention Heads (Layer 1)
  - **Tiles 300-499:** Feed Forward/MLP (Layer 1)
  - ...and so on.
- **Visuals:** A dense, glowing grid. The brightness of a tile corresponds directly to the numerical weight it holds.

### Continent 3: The Working Memory (Context Window)
- **Concept:** The active "thought" space where the user's prompt is processed and the output is assembled.
- **Layout:** A localized region of memory-mapped mailboxes (e.g., `0x5000`) where tiles pass activation vectors to one another.

## 4. The "Visual Saccade" Pipeline

This is the step-by-step physical process of how the AI "thinks" on the map:

1. **Ingestion (The Spark):** The user types "Explain gravity." The prompt is converted into tokens and injected into the Working Memory sector.
2. **Forward Pass (The Wave):** The tokens hit the Cortex. A wave of **cyan activation energy** sweeps across the layer tiles. Only the specific tiles whose weights are highly activated will light up.
3. **Attention (The Saccade):** As the Attention Heads calculate relevance, we draw physical, glowing lines (or high-intensity heatmap flares) connecting the active Cortex tiles to the specific geographic coordinates in The Archive where related training data (e.g., "physics", "Newton") resides.
4. **Emission (The Output):** The final classification layer resolves the highest probability token. The winning tile pulses **bright green** and writes the token to the global UART buffer, which prints to the user's screen.
5. **Decay:** The glowing tiles slowly fade back to idle (dark blue/gray) as the next token calculation begins, creating a trailing "heat signature" of the AI's thought process.

## 5. Technical Implementation Path

### Phase 1: Data Extraction & Cartography
- Extract a subset of open training data.
- Run UMAP on the embeddings to generate 2D `(x, y)` coordinates for every paragraph.
- Write a script to "paint" this text into the `InfiniteMap` chunks.

### Phase 2: Weight Spatialization
- Extract the FP16/INT8 weights of the micro-LLM.
- Distribute the weights across the 4KB memory sandboxes of the 10,000 RISC-V tiles based on layer hierarchy.

### Phase 3: The Saccade Shader
- Modify `gpu-riscv-multicore.wgsl` to include a "glow state."
- When a tile executes a high-value multiplication (activation), it increments its local "heat" register.
- The `ascii-world` visualizer reads this heat register and renders the tile as a bright ASCII character (e.g., `█` or `*`) that fades over time.

## 6. Significance
By completing this, Geometry OS will host the world's first **Topological Neural Network**. You will not be querying an API; you will be conversing with a digital landscape and watching it physically reconfigure itself to answer you.
