#!/usr/bin/env node
// sync/ascii-cli.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ASCIIExperimentRuntime } from './ascii-experiment-runtime.js';
import { ASCIIResultFormatter } from './ascii-result-formatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`ASCII Experiment Runner

Usage:
  node sync/ascii-cli.js <spec-file.ascii>
  node sync/ascii-cli.js --dir <specs-directory>

Options:
  --dir    Run all specs in directory
  --help   Show this help

Format (H/T/M/B):
  H: <hypothesis>    What to test
  T: <target-file>   File to modify
  M: <metric>        Success criteria
  B: <baseline>      Iterations/budget
`);
    process.exit(0);
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
        console.log(ASCIIResultFormatter.format(result));
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
    console.log(ASCIIResultFormatter.format(result));
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
