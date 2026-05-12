import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../auth';
import type { MatchState } from '../domain/matchTypes';
import type { AppCommand } from '../input/commands';
import type { PendingWatchRemoteCommand, WatchRemoteHostStatus } from '../remote/firestoreRemoteTypes';
import {
  createWatchRemoteRoom,
  endWatchRemoteRoom,
  markCommandApplied,
  markCommandRejected,
  publishWatchRemoteState,
  subscribeToPendingCommands,
} from '../remote/firestoreRemoteService';

export const STORAGE_KEY = 'badminton-scorer-watch-remote-room';

export interface WatchRemoteService {
  createRoom: (options: { match: MatchState; hostId: string }) => Promise<string>;
  publishState: (options: { code: string; match: MatchState; hostId: string }) => Promise<void>;
  subscribeToCommands: (options: {
    code: string;
    onCommands: (commands: PendingWatchRemoteCommand[]) => void;
    onError: (error: Error) => void;
  }) => () => void;
  markApplied: (options: { code: string; commandId: string; match: MatchState }) => Promise<void>;
  markRejected: (options: { code: string; commandId: string; reason: string }) => Promise<void>;
  endRoom: (options: { code: string }) => Promise<void>;
}

const defaultService: WatchRemoteService = {
  createRoom: ({ match, hostId }) => createWatchRemoteRoom({ match, hostId }),
  publishState: ({ code, match, hostId }) => publishWatchRemoteState({ code, match, hostId }),
  subscribeToCommands: ({ code, onCommands, onError }) =>
    subscribeToPendingCommands({ code, onCommands, onError }),
  markApplied: ({ code, commandId, match }) => markCommandApplied({ code, commandId, match }),
  markRejected: ({ code, commandId, reason }) => markCommandRejected({ code, commandId, reason }),
  endRoom: ({ code }) => endWatchRemoteRoom({ code }),
};

export function useWatchRemoteHost(options: {
  readonly match: MatchState;
  readonly dispatch: (command: AppCommand) => void;
  readonly announce: () => void;
  readonly service?: WatchRemoteService;
}): {
  readonly status: WatchRemoteHostStatus;
  readonly code?: string;
  readonly error?: string;
  readonly lastCommandLabel?: string;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
} {
  const { match, dispatch, announce, service = defaultService } = options;

  const { user, loading, authUnavailable } = useAuth();

  const [status, setStatus] = useState<WatchRemoteHostStatus>('inactive');
  const [code, setCode] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastCommandLabel, setLastCommandLabel] = useState<string | undefined>(undefined);

  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const codeRef = useRef<string | undefined>(undefined);
  // Keep a ref to the current match so the command handler always sees latest state
  const matchRef = useRef<MatchState>(match);
  matchRef.current = match;

  // Mirror status in a ref so callbacks and guards can read current value without stale closures
  const statusRef = useRef<WatchRemoteHostStatus>('inactive');
  const updateStatus = (s: WatchRemoteHostStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Tracks whether stop() was called while start() was still in progress
  const cancelledRef = useRef(false);

  // Tracks command IDs already processed to prevent duplicate dispatches
  const processedCommandIds = useRef(new Set<string>());

  const start = useCallback(async () => {
    // Guard against double-start or missing auth
    if (statusRef.current !== 'inactive') return;
    if (loading || authUnavailable || !user) return;

    cancelledRef.current = false;
    updateStatus('starting');
    setError(undefined);

    try {
      const roomCode = await service.createRoom({ match: matchRef.current, hostId: user.uid });

      // If stop() was called while createRoom was in flight, clean up the room and bail
      if (cancelledRef.current) {
        try { await service.endRoom({ code: roomCode }); } catch { /* ignore */ }
        updateStatus('inactive');
        return;
      }

      await service.publishState({ code: roomCode, match: matchRef.current, hostId: user.uid });

      const unsubscribe = service.subscribeToCommands({
        code: roomCode,
        onCommands: (commands) => {
          for (const pending of commands) {
            const { id, command } = pending;

            // Deduplication guard: skip commands already processed
            if (processedCommandIds.current.has(id)) continue;
            processedCommandIds.current.add(id);

            if (command.type === 'POINT_TEAM') {
              dispatch({ type: 'POINT_TEAM', teamId: command.teamId });
              setLastCommandLabel(`POINT_TEAM ${command.teamId}`);
              void service.markApplied({ code: roomCode, commandId: id, match: matchRef.current });
            } else if (command.type === 'UNDO') {
              dispatch({ type: 'UNDO' });
              setLastCommandLabel('UNDO');
              void service.markApplied({ code: roomCode, commandId: id, match: matchRef.current });
            } else if (command.type === 'ANNOUNCE') {
              announce();
              setLastCommandLabel('ANNOUNCE');
              void service.markApplied({ code: roomCode, commandId: id, match: matchRef.current });
            } else {
              void service.markRejected({ code: roomCode, commandId: id, reason: 'unsupported command type' });
            }
          }
        },
        onError: (err) => {
          updateStatus('error');
          setError(err.message);
        },
      });

      unsubscribeRef.current = unsubscribe;
      codeRef.current = roomCode;
      localStorage.setItem(STORAGE_KEY, roomCode);
      setCode(roomCode);
      updateStatus('active');
    } catch (err) {
      updateStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [service, dispatch, announce, user, loading, authUnavailable]);

  const stop = useCallback(async () => {
    // Handle stop() called while start() is still in progress
    if (statusRef.current === 'starting') {
      cancelledRef.current = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
      localStorage.removeItem(STORAGE_KEY);
      codeRef.current = undefined;
      setCode(undefined);
      setLastCommandLabel(undefined);
      setError(undefined);
      processedCommandIds.current.clear();
      updateStatus('inactive');
      return;
    }

    updateStatus('stopping');

    const roomCode = codeRef.current;

    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;

    if (roomCode !== undefined) {
      await service.endRoom({ code: roomCode });
    }

    localStorage.removeItem(STORAGE_KEY);
    codeRef.current = undefined;
    setCode(undefined);
    setLastCommandLabel(undefined);
    setError(undefined);
    processedCommandIds.current.clear();
    updateStatus('inactive');
  }, [service]);

  return { status, code, error, lastCommandLabel, start, stop };
}
