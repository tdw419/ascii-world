#!/usr/bin/env bun
// src/cli/pattern-cli.ts

import { program } from 'commander';
import { promises as fs } from 'fs';
import { PATTERN_TYPES, type CliOptions, type PatternOutput, type PatternGroup } from './pattern-cli-types';
import { parseAscii } from '../renderer/patterns/parser';
import { validateTemplate, describePattern, describePatterns } from '../../tests/validation/llm-cross-validate';
import type { DetectedPattern, ButtonPattern, StatusPattern, ContainerPattern, TablePattern } from '../renderer/patterns/types';

/**
 * Convert a detected pattern to CLI output format
 */
function patternToOutput(pattern: DetectedPattern, index: number): PatternOutput {
  const output: PatternOutput = {
    id: `${pattern.type}-${index}`,
    type: pattern.type,
    position: pattern.position,
    content: pattern.content,
  };

  switch (pattern.type) {
    case 'button': {
      const btn = pattern as ButtonPattern;
      output.label = btn.label;
      output.text = btn.text;
      break;
    }
    case 'status-indicator': {
      const status = pattern as StatusPattern;
      output.status = status.status;
      output.symbol = status.symbol;
      break;
    }
    case 'container': {
      const container = pattern as ContainerPattern;
      output.title = container.title;
      output.borderStyle = container.borderStyle;
      output.bounds = {
        startLine: container.position.row,
        endLine: container.position.row + (container.metadata?.height as number || 1),
        startCol: container.position.col,
        endCol: container.position.col + (container.metadata?.width as number || 10),
      };
      break;
    }
    case 'table': {
      const table = pattern as TablePattern;
      output.headers = table.headers;
      output.rows = table.rows?.length || 0;
      break;
    }
  }

  return output;
}

/**
 * Group patterns by type
 */
function groupByType(patterns: PatternOutput[]): PatternGroup[] {
  const groups: Record<string, PatternOutput[]> = {};

  for (const pattern of patterns) {
    if (!groups[pattern.type]) {
      groups[pattern.type] = [];
    }
    groups[pattern.type].push(pattern);
  }

  return Object.entries(groups).map(([type, pats]) => ({
    type,
    patterns: pats,
  }));
}

/**
 * Format output as a table
 */
function formatTableOutput(patterns: PatternOutput[]): string {
  const lines: string[] = [];

  lines.push('\n' + '='.repeat(60));
  lines.push('Pattern Detection Results');
  lines.push('='.repeat(60) + '\n');

  // Summary by type
  const groups = groupByType(patterns);
  lines.push('Pattern Types Detected:');
  for (const group of groups) {
    lines.push(`  ${group.type}: ${group.patterns.length}`);
  }

  // Detailed pattern info
  lines.push('\n' + '-'.repeat(60));
  lines.push('Detailed Results:');
  lines.push('-'.repeat(60));

  for (const pattern of patterns) {
    lines.push(`\n[${pattern.type}] ${pattern.id}`);
    lines.push(`  Position: row ${pattern.position.row}, col ${pattern.position.col}`);

    switch (pattern.type) {
      case 'button':
        lines.push(`  Label: ${pattern.label}, Text: ${pattern.text}`);
        break;
      case 'status-indicator':
        lines.push(`  Status: ${pattern.status}, Symbol: ${pattern.symbol}`);
        break;
      case 'container':
        lines.push(`  Title: ${pattern.title || 'untitled'}`);
        lines.push(`  Border Style: ${pattern.borderStyle}`);
        if (pattern.bounds) {
          lines.push(`  Bounds: L${pattern.bounds.startLine}-${pattern.bounds.endLine}, C${pattern.bounds.startCol}-${pattern.bounds.endCol}`);
        }
        break;
      case 'table':
        lines.push(`  Headers: ${pattern.headers?.join(', ')}`);
        lines.push(`  Rows: ${pattern.rows}`);
        break;
      default:
        lines.push(`  Content: ${pattern.content}`);
    }
  }

  lines.push('\n' + '='.repeat(60));
  return lines.join('\n');
}

/**
 * Format output as pretty printed text
 */
function formatPrettyOutput(patterns: PatternOutput[]): string {
  const lines: string[] = [];

  lines.push('\nPattern Detection Results\n');

  const groups = groupByType(patterns);

  for (const group of groups) {
    lines.push(`\n## ${group.type.toUpperCase()} (${group.patterns.length})`);

    for (const pattern of group.patterns) {
      switch (pattern.type) {
        case 'button':
          lines.push(`  - [${pattern.label}] ${pattern.text}`);
          break;
        case 'status-indicator':
          lines.push(`  - ${pattern.symbol} (${pattern.status})`);
          break;
        case 'container':
          lines.push(`  - "${pattern.title || 'untitled'}" [${pattern.borderStyle}]`);
          break;
        case 'table':
          lines.push(`  - Columns: ${pattern.headers?.join(', ')}`);
          break;
        default:
          lines.push(`  - ${pattern.content}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Main CLI action
 */
async function main(options: CliOptions): Promise<void> {
  // Read input
  let ascii: string;

  if (options.input) {
    ascii = await fs.readFile(options.input, 'utf-8');
  } else {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    ascii = Buffer.concat(chunks).toString('utf-8');
  }

  // Parse ASCII
  const parsed = parseAscii(ascii);

  // Convert to output format
  let patterns = parsed.patterns.map((p, i) => patternToOutput(p, i));

  // Filter patterns if specified
  if (options.patterns) {
    const filterTypes = options.patterns.split(',').map(t => t.trim().toLowerCase());
    patterns = patterns.filter(p =>
      filterTypes.includes(p.type.toLowerCase()) ||
      filterTypes.includes(p.type.replace('-', '').toLowerCase())
    );
  }

  // Format output
  let output: string;
  const format = options.format || 'json';

  switch (format) {
    case 'table':
      output = formatTableOutput(patterns);
      break;
    case 'pretty':
      output = formatPrettyOutput(patterns);
      break;
    default:
      output = JSON.stringify(patterns, null, 2);
  }

  // Write output
  if (options.output) {
    await fs.writeFile(options.output, output);
    console.log(`Output written to ${options.output}`);
  } else {
    console.log(output);
  }
}

// Set up CLI
program
  .name('pattern-cli')
  .description('ASCII Pattern Recognition CLI')
  .version('1.0.0')
  .option('-i, --input <file>', 'Input ASCII file (reads from stdin if not specified)')
  .option('-o, --output <file>', 'Output file (outputs to stdout if not specified)')
  .option('-p, --patterns <items>', 'Patterns to detect (comma-separated: button,status,container,table)')
  .option('-f, --format <format>', 'Output format (json, table, pretty)', 'json')
  .option('-l, --list', 'List available pattern types')
  .action(async (options) => {
    // Handle --list flag
    if (options.list) {
      console.log('\nAvailable Pattern Types:\n');
      for (const info of PATTERN_TYPES) {
        console.log(`  ${info.name.padEnd(16)} - ${info.description}`);
      }
      console.log('');
      process.exit(0);
    }

    try {
      await main(options);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv);
