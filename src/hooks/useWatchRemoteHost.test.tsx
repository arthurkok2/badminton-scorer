import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWatchRemoteHost, STORAGE_KEY, type WatchRemoteService } from './useWatchRemoteHost';
import { createMatch } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';
import type { PendingWatchRemoteCommand } from '../remote/firestoreRemoteTypes';

// Mock useAuth so the hook gets a deterministic uid
vi.mock('../auth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-host-uid', isAnonymous: false },
    loading: false,
    isAnonymous: false,
    authUnavailable: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })),
}));

function createTestMatch(): MatchState {
  return createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
}

function makePendingPointTeam(id: string): PendingWatchRemoteCommand {
  return {
    id,
    command: {
      type: 'POINT_TEAM',
      teamId: 'teamA',
      sourceId: 'watch-1',
      sourceKind: 'wear',
      createdAt: Date.now(),
    },
  };
}

function makePendingUndo(id: string): PendingWatchRemoteCommand {
  return {
    id,
    command: {
      type: 'UNDO',
      sourceId: 'watch-1',
      sourceKind: 'wear',
      createdAt: Date.now(),
    },
  };
}

function makePendingAnnounce(id: string): PendingWatchRemoteCommand {
  return {
    id,
    command: {
      type: 'ANNOUNCE',
      sourceId: 'watch-1',
      sourceKind: 'wear',
      createdAt: Date.now(),
    },
  };
}

