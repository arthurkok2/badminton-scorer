// src/session/sessionScheduler.test.ts
import { createSession, selectNextPlayers, rankSplitsForPlayers, generateMatchSuggestion, applyMatchResult, archiveSession } from './sessionScheduler';
import type { PairingMatrix, SessionPlayer, TeamSplit } from './sessionTypes';

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

describe('generateMatchSuggestion', () => {
  it('returns 3 ranked splits and the on-break list', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const suggestion = generateMatchSuggestion(session);

    expect(suggestion.rankedSplits).toHaveLength(3);
    expect(suggestion.onBreak).toHaveLength(1);
  });

  it('all players appear exactly once across splits and break', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const suggestion = generateMatchSuggestion(session);

    const playing = [...suggestion.rankedSplits[0].teamA, ...suggestion.rankedSplits[0].teamB];
    const all = [...playing, ...suggestion.onBreak].sort();
    expect(all).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'].sort());
  });
});

describe('applyMatchResult', () => {
  it('increments gamesPlayed and consecutiveStreak for players who played', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    const alice = next.players.find(p => p.name === 'Alice')!;
    expect(alice.gamesPlayed).toBe(1);
    expect(alice.consecutiveStreak).toBe(1);
    expect(alice.onBreak).toBe(false);
  });

  it('resets consecutiveStreak and sets onBreak for the player who sat out', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    const eve = next.players.find(p => p.name === 'Eve')!;
    expect(eve.consecutiveStreak).toBe(0);
    expect(eve.onBreak).toBe(true);
    expect(eve.gamesPlayed).toBe(0);
  });

  it('appends the match record to history', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamB');

    expect(next.matches).toHaveLength(1);
    expect(next.matches[0]).toEqual({ teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'], winnerTeam: 'teamB' });
  });

  it('increments partner together count symmetrically', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    expect(next.pairingMatrix.together['Alice']?.['Bob']).toBe(1);
    expect(next.pairingMatrix.together['Bob']?.['Alice']).toBe(1);
    expect(next.pairingMatrix.together['Carol']?.['Dave']).toBe(1);
  });

  it('increments against count for all cross-team pairs', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    expect(next.pairingMatrix.against['Alice']?.['Carol']).toBe(1);
    expect(next.pairingMatrix.against['Alice']?.['Dave']).toBe(1);
    expect(next.pairingMatrix.against['Bob']?.['Carol']).toBe(1);
    expect(next.pairingMatrix.against['Bob']?.['Dave']).toBe(1);
  });
});

describe('archiveSession', () => {
  it('produces correct player summaries', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };
    const after = applyMatchResult(session, split, 'teamA');

    const archive = archiveSession(after, '2026-05-11T10:00:00.000Z');

    const alice = archive.players.find(p => p.name === 'Alice')!;
    expect(alice.gamesPlayed).toBe(1);
    expect(alice.breaksTaken).toBe(0);

    const eve = archive.players.find(p => p.name === 'Eve')!;
    expect(eve.gamesPlayed).toBe(0);
    expect(eve.breaksTaken).toBe(1);

    expect(archive.endedAt).toBe('2026-05-11T10:00:00.000Z');
    expect(archive.matches).toHaveLength(1);
  });
});
