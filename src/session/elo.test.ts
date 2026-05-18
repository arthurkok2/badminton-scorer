import { describe, expect, it } from 'vitest';
import {
  calculateIndividualEloUpdate,
  calculatePairEloUpdate,
  expectedScore,
  kFactorForMatches,
} from './elo';

describe('elo', () => {
  it('returns 0.5 expected score for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it('gives underdogs a lower expected score against stronger opponents', () => {
    expect(expectedScore(1400, 1600)).toBeCloseTo(0.24025, 5);
  });

  it('uses provisional K below 10 matches', () => {
    expect(kFactorForMatches(0)).toBe(32);
    expect(kFactorForMatches(9)).toBe(32);
    expect(kFactorForMatches(10)).toBe(24);
  });

  it('updates both teammates equally from team-average ratings', () => {
    const update = calculateIndividualEloUpdate({
      teamA: [
        { id: 'alice', rating: 1500, matchCount: 0 },
        { id: 'bob', rating: 1500, matchCount: 0 },
      ],
      teamB: [
        { id: 'carol', rating: 1500, matchCount: 0 },
        { id: 'dave', rating: 1500, matchCount: 0 },
      ],
      winnerTeam: 'teamA',
    });

    expect(update.alice.delta).toBe(16);
    expect(update.bob.delta).toBe(16);
    expect(update.carol.delta).toBe(-16);
    expect(update.dave.delta).toBe(-16);
  });

  it('updates pair Elo separately', () => {
    const update = calculatePairEloUpdate({
      teamAPair: { id: 'alice__bob', rating: 1500, matchCount: 10 },
      teamBPair: { id: 'carol__dave', rating: 1500, matchCount: 10 },
      winnerTeam: 'teamB',
    });

    expect(update.alice__bob.delta).toBe(-12);
    expect(update.carol__dave.delta).toBe(12);
  });
});
