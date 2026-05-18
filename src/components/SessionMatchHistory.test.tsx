import { render, screen, within } from '@testing-library/react';
import { SessionMatchHistory } from './SessionMatchHistory';
import type { LegacyMatchRecord, MatchRecord } from '../session/sessionTypes';

describe('SessionMatchHistory', () => {
  it('renders global-aware completed matches newest first with winner and duration', () => {
    const matches: MatchRecord[] = [
      {
        id: 'match-1',
        sessionId: 'session-1',
        matchNumber: 1,
        teamAPlayerIds: ['player-alice', 'player-bob'],
        teamBPlayerIds: ['player-carol', 'player-dave'],
        teamADisplayNames: ['Alice', 'Bob'],
        teamBDisplayNames: ['Carol', 'Dave'],
        teamAPairId: 'player-alice__player-bob',
        teamBPairId: 'player-carol__player-dave',
        winnerTeam: 'teamA',
        finalScore: { teamA: 21, teamB: 18 },
        startedAt: '2026-05-17T10:00:00.000Z',
        endedAt: '2026-05-17T10:14:30.000Z',
      },
      {
        id: 'match-2',
        sessionId: 'session-1',
        matchNumber: 2,
        teamAPlayerIds: ['player-alice', 'player-carol'],
        teamBPlayerIds: ['player-bob', 'player-dave'],
        teamADisplayNames: ['Alice', 'Carol'],
        teamBDisplayNames: ['Bob', 'Dave'],
        teamAPairId: 'player-alice__player-carol',
        teamBPairId: 'player-bob__player-dave',
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

  it('falls back to legacy team names for imported local records without duration timestamps', () => {
    const legacyMatches: LegacyMatchRecord[] = [
      {
        teamA: ['Alice', 'Bob'],
        teamB: ['Carol', 'Dave'],
        winnerTeam: 'teamA',
      },
    ];

    render(<SessionMatchHistory matches={legacyMatches} />);

    expect(screen.getByText(/alice & bob won/i)).toBeInTheDocument();
    expect(screen.getByText(/duration unavailable/i)).toBeInTheDocument();
  });
});
