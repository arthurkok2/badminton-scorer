import { useCallback, useRef, useState } from 'react';
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

const STORAGE_KEY = 'badminton-scorer-watch-remote-room';

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

  const [status, setStatus] = useState<WatchRemoteHostStatus>('inactive');
  const [code, setCode] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastCommandLabel, setLastCommandLabel] = useState<string | undefined>(undefined);

  const hostIdRef = useRef<string>(crypto.randomUUID());
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const codeRef = useRef<string | undefined>(undefined);
  // Keep a ref to the current match so the command handler always sees latest state
  const matchRef = useRef<MatchState>(match);
  matchRef.current = match;

  const start = useCallback(async () => {
    setStatus('starting');
    setError(undefined);

    try {
      const roomCode = await service.createRoom({ match: matchRef.current, hostId: hostIdRef.current });
      await service.publishState({ code: roomCode, match: matchRef.current, hostId: hostIdRef.current });

      const unsubscribe = service.subscribeToCommands({
        code: roomCode,
        onCommands: (commands) => {
          for (const pending of commands) {
            const { id, command } = pending;

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
            }
          }
        },
        onError: (err) => {
          setStatus('error');
          setError(err.message);
        },
      });

      unsubscribeRef.current = unsubscribe;
      codeRef.current = roomCode;
      localStorage.setItem(STORAGE_KEY, roomCode);
      setCode(roomCode);
      setStatus('active');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [service, dispatch, announce]);

  const stop = useCallback(async () => {
    setStatus('stopping');

    const roomCode = codeRef.current;

    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;

    if (roomCode !== undefined) {
      await service.endRoom({ code: roomCode });
    }

    localStorage.removeItem(STORAGE_KEY);
    codeRef.current = undefined;
    setCode(undefined);
    setStatus('inactive');
  }, [service]);

  return { status, code, error, lastCommandLabel, start, stop };
}
