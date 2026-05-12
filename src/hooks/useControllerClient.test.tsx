import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useControllerClient, type ControllerService } from './useControllerClient';
import type { WatchRemoteMatchDocument } from '../remote/firestoreRemoteTypes';
import { createMatch } from '../domain/matchEngine';

vi.mock('../auth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-uid', isAnonymous: true },
    loading: false,
    isAnonymous: true,
    authUnavailable: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })),
}));

function makeService(overrides: Partial<ControllerService> = {}): ControllerService {
  return {
    subscribeToRoomState: vi.fn().mockReturnValue(vi.fn()),
    sendCommand: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMatchDoc(overrides: Partial<WatchRemoteMatchDocument> = {}): WatchRemoteMatchDocument {
  return {
    code: 'ABCD',
    active: true,
    hostId: 'host-1',
    createdAt: null,
    updatedAt: null,
    hostHeartbeatAt: null,
    matchState: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    matchMode: 'doubles',
    ...overrides,
  };
}

describe('useControllerClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initial state is disconnected and no Firebase calls are made', () => {
    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    expect(result.current.status).toBe('disconnected');
    expect(result.current.matchDoc).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.commandError).toBeUndefined();
    expect(service.subscribeToRoomState).not.toHaveBeenCalled();
  });

  it('lastCode is pre-filled from localStorage', () => {
    localStorage.setItem('badminton-scorer-controller-code', 'WXYZ');
    const { result } = renderHook(() => useControllerClient(makeService()));

    expect(result.current.lastCode).toBe('WXYZ');
  });

  it('join() sets status to joining then active on valid snapshot', async () => {
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return vi.fn();
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    expect(result.current.status).toBe('joining');

    act(() => { capturedOnState!(makeMatchDoc()); });
    expect(result.current.status).toBe('active');
    expect(result.current.matchDoc).toBeDefined();
    expect(result.current.matchDoc!.code).toBe('ABCD');
  });

  it('join() stores the code in localStorage', async () => {
    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });

    expect(localStorage.getItem('badminton-scorer-controller-code')).toBe('ABCD');
    expect(result.current.lastCode).toBe('ABCD');
  });

  it('join() sets status to error when subscription calls onError', async () => {
    let capturedOnError: ((err: Error) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return vi.fn();
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnError!(new Error('Room not found')); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Room not found');
  });

  it('leave() unsubscribes, clears state, and resets to disconnected', async () => {
    const unsubscribe = vi.fn();
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return unsubscribe;
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnState!(makeMatchDoc()); });
    expect(result.current.status).toBe('active');

    act(() => { result.current.leave(); });

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('disconnected');
    expect(result.current.matchDoc).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('sendCommand calls the service with the current code and type', async () => {
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return vi.fn();
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnState!(makeMatchDoc()); });
    await act(async () => { await result.current.sendCommand('POINT_TEAM', 'teamA'); });

    expect(service.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD', type: 'POINT_TEAM', teamId: 'teamA' }),
    );
  });

  it('sendCommand sets commandError when the service throws', async () => {
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return vi.fn();
      }),
      sendCommand: vi.fn().mockRejectedValue(new Error('write failed')),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnState!(makeMatchDoc()); });
    await act(async () => { await result.current.sendCommand('UNDO'); });

    expect(result.current.commandError).toBe('write failed');
    expect(result.current.status).toBe('active');
  });

  it('join() normalises code to uppercase', async () => {
    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('abcd'); });

    expect(service.subscribeToRoomState).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD' }),
    );
  });

  it('join() does not subscribe when auth is loading', async () => {
    const { useAuth } = await import('../auth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null, loading: true, isAnonymous: false, authUnavailable: false,
      signInWithGoogle: vi.fn(), signOut: vi.fn(),
    });

    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });

    expect(service.subscribeToRoomState).not.toHaveBeenCalled();
    expect(result.current.status).toBe('disconnected');
  });

  it('join() does not subscribe when authUnavailable is true', async () => {
    const { useAuth } = await import('../auth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null, loading: false, isAnonymous: false, authUnavailable: true,
      signInWithGoogle: vi.fn(), signOut: vi.fn(),
    });

    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });

    expect(service.subscribeToRoomState).not.toHaveBeenCalled();
    expect(result.current.status).toBe('disconnected');
  });
});
