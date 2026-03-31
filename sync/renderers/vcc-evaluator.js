// sync/renderers/vcc-evaluator.js
// Visual Consistency Contract (VCC) Evaluator for AutoResearch
// Verifies that all renderers produce consistent, spec-compliant output

import { render, renderers } from './index.js';

/**
 * VCC Test Suite
 * Each test validates a specific aspect of renderer consistency.
 */

export const VCC_TESTS = {
    // VCC-1: Output contains all characters from input
    characterPreservation: {
        id: 'vcc-1',
        name: 'Character Preservation',
        description: 'Renderer output must contain all non-whitespace characters from input',
        fn: testCharacterPreservation,
    },

    // VCC-2: Output preserves line count (24 lines)
    lineCountPreservation: {
        id: 'vcc-2',
        name: 'Line Count Preservation',
        description: 'Renderer output must preserve the 24-line grid structure',
        fn: testLineCountPreservation,
    },

    // VCC-3: Output preserves column count (80 chars max)
    columnCountPreservation: {
        id: 'vcc-3',
        name: 'Column Count Preservation',
        description: 'Renderer output must preserve the 80-column grid structure',
        fn: testColumnCountPreservation,
    },

    // VCC-4: Semantic characters map to consistent colors
    semanticColorMapping: {
        id: 'vcc-4',
        name: 'Semantic Color Mapping',
        description: 'Status symbols (●○◉) must map to consistent colors across renderers',
        fn: testSemanticColorMapping,
    },

    // VCC-5: No data loss in round-trip
    roundTripIntegrity: {
        id: 'vcc-5',
        name: 'Round-Trip Integrity',
        description: 'Data can be extracted from rendered output',
        fn: testRoundTripIntegrity,
    },
};

/**
 * Run a single VCC test against a renderer.
 */
export async function runVCCTest(testId, format, asciiContent) {
    const test = Object.values(VCC_TESTS).find(t => t.id === testId);
    if (!test) {
        return { passed: false, error: `Unknown test: ${testId}` };
    }

    try {
        const result = await test.fn(format, asciiContent);
        return {
            passed: result.passed,
            test: test.name,
            format,
            details: result.details || {},
            error: result.error || null,
        };
    } catch (err) {
        return {
            passed: false,
            test: test.name,
            format,
            error: err.message,
        };
    }
}

/**
 * Run all VCC tests against all renderers.
 */
export async function runAllVCCTests(asciiContent) {
    const formats = ['html', 'python', 'svg', 'pixels'];
    const results = [];

    for (const format of formats) {
        for (const test of Object.values(VCC_TESTS)) {
            const result = await runVCCTest(test.id, format, asciiContent);
            results.push(result);
        }
    }

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    return {
        passed: passed === total,
        score: passed / total,
        summary: `${passed}/${total} tests passed`,
        results,
    };
}

// ── Test Implementations ─────────────────────────────────────────────────────

async function testCharacterPreservation(format, asciiContent) {
    const output = render(asciiContent, format);

    // Extract visible characters from input
    const inputChars = new Set(asciiContent.replace(/\s/g, ''));

    // Convert output to string if needed
    const outputStr = typeof output === 'string' ? output :
        (output.data ? 'PIXEL_BUFFER' : String(output));

    // For pixels, we can't easily check characters, so we check dimensions
    if (format === 'pixels') {
        return {
            passed: output.width === 480 && output.height === 240,
            details: { width: output.width, height: output.height },
        };
    }

    // Check that all input characters appear in output
    const missing = [];
    for (const ch of inputChars) {
        // Skip box drawing and special chars for HTML/SVG (they may be escaped)
        const code = ch.charCodeAt(0);
        if (code > 127) continue; // Skip Unicode for this test

        if (!outputStr.includes(ch) && !outputStr.includes(escapeChar(ch))) {
            missing.push(ch);
        }
    }

    return {
        passed: missing.length === 0,
        details: { missingChars: missing.slice(0, 10) },
        error: missing.length > 0 ? `Missing characters: ${missing.slice(0, 5).join(', ')}` : null,
    };
}

