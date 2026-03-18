// tests/validation/llm-cross-validate.ts

/**
 * LLM Cross-Validation Utilities
 *
 * These utilities compare detected patterns against expected patterns
 * to validate the pattern recognition system's accuracy.
 */

import { parseAscii } from '../../src/renderer/patterns/parser';
import type { DetectedPattern, ButtonPattern, StatusPattern, ContainerPattern, TablePattern } from '../../src/renderer/patterns/types';
import type { SampleTemplate, ExpectedPattern } from './fixtures/sample-templates';
import { SAMPLE_TEMPLATES } from './fixtures/sample-templates';

/**
 * Result of validating a single template
 */
export interface TemplateValidationResult {
  templateName: string;
  passed: boolean;
  matchScore: number; // 0-100
  expectedCount: number;
  detectedCount: number;
  matchedPatterns: PatternMatch[];
  missingPatterns: ExpectedPattern[];
  extraPatterns: DetectedPattern[];
  details: string[];
}

/**
 * A matched pattern pair
 */
export interface PatternMatch {
  expected: ExpectedPattern;
  detected: DetectedPattern;
  confidence: number; // 0-100
}

/**
 * Result of validating all templates
 */
export interface ValidationSummary {
  totalTemplates: number;
  passed: number;
  failed: number;
  averageScore: number;
  results: TemplateValidationResult[];
}

/**
 * Count patterns by type
 */
function countByType(patterns: DetectedPattern[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pattern of patterns) {
    counts[pattern.type] = (counts[pattern.type] || 0) + 1;
  }
  return counts;
}

/**
 * Count expected patterns by type
 */
function countExpectedByType(patterns: ExpectedPattern[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pattern of patterns) {
    counts[pattern.type] = (counts[pattern.type] || 0) + 1;
  }
  return counts;
}

/**
 * Check if a detected button matches an expected button description
 */
function buttonMatchesExpected(button: ButtonPattern, expected: ExpectedPattern): number {
  if (expected.type !== 'button') return 0;

  const desc = expected.description.toLowerCase();
  const label = button.label.toLowerCase();
  const text = button.text.toLowerCase();

  // Check if button label is mentioned in description (e.g., "Button A")
  const labelMatch = desc.includes(`button ${label.toLowerCase()}`);

  // Check if button text is mentioned in description
  const textMatch = desc.includes(`"${text}"`) || desc.includes(`"${text.toLowerCase()}"`);

  // Check if label appears in description
  const labelInDesc = desc.includes(label);

  if (labelMatch && textMatch) return 100;
  if (labelMatch || textMatch) return 80;
  if (labelInDesc) return 60;

  return 0;
}

/**
 * Check if a detected status matches an expected status description
 */
function statusMatchesExpected(status: StatusPattern, expected: ExpectedPattern): number {
  if (expected.type !== 'status-indicator') return 0;

  const desc = expected.description.toLowerCase();
  const statusType = status.status.toLowerCase();
  const symbol = status.symbol;

  // Check if status type is mentioned
  if (desc.includes(statusType)) return 100;

  // Check for symbol descriptions
  const symbolDescriptions: Record<string, string[]> = {
    '●': ['running', 'green dot', 'active', 'solid'],
    '○': ['stopped', 'gray circle', 'empty', 'inactive'],
    '◐': ['warning', 'half circle', 'partial'],
    '◉': ['error', 'bullseye', 'critical'],
  };

  const symbolDescs = symbolDescriptions[symbol] || [];
  for (const symDesc of symbolDescs) {
    if (desc.includes(symDesc)) return 90;
  }

  return 0;
}

/**
 * Check if a detected container matches an expected container description
 */
function containerMatchesExpected(container: ContainerPattern, expected: ExpectedPattern): number {
  if (expected.type !== 'container') return 0;

  const desc = expected.description.toLowerCase();
  const title = (container.title || '').toLowerCase();

  // Check if title is mentioned
  if (title && desc.includes(title)) return 100;

  // Check for container keywords
  if (desc.includes('container') || desc.includes('box')) return 70;

  return 50;
}

