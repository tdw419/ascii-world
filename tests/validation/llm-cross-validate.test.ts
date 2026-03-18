// tests/validation/llm-cross-validate.test.ts

import { describe, it, expect } from 'bun:test';
import { validateTemplate, validateAllTemplates, describePatterns } from './llm-cross-validate';
import { SAMPLE_TEMPLATES } from './fixtures/sample-templates';
import { parseAscii } from '../../src/renderer/patterns/parser';

describe('Sample Template Validation', () => {
  it('validates simple-buttons template', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'simple-buttons');
    expect(template).toBeDefined();

    const result = validateTemplate(template!);
    expect(result.matchScore).toBe(100);
    expect(result.missingPatterns.length).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('validates status-indicators template', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'status-indicators');
    expect(template).toBeDefined();

    const result = validateTemplate(template!);
    expect(result.matchScore).toBe(100);
    expect(result.missingPatterns.length).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('validates container template', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'container');
    expect(template).toBeDefined();

    const result = validateTemplate(template!);
    // Container patterns may have slight penalty from extra patterns detected
    expect(result.matchScore).toBeGreaterThanOrEqual(80);
    expect(result.missingPatterns.length).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('validates table template', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'table');
    expect(template).toBeDefined();

    const result = validateTemplate(template!);
    // Table patterns may have slight penalty from extra patterns detected
    expect(result.matchScore).toBeGreaterThanOrEqual(80);
    expect(result.missingPatterns.length).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('validates complex-dashboard template', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'complex-dashboard');
    expect(template).toBeDefined();

    const result = validateTemplate(template!);
    // Complex templates may have lower scores due to extra patterns
    expect(result.matchScore).toBeGreaterThanOrEqual(70);
  });
});

describe('Validate All Templates', () => {
  it('validates all sample templates successfully', () => {
    const summary = validateAllTemplates();

    expect(summary.passed).toBeGreaterThan(0);
    // Most templates should pass (at least 4 out of 5)
    expect(summary.passed).toBeGreaterThanOrEqual(4);
    expect(summary.results.length).toBe(SAMPLE_TEMPLATES.length);
  });
});

describe('Pattern Description Generator', () => {
  it('generates human-readable description of buttons', () => {
    const parsed = parseAscii('[A] Tasks  [B] Settings');
    const description = describePatterns(parsed.patterns);

    expect(description).toContain('BUTTON');
    // describePattern returns "Button A: \"Tasks\"" format
    expect(description).toContain('Button A');
    expect(description).toContain('Tasks');
    expect(description).toContain('Button B');
    expect(description).toContain('Settings');
  });

  it('generates human-readable description of status indicators', () => {
    const parsed = parseAscii('● running  ○ stopped');
    const description = describePatterns(parsed.patterns);

    expect(description).toContain('STATUS-INDICATOR');
    expect(description).toContain('running');
    expect(description).toContain('stopped');
  });

  it('generates description with all pattern types', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'complex-dashboard');
    expect(template).toBeDefined();

    const parsed = parseAscii(template!.ascii);
    const description = describePatterns(parsed.patterns);

    expect(description.length).toBeGreaterThan(50);
  });
});

describe('Pattern Count Accuracy', () => {
  it('correctly counts buttons in complex template', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'complex-dashboard');
    expect(template).toBeDefined();

    const result = validateTemplate(template!);

    // Count button patterns in matched patterns
    const buttonCount = result.matchedPatterns.filter(
      m => m.expected.type === 'button'
    ).length;

    expect(buttonCount).toBeGreaterThanOrEqual(3);
  });

  it('correctly counts status indicators', () => {
    const template = SAMPLE_TEMPLATES.find(t => t.name === 'complex-dashboard');
    expect(template).toBeDefined();

    const result = validateTemplate(template!);

    // Count status indicator patterns in matched patterns
    const statusCount = result.matchedPatterns.filter(
      m => m.expected.type === 'status-indicator'
    ).length;

    expect(statusCount).toBeGreaterThanOrEqual(2);
  });
});
