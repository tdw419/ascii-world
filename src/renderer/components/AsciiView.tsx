// src/renderer/components/AsciiView.tsx

import React from 'react';

export interface AsciiViewProps {
  content: string;
  className?: string;
}

export function AsciiView({ content, className = '' }: AsciiViewProps) {
  return (
    <pre
      className={`ascii-grid ${className}`}
      role="presentation"
      aria-label="ASCII interface view"
    >
      {content}
    </pre>
  );
}
