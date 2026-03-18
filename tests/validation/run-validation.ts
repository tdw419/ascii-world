/**
 * Validation Runner for Pattern Recognition System
 *
 * This standalone script runs all validation tests and produces a summary report.
 * It cross-validates parser output against expected patterns from templates.
 *
 * Usage:
 *   bun run tests/validation/run-validation.ts
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import { parseAscii } from '../../src/renderer/patterns/parser';
import type { DetectedPattern, ParsedAscii } from '../../src/renderer/patterns/types';

/**
 * Sample ASCII templates for validation
 */
const VALIDATION_TEMPLATES = {
  projects: {
    name: 'Projects Template',
    ascii: `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  REGISTERED ASCII PROJECTS                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  [1] My App    (port 3000)  ● running                                    │║
║  │  [2] API Server (port 3001)  ○ stopped                                   │║
║  │  [3] Worker    (port 3002)  ◐ warning                                    │║
║  │  [N] New Project...                                                      │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
║  Selected: 1                                                                ║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [S] Start  [T] Stop  [R] Refresh  [V] View ASCII  [E] Edit Project         ║
╚══════════════════════════════════════════════════════════════════════════════╝`,
    expected: {
      buttons: ['A', 'B', 'C', 'D', 'E', 'X', '1', '2', '3', 'N', 'S', 'T', 'R', 'V'],
      statuses: ['running', 'stopped', 'warning'],
      containers: 1,
    },
  },

  dashboard: {
    name: 'Dashboard Template',
    ascii: `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER - DASHBOARD                       v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [F] Dashboard  [X] Quit          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SYSTEM HEALTH                                           Last Check: 14:32:00║
║  ┌──────────────────────────────────────────────────────────────────────────┐║
║  │  Project                    Port    Status    Uptime     Last Check      │║
║  ├──────────────────────────────────────────────────────────────────────────┤║
║  │  [1] My App      3000    ● running  2h 15m     14:32:00    │║
║  │  [2] API Server  3001    ○ stopped  --          --          │║
║  │  [3] Worker      3002    ◑ warning  45m        14:31:55    │║
║  └──────────────────────────────────────────────────────────────────────────┘║
║                                                                              ║
║  Summary: 1 running, 1 stopped, 1 error                        ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [R] Refresh  [1-9] Select Project                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝`,
    expected: {
      buttons: ['A', 'B', 'C', 'F', 'X', '1', '2', '3', 'R'],
      statuses: ['running', 'stopped', 'warning'],
      containers: 1,
    },
  },

  complex: {
    name: 'Complex Nested Template',
    ascii: `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER - PROJECT VIEW                    v1.0.0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  PROJECT: my-app                                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │ Status: ● running   Port: 3000   Uptime: 2h 15m                         │║
║  │ URL: http://localhost:3000                                               │║
║  │                                                                          │║
║  │ RECENT LOGS                                                              │║
║  │ ┌────────────────────────────────────────────────────────────────────┐  │║
║  │ │ 14:30:15 GET /api/users 200                                         │  │║
║  │ │ 14:30:16 POST /api/login 200                                        │  │║
║  │ │ 14:30:17 GET /api/data 500 ●                                        │  │║
║  │ └────────────────────────────────────────────────────────────────────┘  │║
║  │                                                                          │║
║  │ ENDPOINTS                                                                │║
║  │ │ Path          Method   Status                                        │║
║  │ │ /api/users    GET      ● 200                                         │║
║  │ │ /api/login    POST     ● 200                                         │║
║  │ │ /api/data     GET      ◉ 500                                         │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [S] Start  [T] Stop  [R] Refresh  [L] Logs  [V] View                      ║
╚══════════════════════════════════════════════════════════════════════════════╝`,
    expected: {
      buttons: ['A', 'B', 'C', 'D', 'E', 'X', 'S', 'T', 'R', 'L', 'V'],
      statuses: ['running', 'error'],
      containers: 1,
    },
  },
};

/**
 * Result of validating a single template
 */
interface TemplateValidationResult {
  templateName: string;
  passed: boolean;
  matchScore: number;
  mismatches: string[];
  detected: {
    buttons: string[];
    statuses: string[];
    containerCount: number;
    totalPatterns: number;
  };
  expected: {
    buttons: string[];
    statuses: string[];
    containers: number;
  };
}

/**
 * Summary of all validation results
 */
interface ValidationSummary {
  timestamp: string;
  llmCrossValidation: {
    passed: number;
    failed: number;
    total: number;
    results: Array<{
      templateName: string;
      matchScore: number;
      mismatches: string[];
    }>;
  };
  patternStats: {
    totalPatternsDetected: number;
    byType: Record<string, number>;
  };
}

/**
 * Describe patterns in a human-readable format
 */
function describePatterns(parsed: ParsedAscii): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const pattern of parsed.patterns) {
    stats[pattern.type] = (stats[pattern.type] || 0) + 1;
  }

  return stats;
}

/**
 * Validate a single template against expected patterns
 */
