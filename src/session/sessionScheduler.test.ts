// src/session/sessionScheduler.test.ts
import { createSession, selectNextPlayers, rankSplitsForPlayers } from './sessionScheduler';
import type { PairingMatrix, SessionPlayer } from './sessionTypes';

const emptyMatrix: PairingMatrix = { together: {}, against: {} };

describe('createSession', () => {
  it('creates a session with all players set to onBreak', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);

    expect(session.players).toHaveLength(5);
    expect(session.players.map(p => p.name)).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    expect(session.players.every(p => p.onBreak)).toBe(true);
    expect(session.players.every(p => p.gamesPlayed === 0)).toBe(true);
    expect(session.matches).toHaveLength(0);
    expect(session.pairingMatrix).toEqual({ together: {}, against: {} });
  });
});

describe('selectNextPlayers', () => {
  it('selects all players when there are exactly 4', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
      { name: 'Bob', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
      { name: 'Carol', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
      { name: 'Dave', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
    ];

    const { selected, onBreak } = selectNextPlayers(players);

    expect(selected).toHaveLength(4);
    expect(onBreak).toHaveLength(0);
    expect(selected).toContain('Alice');
  });

  it('always brings players on break on first', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Bob', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Carol', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Dave', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Eve', gamesPlayed: 2, consecutiveStreak: 0, onBreak: true },
    ];

    const { selected, onBreak } = selectNextPlayers(players);

    expect(selected).toContain('Eve');
    expect(onBreak).not.toContain('Eve');
  });

  it('sits out the on-court player with the longest consecutive streak', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 4, consecutiveStreak: 4, onBreak: false },
      { name: 'Bob', gamesPlayed: 3, consecutiveStreak: 1, onBreak: false },
      { name: 'Carol', gamesPlayed: 3, consecutiveStreak: 1, onBreak: false },
      { name: 'Dave', gamesPlayed: 3, consecutiveStreak: 1, onBreak: false },
      { name: 'Eve', gamesPlayed: 2, consecutiveStreak: 0, onBreak: true },
    ];

    const { selected, onBreak } = selectNextPlayers(players);

    expect(selected).toContain('Eve');
    expect(onBreak).toContain('Alice');
    expect(selected).not.toContain('Alice');
  });

  it('prefers break player with fewer games when multiple on-break players exceed the 4-slot limit', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 5, consecutiveStreak: 0, onBreak: true },
      { name: 'Bob', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
      { name: 'Carol', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
      { name: 'Dave', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
      { name: 'Eve', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
    ];

    const { onBreak } = selectNextPlayers(players);

    expect(onBreak).toContain('Alice');
    expect(onBreak).toHaveLength(1);
  });
});

describe('rankSplitsForPlayers', () => {
  it('returns exactly 3 splits covering all 4 players', () => {
    const splits = rankSplitsForPlayers(['Alice', 'Bob', 'Carol', 'Dave'], emptyMatrix);

    expect(splits).toHaveLength(3);
    for (const split of splits) {
      const names = [...split.teamA, ...split.teamB].sort();
      expect(names).toEqual(['Alice', 'Bob', 'Carol', 'Dave'].sort());
    }
  });

  it('ranks the split with fewer partner repeats first', () => {
    const matrix: PairingMatrix = {
      together: {
        Alice: { Bob: 3 },
        Bob: { Alice: 3 },
      },
      against: {},
    };

    const splits = rankSplitsForPlayers(['Alice', 'Bob', 'Carol', 'Dave'], matrix);

    // Best split should not pair Alice with Bob (3 repeats together)
    const [a1, a2] = splits[0].teamA;
    const [b1, b2] = splits[0].teamB;
    expect([a1, a2]).not.toEqual(expect.arrayContaining(['Alice', 'Bob']));
    expect([b1, b2]).not.toEqual(expect.arrayContaining(['Alice', 'Bob']));
  });
});
