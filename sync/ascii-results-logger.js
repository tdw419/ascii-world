// sync/ascii-results-logger.js
import fs from 'fs';
import path from 'path';

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

  readRecent(count = 10) {
    if (!fs.existsSync(this.logPath)) return [];
    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1); // Skip header
    return lines.slice(-count).map(line => {
      const [timestamp, hypothesis, baseline, metric, status] = line.split('\t');
      return {
        timestamp: parseFloat(timestamp),
        hypothesis,
        baseline: parseFloat(baseline),
        metric: parseFloat(metric),
        status
      };
    });
  }
}