function makeService(overrides: Partial<WatchRemoteService> = {}): WatchRemoteService {
  return {
    createRoom: vi.fn().mockResolvedValue('ABCD'),
    publishState: vi.fn().mockResolvedValue(undefined),
    subscribeToCommands: vi.fn().mockReturnValue(vi.fn()),
    markApplied: vi.fn().mockResolvedValue(undefined),
    markRejected: vi.fn().mockResolvedValue(undefined),
    endRoom: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useWatchRemoteHost', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initial state is inactive and does not call Firebase', () => {
    const service = makeService();
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    expect(result.current.status).toBe('inactive');
    expect(result.current.code).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.lastCommandLabel).toBeUndefined();
    expect(service.createRoom).not.toHaveBeenCalled();
    expect(service.publishState).not.toHaveBeenCalled();
    expect(service.subscribeToCommands).not.toHaveBeenCalled();
  });

  it('start() creates a room and publishes active status', async () => {
    const service = makeService();
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(service.createRoom).toHaveBeenCalledOnce();
    expect(service.createRoom).toHaveBeenCalledWith(expect.objectContaining({ hostId: 'test-host-uid' }));
    expect(service.publishState).toHaveBeenCalledTimes(2);
    expect(service.publishState).toHaveBeenCalledWith(expect.objectContaining({ hostId: 'test-host-uid' }));
    expect(service.subscribeToCommands).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('active');
    expect(result.current.code).toBe('ABCD');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ABCD');
  });

  it('incoming POINT_TEAM command calls dispatch with POINT_TEAM and teamId', async () => {
    let capturedOnCommands: ((commands: PendingWatchRemoteCommand[]) => void) | undefined;
    const service = makeService({
      subscribeToCommands: vi.fn().mockImplementation(({ onCommands }) => {
        capturedOnCommands = onCommands;
        return vi.fn();
      }),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    const command = makePendingPointTeam('cmd-1');
    await act(async () => {
      capturedOnCommands!([command]);
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'POINT_TEAM', teamId: 'teamA' });
    expect(service.markApplied).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD', commandId: 'cmd-1' }),
    );
    expect(result.current.lastCommandLabel).toBe('POINT_TEAM teamA');
  });

  it('incoming UNDO command calls dispatch with UNDO', async () => {
    let capturedOnCommands: ((commands: PendingWatchRemoteCommand[]) => void) | undefined;
    const service = makeService({
      subscribeToCommands: vi.fn().mockImplementation(({ onCommands }) => {
        capturedOnCommands = onCommands;
        return vi.fn();
      }),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    const command = makePendingUndo('cmd-2');
    await act(async () => {
      capturedOnCommands!([command]);
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'UNDO' });
    expect(service.markApplied).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD', commandId: 'cmd-2' }),
    );
    expect(result.current.lastCommandLabel).toBe('UNDO');
  });

  it('incoming ANNOUNCE command calls the announce callback', async () => {
    let capturedOnCommands: ((commands: PendingWatchRemoteCommand[]) => void) | undefined;
    const service = makeService({
      subscribeToCommands: vi.fn().mockImplementation(({ onCommands }) => {
        capturedOnCommands = onCommands;
        return vi.fn();
      }),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    const command = makePendingAnnounce('cmd-3');
    await act(async () => {
      capturedOnCommands!([command]);
    });

    expect(announce).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
    expect(service.markApplied).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD', commandId: 'cmd-3' }),
    );
    expect(result.current.lastCommandLabel).toBe('ANNOUNCE');
  });

  it('failed start() sets status to error with message and does not throw', async () => {
    const service = makeService({
      createRoom: vi.fn().mockRejectedValue(new Error('Firebase unavailable')),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Firebase unavailable');
    expect(result.current.code).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('stop() ends the room, unsubscribes, clears localStorage, and sets status to inactive', async () => {
    const unsubscribe = vi.fn();
    const service = makeService({
      subscribeToCommands: vi.fn().mockReturnValue(unsubscribe),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('active');

    await act(async () => {
      await result.current.stop();
    });

    expect(service.endRoom).toHaveBeenCalledWith({ code: 'ABCD' });
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.status).toBe('inactive');
    expect(result.current.code).toBeUndefined();
  });

  it('stop() clears lastCommandLabel and error', async () => {
    let capturedOnCommands: ((commands: PendingWatchRemoteCommand[]) => void) | undefined;
    const service = makeService({
      subscribeToCommands: vi.fn().mockImplementation(({ onCommands }) => {
        capturedOnCommands = onCommands;
        return vi.fn();
      }),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    // Trigger a command to populate lastCommandLabel
    await act(async () => {
      capturedOnCommands!([makePendingUndo('cmd-x')]);
    });
    expect(result.current.lastCommandLabel).toBe('UNDO');

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.lastCommandLabel).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('duplicate command ID is dispatched only once', async () => {
    let capturedOnCommands: ((commands: PendingWatchRemoteCommand[]) => void) | undefined;
    const service = makeService({
      subscribeToCommands: vi.fn().mockImplementation(({ onCommands }) => {
        capturedOnCommands = onCommands;
        return vi.fn();
      }),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    const command = makePendingPointTeam('cmd-dup');

    await act(async () => {
      capturedOnCommands!([command]);
    });
    await act(async () => {
      capturedOnCommands!([command]);
    });

    expect(dispatch).toHaveBeenCalledOnce();
    expect(service.markApplied).toHaveBeenCalledOnce();
  });

  it('second start() while active is a no-op', async () => {
    const service = makeService();
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.start();
    });

    expect(service.createRoom).toHaveBeenCalledOnce();
  });

  it('unknown command type calls markRejected and does not dispatch', async () => {
    let capturedOnCommands: ((commands: PendingWatchRemoteCommand[]) => void) | undefined;
    const service = makeService({
      subscribeToCommands: vi.fn().mockImplementation(({ onCommands }) => {
        capturedOnCommands = onCommands;
        return vi.fn();
      }),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    const unknownCommand = {
      id: 'cmd-unknown',
      command: {
        type: 'UNKNOWN_FUTURE_COMMAND' as never,
        sourceId: 'watch-1',
        sourceKind: 'wear' as const,
        createdAt: Date.now(),
      },
    };

    await act(async () => {
      capturedOnCommands!([unknownCommand]);
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(service.markApplied).not.toHaveBeenCalled();
    expect(service.markRejected).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD', commandId: 'cmd-unknown', reason: 'unsupported command type' }),
    );
  });

  it('does not start when authUnavailable is true', async () => {
    const { useAuth } = await import('../auth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null,
      loading: false,
      isAnonymous: false,
      authUnavailable: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    const service = makeService();
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => { await result.current.start(); });

    expect(service.createRoom).not.toHaveBeenCalled();
    expect(result.current.status).toBe('inactive');
  });

  it('does not start when loading is true', async () => {
    const { useAuth } = await import('../auth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null,
      loading: true,
      isAnonymous: false,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    const service = makeService();
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => { await result.current.start(); });

    expect(service.createRoom).not.toHaveBeenCalled();
    expect(result.current.status).toBe('inactive');
  });

  it('does not start when user is null and loading is false', async () => {
    const { useAuth } = await import('../auth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null,
      loading: false,
      isAnonymous: false,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    const service = makeService();
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => { await result.current.start(); });

    expect(service.createRoom).not.toHaveBeenCalled();
    expect(result.current.status).toBe('inactive');
  });

  it('does not start when the current Firebase user is anonymous', async () => {
    const { useAuth } = await import('../auth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: { uid: 'anon-uid', isAnonymous: true },
      loading: false,
      isAnonymous: true,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    const service = makeService();
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => { await result.current.start(); });

    expect(service.createRoom).not.toHaveBeenCalled();
    expect(result.current.status).toBe('inactive');
  });

  it('onError callback sets status to error with the error message', async () => {
    let capturedOnError: ((error: Error) => void) | undefined;
    const service = makeService({
      subscribeToCommands: vi.fn().mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return vi.fn();
      }),
    });
    const dispatch = vi.fn();
    const announce = vi.fn();
    const match = createTestMatch();

    const { result } = renderHook(() =>
      useWatchRemoteHost({ match, dispatch, announce, service }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('active');

    await act(async () => {
      capturedOnError!(new Error('Firestore connection lost'));
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Firestore connection lost');
  });
});
