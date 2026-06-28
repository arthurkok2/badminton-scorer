import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { createMatch } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((parent: unknown, path: string) => ({ kind: 'collection', parent, path })),
  doc: vi.fn((parent: unknown, id: string) => ({ kind: 'doc', parent, id })),
  query: vi.fn((...constraints: unknown[]) => ({ kind: 'query', constraints })),
  where: vi.fn((field: string, operator: string, value: unknown) => ({ kind: 'where', field, operator, value })),
  orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: firestoreMocks.batchUpdate,
    commit: firestoreMocks.batchCommit,
  })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);

describe('firestore remote service', () => {
  const db = { kind: 'firestore' } as unknown as Firestore;

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.serverTimestamp.mockReturnValue({ kind: 'serverTimestamp' });
  });

  it('createRoomCode returns a 4-character uppercase code without ambiguous characters', async () => {
    const { createRoomCode } = await import('./firestoreRemoteService');

    for (let index = 0; index < 100; index += 1) {
      expect(createRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it('createWatchRemoteRoom writes an active match room document', async () => {
    const { createWatchRemoteRoom } = await import('./firestoreRemoteService');
    const match = createTestMatchWithUndefinedWinner();
    const serializedMatch = serializeForExpectation(match);

    const code = await createWatchRemoteRoom({ match, hostId: 'host-1', db });

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(firestoreMocks.collection).toHaveBeenCalledWith(db, 'matches');
    expect(firestoreMocks.doc).toHaveBeenCalledWith({ kind: 'collection', parent: db, path: 'matches' }, code);
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: code },
      {
        active: true,
        code,
        createdAt: { kind: 'serverTimestamp' },
        hostHeartbeatAt: { kind: 'serverTimestamp' },
        hostId: 'host-1',
        matchMode: 'doubles',
        matchState: serializedMatch,
        updatedAt: { kind: 'serverTimestamp' },
      },
    );
    expect(writtenPayload(firestoreMocks.setDoc)).not.toHaveProperty('winnerTeamId');
    expect(writtenMatchState(firestoreMocks.setDoc)).not.toHaveProperty('winnerTeamId');
  });

  it('createWatchRemoteRoom writes winnerTeamId when the match has a winner', async () => {
    const { createWatchRemoteRoom } = await import('./firestoreRemoteService');
    const match = createTestMatch({ winnerTeamId: 'teamA' });

    await createWatchRemoteRoom({ match, hostId: 'host-1', db });

    expect(writtenPayload(firestoreMocks.setDoc)).toHaveProperty('winnerTeamId', 'teamA');
    expect(writtenMatchState(firestoreMocks.setDoc)).toHaveProperty('winnerTeamId', 'teamA');
  });

  it('subscribeToPendingCommands filters applied and rejected commands before notifying', async () => {
    const { subscribeToPendingCommands } = await import('./firestoreRemoteService');
    const onCommands = vi.fn();
    const onError = vi.fn();
    const unsubscribe = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_query, next) => {
      next({
        docs: [
          commandDoc('pending-point', { type: 'POINT_TEAM', teamId: 'teamA', createdAt: 1, sourceId: 'watch-1', sourceKind: 'wear' }),
          commandDoc('applied-undo', { type: 'UNDO', createdAt: 2, appliedAt: 3, sourceId: 'watch-1', sourceKind: 'wear' }),
          commandDoc('rejected-announce', { type: 'ANNOUNCE', createdAt: 4, rejectedAt: 5, sourceId: 'watch-1', sourceKind: 'wear' }),
          commandDoc('pending-undo', { type: 'UNDO', createdAt: 6, sourceId: 'watch-1', sourceKind: 'wear' }),
        ],
      });

      return unsubscribe;
    });

    const stop = subscribeToPendingCommands({ code: 'ABCD', onCommands, onError, db });

    expect(firestoreMocks.collection).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' },
      'commands',
    );
    expect(firestoreMocks.query).toHaveBeenCalledWith(
      { kind: 'collection', parent: { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' }, path: 'commands' },
      { kind: 'where', field: 'createdAt', operator: '!=', value: null },
      { kind: 'orderBy', field: 'createdAt', direction: 'asc' },
    );
    expect(onCommands).toHaveBeenCalledWith([
      { id: 'pending-point', command: { type: 'POINT_TEAM', teamId: 'teamA', createdAt: 1, sourceId: 'watch-1', sourceKind: 'wear' } },
      { id: 'pending-undo', command: { type: 'UNDO', createdAt: 6, sourceId: 'watch-1', sourceKind: 'wear' } },
    ]);
    expect(onError).not.toHaveBeenCalled();

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('subscribeToPendingCommands forwards snapshot errors as Error instances', async () => {
    const { subscribeToPendingCommands } = await import('./firestoreRemoteService');
    const onCommands = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_query, _next, onSnapshotError) => {
      onSnapshotError('something went wrong');
      return vi.fn();
    });

    subscribeToPendingCommands({ code: 'ABCD', onCommands, onError, db });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('something went wrong');
    expect(onCommands).not.toHaveBeenCalled();
  });

  it('publishWatchRemoteState updates room state and heartbeat timestamp', async () => {
    const { publishWatchRemoteState } = await import('./firestoreRemoteService');
    const match = createTestMatchWithUndefinedWinner();
    const serializedMatch = serializeForExpectation(match);

    await publishWatchRemoteState({ code: 'WXYZ', match, hostId: 'host-2', db });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'WXYZ' },
      {
        active: true,
        hostHeartbeatAt: { kind: 'serverTimestamp' },
        hostId: 'host-2',
        matchMode: 'doubles',
        matchState: serializedMatch,
        updatedAt: { kind: 'serverTimestamp' },
      },
    );
    expect(writtenPayload(firestoreMocks.updateDoc)).not.toHaveProperty('winnerTeamId');
    expect(writtenMatchState(firestoreMocks.updateDoc)).not.toHaveProperty('winnerTeamId');
  });

  it('publishWatchRemoteState writes winnerTeamId when the match has a winner', async () => {
    const { publishWatchRemoteState } = await import('./firestoreRemoteService');
    const match = createTestMatch({ winnerTeamId: 'teamA' });

    await publishWatchRemoteState({ code: 'WXYZ', match, hostId: 'host-2', db });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'WXYZ' },
      {
        active: true,
        hostHeartbeatAt: { kind: 'serverTimestamp' },
        hostId: 'host-2',
        matchMode: 'doubles',
        matchState: match,
        updatedAt: { kind: 'serverTimestamp' },
        winnerTeamId: 'teamA',
      },
    );
    expect(writtenMatchState(firestoreMocks.updateDoc)).toHaveProperty('winnerTeamId', 'teamA');
  });

  it('marks a command applied with the latest match state', async () => {
    const { markCommandApplied } = await import('./firestoreRemoteService');
    const match = createTestMatchWithUndefinedWinner();
    const serializedMatch = serializeForExpectation(match);

    await markCommandApplied({ code: 'ABCD', commandId: 'command-1', match, db });

    expect(firestoreMocks.writeBatch).toHaveBeenCalledWith(db);
    expect(firestoreMocks.batchUpdate).toHaveBeenNthCalledWith(
      1,
      {
        kind: 'doc',
        parent: { kind: 'collection', parent: { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' }, path: 'commands' },
        id: 'command-1',
      },
      { appliedAt: { kind: 'serverTimestamp' } },
    );
    expect(firestoreMocks.batchUpdate).toHaveBeenNthCalledWith(
      2,
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' },
      {
        hostHeartbeatAt: { kind: 'serverTimestamp' },
        lastAppliedCommandId: 'command-1',
        matchMode: 'doubles',
        matchState: serializedMatch,
        updatedAt: { kind: 'serverTimestamp' },
      },
    );
    expect(firestoreMocks.batchCommit).toHaveBeenCalledOnce();
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(writtenPayload(firestoreMocks.batchUpdate, 1)).not.toHaveProperty('winnerTeamId');
    expect(writtenMatchState(firestoreMocks.batchUpdate, 1)).not.toHaveProperty('winnerTeamId');
  });

  it('marks a command applied with winnerTeamId when the match has a winner', async () => {
    const { markCommandApplied } = await import('./firestoreRemoteService');
    const match = createTestMatch({ winnerTeamId: 'teamA' });

    await markCommandApplied({ code: 'ABCD', commandId: 'command-1', match, db });

    expect(firestoreMocks.writeBatch).toHaveBeenCalledWith(db);
    expect(firestoreMocks.batchUpdate).toHaveBeenNthCalledWith(
      2,
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' },
      {
        hostHeartbeatAt: { kind: 'serverTimestamp' },
        lastAppliedCommandId: 'command-1',
        matchMode: 'doubles',
        matchState: match,
        updatedAt: { kind: 'serverTimestamp' },
        winnerTeamId: 'teamA',
      },
    );
    expect(firestoreMocks.batchCommit).toHaveBeenCalledOnce();
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(writtenMatchState(firestoreMocks.batchUpdate, 1)).toHaveProperty('winnerTeamId', 'teamA');
  });

  it('marks a command rejected with the rejection reason', async () => {
    const { markCommandRejected } = await import('./firestoreRemoteService');

    await markCommandRejected({ code: 'ABCD', commandId: 'command-2', reason: 'invalid team', db });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      {
        kind: 'doc',
        parent: { kind: 'collection', parent: { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' }, path: 'commands' },
        id: 'command-2',
      },
      {
        rejectedAt: { kind: 'serverTimestamp' },
        rejectionReason: 'invalid team',
      },
    );
  });

  it('updates host heartbeat timestamp', async () => {
    const { updateHostHeartbeat } = await import('./firestoreRemoteService');

    await updateHostHeartbeat({ code: 'ABCD', db });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' },
      {
        hostHeartbeatAt: { kind: 'serverTimestamp' },
        updatedAt: { kind: 'serverTimestamp' },
      },
    );
  });

  it('ends a watch remote room', async () => {
    const { endWatchRemoteRoom } = await import('./firestoreRemoteService');

    await endWatchRemoteRoom({ code: 'ABCD', db });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'matches' }, id: 'ABCD' },
      {
        active: false,
        hostHeartbeatAt: { kind: 'serverTimestamp' },
        updatedAt: { kind: 'serverTimestamp' },
      },
    );
  });
});

function createTestMatch(overrides: Partial<MatchState> = {}): MatchState {
  return {
    ...createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    ...overrides,
  };
}

function createTestMatchWithUndefinedWinner(): MatchState {
  return createTestMatch({ winnerTeamId: undefined });
}

function commandDoc(id: string, command: Record<string, unknown>): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => command,
  };
}

function writtenPayload(mock: { mock: { calls: unknown[][] } }, callIndex = 0): Record<string, unknown> {
  return mock.mock.calls[callIndex]?.[1] as Record<string, unknown>;
}

function writtenMatchState(mock: { mock: { calls: unknown[][] } }, callIndex = 0): MatchState {
  return writtenPayload(mock, callIndex).matchState as MatchState;
}

function serializeForExpectation(match: MatchState): MatchState {
  return JSON.parse(JSON.stringify(match)) as MatchState;
}
