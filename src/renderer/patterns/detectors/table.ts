// src/renderer/patterns/detectors/table.ts

import type { AsciiLexer } from '../lexer';
import type { TablePattern, TableRowPattern } from '../types';

export function detectTables(lexer: AsciiLexer): TablePattern[] {
  const tables: TablePattern[] = [];
  let currentTable: { startRow: number; headers: string[]; rows: TableRowPattern[] } | null = null;

  for (let row = 0; row < lexer.gridSize.height; row++) {
    const line = lexer.getLine(row);

    // Check if line is a divider row first
    if (isDividerRow(line)) {
      // Divider row - if we have a table but no rows yet, keep the headers
      // Just skip the divider
      continue;
    }

    // Check if line is a table row (starts/ends with │ or ║)
    const isTableRow = /^[│║]/.test(line) && /[│║]$/.test(line);

    if (isTableRow) {
      const cells = parseTableRow(line);
      const labelMatch = cells[0]?.match(/\[([A-Z0-9])\]/);
      const label = labelMatch ? labelMatch[1] : undefined;

      // Clean first cell of label
      const cleanedCells = [...cells];
      if (label && cleanedCells.length > 0) {
        cleanedCells[0] = cleanedCells[0].replace(/\[[A-Z0-9]\]\s*/, '').trim();
      }

      if (!currentTable) {
        // First row of table - check if it has a label
        // If it has a label, it's a data row, not a header
        if (label) {
          // Table has no headers, first row is data
          currentTable = {
            startRow: row,
            headers: [],
            rows: [{
              type: 'table-row',
              position: { row, col: 0 },
              content: line,
              cells: cleanedCells,
              label,
            }],
          };
        } else {
          // First row is headers
          currentTable = {
            startRow: row,
            headers: cells,
            rows: [],
          };
        }
      } else {
        // Add as data row
        currentTable.rows.push({
          type: 'table-row',
          position: { row, col: 0 },
          content: line,
          cells: cleanedCells,
          label,
        });
      }
    } else if (currentTable && currentTable.rows.length > 0) {
      // End of table
      tables.push({
        type: 'table',
        position: { row: currentTable.startRow, col: 0 },
        content: '',
        headers: currentTable.headers,
        rows: currentTable.rows,
      });
      currentTable = null;
    } else if (currentTable) {
      currentTable = null;
    }
  }

  // Handle table at end of file
  if (currentTable && currentTable.rows.length > 0) {
    tables.push({
      type: 'table',
      position: { row: currentTable.startRow, col: 0 },
      content: '',
      headers: currentTable.headers,
      rows: currentTable.rows,
    });
  }

  return tables;
}

function parseTableRow(line: string): string[] {
  // Remove leading and trailing borders
  const content = line.replace(/^[│║]\s*/, '').replace(/\s*[│║]$/, '');

  // Split by cell borders
  const cells = content.split(/\s*[│║]\s*/);

  return cells.map(cell => cell.trim()).filter(cell => cell.length > 0);
}

function isDividerRow(line: string): boolean {
  // Check if row is all dividers (├─┤ or ╠═╣ patterns)
  return /^[│║╠├][═─┼╬├┤┌┐└┘┬┴]+[│║╣┤]$/.test(line.trim());
}
