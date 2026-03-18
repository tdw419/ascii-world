// src/renderer/components/LabelButton.tsx

import React from 'react';

export interface LabelButtonProps {
  label: string;
  onClick: (label: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function LabelButton({ label, onClick, children, className = '', disabled = false }: LabelButtonProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick(label);
    }
  };

  return (
    <button
      className={`ascii-label-button ${className}`}
      onClick={handleClick}
      disabled={disabled}
      data-label={label}
    >
      <span className="ascii-label-tag">[{label}]</span>
      <span className="ascii-label-text">{children}</span>
    </button>
  );
}