/**
 * Check if a detected table matches an expected table description
 */
function tableMatchesExpected(table: TablePattern, expected: ExpectedPattern): number {
  if (expected.type !== 'table') return 0;

  const desc = expected.description.toLowerCase();
  const headers = table.headers.map(h => h.toLowerCase());

  // Check if headers are mentioned
  let headerMatches = 0;
  for (const header of headers) {
    if (desc.includes(header)) headerMatches++;
  }

  if (headerMatches === headers.length && headers.length > 0) return 100;
  if (headerMatches > 0) return 70;
  if (desc.includes('table')) return 50;

  return 0;
}

/**
 * Find the best matching detected pattern for an expected pattern
 */
function findBestMatch(
  expected: ExpectedPattern,
  detected: DetectedPattern[]
): { pattern: DetectedPattern; confidence: number } | null {
  let bestMatch: DetectedPattern | null = null;
  let bestConfidence = 0;

  for (const pattern of detected) {
    if (pattern.type !== expected.type) continue;

    let confidence = 0;

    switch (pattern.type) {
      case 'button':
        confidence = buttonMatchesExpected(pattern as ButtonPattern, expected);
        break;
      case 'status-indicator':
        confidence = statusMatchesExpected(pattern as StatusPattern, expected);
        break;
      case 'container':
        confidence = containerMatchesExpected(pattern as ContainerPattern, expected);
        break;
      case 'table':
        confidence = tableMatchesExpected(pattern as TablePattern, expected);
        break;
    }

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = pattern;
    }
  }

  if (bestMatch && bestConfidence >= 50) {
    return { pattern: bestMatch, confidence: bestConfidence };
  }

  return null;
}

/**
 * Describe a detected pattern in human-readable form
 */
export function describePattern(pattern: DetectedPattern): string {
  switch (pattern.type) {
    case 'button': {
      const btn = pattern as ButtonPattern;
      return `Button ${btn.label}: "${btn.text}"`;
    }
    case 'status-indicator': {
      const status = pattern as StatusPattern;
      return `Status: ${status.status} (${status.symbol})`;
    }
    case 'container': {
      const container = pattern as ContainerPattern;
      return `Container: ${container.title || 'untitled'} (${container.borderStyle} border)`;
    }
    case 'table': {
      const table = pattern as TablePattern;
      return `Table with columns: ${table.headers.join(', ')}`;
    }
    case 'table-row': {
      return `Table row`;
    }
    case 'text': {
      return `Text: "${pattern.content}"`;
    }
    case 'divider': {
      return `Divider`;
    }
    case 'header': {
      return `Header: "${pattern.content}"`;
    }
    default: {
      return `${pattern.type}: ${pattern.content}`;
    }
  }
}

/**
 * Describe multiple patterns in a formatted string
 */
