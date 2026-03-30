// sync/ascii-results-logger.js
import fs from 'fs';
import path from 'path';
import { ANSI } from './renderers/ansi.js';

export class ASCIIResultsLogger {
  constructor(logPath = '.autoresearch/results.tsv') {
    this.logPath = logPath;
    this.ensureHeader();
  }

  ensureHeader() {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, 'timestamp\thypothesis\tbaseline\tmetric\tstatus\n');
    }
  }

  log(result) {
    const timestamp = Date.now() / 1000;
    const line = `${timestamp}\t${result.hypothesis}\t${result.baseline}\t${result.metric}\t${result.status}\n`;
    fs.appendFileSync(this.logPath, line);
  }

  readAll() {
    if (!fs.existsSync(this.logPath)) return [];
    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1); // Skip header
    return lines.map(line => this.parseLine(line)).filter(r => r);
  }

  readRecent(count = 10) {
    return this.readAll().slice(-count);
  }

  parseLine(line) {
    const parts = line.split('\t');
    if (parts.length < 5) return null;

    const [timestamp, hypothesis, baseline, metric, status] = parts;

    return {
      timestamp: parseFloat(timestamp),
      hypothesis,
      baseline: isNaN(parseFloat(baseline)) ? baseline : parseFloat(baseline),
      metric: parseFloat(metric),
      status,
      date: new Date(parseFloat(timestamp) * 1000).toISOString()
    };
  }

  // Get statistics
  getStats() {
    const results = this.readAll();

    const keep = results.filter(r => r.status === 'KEEP');
    const revert = results.filter(r => r.status === 'REVERT');

    // Group by hypothesis
    const byHypothesis = {};
    for (const r of results) {
      const key = r.hypothesis;
      if (!byHypothesis[key]) {
        byHypothesis[key] = [];
      }
      byHypothesis[key].push(r);
    }

    // Calculate metric trend (last 10)
    const recent = results.slice(-10);
    const avgMetric = recent.length > 0
      ? recent.reduce((sum, r) => sum + (r.metric || 0), 0) / recent.length
      : 0;

    return {
      total: results.length,
      kept: keep.length,
      reverted: revert.length,
      keepRate: results.length > 0 ? (keep.length / results.length * 100).toFixed(1) : 0,
      avgMetric: avgMetric.toFixed(1),
      uniqueHypotheses: Object.keys(byHypothesis).length,
      firstRun: results[0]?.date || null,
      lastRun: results[results.length - 1]?.date || null
    };
  }

  // Get history for a specific hypothesis
  getHistory(hypothesis) {
    return this.readAll().filter(r =>
      r.hypothesis.toLowerCase().includes(hypothesis.toLowerCase())
    );
  }

  // Get metric trend over time
  getMetricTrend(count = 20) {
    const results = this.readRecent(count);
    return results.map(r => ({
      timestamp: r.timestamp,
      metric: r.metric,
      status: r.status
    }));
  }

  // Format as ASCII table
  toTable(results = null, maxRows = 20, options = {}) {
    const data = results || this.readRecent(maxRows);
    const { useColor = true } = options;

    if (data.length === 0) {
      return 'No experiments found';
    }

    const c = useColor ? {
      reset: ANSI.reset,
      bold: ANSI.bold,
      green: ANSI.green,
      red: ANSI.red,
      cyan: ANSI.cyan,
      yellow: ANSI.yellow,
      dim: ANSI.dim
    } : {
      reset: '', bold: '', green: '', red: '', cyan: '', yellow: '', dim: ''
    };

    const header = `${c.cyan}┌────────────┬──────────────────────────────────────┬──────────┬────────┬────────┐${c.reset}\n` +
                   `${c.cyan}│${c.reset} ${c.bold}DATE       │ HYPOTHESIS                           │ BASELINE │ METRIC │ STATUS ${c.reset}${c.cyan}│${c.reset}\n` +
                   `${c.cyan}├────────────┼──────────────────────────────────────┼──────────┼────────┼────────┤${c.reset}`;

    const rows = data.map(r => {
      const date = (r.date || '').substring(0, 10).padEnd(10);
      const hyp = (r.hypothesis || '').substring(0, 36).padEnd(36);
      const base = String(r.baseline || '-').substring(0, 8).padEnd(8);
      const metricStr = String(r.metric || '-').padEnd(6);
      const statusStr = (r.status || '-').padEnd(6);
      
      const statusColor = r.status === 'KEEP' ? c.green : r.status === 'REVERT' ? c.red : c.reset;
      
      return `${c.cyan}│${c.reset} ${date} ${c.cyan}│${c.reset} ${hyp} ${c.cyan}│${c.reset} ${base} ${c.cyan}│${c.reset} ${c.yellow}${metricStr}${c.reset} ${c.cyan}│${c.reset} ${statusColor}${statusStr}${c.reset} ${c.cyan}│${c.reset}`;
    }).join('\n');

    const footer = `${c.cyan}└────────────┴──────────────────────────────────────┴──────────┴────────┴────────┘${c.reset}`;

    return `${header}\n${rows}\n${footer}`;
  }

  // Format stats as ASCII
  statsToASCII(options = {}) {
    const stats = this.getStats();
    const { useColor = true } = options;

    const c = useColor ? {
      reset: ANSI.reset,
      bold: ANSI.bold,
      green: ANSI.green,
      red: ANSI.red,
      cyan: ANSI.cyan,
      yellow: ANSI.yellow,
      dim: ANSI.dim
    } : {
      reset: '', bold: '', green: '', red: '', cyan: '', yellow: '', dim: ''
    };

    const boxColor = c.cyan;

    return `${boxColor}╔═══════════════════════════════════════════════════════════════╗${c.reset}
${boxColor}║${c.reset} ${c.bold}EXPERIMENT STATISTICS${c.reset}                                         ${boxColor}║${c.reset}
${boxColor}╠═══════════════════════════════════════════════════════════════╣${c.reset}
${boxColor}║${c.reset} Total experiments: ${c.bold}${String(stats.total).padEnd(42)}${c.reset}${boxColor}║${c.reset}
${boxColor}║${c.reset} Kept: ${c.green}${String(stats.kept).padEnd(55)}${c.reset}${boxColor}║${c.reset}
${boxColor}║${c.reset} Reverted: ${c.red}${String(stats.reverted).padEnd(52)}${c.reset}${boxColor}║${c.reset}
${boxColor}║${c.reset} Keep rate: ${c.bold}${stats.keepRate}%${c.reset}                                           ${boxColor}║${c.reset}
${boxColor}║${c.reset} Avg metric: ${c.yellow}${stats.avgMetric}${c.reset}                                          ${boxColor}║${c.reset}
${boxColor}║${c.reset} Unique hypotheses: ${String(stats.uniqueHypotheses).padEnd(41)}${boxColor}║${c.reset}
${boxColor}║${c.reset} First run: ${c.dim}${(stats.firstRun || 'N/A').padEnd(48)}${c.reset}${boxColor}║${c.reset}
${boxColor}║${c.reset} Last run: ${c.dim}${(stats.lastRun || 'N/A').padEnd(49)}${c.reset}${boxColor}║${c.reset}
${boxColor}╚═══════════════════════════════════════════════════════════════╝${c.reset}`;
  }
}
