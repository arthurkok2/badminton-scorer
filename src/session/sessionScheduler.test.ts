// src/session/sessionScheduler.test.ts
import { createSession, createLegacySessionFromPlayerNames, selectNextPlayers, rankSplitsForPlayers, generateMatchSuggestion, applyMatchResult, archiveSession } from './sessionScheduler';
import type { GlobalPlayer, GlobalSessionPlayer, PairingMatrix, TeamSplit } from './sessionTypes';

function makeGlobalPlayer(id: string, displayName: string): GlobalPlayer {
  return {
    id,
    displayName,
    searchName: displayName.toLowerCase(),
    createdBy: 'uid-1',
    claimStatus: 'guest' as const,
    globalIndividualElo: 1500,
    globalMatchCount: 0,
    statsVersion: 1,
  };
}

const globalPlayers = [
  makeGlobalPlayer('player-alice', 'Alice'),
  makeGlobalPlayer('player-bob', 'Bob'),
  makeGlobalPlayer('player-carol', 'Carol'),
  makeGlobalPlayer('player-dave', 'Dave'),
  makeGlobalPlayer('player-eve', 'Eve'),
] as const;

const [alice, bob, carol, dave, eve] = globalPlayers;
const emptyMatrix: PairingMatrix = { together: {}, against: {} };

function sessionPlayer(
  player: GlobalPlayer,
  overrides: Partial<Omit<GlobalSessionPlayer, 'id' | 'displayName'>> = {},
): GlobalSessionPlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    gamesPlayed: 0,
    ...overrides,
  };
}

function splitFor(
  a1: GlobalSessionPlayer,
  a2: GlobalSessionPlayer,
  b1: GlobalSessionPlayer,
  b2: GlobalSessionPlayer,
): TeamSplit {
  return { teamA: [a1, a2], teamB: [b1, b2] };
}

describe('createSession', () => {
  it('creates a session with global session players on zero games', () => {
    const session = createSession(globalPlayers);

    expect(session.players).toHaveLength(5);
    expect(session.players.map(p => p.id)).toEqual(['player-alice', 'player-bob', 'player-carol', 'player-dave', 'player-eve']);
    expect(session.players.map(p => p.displayName)).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    expect(session.players.every(p => p.gamesPlayed === 0)).toBe(true);
    expect(session.matches).toHaveLength(0);
    expect(session.pairingMatrix).toEqual({ together: {}, against: {} });
  });
});