export function describePatterns(patterns: DetectedPattern[]): string {
  if (patterns.length === 0) {
    return 'No patterns detected';
  }

  const lines: string[] = ['Detected Patterns:'];

  // Group by type
  const byType: Record<string, DetectedPattern[]> = {};
  for (const pattern of patterns) {
    if (!byType[pattern.type]) {
      byType[pattern.type] = [];
    }
    byType[pattern.type].push(pattern);
  }

  for (const [type, typePatterns] of Object.entries(byType)) {
    lines.push(`\n  ${type.toUpperCase()} (${typePatterns.length}):`);
    for (const pattern of typePatterns) {
      lines.push(`    - ${describePattern(pattern)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Validate a single template
 */
export function validateTemplate(template: SampleTemplate): TemplateValidationResult {
  const parsed = parseAscii(template.ascii);
  const detected = parsed.patterns;
  const expected = template.expectedPatterns;

  const details: string[] = [];
  const matchedPatterns: PatternMatch[] = [];
  const missingPatterns: ExpectedPattern[] = [];
  const usedPatterns = new Set<DetectedPattern>();

  // Find matches for each expected pattern
  for (const exp of expected) {
    const match = findBestMatch(exp, detected);
    if (match) {
      matchedPatterns.push({
        expected: exp,
        detected: match.pattern,
        confidence: match.confidence,
      });
      usedPatterns.add(match.pattern);
      details.push(`MATCHED: ${exp.description} -> ${describePattern(match.pattern)} (${match.confidence}%)`);
    } else {
      missingPatterns.push(exp);
      details.push(`MISSING: ${exp.description}`);
    }
  }

  // Find extra patterns (detected but not expected)
  const extraPatterns = detected.filter(p => !usedPatterns.has(p));
  for (const extra of extraPatterns) {
    details.push(`EXTRA: ${describePattern(extra)}`);
  }

  // Calculate match score
  // Base score from matched patterns
  let totalConfidence = 0;
  for (const match of matchedPatterns) {
    totalConfidence += match.confidence;
  }

  // Score calculation:
  // - Weight matches by confidence
  // - Penalize for missing patterns
  // - Penalize slightly for extra patterns (less severe)
  const expectedCount = expected.length;
  const matchedCount = matchedPatterns.length;

  let matchScore = 0;
  if (expectedCount > 0) {
    // Average confidence of matched patterns
    const avgConfidence = matchedPatterns.length > 0 ? totalConfidence / matchedPatterns.length : 0;

    // Coverage ratio (how many expected patterns were found)
    const coverageRatio = matchedCount / expectedCount;

    // Extra patterns penalty (less severe)
    const extraPenalty = Math.min(extraPatterns.length * 5, 20); // Max 20% penalty

    // Final score
    matchScore = Math.round((avgConfidence * coverageRatio) - extraPenalty);
    matchScore = Math.max(0, Math.min(100, matchScore));
  }

  const passed = missingPatterns.length === 0 && matchScore >= 80;

  return {
    templateName: template.name,
    passed,
    matchScore,
    expectedCount: expected.length,
    detectedCount: detected.length,
    matchedPatterns,
    missingPatterns,
    extraPatterns,
    details,
  };
}

/**
 * Validate all sample templates
 */
export function validateAllTemplates(): ValidationSummary {
  const results: TemplateValidationResult[] = [];
  let totalScore = 0;
  let passed = 0;
  let failed = 0;

  for (const template of SAMPLE_TEMPLATES) {
    const result = validateTemplate(template);
    results.push(result);
    totalScore += result.matchScore;

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  return {
    totalTemplates: SAMPLE_TEMPLATES.length,
    passed,
    failed,
    averageScore: Math.round(totalScore / SAMPLE_TEMPLATES.length),
    results,
  };
}

/**
 * Generate a formatted report of validation results
 */
export function generateReport(summary: ValidationSummary): string {
  const lines: string[] = [
    '=== Pattern Recognition Validation Report ===',
    '',
    `Total Templates: ${summary.totalTemplates}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    `Average Score: ${summary.averageScore}%`,
    '',
  ];

  for (const result of summary.results) {
    lines.push(`--- ${result.templateName} ---`);
    lines.push(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`Score: ${result.matchScore}%`);
    lines.push(`Expected: ${result.expectedCount}, Detected: ${result.detectedCount}`);

    if (result.missingPatterns.length > 0) {
      lines.push(`Missing Patterns:`);
      for (const missing of result.missingPatterns) {
        lines.push(`  - ${missing.description}`);
      }
    }

    if (result.extraPatterns.length > 0) {
      lines.push(`Extra Patterns:`);
      for (const extra of result.extraPatterns) {
        lines.push(`  - ${describePattern(extra)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

// Re-export for convenience
export { SAMPLE_TEMPLATES };
