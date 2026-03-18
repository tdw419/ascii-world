import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutoRenderer } from '../AutoRenderer';

describe('AutoRenderer', () => {
  it('renders buttons from ASCII', () => {
    const ascii = '[A] Tasks  [B] Settings';
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders status indicators in tables', () => {
    const ascii = `│ Name  │ Status │
│ App 1 │ ●      │`;
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByTitle('running')).toBeInTheDocument();
  });

  it('renders tables with headers', () => {
    const ascii = `│ Name  │ Status │
│ App 1 │ ●      │`;
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('calls onControl when button clicked', async () => {
    const ascii = '[A] Tasks';
    const onControl = vi.fn();
    render(<AutoRenderer ascii={ascii} onControl={onControl} />);

    const button = screen.getByRole('button');
    button.click();

    expect(onControl).toHaveBeenCalledWith('A');
  });

  it('falls back to raw ASCII for unrecognized patterns', () => {
    const ascii = 'Just plain text';
    render(<AutoRenderer ascii={ascii} onControl={() => {}} />);

    expect(screen.getByText('Just plain text')).toBeInTheDocument();
  });
});
