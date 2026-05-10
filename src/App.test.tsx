import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const STORAGE_KEY = 'badminton-score-preferences';

describe('App', () => {
  const speak = vi.fn();
  const cancel = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    speak.mockClear();
    cancel.mockClear();

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class SpeechSynthesisUtterance {
        text: string;

        constructor(text: string) {
          this.text = text;
        }
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awards a point to the serving team and keeps the serving player visible', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /point for serving team/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.getByText(/serving: Team A/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 1/i)).toBeInTheDocument();
  });

  it('awards a point to the receiving team and changes server', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /point for receiving team/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('1');
    expect(screen.getByText(/serving: Team B/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 4/i)).toBeInTheDocument();
  });

  it('undo restores the previous score', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /point for serving team/i }));
    await user.click(screen.getByRole('button', { name: /undo last point/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.getByText(/serving: Team A/i)).toBeInTheDocument();
  });

  it('shows Bluetooth unsupported fallback and disables connect', () => {
    render(<App />);

    expect(screen.getByText(/android chrome required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect bluetooth remote/i })).toBeDisabled();
  });

  it('persists auto announce and speaks only after scoring when enabled', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /point for serving team/i }));
    expect(speak).not.toHaveBeenCalled();

    await user.click(screen.getByRole('switch', { name: /auto announce/i }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ autoAnnounce: true });

    await user.click(screen.getByRole('button', { name: /point for serving team/i }));

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toMatchObject({ text: expect.stringMatching(/Team A serving, Player 1, 2-0/i) });
  });
});
