import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * GlassBoxAugmentor - Feeds attention and archive data into the training loop
 * 
 * It bridges the "watching AI think" system with the "making AI build" system.
 */
export class GlassBoxAugmentor {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || '/home/jericho/zion/projects/ascii_world/ascii_world';
        this.attentionPath = join(this.projectRoot, '.ouroboros', 'visualizations', 'real_attention.json');
        this.archivePath = join(this.projectRoot, '.ouroboros', 'archive', 'archive_manifest.json');
    }

    /**
     * Gets current attention state and top document snippets to augment the prompt.
     */
    async getAugmentationData() {
        try {
            if (!existsSync(this.attentionPath) || !existsSync(this.archivePath)) {
                return null;
            }

            const attention = JSON.parse(readFileSync(this.attentionPath, 'utf-8'));
            const archive = JSON.parse(readFileSync(this.archivePath, 'utf-8'));

            // Find top documents attended to and aggregate intensity
            const docStats = {};
            const layerStats = {};

            attention.saccades.forEach(s => {
                // Doc stats
                if (!docStats[s.doc_id]) docStats[s.doc_id] = { count: 0, intensity: 0 };
                docStats[s.doc_id].count++;
                docStats[s.doc_id].intensity += (s.intensity || 0);

                // Layer stats
                const layer = s.tile_layer || 0;
                if (!layerStats[layer]) layerStats[layer] = { count: 0, intensity: 0 };
                layerStats[layer].count++;
                layerStats[layer].intensity += (s.intensity || 0);
            });

            const topDocIds = Object.entries(docStats)
                .sort((a, b) => b[1].intensity - a[1].intensity) // Sort by total intensity
                .slice(0, 3)
                .map(([id]) => parseInt(id));

            const topLayers = Object.entries(layerStats)
                .sort((a, b) => b[1].intensity - a[1].intensity)
                .slice(0, 2)
                .map(([l]) => parseInt(l));

            const snippets = topDocIds.map(id => {
                const doc = archive.documents[id];
                const stats = docStats[id];
                return doc ? `[${doc.category}] ${doc.text.slice(0, 300)} (Saccade Strength: ${stats.intensity.toFixed(2)})` : null;
            }).filter(Boolean);

            // Map layers to concepts (Geometry OS convention)
            const layerConcepts = {
                0: "Fundamental vocabulary and token embeddings",
                1: "Lower-level syntactic structures",
                2: "Mid-level semantic associations",
                3: "Complex relational patterns",
                4: "Abstract logical reasoning",
                5: "High-level goal and intent alignment"
            };

            const neuralState = topLayers.map(l => layerConcepts[l] || `Layer ${l}`).join(", ");

            return {
                tokens: attention.tokens,
                snippets: snippets,
                active_tiles: attention.saccades.length,
                neural_state: neuralState,
                query: attention.input_text
            };
        } catch (err) {
            console.error('[GLASS-BOX-AUGMENT] Failed:', err.message);
            return null;
        }
    }
}
