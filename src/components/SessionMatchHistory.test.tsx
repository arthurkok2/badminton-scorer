import { render, screen, within } from '@testing-library/react';
import { SessionMatchHistory } from './SessionMatchHistory';
import type { MatchRecord } from '../session/sessionTypes';

describe('SessionMatchHistory', () => {
  it('renders completed matches newest first with winner and duration', () => {
    const matches: MatchRecord[] = [
      {
        teamA: ['Alice', 'Bob'],
        teamB: ['Carol', 'Dave'],
        winnerTeam: 'teamA',
        finalScore: { teamA: 21, teamB: 18 },
        startedAt: '2026-05-17T10:00:00.000Z',
        endedAt: '2026-05-17T10:14:30.000Z',
      },
      {
        teamA: ['Alice', 'Carol'],
        teamB: ['Bob', 'Dave'],
        winnerTeam: 'teamB',
        finalScore: { teamA: 17, teamB: 21 },
        startedAt: '2026-05-17T10:20:00.000Z',
        endedAt: '2026-05-17T10:41:00.000Z',
      },
    ];

    render(<SessionMatchHistory matches={matches} />);

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText(/match 2/i)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/bob & dave won/i)).toBeInTheDocument();
    expect(within(rows[0]).getByText('17-21')).toBeInTheDocument();
    expect(within(rows[0]).getByText('21 min')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/match 1/i)).toBeInTheDocument();
    expect(within(rows[1]).getByText('21-18')).toBeInTheDocument();
    expect(within(rows[1]).getByText('15 min')).toBeInTheDocument();
  });

  it('renders legacy matches without duration timestamps', () => {
    render(
      <SessionMatchHistory
        matches={[
          {
            teamA: ['Alice', 'Bob'],
            teamB: ['Carol', 'Dave'],
            winnerTeam: 'teamA',
          },
        ]}
      />,
    );

    expect(screen.getByText(/duration unavailable/i)).toBeInTheDocument();
  });
});
