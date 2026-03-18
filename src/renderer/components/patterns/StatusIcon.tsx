import React from 'react';
import type { StatusPattern } from '../../patterns/types';

export interface StatusIconProps {
  status: StatusPattern['status'];
  className?: string;
}

const STATUS_STYLES: Record<StatusPattern['status'], { color: string; bg: string }> = {
  running: { color: '#22c55e', bg: '#dcfce7' },
  stopped: { color: '#6b7280', bg: '#f3f4f6' },
  warning: { color: '#f59e0b', bg: '#fef3c7' },
  error: { color: '#ef4444', bg: '#fee2e2' },
  unknown: { color: '#9ca3af', bg: '#e5e7eb' },
};

export function StatusIcon({ status, className = '' }: StatusIconProps) {
  const style = STATUS_STYLES[status];

  return (
    <span
      className={`ascii-status-icon ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: style.bg,
        color: style.color,
        fontSize: '12px',
        fontWeight: 'bold',
      }}
      title={status}
    >
      {status === 'running' && '●'}
      {status === 'stopped' && '○'}
      {status === 'warning' && '◐'}
      {status === 'error' && '✕'}
      {status === 'unknown' && '?'}
    </span>
  );
}
