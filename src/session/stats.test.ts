import { describe, expect, it } from 'vitest';
import { buildStatsSummary } from './stats';
import type { MatchRecord } from './sessionTypes';

describe('stats aggregation', () => {
  it('aggregates player, pair, opponent, and recent-form stats', () => {
    const matches: MatchRecord[] = [
      makeMatch({ id: 'm1', winnerTeam: 'teamA' }),
      makeMatch({ id: 'm2', winnerTeam: 'teamB' }),
    ];

    const summary = buildStatsSummary(matches);

    expect(summary.ratedMatchCount).toBe(2);
    expect(summary.players.alice.matchesPlayed).toBe(2);
    expect(summary.players.alice.wins).toBe(1);
    expect(summary.players.alice.losses).toBe(1);
    expect(summary.players.alice.recentForm).toEqual(['W', 'L']);
    expect(summary.pairs.alice__bob.matchesPlayed).toBe(2);
    expect(summary.pairs.alice__bob.wins).toBe(1);
    expect(summary.matchups['alice__vs__carol'].matchesPlayed).toBe(2);
  });
});

function makeMatch(overrides: { id: string; winnerTeam: 'teamA' | 'teamB' }): MatchRecord {
  return {
    id: overrides.id,
    sessionId: 'session-1',
    matchNumber: overrides.id === 'm1' ? 1 : 2,
    teamAPlayerIds: ['alice', 'bob'],
    teamBPlayerIds: ['carol', 'dave'],
    teamADisplayNames: ['Alice', 'Bob'],
    teamBDisplayNames: ['Carol', 'Dave'],
    teamAPairId: 'alice__bob',
    teamBPairId: 'carol__dave',
    winnerTeam: overrides.winnerTeam,
  };
}
