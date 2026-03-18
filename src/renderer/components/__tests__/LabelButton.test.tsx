// src/renderer/components/__tests__/LabelButton.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelButton } from '../LabelButton';

describe('LabelButton', () => {
  it('renders with label and children', () => {
    render(<LabelButton label="A" onClick={() => {}}>View Tasks</LabelButton>);
    expect(screen.getByText('[A]')).toBeInTheDocument();
    expect(screen.getByText('View Tasks')).toBeInTheDocument();
  });

  it('calls onClick with label when clicked', () => {
    const handleClick = vi.fn();
    render(<LabelButton label="B" onClick={handleClick}>Settings</LabelButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith('B');
  });

  it('applies custom className', () => {
    render(<LabelButton label="C" onClick={() => {}} className="custom">Test</LabelButton>);
    expect(screen.getByRole('button')).toHaveClass('custom');
  });
});
