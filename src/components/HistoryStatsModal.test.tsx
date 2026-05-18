import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { HistoryStatsModal } from './HistoryStatsModal';

it('renders sessions, players, pairs, and matchups tabs', () => {
  render(<HistoryStatsModal sessions={[]} players={[]} pairs={[]} matchups={[]} onClose={vi.fn()} />);

  expect(screen.getByRole('tab', { name: /sessions/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /players/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /pairs/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /matchups/i })).toBeInTheDocument();
});

it('switches to player leaderboard', async () => {
  render(<HistoryStatsModal
    sessions={[]}
    players={[{ id: 'alice', displayName: 'Alice', elo: 1516, matchesPlayed: 1, winRate: 1, recentForm: ['W'] }]}
    pairs={[]}
    matchups={[]}
    onClose={vi.fn()}
  />);

  await userEvent.click(screen.getByRole('tab', { name: /players/i }));

  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('1516')).toBeInTheDocument();
});
