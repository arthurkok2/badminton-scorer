import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpinningShuttle } from './SpinningShuttle';

const playerNames = { A1: 'Alice', A2: 'Bob', B1: 'Charlie', B2: 'Diana' };

function createMockAnimation() {
  const anim = {
    onfinish: null as (() => void) | null,
    oncancel: null as (() => void) | null,
  };
  return anim;
}

function mockAnimate(mock: ReturnType<typeof createMockAnimation>) {
  const original = SVGSVGElement.prototype.animate;
  SVGSVGElement.prototype.animate = vi.fn(() => mock as unknown as Animation);
  return () => {
    SVGSVGElement.prototype.animate = original;
  };
}

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
    const anim = createMockAnimation();
    const restore = mockAnimate(anim);

    render(<SpinningShuttle playerNames={playerNames} onComplete={onComplete} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);

    expect(screen.getByText(/spinning/i)).toBeInTheDocument();

    restore();
  });

  it('calls onComplete with a teamId after spin settles', async () => {
    vi.useFakeTimers();
    const anim = createMockAnimation();
    const restore = mockAnimate(anim);

    render(<SpinningShuttle playerNames={playerNames} onComplete={onComplete} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);

    expect(screen.getByText(/spinning/i)).toBeInTheDocument();

    // Fire the onfinish callback
    act(() => {
      anim.onfinish?.();
    });

    // Advance rAFs for setShowResult
    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/serves first!/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const teamId = onComplete.mock.calls[0][0];
    expect(['teamA', 'teamB']).toContain(teamId);

    restore();
    vi.useRealTimers();
  });

  it('does not spin again when clicked during spinning', () => {
    const anim = createMockAnimation();
    const restore = mockAnimate(anim);

    render(<SpinningShuttle playerNames={playerNames} onComplete={onComplete} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);
    fireEvent.click(shuttle);

    expect(onComplete).not.toHaveBeenCalled();

    restore();
  });

  it('produces both outcomes over many spins', () => {
    vi.useFakeTimers();
    const outcomes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const anim = createMockAnimation();
      const restore = mockAnimate(anim);

      render(
        <SpinningShuttle
          playerNames={{ A1: 'A', A2: 'AA', B1: 'B', B2: 'BB' }}
          onComplete={vi.fn()}
        />,
      );

      const shuttle = screen.getByRole('button', { name: /tap to spin/i });
      fireEvent.click(shuttle);

      act(() => {
        anim.onfinish?.();
      });

      act(() => {
        vi.advanceTimersToNextFrame();
        vi.advanceTimersToNextFrame();
        vi.advanceTimersByTime(500);
      });

      const prompt = screen.getByText(/serves first!/i);
      if (prompt.textContent?.includes('Team A')) outcomes.add('teamA');
      if (prompt.textContent?.includes('Team B')) outcomes.add('teamB');

      restore();
      cleanup();
    }

    vi.useRealTimers();

    expect(outcomes.has('teamA')).toBe(true);
    expect(outcomes.has('teamB')).toBe(true);
  });
});
