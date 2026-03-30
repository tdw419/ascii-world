// sync/ascii-result-formatter.js
import { ANSI } from './renderers/ansi.js';

export class ASCIIResultFormatter {
  static format(result, options = {}) {
    const { useColor = true } = options;
    
    const elapsedSec = (result.elapsed / 1000).toFixed(1);
    const statusIcon = result.status === 'KEEP' ? '✓' : '✗';
    const metricDisplay = result.metricValue !== undefined ? result.metricValue : 'N/A';

    // ANSI Colors
    const c = useColor ? {
      reset: ANSI.reset,
      bold: ANSI.bold,
      green: ANSI.green,
      red: ANSI.red,
      cyan: ANSI.cyan,
      yellow: ANSI.yellow,
      dim: ANSI.dim,
      border: ANSI.cyan
    } : {
      reset: '', bold: '', green: '', red: '', cyan: '', yellow: '', dim: '', border: ''
    };

    const statusColor = result.status === 'KEEP' ? c.green : c.red;
    const boxColor = c.border;

    let output = `${boxColor}╔═══════════════════════════════════════════════════════════════╗${c.reset}\n`;
    output += `${boxColor}║${c.reset} ${c.bold}RESULT:${c.reset} experiment                                            ${boxColor}║${c.reset}\n`;
    output += `${boxColor}║${c.reset} STATUS: ${statusColor}${result.status.padEnd(53)}${statusIcon}${c.reset}${boxColor}║${c.reset}\n`;
    output += `${boxColor}║${c.reset} METRIC: ${c.yellow}${String(metricDisplay).padEnd(53)}${c.reset}${boxColor}║${c.reset}\n`;
    output += `${boxColor}║${c.reset} TARGET: ${c.dim}${(result.metric + ' → ' + result.status).padEnd(53)}${c.reset}${boxColor}║${c.reset}\n`;
    output += `${boxColor}║${c.reset} ELAPSED: ${elapsedSec + 's'}                                              ${boxColor}║${c.reset}\n`;
    output += `${boxColor}╚═══════════════════════════════════════════════════════════════╝${c.reset}`;

    return output;
  }

  static formatHistory(results, options = {}) {
    const { useColor = true } = options;
    const c = useColor ? {
      reset: ANSI.reset,
      bold: ANSI.bold,
      green: ANSI.green,
      red: ANSI.red,
      cyan: ANSI.cyan,
      dim: ANSI.dim
    } : {
      reset: '', bold: '', green: '', red: '', cyan: '', dim: ''
    };

    const header = `${c.cyan}┌───────┬─────────────┬──────────┬────────┬────────────────┐${c.reset}\n` +
                   `${c.cyan}│${c.reset} ${c.bold}RUN   │ HYPOTHESIS  │ METRIC   │ STATUS │ ACTION         ${c.reset}${c.cyan}│${c.reset}\n` +
                   `${c.cyan}├───────┼─────────────┼──────────┼────────┼────────────────┤${c.reset}`;

    const rows = results.map((r, i) => {
      const runNum = String(i + 1).padStart(3, '0');
      const hyp = (r.hypothesis || '').substring(0, 11).padEnd(11);
      const metric = String(r.metricValue || r.metric || '-').padEnd(8);
      const statusStr = (r.status || '-').padEnd(6);
      const statusColor = r.status === 'KEEP' ? c.green : r.status === 'REVERT' ? c.red : c.reset;
      
      const action = r.status === 'KEEP' ? `${c.green}KEEP ✓${c.reset}` : r.status === 'REVERT' ? `${c.red}REVERT${c.reset}` : '-';
      
      return `${c.cyan}│${c.reset} ${runNum}   ${c.cyan}│${c.reset} ${hyp} ${c.cyan}│${c.reset} ${c.yellow}${metric}${c.reset} ${c.cyan}│${c.reset} ${statusColor}${statusStr}${c.reset} ${c.cyan}│${c.reset} ${action.padEnd(useColor ? 23 : 14)} ${c.cyan}│${c.reset}`;
    }).join('\n');

    const footer = `${c.cyan}└───────┴─────────────┴──────────┴────────┴────────────────┘${c.reset}`;

    return `${header}\n${rows}\n${footer}`;
  }
}
