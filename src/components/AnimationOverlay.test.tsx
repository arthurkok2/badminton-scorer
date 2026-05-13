import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimationOverlay } from './AnimationOverlay';

describe('AnimationOverlay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders nothing when event is null', () => {
    const { container } = render(
      <AnimationOverlay event={null} onDismiss={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay when event is provided', () => {
    render(
      <AnimationOverlay
        event={{ type: 'match_won', teamId: 'teamA' }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows the correct label for match_won', () => {
    render(
      <AnimationOverlay
        event={{ type: 'match_won', teamId: 'teamA' }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('MATCH!')).toBeInTheDocument();
  });

  it('shows the correct label for deuce', () => {
    render(
      <AnimationOverlay
        event={{ type: 'deuce', teamId: 'teamB' }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('DEUCE')).toBeInTheDocument();
  });

  it('calls onDismiss after 2500ms', () => {
    const onDismiss = vi.fn();
    render(
      <AnimationOverlay
        event={{ type: 'streak_3', teamId: 'teamA' }}
        onDismiss={onDismiss}
      />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not call onDismiss before 2500ms', () => {
    const onDismiss = vi.fn();
    render(
      <AnimationOverlay
        event={{ type: 'comeback', teamId: 'teamB' }}
        onDismiss={onDismiss}
      />
    );
    act(() => { vi.advanceTimersByTime(2499); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('clears timer when event becomes null', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <AnimationOverlay
        event={{ type: 'streak_6', teamId: 'teamA' }}
        onDismiss={onDismiss}
      />
    );
    rerender(<AnimationOverlay event={null} onDismiss={onDismiss} />);
    act(() => { vi.advanceTimersByTime(2500); });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
