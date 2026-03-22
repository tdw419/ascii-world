// sync/ascii-result-formatter.js

export class ASCIIResultFormatter {
  static format(result) {
    const elapsedSec = (result.elapsed / 1000).toFixed(1);
    const statusIcon = result.status === 'KEEP' ? '✓' : '✗';
    const metricDisplay = result.metricValue !== undefined ? result.metricValue : 'N/A';

    return `╔═══════════════════════════════════════════════════════════════╗
║ RESULT: experiment                                            ║
║ STATUS: ${result.status.padEnd(53)}${statusIcon}║
║ METRIC: ${String(metricDisplay).padEnd(53)}║
║ TARGET: ${(result.metric + ' → ' + result.status).padEnd(53)}║
║ ELAPSED: ${elapsedSec + 's'}                                              ║
╚═══════════════════════════════════════════════════════════════╝`;
  }

  static formatHistory(results) {
    const header = '┌───────┬─────────────┬──────────┬────────┬────────────────┐\n' +
                   '│ RUN   │ HYPOTHESIS  │ METRIC   │ STATUS │ ACTION         │\n' +
                   '├───────┼─────────────┼──────────┼────────┼────────────────┤';

    const rows = results.map((r, i) => {
      const runNum = String(i + 1).padStart(3, '0');
      const hyp = (r.hypothesis || '').substring(0, 11).padEnd(11);
      const metric = String(r.metricValue || r.metric || '-').padEnd(8);
      const status = (r.status || '-').padEnd(6);
      const action = r.status === 'KEEP' ? 'KEEP ✓' : r.status === 'REVERT' ? 'REVERT' : '-';
      return `│ ${runNum}   │ ${hyp} │ ${metric} │ ${status} │ ${action.padEnd(14)} │`;
    }).join('\n');

    const footer = '└───────┴─────────────┴──────────┴────────┴────────────────┘';

    return `${header}\n${rows}\n${footer}`;
  }
}
