import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIcon } from '../patterns/StatusIcon';
import { PatternButton } from '../patterns/PatternButton';
import { PatternTable } from '../patterns/PatternTable';
import { PatternCard } from '../patterns/PatternCard';

describe('Pattern Components', () => {
  describe('StatusIcon', () => {
    it('renders running status with green color', () => {
      render(<StatusIcon status="running" />);
      expect(screen.getByTitle('running')).toBeInTheDocument();
    });

    it('renders stopped status with gray color', () => {
      render(<StatusIcon status="stopped" />);
      expect(screen.getByTitle('stopped')).toBeInTheDocument();
    });
  });

  describe('PatternButton', () => {
    it('renders with label and text', () => {
      const pattern = { type: 'button' as const, position: { row: 0, col: 0 }, content: '[A] Task', label: 'A', text: 'Task' };
      render(<PatternButton pattern={pattern} onClick={() => {}} />);
      expect(screen.getByText('[A]')).toBeInTheDocument();
      expect(screen.getByText('Task')).toBeInTheDocument();
    });

    it('calls onClick with label when clicked', () => {
      const pattern = { type: 'button' as const, position: { row: 0, col: 0 }, content: '[B] Task', label: 'B', text: 'Task' };
      const onClick = vi.fn();
      render(<PatternButton pattern={pattern} onClick={onClick} />);
      screen.getByRole('button').click();
      expect(onClick).toHaveBeenCalledWith('B');
    });
  });

  describe('PatternTable', () => {
    it('renders headers', () => {
      const pattern = { type: 'table' as const, position: { row: 0, col: 0 }, content: '', headers: ['Name', 'Status'], rows: [] };
      render(<PatternTable pattern={pattern} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('renders rows with labels', () => {
      const pattern = {
        type: 'table' as const,
        position: { row: 0, col: 0 },
        content: '',
        headers: ['Name'],
        rows: [{ type: 'table-row' as const, position: { row: 1, col: 0 }, content: '', cells: ['App 1'], label: 'A' }],
      };
      render(<PatternTable pattern={pattern} />);
      expect(screen.getByText('[A] App 1')).toBeInTheDocument();
    });
  });

  describe('PatternCard', () => {
    it('renders with title', () => {
      const pattern = { type: 'container' as const, position: { row: 0, col: 0 }, content: '', title: 'My Card', children: [], borderStyle: 'single' as const };
      render(<PatternCard pattern={pattern} />);
      expect(screen.getByText('My Card')).toBeInTheDocument();
    });

    it('renders children', () => {
      const pattern = { type: 'container' as const, position: { row: 0, col: 0 }, content: '', children: [], borderStyle: 'single' as const };
      render(<PatternCard pattern={pattern}><span>Child content</span></PatternCard>);
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });
  });
});