describe('selectNextPlayers', () => {
  it('selects all players when there are exactly 4', () => {
    const players: GlobalSessionPlayer[] = [
      sessionPlayer(alice, { gamesPlayed: 2 }),
      sessionPlayer(bob, { gamesPlayed: 2 }),
      sessionPlayer(carol, { gamesPlayed: 2 }),
      sessionPlayer(dave, { gamesPlayed: 2 }),
    ];

    const { selected, onBreak } = selectNextPlayers(players, emptyMatrix);

    expect(selected).toHaveLength(4);
    expect(onBreak).toHaveLength(0);
    expect(selected.map(player => player.id)).toContain('player-alice');
  });

  it('always plays the players owed court time', () => {
    const players: GlobalSessionPlayer[] = [
      sessionPlayer(alice, { gamesPlayed: 3 }),
      sessionPlayer(bob, { gamesPlayed: 3 }),
      sessionPlayer(carol, { gamesPlayed: 3 }),
      sessionPlayer(dave, { gamesPlayed: 3 }),
      sessionPlayer(eve, { gamesPlayed: 2 }),
    ];

    const { selected, onBreak } = selectNextPlayers(players, emptyMatrix);

    expect(selected.map(player => player.id)).toContain('player-eve');
    expect(onBreak.map(player => player.id)).not.toContain('player-eve');
  });

  it('sits out the player with the most games played', () => {
    const players: GlobalSessionPlayer[] = [
      sessionPlayer(alice, { gamesPlayed: 5 }),
      sessionPlayer(bob, { gamesPlayed: 3 }),
      sessionPlayer(carol, { gamesPlayed: 3 }),
      sessionPlayer(dave, { gamesPlayed: 3 }),
      sessionPlayer(eve, { gamesPlayed: 3 }),
    ];

    const { selected, onBreak } = selectNextPlayers(players, emptyMatrix);

    expect(onBreak.map(player => player.id)).toEqual(['player-alice']);
    expect(selected.map(player => player.id)).not.toContain('player-alice');
  });

  it('picks the foursome that has shared a court least when games played are level', () => {
    // Alice has been on court with everyone twice, so every foursome containing her costs 6
    // while the one without her costs 0.
    const aliceWithEveryone: PairingMatrix = {
      together: {
        'player-alice': { 'player-bob': 2, 'player-carol': 2, 'player-dave': 2, 'player-eve': 2 },
        'player-bob': { 'player-alice': 2 },
        'player-carol': { 'player-alice': 2 },
        'player-dave': { 'player-alice': 2 },
        'player-eve': { 'player-alice': 2 },
      },
      against: {},
    };
    const players: GlobalSessionPlayer[] = [
      sessionPlayer(alice, { gamesPlayed: 2 }),
      sessionPlayer(bob, { gamesPlayed: 2 }),
      sessionPlayer(carol, { gamesPlayed: 2 }),
      sessionPlayer(dave, { gamesPlayed: 2 }),
      sessionPlayer(eve, { gamesPlayed: 2 }),
    ];

    for (let i = 0; i < 20; i++) {
      const { selected, onBreak } = selectNextPlayers(players, aliceWithEveryone);

      expect(selected.map(player => player.id).sort()).toEqual([
        'player-bob',
        'player-carol',
        'player-dave',
        'player-eve',
      ]);
      expect(onBreak.map(player => player.id)).toEqual(['player-alice']);
    }
  });

  it('keeps court time ahead of variety when a player is owed a game', () => {
    const eveWithEveryone: PairingMatrix = {
      together: {
        'player-eve': { 'player-alice': 5, 'player-bob': 5, 'player-carol': 5, 'player-dave': 5 },
        'player-alice': { 'player-eve': 5 },
        'player-bob': { 'player-eve': 5 },
        'player-carol': { 'player-eve': 5 },
        'player-dave': { 'player-eve': 5 },
      },
      against: {},
    };
    const players: GlobalSessionPlayer[] = [
      sessionPlayer(alice, { gamesPlayed: 2 }),
      sessionPlayer(bob, { gamesPlayed: 2 }),
      sessionPlayer(carol, { gamesPlayed: 2 }),
      sessionPlayer(dave, { gamesPlayed: 2 }),
      sessionPlayer(eve, { gamesPlayed: 1 }),
    ];

    const { selected } = selectNextPlayers(players, eveWithEveryone);

    expect(selected.map(player => player.id)).toContain('player-eve');
  });
});

describe('rankSplitsForPlayers', () => {
  const fourPlayers = [
    sessionPlayer(alice),
    sessionPlayer(bob),
    sessionPlayer(carol),
    sessionPlayer(dave),
  ] as const;

  it('returns exactly 3 splits covering all 4 global players', () => {
    const splits = rankSplitsForPlayers(fourPlayers, emptyMatrix);

    expect(splits).toHaveLength(3);
    for (const split of splits) {
      const ids = [...split.teamA, ...split.teamB].map(player => player.id).sort();
      expect(ids).toEqual(['player-alice', 'player-bob', 'player-carol', 'player-dave'].sort());
    }
  });

  it('ranks the split with fewer partner repeats first using player ids', () => {
    const matrix: PairingMatrix = {
      together: {
        'player-alice': { 'player-bob': 3 },
        'player-bob': { 'player-alice': 3 },
      },
      against: {},
    };

    const splits = rankSplitsForPlayers(fourPlayers, matrix);

    const teamAIds = splits[0].teamA.map(player => player.id);
    const teamBIds = splits[0].teamB.map(player => player.id);
    expect(teamAIds).not.toEqual(expect.arrayContaining(['player-alice', 'player-bob']));
    expect(teamBIds).not.toEqual(expect.arrayContaining(['player-alice', 'player-bob']));
  });
});

