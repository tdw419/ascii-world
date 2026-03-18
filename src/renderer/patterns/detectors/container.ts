// src/renderer/patterns/detectors/container.ts

import type { AsciiLexer } from '../lexer';
import type { ContainerPattern } from '../types';

interface ContainerBounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export function detectContainers(lexer: AsciiLexer): ContainerPattern[] {
  const containers: ContainerPattern[] = [];
  const visited = new Set<string>();

  // Find top-left corners
  for (let row = 0; row < lexer.gridSize.height; row++) {
    for (let col = 0; col < lexer.gridSize.width; col++) {
      const char = lexer.getChar(row, col);
      if ((char === '┌' || char === '╔') && !visited.has(`${row},${col}`)) {
        const container = findContainerBounds(lexer, row, col);
        if (container) {
          visited.add(`${row},${col}`);
          const title = extractTitle(lexer, container);
          const borderStyle = char === '╔' ? 'double' : 'single';

          containers.push({
            type: 'container',
            position: { row, col },
            content: extractContent(lexer, container),
            title,
            children: [],
            borderStyle,
            metadata: {
              bounds: container,
            },
          });
        }
      }
    }
  }

  return containers;
}

function findContainerBounds(lexer: AsciiLexer, startRow: number, startCol: number): ContainerBounds | null {
  const startChar = lexer.getChar(startRow, startCol);
  const isDouble = startChar === '╔';

  // Find right edge of top border
  let endCol = startCol;
  while (endCol < lexer.gridSize.width) {
    const char = lexer.getChar(startRow, endCol);
    if ((isDouble && char === '╗') || (!isDouble && char === '┐')) {
      break;
    }
    endCol++;
  }

  // If we didn't find a top-right corner, increment to include the found position
  const topRight = lexer.getChar(startRow, endCol);
  const expectedTopRight = isDouble ? '╗' : '┐';
  if (topRight === expectedTopRight) {
    // endCol already points to the corner
  }

  // Find bottom edge
  let endRow = startRow;
  while (endRow < lexer.gridSize.height) {
    const char = lexer.getChar(endRow, startCol);
    if ((isDouble && char === '╚') || (!isDouble && char === '└')) {
      break;
    }
    endRow++;
  }

  // Verify bottom-right corner
  const bottomRight = lexer.getChar(endRow, endCol);
  const expectedCorner = isDouble ? '╝' : '┘';
  if (bottomRight !== expectedCorner) {
    return null;
  }

  return { startRow, endRow, startCol, endCol };
}

function extractTitle(lexer: AsciiLexer, bounds: ContainerBounds): string | undefined {
  const titleRow = bounds.startRow + 1;
  if (titleRow > bounds.endRow) return undefined;

  const line = lexer.getLine(titleRow);
  const content = line.slice(bounds.startCol + 1, bounds.endCol).trim();
  return content || undefined;
}

function extractContent(lexer: AsciiLexer, bounds: ContainerBounds): string {
  const lines: string[] = [];
  for (let row = bounds.startRow + 1; row < bounds.endRow; row++) {
    const line = lexer.getLine(row);
    const content = line.slice(bounds.startCol + 1, bounds.endCol);
    lines.push(content);
  }
  return lines.join('\n');
}
