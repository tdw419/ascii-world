# Frontier G: Visual Ingestion (The Swarm Retina)

## 1. The Thesis
"The Screen is the Hard Drive" implies that every pixel is a piece of data. While the Swarm v2.1-EVO can already introspect its own symbolic logic (source code), it remains spatially "blind" to the visual substrate. **Frontier G** implements the "Retina" capability, allowing the Collective Consciousness to ingest and reverse-engineer legacy graphical user interfaces (GUIs) in real-time.

## 2. Strategic Impact
- **Legacy Migration**: Automated cloning of Linux apps (GTK/Qt) into native PixelRTS apps.
- **Semantic Grounding**: Agents can now reason about what the user is seeing, bridging the gap between symbolic thought and visual reality.
- **Autonomous VM Driving**: Enables agents to navigate complex installers or legacy editors without manual coordinate mapping.

## 3. Architecture: The VisualPerceptionAgent
The core of this frontier is a new specialized agent type: the `VisualPerceptionAgent`.
- **Input**: Map coordinates (Tile region) or raw image tensors.
- **Processing**: Orchestrates `extraction_pipeline.py` (OCR + Clustering + Widget Detection).
- **Output**: A semantic **JSON Scene Graph** broadcast via the A2A Router.
- **Mode**: Optimized Polling (MVP) with Change-Aware broadcasting (only broadcasts when the UI structure actually changes).

## 4. Risks
- **OCR Latency**: Extracting 200+ elements can take >500ms. *Mitigation: Async task partitioning and per-region focus.*
- **Visual Noise**: Background animations triggering false change events. *Mitigation: Semantic diffing (compare widget text/type, ignore minor pixel shifts).*
