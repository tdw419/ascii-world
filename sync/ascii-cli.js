#!/usr/bin/env node
// sync/ascii-cli.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ASCIIExperimentRuntime } from './ascii-experiment-runtime.js';
import { ASCIIResultFormatter } from './ascii-result-formatter.js';
import { ASCIIResultsLogger } from './ascii-results-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`ASCII Experiment Runner

Usage:
  node sync/ascii-cli.js <spec-file.ascii>    Run single spec
  node sync/ascii-cli.js --dir <dir>          Run all specs in directory
  node sync/ascii-cli.js --history [n]        Show last n experiments (default: 10)
  node sync/ascii-cli.js --stats              Show experiment statistics
  node sync/ascii-cli.js --search <query>     Search experiments by hypothesis

Options:
  --help   Show this help

Format (H/T/M/B):
  H: <hypothesis>    What to test
  T: <target-file>   File to modify
  M: <metric>        Success criteria
  B: <baseline>      Iterations/budget
`);
    process.exit(0);
  }

  // Handle history command
  if (args[0] === '--history') {
    const count = parseInt(args[1]) || 10;
    const logger = new ASCIIResultsLogger();
    console.log(`\nLast ${count} experiments:\n`);
    console.log(logger.toTable(null, count, { useColor: process.stdout.isTTY }));
    return;
  }

  // Handle stats command
  if (args[0] === '--stats') {
    const logger = new ASCIIResultsLogger();
    console.log(logger.statsToASCII({ useColor: process.stdout.isTTY }));
    return;
  }

  // Handle search command
  if (args[0] === '--search') {
    const query = args[1];
    if (!query) {
      console.error('Please provide a search query');
      process.exit(1);
    }
    const logger = new ASCIIResultsLogger();
    const results = logger.getHistory(query);
    console.log(`\nFound ${results.length} experiments matching "${query}":\n`);
    console.log(logger.toTable(results, 50, { useColor: process.stdout.isTTY }));
    return;
  }

  const runtime = new ASCIIExperimentRuntime({
    projectPath: process.cwd()
  });

  if (args[0] === '--dir') {
    const dir = args[1] || '.autoresearch/specs';
    if (!fs.existsSync(dir)) {
      console.error(`Directory not found: ${dir}`);
      process.exit(1);
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ascii'));

    console.log(`Running ${files.length} specs from ${dir}...\n`);

    for (const file of files) {
      const specPath = path.join(dir, file);
      const spec = fs.readFileSync(specPath, 'utf-8');
      console.log(`=== ${file} ===`);
      try {
        const result = await runtime.runSpec(spec);
        console.log(ASCIIResultFormatter.format(result, { useColor: process.stdout.isTTY }));
        console.log();
      } catch (err) {
        console.error(`Error: ${err.message}\n`);
      }
    }
  } else {
    const specPath = args[0];
    if (!fs.existsSync(specPath)) {
      console.error(`File not found: ${specPath}`);
      process.exit(1);
    }
    const spec = fs.readFileSync(specPath, 'utf-8');
    const result = await runtime.runSpec(spec);
    console.log(ASCIIResultFormatter.format(result, { useColor: process.stdout.isTTY }));
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
