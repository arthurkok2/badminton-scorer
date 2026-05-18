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

  it('returns empty stats for no matches', () => {
    const summary = buildStatsSummary([]);
    expect(summary.ratedMatchCount).toBe(0);
    expect(Object.keys(summary.players)).toHaveLength(0);
    expect(Object.keys(summary.pairs)).toHaveLength(0);
    expect(Object.keys(summary.matchups)).toHaveLength(0);
  });

  it('tracks a single win correctly', () => {
    const summary = buildStatsSummary([makeMatch({ id: 'm1', winnerTeam: 'teamA' })]);
    expect(summary.players.alice.wins).toBe(1);
    expect(summary.players.alice.losses).toBe(0);
    expect(summary.players.alice.recentForm).toEqual(['W']);
  });

  it('caps recentForm at 5 most recent entries', () => {
    const matches = [
      makeMatch({ id: 'm1', winnerTeam: 'teamA' }),
      makeMatch({ id: 'm2', winnerTeam: 'teamB' }),
      makeMatch({ id: 'm3', winnerTeam: 'teamA' }),
      makeMatch({ id: 'm4', winnerTeam: 'teamB' }),
      makeMatch({ id: 'm5', winnerTeam: 'teamA' }),
      makeMatch({ id: 'm6', winnerTeam: 'teamB' }),
    ];
    const summary = buildStatsSummary(matches);
    expect(summary.players.alice.recentForm).toHaveLength(5);
    expect(summary.players.alice.recentForm).toEqual(['L', 'W', 'L', 'W', 'L']);
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
