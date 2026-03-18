import React from 'react';
import type { ButtonPattern } from '../../patterns/types';

export interface PatternButtonProps {
  pattern: ButtonPattern;
  onClick: (label: string) => void;
  className?: string;
}

export function PatternButton({ pattern, onClick, className = '' }: PatternButtonProps) {
  return (
    <button
      className={`ascii-pattern-button ${className}`}
      onClick={() => onClick(pattern.label)}
      data-label={pattern.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#374151',
        border: '1px solid #4b5563',
        borderRadius: '6px',
        color: '#f9fafb',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <span
        className="ascii-label-badge"
        style={{
          backgroundColor: '#00d9ff',
          color: '#111827',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '12px',
        }}
      >
        [{pattern.label}]
      </span>
      <span className="ascii-label-text">{pattern.text}</span>
    </button>
  );
}
