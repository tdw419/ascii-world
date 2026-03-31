// sync/integrations/openspec/geometry_bridge.js
/**
 * GeometryBridge - Connects OpenSpec/AutoResearch with the pxOS PixelSubstrate
 * 
 * This bridge converts ASCII experiment specs into "Geometry Bonds" (binary opcodes)
 * and renders results back to the pixel canvas.
 */

import { ASCIIExperimentSpec } from '../../ascii-spec-parser.js';
import { ASCIIExperimentRuntime } from '../../ascii-experiment-runtime.js';

export class GeometryBridge {
  constructor(server) {
    this.server = server;
    this.runtime = new ASCIIExperimentRuntime({ projectPath: '.' });
  }

  /**
   * Parse ASCII text into a spec and convert to "Geometry Bonds" (SIT pixels).
   * In pxOS, "bonds" are just SIT pixels (opcode, target, flags).
   */
  specToSIT(specText, startX = 0, startY = 0) {
    const spec = ASCIIExperimentSpec.parse(specText);
    const pixels = [];

    // Map spec keys to SIT opcodes (Phase 20+ "Geometry OS" mapping)
    // 0x80 (128): DATA (Baseline)
    // 0x81 (129): LOAD (Target)
    // 0x82 (130): STORE (Metric)
    
    // Header bond (Hypothesis summary as metadata in flags)
    pixels.push({ x: startX, y: startY, r: 128, g: 0, b: 0 }); // DATA 0
    
    // T: Target bond
    if (spec.t) {
        pixels.push({ x: startX + 1, y: startY, r: 129, g: 1, b: 0 }); // LOAD 1
    }
    
    // M: Metric bond
    if (spec.m) {
        pixels.push({ x: startX + 2, y: startY, r: 130, g: 2, b: 0 }); // STORE 2
    }
    
    // B: Baseline bond
    if (spec.b) {
        const baselineVal = parseInt(spec.b) || 0;
        pixels.push({ x: startX + 3, y: startY, r: 128, g: 3, b: baselineVal }); // DATA 3 (val)
    }

    return pixels;
  }

  /**
   * Execute an experiment and render the result back to the server's cell store.
   */
  async executeOnCanvas(specText, x = 0, y = 0) {
    const result = await this.runtime.runSpec(specText);
    
    // Update cell store with result (visible on dashboard)
    const prefix = `exp_${x}_${y}`;
    const updates = {
      [`${prefix}_status`]: result.status,
      [`${prefix}_metric`]: result.metricValue,
      [`${prefix}_elapsed`]: result.elapsed,
      [`${prefix}_message`]: result.message
    };
    
    this.server.cellStore.setCells(updates);

    // Automatically add result template to current view
    const resultTemplate = this.getResultTemplate(x, y);
    this.server.template = [...this.server.template, ...resultTemplate];

    // Push SIT pixels to GPU via the server's gpuBridge
    const sitPixels = this.specToSIT(specText, x, y);
    if (this.server.gpuBridge && sitPixels.length > 0) {
        await this.server.gpuBridge.pushPixels(sitPixels);
    }
    
    return {
      result,
      sitPixels
    };
  }

  /**
   * Generate a pixel template for the experiment result.
   */
  getResultTemplate(x, y) {
    const prefix = `exp_${x}_${y}`;
    return [
      { fn: 'BOX', args: [x, y, 20, 5] },
      { fn: 'TEXT', args: [x + 1, y + 1, `${prefix}_status`] },
      { fn: 'NUMBER', args: [x + 10, y + 1, `${prefix}_metric`, '0.0'] },
      { fn: 'TEXT', args: [x + 1, y + 3, `${prefix}_message`] }
    ];
  }
}