describe('generateMatchSuggestion', () => {
  it('returns 3 ranked splits and the on-break list as global session players', () => {
    const session = createSession(globalPlayers);
    const suggestion = generateMatchSuggestion(session);

    expect(suggestion.rankedSplits).toHaveLength(3);
    expect(suggestion.onBreak).toHaveLength(1);
    expect(suggestion.onBreak[0]).toHaveProperty('displayName');
  });

  it('all players appear exactly once across splits and break', () => {
    const session = createSession(globalPlayers);
    const suggestion = generateMatchSuggestion(session);

    const playing = [...suggestion.rankedSplits[0].teamA, ...suggestion.rankedSplits[0].teamB];
    const all = [...playing, ...suggestion.onBreak].map(player => player.id).sort();
    expect(all).toEqual(['player-alice', 'player-bob', 'player-carol', 'player-dave', 'player-eve'].sort());
  });
});

describe('applyMatchResult', () => {
  it('increments gamesPlayed for players who played by id', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const next = applyMatchResult(session, split, 'teamA');

    const aliceRecord = next.players.find(p => p.id === 'player-alice')!;
    expect(aliceRecord.gamesPlayed).toBe(1);
  });

  it('leaves the player who sat out untouched', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const next = applyMatchResult(session, split, 'teamA');

    const eveRecord = next.players.find(p => p.id === 'player-eve')!;
    expect(eveRecord.gamesPlayed).toBe(0);
    expect(eveRecord).toEqual(session.players.find(p => p.id === 'player-eve'));
  });

  it('appends a global-aware match record to history', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const next = applyMatchResult(session, split, 'teamB');

    expect(next.matches).toHaveLength(1);
    expect(next.matches[0]).toEqual({
      id: expect.any(String),
      sessionId: session.id,
      matchNumber: 1,
      teamAPlayerIds: ['player-alice', 'player-bob'],
      teamBPlayerIds: ['player-carol', 'player-dave'],
      teamADisplayNames: ['Alice', 'Bob'],
      teamBDisplayNames: ['Carol', 'Dave'],
      teamAPairId: 'player-alice__player-bob',
      teamBPairId: 'player-carol__player-dave',
      winnerTeam: 'teamB',
    });
  });

  it('stores optional match timing metadata in history', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const next = applyMatchResult(session, split, 'teamB', {
      startedAt: '2026-05-17T10:00:00.000Z',
      endedAt: '2026-05-17T10:14:30.000Z',
      globalMatchId: 'global-match-1',
    });

    expect(next.matches[0]).toMatchObject({
      teamAPlayerIds: ['player-alice', 'player-bob'],
      teamBPlayerIds: ['player-carol', 'player-dave'],
      winnerTeam: 'teamB',
      startedAt: '2026-05-17T10:00:00.000Z',
      endedAt: '2026-05-17T10:14:30.000Z',
      globalMatchId: 'global-match-1',
    });
  });

  it('stores optional final score metadata in history', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const next = applyMatchResult(session, split, 'teamA', {
      finalScore: { teamA: 21, teamB: 18 },
    });

    expect(next.matches[0]).toMatchObject({
      teamAPlayerIds: ['player-alice', 'player-bob'],
      teamBPlayerIds: ['player-carol', 'player-dave'],
      winnerTeam: 'teamA',
      finalScore: { teamA: 21, teamB: 18 },
    });
  });

  it('increments partner together count symmetrically by player id', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const next = applyMatchResult(session, split, 'teamA');

    expect(next.pairingMatrix.together['player-alice']?.['player-bob']).toBe(1);
    expect(next.pairingMatrix.together['player-bob']?.['player-alice']).toBe(1);
    expect(next.pairingMatrix.together['player-carol']?.['player-dave']).toBe(1);
  });

  it('accumulates pairing matrix counts across two consecutive matches', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const after1 = applyMatchResult(session, split, 'teamA');
    // Use the updated player records for the second match so gamesPlayed is correct,
    // but keep the same pairing (alice+bob vs carol+dave) to verify count accumulation.
    const split2 = splitFor(after1.players[0], after1.players[1], after1.players[2], after1.players[3]);
    const after2 = applyMatchResult(after1, split2, 'teamA');

    expect(after2.pairingMatrix.together['player-alice']?.['player-bob']).toBe(2);
    expect(after2.pairingMatrix.together['player-bob']?.['player-alice']).toBe(2);
    expect(after2.pairingMatrix.against['player-alice']?.['player-carol']).toBe(2);
  });

  it('increments against count for all cross-team pairs by player id', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);

    const next = applyMatchResult(session, split, 'teamA');

    expect(next.pairingMatrix.against['player-alice']?.['player-carol']).toBe(1);
    expect(next.pairingMatrix.against['player-alice']?.['player-dave']).toBe(1);
    expect(next.pairingMatrix.against['player-bob']?.['player-carol']).toBe(1);
    expect(next.pairingMatrix.against['player-bob']?.['player-dave']).toBe(1);
  });
});

