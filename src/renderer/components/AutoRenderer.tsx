// src/renderer/components/AutoRenderer.tsx

import React from 'react';
import { parseAscii } from '../patterns/parser';
import { PatternButton } from './patterns/PatternButton';
import { PatternTable } from './patterns/PatternTable';
import { PatternCard } from './patterns/PatternCard';
import { AsciiView } from './AsciiView';
import type { ButtonPattern, TablePattern, ContainerPattern } from '../patterns/types';

export interface AutoRendererProps {
  ascii: string;
  onControl: (label: string) => void;
  className?: string;
  showRawFallback?: boolean;
}

export function AutoRenderer({
  ascii,
  onControl,
  className = '',
  showRawFallback = true,
}: AutoRendererProps) {
  const parsed = parseAscii(ascii);

  // If no patterns detected, show raw ASCII
  if (parsed.patterns.length === 0 && showRawFallback) {
    return <AsciiView content={ascii} className={className} />;
  }

  // Group patterns by type
  const buttons = parsed.patterns.filter((p): p is ButtonPattern => p.type === 'button');
  const tables = parsed.patterns.filter((p): p is TablePattern => p.type === 'table');
  const containers = parsed.patterns.filter((p): p is ContainerPattern => p.type === 'container');

  return (
    <div className={`ascii-auto-renderer ${className}`}>
      {/* Render containers */}
      {containers.map((container, i) => (
        <PatternCard key={`container-${i}`} pattern={container} />
      ))}

      {/* Render tables */}
      {tables.map((table, i) => (
        <PatternTable
          key={`table-${i}`}
          pattern={table}
          onLabelClick={onControl}
        />
      ))}

      {/* Render button bar */}
      {buttons.length > 0 && (
        <div className="ascii-button-bar" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {buttons.map((button, i) => (
            <PatternButton
              key={`button-${i}`}
              pattern={button}
              onClick={onControl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
