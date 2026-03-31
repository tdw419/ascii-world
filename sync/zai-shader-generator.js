/**
 * Z.ai Shader Generator - Uses GLM models to generate AND score pixel shaders
 * 
 * Part of Phase 4: Visual Intelligence.
 * 
 * Model roles:
 *   glm-5-turbo  → generates shader code (needs 4096+ max_tokens for reasoning)
 *   glm-4.6v     → scores rendered PNGs via vision ( OpenAI-compatible format )
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class ZaiShaderGenerator {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4';
        this.apiKey = options.apiKey || process.env.ZAI_API_KEY;
        this.codeModel = options.codeModel || 'glm-5-turbo';
        this.visionModel = options.visionModel || 'glm-4.6v';
        this.maxTokens = options.maxTokens || 4096;
        this.historyDir = options.historyDir || './.ouroboros/history';
        mkdirSync(this.historyDir, { recursive: true });
    }

    /**
     * Save a generation to the persistent history
     */
    saveHistory(generation) {
        const timestamp = Date.now();
        const filename = join(this.historyDir, `gen_${timestamp}.json`);
        writeFileSync(filename, JSON.stringify(generation, null, 2));
        return filename;
    }

    /**
     * Generate a new shader based on a prompt and optional context (previous code)
     */
    async generateShader(prompt, context = null) {
        if (!this.apiKey) throw new Error('ZAI_API_KEY not set');

        let systemPrompt = `You are a creative pixel shader engineer for Geometry OS. 
Write a JavaScript arrow function (x, y, t) => [r, g, b] that renders a visual pattern.
x: 0-479, y: 0-239, t: time in seconds.

OBJECTIVES:
1. HIGH COHERENCE: Patterns must be sharp, intentional, and artifact-free.
2. HIGH HARMONY: Use balanced, readable color palettes.
3. HIGH COMPLEXITY: Use nested math, oscillators, and field functions.
4. HIGH DENSITY: Include structures that look like UI elements (windows, text lines, status bars) or data visualizations.

Return ONLY the raw function code, no markdown fences, no explanation.`;

        if (context) {
            systemPrompt += `\n\nReference the following successful shader and evolve it. Preserve its core logic but improve density and UI-utility:\n${context}`;
        }

        try {
            const resp = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.codeModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: this.maxTokens,
                    temperature: 0.8
                })
            });

            const data = await resp.json();
            let code = data.choices[0].message.content || '';
            
            // Handle reasoning models where content might be empty but logic is in reasoning_content
            if (!code && data.choices[0].message.reasoning_content) {
                // Heuristic: try to extract the last code-like block from reasoning
                const reasoning = data.choices[0].message.reasoning_content;
                const match = reasoning.match(/\((x, y, t) => [\s\S]*\)/) || reasoning.match(/const[\s\S]*return/);
                if (match) code = match[0];
            }

            return this._repair(code);
        } catch (err) {
            console.error('[ZAI-GEN] Generation failed:', err.message);
            return '(x, y, t) => [128, 128, 128]'; // Safe fallback
        }
    }

    /**
     * Attempt to repair truncated shader code by closing open braces/parens/brackets
     */
    _repair(code) {
        let s = code.trim();
        // Remove markdown fences if present
        if (s.includes('```')) {
            const parts = s.split(/```(?:javascript|js|json)?/);
            if (parts.length > 1) {
                s = parts[1].split('```')[0].trim();
            }
        }
        
        let stack = [];
        const pairs = { '{': '}', '(': ')', '[': ']' };
        
        for (const ch of s) {
            if (pairs[ch]) {
                stack.push(pairs[ch]);
            } else if (Object.values(pairs).includes(ch)) {
                if (stack.length > 0 && stack[stack.length - 1] === ch) {
                    stack.pop();
                }
            }
        }

        if (stack.length > 0) {
            console.log(`[REPAIR] Truncation detected, closing ${stack.length} open scopes: ${stack.reverse().join('')}`);
            
            // Check if we're inside a statement and need a return
            if (!s.includes('return [') && !s.includes('return[')) {
                // If it looks like we're in the middle of a block, try to insert a return
                if (s.endsWith(',') || s.endsWith('+') || s.endsWith('-') || s.endsWith('*') || s.endsWith('/')) {
                    s += ' 0';
                }
                if (!s.endsWith(';')) s += ';';
                s += '\n  return [0, 0, 0];';
            }
            
            // Close everything in reverse order
            s += '\n' + stack.join('');
        }
        
        // Final sanity check: if the model only returned the body but no arrow head
        if (!s.startsWith('(x, y, t) =>') && s.includes('return [')) {
            s = '(x, y, t) => {\n' + s + '\n}';
        }
        
        return s;
    }

    /**
     * Compile a generated shader string into a callable function
     */
    compile(code) {
        try {
            const fn = new Function('return (' + code + ')')();
            // Test execution
            const test = fn(0, 0, 0);
            if (!Array.isArray(test)) throw new Error('Result not an array');
            return fn;
        } catch (e) {
            throw new Error(`Compile failed: ${e.message}\nCode: ${code.slice(0, 100)}...`);
        }
    }
}
