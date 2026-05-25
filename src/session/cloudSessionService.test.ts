import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((parent: unknown, path: string) => ({ kind: 'collection', parent, path })),
  doc: vi.fn((parent: unknown, id?: string) => ({ kind: 'doc', parent, id: id ?? 'generated-id' })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count: number) => ({ kind: 'limit', count })),
  orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
  query: vi.fn((...constraints: unknown[]) => ({ kind: 'query', constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn((field: string, operator: string, value: unknown) => ({ kind: 'where', field, operator, value })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);

describe('cloud session service', () => {
  const db = { kind: 'firestore' } as unknown as Firestore;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a global player document with default rating fields', async () => {
    const { createGlobalPlayerDocument } = await import('./cloudSessionService');

    const player = await createGlobalPlayerDocument({ displayName: 'Alice', uid: 'uid-1', db });

    expect(player.displayName).toBe('Alice');
    expect(player.globalIndividualElo).toBe(1500);
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'players' }, id: expect.any(String) },
      expect.objectContaining({
        displayName: 'Alice',
        searchName: 'alice',
        createdBy: 'uid-1',
        claimStatus: 'guest',
        globalIndividualElo: 1500,
        globalMatchCount: 0,
      }),
    );
  });

  it('searches global players by normalized search name prefix', async () => {
    const { searchGlobalPlayers } = await import('./cloudSessionService');
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] });

    await searchGlobalPlayers({ searchText: ' Ali ', db });

    expect(firestoreMocks.where).toHaveBeenCalledWith('searchName', '>=', 'ali');
    expect(firestoreMocks.where).toHaveBeenCalledWith('searchName', '<=', 'ali');
    expect(firestoreMocks.limit).toHaveBeenCalledWith(10);
  });

  it('calls runTransaction to complete a cloud session match', async () => {
    const { completeCloudSessionMatch } = await import('./cloudSessionService');
    firestoreMocks.runTransaction.mockResolvedValue(undefined);
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        id: 'alice', displayName: 'Alice', searchName: 'alice', createdBy: 'uid-1',
        claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1,
      }),
    });

    const matchRecord = {
      id: 'match-1',
      sessionId: 'session-1',
      matchNumber: 1,
      teamAPlayerIds: ['alice', 'bob'] as [string, string],
      teamBPlayerIds: ['carol', 'dave'] as [string, string],
      teamADisplayNames: ['Alice', 'Bob'] as [string, string],
      teamBDisplayNames: ['Carol', 'Dave'] as [string, string],
      teamAPairId: 'alice__bob',
      teamBPairId: 'carol__dave',
      winnerTeam: 'teamA' as const,
    };

    await completeCloudSessionMatch({ uid: 'uid-1', matchRecord, db });

    expect(firestoreMocks.runTransaction).toHaveBeenCalledOnce();
  });

  it('writes user session metadata', async () => {
    const { saveCloudSession } = await import('./cloudSessionService');

    await saveCloudSession({
      uid: 'uid-1',
      status: 'active',
      db,
      session: {
        id: 'session-1',
        startedAt: '2026-01-01T10:00:00.000Z',
        players: [
          { id: 'alice', displayName: 'Alice', gamesPlayed: 0, consecutiveStreak: 0, onBreak: true },
          { id: 'bob', displayName: 'Bob', gamesPlayed: 0, consecutiveStreak: 0, onBreak: true },
          { id: 'carol', displayName: 'Carol', gamesPlayed: 0, consecutiveStreak: 0, onBreak: true },
          { id: 'dave', displayName: 'Dave', gamesPlayed: 0, consecutiveStreak: 0, onBreak: true },
        ],
        matches: [],
        pairingMatrix: { together: {}, against: {} },
      },
    });

    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'users/uid-1/sessions' }, id: 'session-1' },
      expect.objectContaining({
        id: 'session-1',
        status: 'active',
        matchCount: 0,
        source: 'cloud',
      }),
      { merge: true },
    );
    const [, payload] = firestoreMocks.setDoc.mock.calls[0];
    expect(payload).toEqual(expect.objectContaining({
      players: [
        { id: 'alice', displayName: 'Alice', gamesPlayed: 0 },
        { id: 'bob', displayName: 'Bob', gamesPlayed: 0 },
        { id: 'carol', displayName: 'Carol', gamesPlayed: 0 },
        { id: 'dave', displayName: 'Dave', gamesPlayed: 0 },
      ],
    }));
  });

  it('writes metadata for older name-only session players', async () => {
    const { saveCloudSession } = await import('./cloudSessionService');

    await saveCloudSession({
      uid: 'uid-1',
      status: 'completed',
      db,
      source: 'local-import',
      session: {
        id: 'session-legacy',
        startedAt: '2026-01-01T10:00:00.000Z',
        endedAt: '2026-01-01T12:00:00.000Z',
        players: [{ name: 'OldAlice', gamesPlayed: 2, consecutiveStreak: 0, onBreak: false }],
        matches: [],
      } as never,
    });

    const [, payload] = firestoreMocks.setDoc.mock.calls[0];
    expect(payload).toEqual(expect.objectContaining({
      players: [
        { id: 'legacy-local-player-oldalice', displayName: 'OldAlice', gamesPlayed: 2 },
      ],
    }));
  });

  it('updates a global player sprite id and returns the patched player', async () => {
    const { updateGlobalPlayerSpriteId } = await import('./cloudSessionService');
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        id: 'alice',
        displayName: 'Alice',
        searchName: 'alice',
        createdBy: 'uid-1',
        claimStatus: 'guest',
        globalIndividualElo: 1500,
        globalMatchCount: 0,
        statsVersion: 1,
        spriteId: 'female-net',
      }),
    });

    const player = await updateGlobalPlayerSpriteId({ playerId: 'alice', spriteId: 'female-net', db });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(expect.anything(), {
      spriteId: 'female-net',
      updatedAt: expect.anything(),
    });
    expect(player.spriteId).toBe('female-net');
  });

  it('loads cloud history stats from Firestore documents', async () => {
    const { loadCloudHistoryStats } = await import('./cloudSessionService');
    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [docSnapshot('session-1', { id: 'session-1', startedAt: '2026-01-01T10:00:00.000Z', matchCount: 2 })] })
      .mockResolvedValueOnce({ docs: [
        docSnapshot('alice', { id: 'alice', displayName: 'Alice', globalIndividualElo: 1600, globalMatchCount: 2 }),
        docSnapshot('bob', { id: 'bob', displayName: 'Bob', globalIndividualElo: 1500, globalMatchCount: 1 }),
        docSnapshot('carol', { id: 'carol', displayName: 'Carol', globalIndividualElo: 1490, globalMatchCount: 1 }),
        docSnapshot('dave', { id: 'dave', displayName: 'Dave', globalIndividualElo: 1490, globalMatchCount: 1 }),
      ] })
      .mockResolvedValueOnce({ docs: [docSnapshot('alice__bob', { id: 'alice__bob', displayNames: ['Alice', 'Bob'], globalPairElo: 1550, globalMatchCount: 1 })] })
      .mockResolvedValueOnce({ docs: [docSnapshot('match-1', {
        id: 'match-1',
        sessionId: 'session-1',
        matchNumber: 1,
        teamAPlayerIds: ['alice', 'bob'],
        teamBPlayerIds: ['carol', 'dave'],
        teamAPairId: 'alice__bob',
        teamBPairId: 'carol__dave',
        winnerTeam: 'teamA',
        finalScore: { teamA: 21, teamB: 18 },
        submittedBy: 'uid-1',
      })] });
    firestoreMocks.getDoc.mockResolvedValue(docSnapshot('summary', {
      ratedMatchCount: 1,
      statsVersion: 1,
      players: { alice: { displayName: 'Alice', matchesPlayed: 1, wins: 1, losses: 0, winRate: 1, recentForm: ['W'] } },
      pairs: {},
      matchups: {},
    }));

    const stats = await loadCloudHistoryStats({ uid: 'uid-1', db });

    expect(stats.sessions[0]).toEqual({ id: 'session-1', startedAt: '2026-01-01T10:00:00.000Z', matchCount: 2 });
    expect(stats.players[0]).toMatchObject({ id: 'alice', displayName: 'Alice', elo: 1600, matchesPlayed: 2, winRate: 1, recentForm: ['W'] });
    expect(stats.pairs[0]).toMatchObject({ id: 'alice__bob', displayNames: ['Alice', 'Bob'], elo: 1550, matchesPlayed: 1, winRate: 1 });
    expect(stats.matchups[0]).toMatchObject({ id: 'alice__vs__carol', players: ['Alice', 'Carol'], matchesPlayed: 1, wins: 1, losses: 0 });
    expect(stats.globalMatches[0]).toMatchObject({
      id: 'match-1',
      teamA: ['Alice', 'Bob'],
      teamB: ['Carol', 'Dave'],
      finalScore: { teamA: 21, teamB: 18 },
      submittedBy: 'uid-1',
    });
    expect(stats.personalStats?.ratedMatchCount).toBe(1);
  });
});

function docSnapshot(id: string, data: unknown) {
  return { id, data: () => data };
}