describe('archiveSession', () => {
  it('preserves player ids and display names in player summaries and matches', () => {
    const session = createSession(globalPlayers);
    const split = splitFor(session.players[0], session.players[1], session.players[2], session.players[3]);
    const after = applyMatchResult(session, split, 'teamA');

    const archive = archiveSession(after, '2026-05-11T10:00:00.000Z');

    const aliceRecord = archive.players.find(p => p.id === 'player-alice')!;
    expect(aliceRecord.displayName).toBe('Alice');
    expect(aliceRecord.gamesPlayed).toBe(1);
    expect(aliceRecord.breaksTaken).toBe(0);

    const eveRecord = archive.players.find(p => p.id === 'player-eve')!;
    expect(eveRecord.displayName).toBe('Eve');
    expect(eveRecord.gamesPlayed).toBe(0);
    expect(eveRecord.breaksTaken).toBe(1);

    expect(archive.endedAt).toBe('2026-05-11T10:00:00.000Z');
    expect(archive.matches[0]).toHaveProperty('teamADisplayNames', ['Alice', 'Bob']);
  });
});

// A perfectly balanced matrix: every pair has played together once and against each other twice.
// All three possible splits for [Alice, Bob, Carol, Dave] score identically (12 each).
const balancedMatrix: PairingMatrix = {
  together: {
    'player-alice': { 'player-bob': 1, 'player-carol': 1, 'player-dave': 1 },
    'player-bob': { 'player-alice': 1, 'player-carol': 1, 'player-dave': 1 },
    'player-carol': { 'player-alice': 1, 'player-bob': 1, 'player-dave': 1 },
    'player-dave': { 'player-alice': 1, 'player-bob': 1, 'player-carol': 1 },
  },
  against: {
    'player-alice': { 'player-bob': 2, 'player-carol': 2, 'player-dave': 2 },
    'player-bob': { 'player-alice': 2, 'player-carol': 2, 'player-dave': 2 },
    'player-carol': { 'player-alice': 2, 'player-bob': 2, 'player-dave': 2 },
    'player-dave': { 'player-alice': 2, 'player-bob': 2, 'player-carol': 2 },
  },
};

describe('rankSplitsForPlayers tie-breaking', () => {
  const fourPlayers = [
    sessionPlayer(alice),
    sessionPlayer(bob),
    sessionPlayer(carol),
    sessionPlayer(dave),
  ] as const;

  it('returns all 3 possible splits as top-ranked across repeated calls with a balanced matrix', () => {
    const seenTopSplits = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const [top] = rankSplitsForPlayers(fourPlayers, balancedMatrix);
      seenTopSplits.add(JSON.stringify([...top.teamA, ...top.teamB].map(player => player.id)));
    }

    // All 3 distinct splits must appear; a deterministic sort would always return the same one.
    expect(seenTopSplits.size).toBe(3);
  });

  it('still ranks the split with fewer partner repeats first when scores differ', () => {
    const matrix: PairingMatrix = {
      together: { 'player-alice': { 'player-bob': 3 }, 'player-bob': { 'player-alice': 3 } },
      against: {},
    };
    const splits = rankSplitsForPlayers(fourPlayers, matrix);

    const teamAIds = splits[0].teamA.map(player => player.id);
    const teamBIds = splits[0].teamB.map(player => player.id);
    expect(teamAIds).not.toEqual(expect.arrayContaining(['player-alice', 'player-bob']));
    expect(teamBIds).not.toEqual(expect.arrayContaining(['player-alice', 'player-bob']));
  });
});