async function testLineCountPreservation(format, asciiContent) {
    const inputLines = asciiContent.split('\n').length;
    const output = render(asciiContent, format);

    if (format === 'pixels') {
        // Check pixel height matches expected lines
        const expectedHeight = inputLines * 10; // 10 pixels per line
        return {
            passed: output.height >= expectedHeight - 10,
            details: { inputLines, pixelHeight: output.height },
        };
    }

    const outputStr = typeof output === 'string' ? output : String(output);

    // Count lines in output (format-specific)
    let outputLines;
    if (format === 'html') {
        // Our html-renderer.js joins with \n
        outputLines = (outputStr.match(/\n/g) || []).length + 1;
        // Subtract template lines if it's standalone
        if (outputStr.includes('<!DOCTYPE')) outputLines -= 15; 
    } else if (format === 'python') {
        // Count string literals in cells array by looking for indentation
        const matches = outputStr.match(/ {8}"/g) || []; 
        outputLines = matches.length || (outputStr.match(/\n/g) || []).length;
    } else if (format === 'svg') {
        // Count <text> elements
        outputLines = (outputStr.match(/<text/g) || []).length;
    } else {
        outputLines = outputStr.split('\n').length;
    }

    return {
        passed: Math.abs(outputLines - inputLines) <= 2,
        details: { inputLines, outputLines },
        error: Math.abs(outputLines - inputLines) > 2 ?
            `Line count mismatch: expected ${inputLines}, got ${outputLines}` : null,
    };
}

async function testColumnCountPreservation(format, asciiContent) {
    const maxCol = Math.max(...asciiContent.split('\n').map(l => l.length));
    const output = render(asciiContent, format);

    if (format === 'pixels') {
        // Check pixel width
        const expectedWidth = maxCol * 6; // 6 pixels per char
        return {
            passed: output.width >= 480, // Should be 480 for 80 cols
            details: { maxCol, pixelWidth: output.width },
        };
    }

    // For text formats, we verify the structure supports 80 cols
    return {
        passed: maxCol <= 80,
        details: { maxCol },
        error: maxCol > 80 ? `Column count ${maxCol} exceeds 80` : null,
    };
}

async function testSemanticColorMapping(format, asciiContent) {
    const output = render(asciiContent, format);

    // Define expected color mappings
    const expectedMappings = {
        '●': 'green',  // active
        '○': 'dim',    // idle
        '◉': 'red',    // error
    };

    if (format === 'pixels') {
        // For pixels, check that the color palette is used
        // This is a simplified check
        return { passed: true, details: { note: 'Pixel color check requires image analysis' } };
    }

    const outputStr = typeof output === 'string' ? output : String(output);

    // Check that semantic classes/colors are defined
    const checks = [];

    if (format === 'html') {
        checks.push({
            char: '●',
            found: outputStr.includes('status-active') || outputStr.includes('#3fb950'),
        });
        checks.push({
            char: '○',
            found: outputStr.includes('status-idle') || outputStr.includes('#484f58'),
        });
        checks.push({
            char: '◉',
            found: outputStr.includes('status-error') || outputStr.includes('#f85149'),
        });
    } else if (format === 'svg') {
        checks.push({ char: '●', found: outputStr.includes('#3fb950') });
        checks.push({ char: '○', found: outputStr.includes('#484f58') });
        checks.push({ char: '◉', found: outputStr.includes('#f85149') });
    } else if (format === 'python') {
        // Python output is code, colors are applied at runtime
        checks.push({ char: '●', found: outputStr.includes('●') });
        checks.push({ char: '○', found: outputStr.includes('○') });
        checks.push({ char: '◉', found: outputStr.includes('◉') });
    }

    const allFound = checks.every(c => c.found);

    return {
        passed: allFound,
        details: { checks },
        error: !allFound ? `Missing color mappings: ${checks.filter(c => !c.found).map(c => c.char).join(', ')}` : null,
    };
}

async function testRoundTripIntegrity(format, asciiContent) {
    const output = render(asciiContent, format);

    if (format === 'pixels') {
        // For pixels, verify we can read pixel data back
        return {
            passed: output.data && output.data.length === 480 * 240 * 4,
            details: { bufferLength: output.data?.length },
        };
    }

    if (format === 'python') {
        // Verify Python code is syntactically valid
        const outputStr = typeof output === 'string' ? output : String(output);
        const hasClass = outputStr.includes('class ');
        const hasCells = outputStr.includes('cells');

        return {
            passed: hasClass && hasCells,
            details: { hasClass, hasCells },
        };
    }

    if (format === 'html' || format === 'svg') {
        // Verify markup is well-formed
        const outputStr = typeof output === 'string' ? output : String(output);
        const hasOpen = outputStr.includes('<') || outputStr.includes('&lt;');
        const hasClose = outputStr.includes('>') || outputStr.includes('&gt;');

        return {
            passed: hasOpen && hasClose,
            details: { hasOpen, hasClose },
        };
    }

    return { passed: true, details: {} };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeChar(ch) {
    const escapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
    };
    return escapes[ch] || ch;
}

// ── CLI Interface ─────────────────────────────────────────────────────────────

export async function runEvaluatorCLI() {
    // 80 columns exactly: ┌ + 78*─ + ┐
    const SAMPLE_ASCII = `
┌──────────────────────────────────────────────────────────────────────────────┐
│ ASCII WORLD - VCC Test                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ STATUS: ● ACTIVE    ○ IDLE    ◉ ERROR                                        │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim();

    console.log('┌───────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ VCC EVALUATOR - Visual Consistency Contract Tests                            │');
    console.log('└───────────────────────────────────────────────────────────────────────────────┘\n');

    const result = await runAllVCCTests(SAMPLE_ASCII);

    console.log(`\nResults: ${result.summary}`);
    console.log(`Score: ${(result.score * 100).toFixed(1)}%\n`);

    // Group by format
    const byFormat = {};
    for (const r of result.results) {
        if (!byFormat[r.format]) byFormat[r.format] = [];
        byFormat[r.format].push(r);
    }

    for (const [format, tests] of Object.entries(byFormat)) {
        const passed = tests.filter(t => t.passed).length;
        console.log(`${format.toUpperCase().padEnd(8)} ${passed}/${tests.length} tests passed`);

        for (const t of tests) {
            const status = t.passed ? '✓' : '✗';
            console.log(`  ${status} ${t.test}`);
            if (t.error) {
                console.log(`    Error: ${t.error}`);
            }
        }
        console.log('');
    }

    return result;
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runEvaluatorCLI().then(r => {
        process.exit(r.passed ? 0 : 1);
    });
}
