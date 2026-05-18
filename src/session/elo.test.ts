import { describe, expect, it } from 'vitest';
import {
  INITIAL_ELO,
  calculateIndividualEloUpdate,
  calculatePairEloUpdate,
  expectedScore,
  kFactorForMatches,
} from './elo';

describe('elo', () => {
  it('returns 0.5 expected score for equal ratings', () => {
    expect(expectedScore(INITIAL_ELO, INITIAL_ELO)).toBeCloseTo(0.5, 5);
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
        { id: 'alice', rating: INITIAL_ELO, matchCount: 0 },
        { id: 'bob', rating: INITIAL_ELO, matchCount: 0 },
      ],
      teamB: [
        { id: 'carol', rating: INITIAL_ELO, matchCount: 0 },
        { id: 'dave', rating: INITIAL_ELO, matchCount: 0 },
      ],
      winnerTeam: 'teamA',
    });

    expect(update.alice.delta).toBe(16);
    expect(update.bob.delta).toBe(16);
    expect(update.carol.delta).toBe(-16);
    expect(update.dave.delta).toBe(-16);
  });

  it('averages asymmetric teammate ratings and mixed teammate K factors', () => {
    const update = calculateIndividualEloUpdate({
      teamA: [
        { id: 'alice', rating: 1600, matchCount: 0 },
        { id: 'bob', rating: 1400, matchCount: 10 },
      ],
      teamB: [
        { id: 'carol', rating: 1450, matchCount: 10 },
        { id: 'dave', rating: 1350, matchCount: 10 },
      ],
      winnerTeam: 'teamB',
    });

    expect(update.alice).toEqual({ before: 1600, after: 1582, delta: -18 });
    expect(update.bob).toEqual({ before: 1400, after: 1382, delta: -18 });
    expect(update.carol).toEqual({ before: 1450, after: 1465, delta: 15 });
    expect(update.dave).toEqual({ before: 1350, after: 1365, delta: 15 });
  });

  it('throws when individual Elo subjects contain duplicate player ids', () => {
    expect(() =>
      calculateIndividualEloUpdate({
        teamA: [
          { id: 'alice', rating: INITIAL_ELO, matchCount: 0 },
          { id: 'bob', rating: INITIAL_ELO, matchCount: 0 },
        ],
        teamB: [
          { id: 'alice', rating: INITIAL_ELO, matchCount: 0 },
          { id: 'dave', rating: INITIAL_ELO, matchCount: 0 },
        ],
        winnerTeam: 'teamA',
      }),
    ).toThrow('Individual Elo update requires four unique player ids.');
  });

  it('updates pair Elo separately', () => {
    const update = calculatePairEloUpdate({
      teamAPair: { id: 'alice__bob', rating: INITIAL_ELO, matchCount: 10 },
      teamBPair: { id: 'carol__dave', rating: INITIAL_ELO, matchCount: 10 },
      winnerTeam: 'teamB',
    });

    expect(update.alice__bob.delta).toBe(-12);
    expect(update.carol__dave.delta).toBe(12);
  });

  it('updates pair Elo from pair ratings and each pair K factor', () => {
    const update = calculatePairEloUpdate({
      teamAPair: { id: 'alice__bob', rating: 1600, matchCount: 0 },
      teamBPair: { id: 'carol__dave', rating: 1400, matchCount: 10 },
      winnerTeam: 'teamB',
    });

    expect(update.alice__bob).toEqual({ before: 1600, after: 1576, delta: -24 });
    expect(update.carol__dave).toEqual({ before: 1400, after: 1418, delta: 18 });
  });

  it('throws when pair Elo subjects use the same pair id', () => {
    expect(() =>
      calculatePairEloUpdate({
        teamAPair: { id: 'alice__bob', rating: INITIAL_ELO, matchCount: 0 },
        teamBPair: { id: 'alice__bob', rating: INITIAL_ELO, matchCount: 0 },
        winnerTeam: 'teamA',
      }),
    ).toThrow('Pair Elo update requires distinct pair ids.');
  });
});
