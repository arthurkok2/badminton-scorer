import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((parent: unknown, path: string) => ({ kind: 'collection', parent, path })),
  doc: vi.fn((parent: unknown, id: string) => ({ kind: 'doc', parent, id })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);

describe('firestoreControllerService', () => {
  const db = { kind: 'firestore' } as unknown as Firestore;

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.serverTimestamp.mockReturnValue({ kind: 'serverTimestamp' });
  });

  it('subscribeToRoomState subscribes to the matches/{code} document', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockReturnValue(vi.fn());

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(firestoreMocks.collection).toHaveBeenCalledWith(db, 'matches');
    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      { kind: 'collection', parent: db, path: 'matches' },
      'ABCD',
    );
    expect(firestoreMocks.onSnapshot).toHaveBeenCalledOnce();
  });

  it('subscribeToRoomState calls onError when document does not exist', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => false, data: () => undefined });
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Room not found');
    expect(onState).not.toHaveBeenCalled();
  });

  it('subscribeToRoomState calls onError when room is inactive', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => ({ active: false, code: 'ABCD' }) });
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe('Room is no longer active');
    expect(onState).not.toHaveBeenCalled();
  });

  it('subscribeToRoomState calls onState with document data when room is active', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    const roomData = { active: true, code: 'ABCD', matchState: {}, matchMode: 'doubles' };
    firestoreMocks.onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => roomData });
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onState).toHaveBeenCalledWith(roomData);
    expect(onError).not.toHaveBeenCalled();
  });

  it('subscribeToRoomState forwards Firestore errors to onError as Error instances', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_ref, _next, onSnapshotError) => {
      onSnapshotError('permission denied');
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('permission denied');
  });

  it('subscribeToRoomState returns the unsubscribe function', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const unsubscribe = vi.fn();
    firestoreMocks.onSnapshot.mockReturnValue(unsubscribe);

    const stop = subscribeToRoomState({ code: 'ABCD', onState: vi.fn(), onError: vi.fn(), db });
    stop();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('sendControllerCommand writes a POINT_TEAM command with teamId', async () => {
    const { sendControllerCommand } = await import('./firestoreControllerService');
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    await sendControllerCommand({ code: 'ABCD', type: 'POINT_TEAM', teamId: 'teamA', sourceId: 'src-1', db });

    expect(firestoreMocks.setDoc).toHaveBeenCalledOnce();
    const payload = firestoreMocks.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      type: 'POINT_TEAM',
      teamId: 'teamA',
      sourceId: 'src-1',
      sourceKind: 'web',
      createdAt: { kind: 'serverTimestamp' },
    });
  });

  it('sendControllerCommand writes an UNDO command without teamId', async () => {
    const { sendControllerCommand } = await import('./firestoreControllerService');
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    await sendControllerCommand({ code: 'ABCD', type: 'UNDO', sourceId: 'src-1', db });

    const payload = firestoreMocks.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'UNDO', sourceKind: 'web' });
    expect(payload).not.toHaveProperty('teamId');
  });

  it('sendControllerCommand writes an ANNOUNCE command without teamId', async () => {
    const { sendControllerCommand } = await import('./firestoreControllerService');
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    await sendControllerCommand({ code: 'ABCD', type: 'ANNOUNCE', sourceId: 'src-1', db });

    const payload = firestoreMocks.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'ANNOUNCE', sourceKind: 'web' });
    expect(payload).not.toHaveProperty('teamId');
  });
});
