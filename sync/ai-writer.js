#!/usr/bin/env node
// ai-writer.js - Helper for AI to write compliant ASCII files
//
// Usage:
//   node ai-writer.js write <filepath> <content>
//   node ai-writer.js verify <filepath>
//   node ai-writer.js template <name>
//
// This script ensures:
// 1. ASCII is valid per compliance.md
// 2. Hash is computed and embedded
// 3. Parse report is generated for verification

import fs from 'fs/promises';
import path from 'path';
import { contentHash, stripHashLine, extractHash, updateHash, verifyHash } from './hash-utils.js';

const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, '../data');

// Parse ASCII and generate element report (same logic as GUI)
function parseAscii(ascii) {
    const elements = {
        buttons: [],
        statuses: [],
        tables: [],
        cards: [],
        text: []
    };

    const lines = ascii.split('\n');

    // Parse buttons: [A] Label
    const buttonRegex = /\[([A-Z0-9])\]\s*([A-Za-z][A-Za-z\s]*?)(?=\s{2}|\s*\[|\s*║|$)/g;
    let match;
    for (const line of lines) {
        while ((match = buttonRegex.exec(line)) !== null) {
            elements.buttons.push({
                key: match[1],
                label: match[2].trim()
            });
        }
    }

    // Parse status indicators
    const statusSymbols = {
        '●': 'running',
        '○': 'stopped',
        '◐': 'warning',
        '◑': 'paused',
        '◉': 'error'
    };

    for (const line of lines) {
        for (const [symbol, state] of Object.entries(statusSymbols)) {
            const regex = new RegExp(symbol + '\\s+(\\w+)', 'g');
            while ((match = regex.exec(line)) !== null) {
                elements.statuses.push({
                    symbol,
                    state,
                    context: match[1]
                });
            }
        }
    }

    // Parse tables (lines with │ separators)
    let inTable = false;
    let tableLines = [];
    for (const line of lines) {
        if (line.includes('│') && !line.includes('║')) {
            if (!inTable) {
                inTable = true;
                tableLines = [];
            }
            if (!line.match(/^[\s│├└┌─]+$/)) {
                tableLines.push(line);
            }
        } else if (inTable) {
            if (tableLines.length >= 2) {
                const rows = tableLines.map(l =>
                    l.split('│').map(c => c.trim()).filter(c => c)
                ).filter(r => r.length > 0);
                elements.tables.push({
                    headers: rows[0] || [],
                    rows: rows.slice(1)
                });
            }
            inTable = false;
            tableLines = [];
        }
    }

    // Count plain text lines
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed &&
            !/^[╔╗╚╝║═┌┐└┘│─├┤┬┴┼]+$/.test(trimmed) &&
            !/\[([A-Z0-9])\]/.test(trimmed) &&
            !/[●○◐◑◉]/.test(trimmed) &&
            !trimmed.includes('│')) {
            elements.text.push(trimmed);
        }
    }

    return elements;
}

async function writeFile(filepath, content) {
    const fullPath = path.join(DATA_DIR, path.basename(filepath));

    // Update hash
    const contentWithHash = updateHash(content);
    await fs.writeFile(fullPath, contentWithHash, 'utf-8');

    // Parse and report
    const elements = parseAscii(contentWithHash);
    const hash = extractHash(contentWithHash);

    console.log('\n=== ASCII File Written ===');
    console.log('File:', fullPath);
    console.log('Hash:', hash);
    console.log('\nElements:');
    console.log('  Buttons:', elements.buttons.length, elements.buttons.map(b => `[${b.key}] ${b.label}`));
    console.log('  Statuses:', elements.statuses.length, elements.statuses.map(s => `${s.symbol} ${s.context}`));
    console.log('  Tables:', elements.tables.length);
    console.log('  Text lines:', elements.text.length);
    console.log('\nParse Report (for GUI verification):');
    console.log(JSON.stringify({
        type: 'intended_elements',
        hash,
        elements: {
            buttons: elements.buttons.map(b => ({ key: b.key, label: b.label })),
            statuses: elements.statuses.map(s => ({ symbol: s.symbol, state: s.state, context: s.context })),
            tables: elements.tables.map(t => ({ rows: t.rows.length + 1, cols: t.headers.length })),
            textCount: elements.text.length
        }
    }, null, 2));
    console.log('\n✓ File written with hash ver:' + hash);
}

async function verifyFile(filepath) {
    const fullPath = path.join(DATA_DIR, path.basename(filepath));
    const content = await fs.readFile(fullPath, 'utf-8');

    const result = verifyHash(content);
    const elements = parseAscii(content);

    console.log('\n=== Verification ===');
    console.log('File:', fullPath);
    console.log('Hash valid:', result.valid ? '✓ YES' : '✗ NO');
    console.log('Embedded:', result.embedded);
    console.log('Computed:', result.computed);

    if (!result.valid) {
        console.log('\n⚠️  HASH MISMATCH - content was modified');
    }

    console.log('\nParsed Elements:');
    console.log('  Buttons:', elements.buttons.length);
    console.log('  Statuses:', elements.statuses.length);
    console.log('  Tables:', elements.tables.length);
    console.log('  Text lines:', elements.text.length);

    return result.valid;
}

function showTemplate(name) {
    const templates = {
        dashboard: `╔══════════════════════════════════════════════════════════════════════════════╗
║  DASHBOARD                                                    ver:--------   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Start  [B] Stop  [R] Refresh  [X] Exit                                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌──────────────────────────────────────────────────────────────────────────┐║
║  │  Service        Port    Status    Uptime                                 │║
║  ├──────────────────────────────────────────────────────────────────────────┤║
║  │  web-app        3000    ● running  2h 15m                                │║
║  │  api-server     3001    ● running  45m                                   │║
║  │  worker         3002    ○ stopped  --                                    │║
║  └──────────────────────────────────────────────────────────────────────────┘║
║                                                                              ║
║  Summary: 2 running, 1 stopped                                               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝`,

        minimal: `╔══════════════════════════════════════════════════════════════════════════════╗
║  SIMPLE APP                                                   ver:--------   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Action  [X] Exit                                                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  Status: ● running                                                           ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝`
    };

    if (templates[name]) {
        console.log(templates[name]);
    } else {
        console.log('Available templates:', Object.keys(templates).join(', '));
    }
}

// CLI
const [cmd, arg1, arg2] = process.argv.slice(2);

switch (cmd) {
    case 'write':
        if (!arg1 || !arg2) {
            console.log('Usage: node ai-writer.js write <filepath> <content>');
            process.exit(1);
        }
        writeFile(arg1, arg2);
        break;

    case 'verify':
        if (!arg1) {
            console.log('Usage: node ai-writer.js verify <filepath>');
            process.exit(1);
        }
        verifyFile(arg1);
        break;

    case 'template':
        showTemplate(arg1 || '');
        break;

    default:
        console.log(`
ASCII World AI Writer

Commands:
  write <file> <content>  Write ASCII content with auto-hash
  verify <file>           Verify file hash and parse elements
  template [name]         Show template (dashboard, minimal)

Examples:
  node ai-writer.js template dashboard
  node ai-writer.js write myapp.ascii "\$(cat myapp.ascii)"
  node ai-writer.js verify dashboard.ascii
`);
}
