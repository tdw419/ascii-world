/**
 * Infinite Map Agent - Strategic LLM Controller for the Infinite Map
 * 
 * This agent manages the "Continental Logic" of the Infinite Map by
 * responding to user prompts to move, re-task, or visualize map sectors.
 * 
 * Part of Phase 42: The Sovereign Array.
 */

import { VisualScorer } from './visual-scorer.js';
import { InfiniteMap } from './infinite-map.js';

export class InfiniteMapAgent {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4';
        this.apiKey = options.apiKey || process.env.ZAI_API_KEY;
        this.model = options.model || 'glm-5-turbo';
        
        this.map = options.map || new InfiniteMap();
        this.scorer = new VisualScorer();
        
        this.context = {
            currentViewport: { x: 0, y: 0, w: 100, h: 100 },
            activeSectors: [],
            lastAction: null,
            history: []
        };
    }

    /**
     * Respond to a strategic prompt about the map
     */
    async chat(prompt) {
        if (!this.apiKey) throw new Error('ZAI_API_KEY not set');

        // Get map state for context
        const stats = this.map.getStats();
        const sovereign = this.map.getSovereign();
        const chunks = this.map.listChunks();

        const systemPrompt = `You are the Sovereign Commander of the Geometry OS Infinite Map.
You manage 10,000 RISC-V tiles and a digital substrate of pixels.

Current Map State:
- Active Chunks: ${stats.chunkCount}
- Sovereign Controller: ${sovereign || 'None'}
- Viewport: x=${this.context.currentViewport.x}, y=${this.context.currentViewport.y}

Your goal is to coordinate the map regions based on user instructions. 
You can MOVE the viewport, ALLOCATE sectors, or TRIGGER visual updates.

IMPORTANT: You MUST respond in this EXACT format:
Thought: <Your strategic reasoning>
Action: { "action": "...", ... }

Only ONE Action JSON block is allowed per response.

Supported Actions:
- { "action": "MOVE", "x": number, "y": number }
- { "action": "ALLOCATE", "name": string, "x": number, "y": number, "w": number, "h": number, "type": "neural|logic|executive" }
- { "action": "VISUALIZE", "chunkX": number, "chunkY": number }
- { "action": "STATUS", "message": string }
`;

        try {
            const resp = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...this.context.history.slice(-5),
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                })
            });

            const data = await resp.json();
            const content = data.choices[0].message.content;

            // Update context
            this.context.history.push({ role: 'user', content: prompt });
            this.context.history.push({ role: 'assistant', content });

            return this._parseResponse(content);
        } catch (err) {
            console.error('[MAP-AGENT] Chat failed:', err.message);
            return { thought: "Error communicating with the substrate.", action: { action: "ERROR" } };
        }
    }

    /**
     * Parse the LLM response into thought and action
     */
    _parseResponse(content) {
        // Try to find Thought
        const thoughtMatch = content.match(/Thought:\s*([\s\S]*?)(?=Action:|$)/i);
        let thought = thoughtMatch ? thoughtMatch[1].trim() : "";
        
        // If no explicit Thought prefix, take the first non-JSON part
        if (!thought && !content.trim().startsWith('{')) {
            thought = content.split('{')[0].trim();
        }

        // Try to find Action (JSON block)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        let action = { action: "STATUS", message: "No specific action parsed." };

        if (jsonMatch) {
            try {
                // Clean the JSON string (remove possible markdown backticks)
                let jsonStr = jsonMatch[0].trim();
                action = JSON.parse(jsonStr);
            } catch (e) {
                console.error('[MAP-AGENT] Failed to parse action JSON:', e.message);
            }
        }

        if (!thought) thought = "Acknowledged.";

        // Apply action to internal context if relevant
        if (action.action === 'MOVE') {
            this.context.currentViewport.x = action.x;
            this.context.currentViewport.y = action.y;
        }

        return { thought, action };
    }

    /**
     * Get a visual summary of a specific map region
     */
    async getVisualContext(cx, cy) {
        const png = await this.map.exportChunk(cx, cy);
        if (!png) return "Chunk is empty.";
        
        const score = await this.scorer.score(png);
        return `Visual state at (${cx},${cy}): ${score.reason} (Score: ${score.total}/40)`;
    }
}
