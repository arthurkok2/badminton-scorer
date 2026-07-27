import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpinningShuttle } from './SpinningShuttle';

const playerNames = { A1: 'Alice', A2: 'Bob', B1: 'Charlie', B2: 'Diana' };

describe('SpinningShuttle', () => {
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onComplete = vi.fn();
  });

  it('renders the overlay with team names and prompt', () => {
    render(<SpinningShuttle playerNames={playerNames} onComplete={onComplete} />);

    expect(screen.getByRole('dialog', { name: /spin shuttle/i })).toBeInTheDocument();
    expect(screen.getByText(/tap the shuttle to toss/i)).toBeInTheDocument();
    expect(screen.getByText(/team a alice/i)).toBeInTheDocument();
    expect(screen.getByText(/team b charlie/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tap to spin/i })).toBeInTheDocument();
  });

  it('transitions to spinning on click', () => {
    render(<SpinningShuttle playerNames={playerNames} onComplete={onComplete} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);

    expect(screen.getByText(/spinning/i)).toBeInTheDocument();
  });

  it('calls onComplete with a teamId after spin settles', async () => {
    vi.useFakeTimers();
    render(<SpinningShuttle playerNames={playerNames} onComplete={onComplete} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);

    fireEvent.transitionEnd(shuttle);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/serves first!/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const teamId = onComplete.mock.calls[0][0];
    expect(['teamA', 'teamB']).toContain(teamId);

    vi.useRealTimers();
  });

  it('does not spin again when clicked during spinning', () => {
    render(<SpinningShuttle playerNames={playerNames} onComplete={onComplete} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);
    fireEvent.click(shuttle);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('produces both outcomes over many spins', () => {
    vi.useFakeTimers();
    const outcomes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      render(
        <SpinningShuttle
          playerNames={{ A1: 'A', A2: 'AA', B1: 'B', B2: 'BB' }}
          onComplete={vi.fn()}
        />,
      );

      const shuttle = screen.getByRole('button', { name: /tap to spin/i });
      fireEvent.click(shuttle);
      fireEvent.transitionEnd(shuttle);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const prompt = screen.getByText(/serves first!/i);
      if (prompt.textContent?.includes('Team A')) outcomes.add('teamA');
      if (prompt.textContent?.includes('Team B')) outcomes.add('teamB');

      cleanup();
    }

    vi.useRealTimers();

    expect(outcomes.has('teamA')).toBe(true);
    expect(outcomes.has('teamB')).toBe(true);
  });
});
