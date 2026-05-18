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
    expect(firestoreMocks.where).toHaveBeenCalledWith('searchName', '<=', 'ali');
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
});
