import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PoseCamera } from './PoseCamera';
import type { AppCommand } from '../input/commands';

vi.mock('../hooks/usePoseDetection', () => ({
  usePoseDetection: vi.fn(() => ({
    isSupported: true,
    isActive: false,
    error: null,
    stream: null,
    start: vi.fn(),
    stop: vi.fn(),
  })),
  drawSkeleton: vi.fn(),
}));

import { usePoseDetection } from '../hooks/usePoseDetection';

describe('PoseCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders toggle button when supported', () => {
    render(<PoseCamera onCommand={vi.fn()} />);
    const button = screen.getByRole('button', { name: /camera/i });
    expect(button).toBeInTheDocument();
  });

  it('does not render when not supported', () => {
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: false,
      isActive: false,
      error: null,
      stream: null,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls start when toggle is clicked while inactive', () => {
    const mockStart = vi.fn();
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: true,
      isActive: false,
      error: null,
      stream: null,
      start: mockStart,
      stop: vi.fn(),
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /camera/i }));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('calls stop when toggle is clicked while active', () => {
    const mockStop = vi.fn();
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: true,
      isActive: true,
      error: null,
      stream: null,
      start: vi.fn(),
      stop: mockStop,
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /camera/i }));
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('shows error message when error is set', () => {
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: true,
      isActive: false,
      error: 'Camera permission denied',
      stream: null,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    expect(screen.getByText('Camera permission denied')).toBeInTheDocument();
  });
});
