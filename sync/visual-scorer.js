/**
 * Visual Scorer - Rates framebuffer renders via vision model (LM Studio)
 * 
 * Part of Phase 4: Visual Intelligence.
 * 
 * Bridges the gap between raw pixel buffers and aesthetic/utility scores
 * using a local vision model (e.g., qwen3-vl-8b).
 */

import { readFileSync, existsSync } from 'fs';

export class VisualScorer {
    constructor(options = {}) {
        this.endpoint = options.endpoint || 'http://localhost:1234/v1/chat/completions';
        this.model = options.model || 'qwen/qwen3-vl-8b';
    }

    /**
     * Send a PNG image to the vision model and get an aesthetic/utility score.
     * 
     * @param {string|Buffer} imageData - PNG buffer or path to PNG
     * @returns {Object} { coherence, harmony, complexity, density, total, reason }
     */
    async score(imageData) {
        let base64Image;
        if (typeof imageData === 'string') {
            if (existsSync(imageData)) {
                base64Image = readFileSync(imageData).toString('base64');
            } else {
                throw new Error(`File not found: ${imageData}`);
            }
        } else if (Buffer.isBuffer(imageData)) {
            base64Image = imageData.toString('base64');
        } else {
            throw new Error('imageData must be a path or a Buffer');
        }

        const prompt = `
Analyze this framebuffer render (480x240 pixels) for a minimal pixel-based OS.
Rate the following metrics from 1-10:
1. Coherence: Visual integrity, lack of artifacts, clear patterns.
2. Harmony: Color balance, aesthetic appeal, readability.
3. Complexity: Mathematical depth, interesting visual patterns.
4. Density: Information-to-pixel ratio, utility for a UI.

Return a JSON object:
{
  "coherence": number,
  "harmony": number,
  "complexity": number,
  "density": number,
  "total": number,
  "reason": "Brief explanation"
}
`;

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: { url: `data:image/png;base64,${base64Image}` }
                                }
                            ]
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                throw new Error(`Vision API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // Handle both raw JSON and Markdown-wrapped JSON
            const jsonStr = content.includes('```json') 
                ? content.split('```json')[1].split('```')[0].trim()
                : content.trim();

            const scores = JSON.parse(jsonStr);
            
            // Normalize total if not provided correctly
            scores.total = (scores.coherence || 0) + (scores.harmony || 0) + (scores.complexity || 0) + (scores.density || 0);
            
            return scores;
        } catch (err) {
            console.error('[VISUAL-SCORER] Failed to score image:', err.message);
            // Return failure scores
            return {
                coherence: 1,
                harmony: 1,
                complexity: 1,
                density: 1,
                total: 4,
                reason: `Error: ${err.message}`
            };
        }
    }
}
