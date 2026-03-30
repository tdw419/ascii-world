// sync/evolutionary-agent.js
/**
 * EvolutionaryAgent - Autonomous Map Region Manager
 * 
 * Monitors visual/system performance and triggers 
 * experiments to self-optimize the Geometry OS substrate.
 * Part of Phase 3: Autonomous Evolution.
 */

export class EvolutionaryAgent {
  constructor(server, options = {}) {
    this.server = server;
    this.interval = options.interval || 30000; // 30s check
    this.thresholds = options.thresholds || {
      cpu: 0.85,
      render_time: 25, // ms (target < 16.6)
      gpu_vms_pct: 0.9,
      mem: 0.8
    };
    this.timer = null;
    this.isWorking = false;
    this.lastExperimentTime = 0;
    this.cooldown = 60000; // 1m between autonomous experiments
  }

  /**
   * Start the autonomous optimization loop.
   */
  start() {
    console.log(`[EVO-AGENT] Starting autonomous optimization loop (${this.interval}ms)...`);
    this.timer = setInterval(() => this.tick(), this.interval);
    
    // Subscribe to critical alerts from the engine
    if (this.server.alertEngine) {
      this.server.alertEngine.addNotifier((alert) => this.handleAlert(alert));
    }
  }

  /**
   * Stop the loop.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.isWorking) return;
    this.isWorking = true;

    try {
      const cells = this.server.cellStore.getCells();
      await this.checkPerformance(cells);
    } catch (err) {
      console.error('[EVO-AGENT] Tick failed:', err.message);
    } finally {
      this.isWorking = false;
    }
  }

  /**
   * Handle alerts from the AlertEngine.
   */
  async handleAlert(alert) {
    if (alert.severity === 'critical') {
      console.log(`[EVO-AGENT] Critical alert: ${alert.message}. Initiating emergency optimization...`);
      await this.triggerExperiment(alert.cell, alert.value);
    }
  }

  /**
   * Check current metrics against thresholds.
   */
  async checkPerformance(cells) {
    const now = Date.now();
    if (now - this.lastExperimentTime < this.cooldown) return;

    // Check for high CPU
    if (cells.cpu > this.thresholds.cpu) {
      await this.triggerExperiment('cpu', cells.cpu);
    } 
    // Check for slow rendering
    else if (cells.render_time > this.thresholds.render_time) {
      await this.triggerExperiment('render_time', cells.render_time);
    }
    // Check for memory pressure
    else if (cells.mem > this.thresholds.mem) {
      await this.triggerExperiment('mem', cells.mem);
    }
  }

  /**
   * Synthesize and run an ASCII experiment.
   */
  async triggerExperiment(metricName, value) {
    this.lastExperimentTime = Date.now();
    console.log(`[EVO-AGENT] Triggering autonomous experiment for ${metricName} (val: ${value})`);

    // Synthesize spec
    let specText = '';
    if (metricName === 'cpu') {
      specText = `
H: Inline bitwise ops in SyntheticGlyphVM dispatch
T: sync/synthetic-glyph-vm.js
M: cpu < ${this.thresholds.cpu}
B: ${value}
`;
    } else if (metricName === 'render_time') {
      specText = `
H: Optimize pixel-buffer setPixel for RGBA packing
T: sync/pixel-buffer.js
M: render_time < 16.6
B: ${value}
`;
    } else {
      specText = `
H: Optimize ${metricName} resource utilization
T: sync/server.js
M: ${metricName} < ${value}
B: ${value}
`;
    }

    // Coordinates for the Agent's "Work Region" on the dashboard
    const x = 30;
    const y = 10 + (Math.floor(Math.random() * 10));

    try {
      // Execute via the bridge (which handles SIT bonds + template rendering)
      const { result } = await this.server.geometryBridge.executeOnCanvas(specText, x, y);
      
      console.log(`[EVO-AGENT] Result: ${result.status} (${result.metricValue})`);
      
      // If result is KEEP, we could theoretically apply changes here
      // For now, we just log it and render to canvas.
    } catch (err) {
      console.error(`[EVO-AGENT] Experiment failed:`, err.message);
    }
  }
}