function validateTemplate(
  name: string,
  ascii: string,
  expected: {
    buttons: string[];
    statuses: string[];
    containers: number;
  }
): TemplateValidationResult {
  const parsed = parseAscii(ascii);
  const mismatches: string[] = [];

  // Extract detected patterns
  const detectedButtons = parsed.patterns
    .filter((p) => p.type === 'button' && p.label)
    .map((p) => p.label as string);

  const detectedStatuses = parsed.patterns
    .filter((p) => p.type === 'status-indicator')
    .map((p) => (p as any).status as string);

  const containerCount = parsed.patterns.filter((p) => p.type === 'container').length;

  // Check buttons
  const missingButtons = expected.buttons.filter((b) => !detectedButtons.includes(b));
  const extraButtons = detectedButtons.filter((b) => !expected.buttons.includes(b));

  if (missingButtons.length > 0) {
    mismatches.push(`Missing buttons: ${missingButtons.join(', ')}`);
  }
  if (extraButtons.length > 0) {
    mismatches.push(`Unexpected buttons: ${extraButtons.join(', ')}`);
  }

  // Check statuses
  const missingStatuses = expected.statuses.filter((s) => !detectedStatuses.includes(s));
  if (missingStatuses.length > 0) {
    mismatches.push(`Missing status indicators: ${missingStatuses.join(', ')}`);
  }

  // Check containers
  if (containerCount < expected.containers) {
    mismatches.push(
      `Missing containers: expected ${expected.containers}, found ${containerCount}`
    );
  }

  // Calculate match score (percentage of expected patterns found)
  const expectedCount =
    expected.buttons.length + expected.statuses.length + expected.containers;
  const foundCount =
    detectedButtons.filter((b) => expected.buttons.includes(b)).length +
    detectedStatuses.filter((s) => expected.statuses.includes(s)).length +
    Math.min(containerCount, expected.containers);

  const matchScore = expectedCount > 0 ? Math.min(100, Math.round((foundCount / expectedCount) * 100)) : 0;

  return {
    templateName: name,
    passed: mismatches.length === 0,
    matchScore,
    mismatches,
    detected: {
      buttons: detectedButtons,
      statuses: detectedStatuses,
      containerCount,
      totalPatterns: parsed.patterns.length,
    },
    expected,
  };
}

/**
 * Run validation on all templates and return summary
 */
function runValidation(): ValidationSummary {
  console.log('Running Pattern Recognition Validation...\n');
  console.log('='.repeat(70));
  console.log('PATTERN RECOGNITION VALIDATION REPORT');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const results: TemplateValidationResult[] = [];
  let totalPatterns = 0;
  const patternTypeStats: Record<string, number> = {};

  // Validate each template
  for (const [key, template] of Object.entries(VALIDATION_TEMPLATES)) {
    console.log(`\nValidating: ${template.name}`);
    console.log('-'.repeat(50));

    const result = validateTemplate(key, template.ascii, template.expected);
    results.push(result);

    // Aggregate pattern stats
    const parsed = parseAscii(template.ascii);
    totalPatterns += parsed.patterns.length;

    for (const pattern of parsed.patterns) {
      patternTypeStats[pattern.type] = (patternTypeStats[pattern.type] || 0) + 1;
    }

    // Print result
    const status = result.passed ? '[PASS]' : '[FAIL]';
    console.log(`  ${status} Match Score: ${result.matchScore}%`);
    console.log(`  Patterns detected: ${result.detected.totalPatterns}`);

    if (result.mismatches.length > 0) {
      console.log('  Mismatches:');
      result.mismatches.forEach((m) => console.log(`    - ${m}`));
    }

    // Show detected patterns summary
    console.log(`  Buttons: ${result.detected.buttons.join(', ') || 'none'}`);
    console.log(`  Statuses: ${result.detected.statuses.join(', ') || 'none'}`);
    console.log(`  Containers: ${result.detected.containerCount}`);
  }

  // Summary
  console.log('\n');
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\nValidation Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log(`\nPattern Statistics:`);
  console.log(`  Total patterns detected: ${totalPatterns}`);
  console.log(`  By type:`);

  for (const [type, count] of Object.entries(patternTypeStats).sort((a, b) => b[1] - a[1])) {
    console.log(`    - ${type}: ${count}`);
  }

  // Final status
  console.log('\n' + '='.repeat(70));
  if (failed === 0) {
    console.log('ALL VALIDATIONS PASSED');
  } else {
    console.log('SOME VALIDATIONS FAILED');
  }
  console.log('='.repeat(70));

  return {
    timestamp: new Date().toISOString(),
    llmCrossValidation: {
      passed,
      failed,
      total: results.length,
      results: results.map((r) => ({
        templateName: r.templateName,
        matchScore: r.matchScore,
        mismatches: r.mismatches,
      })),
    },
    patternStats: {
      totalPatternsDetected: totalPatterns,
      byType: patternTypeStats,
    },
  };
}

// Run validation and exit with appropriate code
const summary = runValidation();
const exitCode = summary.llmCrossValidation.failed > 0 ? 1 : 0;

console.log(`\nExiting with code: ${exitCode}`);
process.exit(exitCode);
