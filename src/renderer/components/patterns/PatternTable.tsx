import React from 'react';
import type { TablePattern } from '../../patterns/types';
import { StatusIcon } from './StatusIcon';

export interface PatternTableProps {
  pattern: TablePattern;
  onLabelClick?: (label: string) => void;
  className?: string;
}

export function PatternTable({ pattern, onLabelClick, className = '' }: PatternTableProps) {
  return (
    <div className={`ascii-pattern-table ${className}`}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr>
            {pattern.headers.map((header, i) => (
              <th
                key={i}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '2px solid #4b5563',
                  color: '#9ca3af',
                  fontWeight: '600',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pattern.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{ padding: '8px 12px', borderBottom: '1px solid #374151' }}
                >
                  {cellIndex === 0 && row.label ? (
                    <button
                      onClick={() => onLabelClick?.(row.label!)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#00d9ff',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      [{row.label}] {cell}
                    </button>
                  ) : (
                    renderCell(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(cell: string): React.ReactNode {
  if (cell === '●') return <StatusIcon status="running" />;
  if (cell === '○') return <StatusIcon status="stopped" />;
  if (cell === '◐' || cell === '◑') return <StatusIcon status="warning" />;
  if (cell === '◉') return <StatusIcon status="error" />;
  return cell;
}
