import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { HistoryStatsModal } from './HistoryStatsModal';

it('renders sessions, players, pairs, and matchups tabs', () => {
  render(<HistoryStatsModal sessions={[]} players={[]} pairs={[]} matchups={[]} globalMatches={[]} onClose={vi.fn()} />);

  expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /sessions/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /players/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /pairs/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /global matches/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /matchups/i })).toBeInTheDocument();
});

it('switches to player leaderboard', async () => {
  render(<HistoryStatsModal
    sessions={[]}
    players={[{ id: 'alice', displayName: 'Alice', elo: 1516, matchesPlayed: 1, winRate: 1, recentForm: ['W'] }]}
    pairs={[]}
    matchups={[]}
    globalMatches={[]}
    onClose={vi.fn()}
  />);

  await userEvent.click(screen.getByRole('tab', { name: /players/i }));

  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('1516')).toBeInTheDocument();
});

it('shows global match history', async () => {
  render(<HistoryStatsModal
    sessions={[]}
    players={[]}
    pairs={[]}
    matchups={[]}
    globalMatches={[{
      id: 'match-1',
      startedAt: '2026-05-20T01:41:11.342Z',
      endedAt: '2026-05-20T01:41:43.908Z',
      teamA: ['Arthur', 'Margaret'],
      teamB: ['Steve', 'Mannissa'],
      winnerTeam: 'teamB',
      finalScore: { teamA: 3, teamB: 21 },
      submittedBy: 'uid-1',
    }]}
    onClose={vi.fn()}
  />);

  await userEvent.click(screen.getByRole('tab', { name: /global matches/i }));

  expect(screen.getByText(/Arthur & Margaret/i)).toBeInTheDocument();
  expect(screen.getByText(/Steve & Mannissa/i)).toBeInTheDocument();
  expect(screen.getByText('3-21')).toBeInTheDocument();
});

it('shows personal stats from the user summary', async () => {
  render(<HistoryStatsModal
    sessions={[]}
    players={[]}
    pairs={[]}
    matchups={[]}
    globalMatches={[]}
    personalStats={{
      players: {
        alice: { displayName: 'Alice', matchesPlayed: 4, wins: 3, losses: 1, winRate: 0.75, recentForm: ['W', 'W', 'L', 'W'] },
      },
      pairs: {
        alice__bob: { displayNames: ['Alice', 'Bob'], matchesPlayed: 2, wins: 2, losses: 0, winRate: 1 },
      },
      matchups: {},
      ratedMatchCount: 4,
      statsVersion: 1,
    }}
    onClose={vi.fn()}
  />);

  await userEvent.click(screen.getByRole('tab', { name: /my stats/i }));

  expect(screen.getByText(/Rated matches/i)).toBeInTheDocument();
  expect(screen.getByText('4')).toBeInTheDocument();
  expect(screen.getByText(/Alice/)).toBeInTheDocument();
  expect(screen.getByText(/3W \/ 1L/)).toBeInTheDocument();
});
