// src/renderer/components/__tests__/AsciiView.test.tsx
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AsciiView } from '../AsciiView';

describe('AsciiView', () => {
  it('renders ASCII content in preformatted block', () => {
    const asciiContent = `+------------------+
|  TEST APP        |
+------------------+`;
    render(<AsciiView content={asciiContent} />);
    expect(screen.getByText(/TEST APP/)).toBeInTheDocument();
  });

  it('applies 80x24 grid styling', () => {
    render(<AsciiView content="test" />);
    const pre = screen.getByRole('presentation');
    expect(pre).toHaveClass('ascii-grid');
  });
});