describe('selectNextPlayers tie-breaking', () => {
  it('varies which player sits out when all players have equal gamesPlayed and no shared history', () => {
    const equalPlayers: GlobalSessionPlayer[] = [
      sessionPlayer(alice, { gamesPlayed: 4 }),
      sessionPlayer(bob, { gamesPlayed: 4 }),
      sessionPlayer(carol, { gamesPlayed: 4 }),
      sessionPlayer(dave, { gamesPlayed: 4 }),
      sessionPlayer(eve, { gamesPlayed: 4 }),
    ];

    const sittingOut = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { onBreak } = selectNextPlayers(equalPlayers, emptyMatrix);
      for (const player of onBreak) sittingOut.add(player.id);
    }

    // Every player should sit out at least once; a stable sort would always bench the same player.
    expect(sittingOut.size).toBe(5);
  });
});

describe('full-rotation cycle', () => {
  it('does not repeat the exact same team splits after one complete sit-out rotation', () => {
    const balanced: PairingMatrix = {
      together: {
        'player-alice': { 'player-bob': 1, 'player-carol': 1, 'player-dave': 1 },
        'player-bob': { 'player-alice': 1, 'player-carol': 1, 'player-dave': 1 },
        'player-carol': { 'player-alice': 1, 'player-bob': 1, 'player-dave': 1 },
        'player-dave': { 'player-alice': 1, 'player-bob': 1, 'player-carol': 1 },
      },
      against: {
        'player-alice': { 'player-bob': 1, 'player-carol': 1, 'player-dave': 1 },
        'player-bob': { 'player-alice': 1, 'player-carol': 1, 'player-dave': 1 },
        'player-carol': { 'player-alice': 1, 'player-bob': 1, 'player-dave': 1 },
        'player-dave': { 'player-alice': 1, 'player-bob': 1, 'player-carol': 1 },
      },
    };

    const players = [
      sessionPlayer(alice),
      sessionPlayer(bob),
      sessionPlayer(carol),
      sessionPlayer(dave),
    ] as const;
    const seenSplits = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const [top] = rankSplitsForPlayers(players, balanced);
      seenSplits.add(JSON.stringify([...top.teamA, ...top.teamB].map(player => player.id)));
    }
    expect(seenSplits.size).toBeGreaterThan(1);
  });
});

describe('rotation diversity', () => {
  function playSession(playerCount: number, matches: number) {
    const roster = Array.from({ length: playerCount }, (_, i) => String.fromCharCode(65 + i));
    let session = createLegacySessionFromPlayerNames(roster);
    const foursomes = new Set<string>();
    const sharedCourt = new Set<string>();

    for (let match = 0; match < matches; match++) {
      const [split] = generateMatchSuggestion(session).rankedSplits;
      const four = [...split.teamA, ...split.teamB];
      foursomes.add(four.map(player => player.displayName).sort().join(''));
      for (let i = 0; i < four.length; i++) {
        for (let j = i + 1; j < four.length; j++) {
          sharedCourt.add([four[i].displayName, four[j].displayName].sort().join('-'));
        }
      }
      session = applyMatchResult(session, split, 'teamA');
    }

    const gamesPlayed = session.players.map(player => player.gamesPlayed);
    return { foursomes, sharedCourt, courtTimeSpread: Math.max(...gamesPlayed) - Math.min(...gamesPlayed) };
  }

  it('does not lock 8 players into two groups that only play each other', () => {
    // Rotating by who sat out last alternated between exactly 2 foursomes forever,
    // leaving 16 of the 28 possible pairs never sharing a court.
    const { foursomes, sharedCourt } = playSession(8, 24);

    expect(foursomes.size).toBeGreaterThanOrEqual(12);
    expect(sharedCourt.size).toBe(28);
  });

  it('does not lock 6 players into fixed sit-out duos', () => {
    // Rotating by who sat out last produced only 3 of the 15 possible foursomes.
    const { foursomes } = playSession(6, 24);

    expect(foursomes.size).toBeGreaterThanOrEqual(12);
  });

  it('keeps court time within one game for every roster size', () => {
    for (const playerCount of [4, 5, 6, 7, 8]) {
      expect(playSession(playerCount, 24).courtTimeSpread).toBeLessThanOrEqual(1);
    }
  });
});
