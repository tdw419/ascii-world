// sync/ascii-experiment-runtime.js
import fs from 'fs';
import path from 'path';
import { ASCIIExperimentSpec } from './ascii-spec-parser.js';
import { ASCIIResultsLogger } from './ascii-results-logger.js';
import { MetricEvaluatorRegistry } from './ascii-metric-evaluators.js';

export class ASCIIExperimentRuntime {
  constructor(options = {}) {
    this.projectPath = options.projectPath || '.';
    this.logger = new ASCIIResultsLogger(options.resultsPath || '.autoresearch/results.tsv');
    this.evaluatorRegistry = new MetricEvaluatorRegistry(this.projectPath);
  }

  async runSpec(asciiText) {
    const spec = ASCIIExperimentSpec.parse(asciiText);
    const startTime = Date.now();

    // Get appropriate evaluator
    const evaluator = this.evaluatorRegistry.getEvaluator(spec.m);
    const metricResult = await evaluator.evaluate(spec);
    const elapsed = Date.now() - startTime;

    // Determine status
    const status = metricResult.success ? 'KEEP' : 'REVERT';

    // Log result
    this.logger.log({
      hypothesis: spec.h,
      baseline: spec.b,
      metric: metricResult.value,
      status
    });

    return {
      hypothesis: spec.h,
      target: spec.t,
      metric: spec.m,
      baseline: spec.b,
      status,
      elapsed,
      metricValue: metricResult.value,
      message: metricResult.message
    };
  }
}
