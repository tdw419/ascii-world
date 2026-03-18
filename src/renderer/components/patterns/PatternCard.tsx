import React from 'react';
import type { ContainerPattern } from '../../patterns/types';

export interface PatternCardProps {
  pattern: ContainerPattern;
  children?: React.ReactNode;
  className?: string;
}

export function PatternCard({ pattern, children, className = '' }: PatternCardProps) {
  const borderStyle = pattern.borderStyle === 'double' ? '2px solid #4b5563' : '1px solid #374151';

  return (
    <div
      className={`ascii-pattern-card ${className}`}
      style={{ border: borderStyle, borderRadius: '8px', overflow: 'hidden' }}
    >
      {pattern.title && (
        <div
          className="ascii-card-header"
          style={{
            padding: '12px 16px',
            backgroundColor: '#1f2937',
            borderBottom: borderStyle,
            fontWeight: '600',
          }}
        >
          {pattern.title}
        </div>
      )}
      <div className="ascii-card-content" style={{ padding: '16px' }}>
        {children || <pre style={{ margin: 0 }}>{pattern.content}</pre>}
      </div>
    </div>
  );
}
