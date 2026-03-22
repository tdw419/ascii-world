// sync/ascii-spec-parser.js
/**
 * ASCII Experiment Spec - Parser for H/T/M/B format
 * Layer 0-3 compatible
 */

export class ASCIIExperimentSpec {
  constructor(hypothesis, target, metric, baseline) {
    this.h = hypothesis;
    this.t = target;
    this.m = metric;
    this.b = baseline;
  }

  static parse(asciiText) {
    // Match H/T/M/B keys, stopping at box borders or newlines
    const hMatch = asciiText.match(/H:\s*([^│\n]+)/);
    const tMatch = asciiText.match(/T:\s*([^│\n]+)/);
    const mMatch = asciiText.match(/M:\s*([^│\n]+)/);
    const bMatch = asciiText.match(/B:\s*([^│\n]+)/);

    return new ASCIIExperimentSpec(
      hMatch?.[1]?.trim(),
      tMatch?.[1]?.trim(),
      mMatch?.[1]?.trim(),
      bMatch?.[1]?.trim()
    );
  }

  toBoxed() {
    const lines = [
      '┌──────────────────────────────────────────────────┐',
      `│ H: ${(this.h || '').padEnd(46)}│`,
      `│ T: ${(this.t || '').padEnd(46)}│`,
      `│ M: ${(this.m || '').padEnd(46)}│`,
      `│ B: ${(this.b || '').padEnd(46)}│`,
      '└──────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}
