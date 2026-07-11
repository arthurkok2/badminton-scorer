import { useCallback, useRef, useState } from 'react';
import type { TeamId } from '../domain/matchTypes';
import type { WatchRemoteCommandType, WatchRemoteMatchDocument } from '../remote/firestoreRemoteTypes';
import { subscribeToRoomState, sendControllerCommand } from '../remote/firestoreControllerService';

const CODE_KEY = 'badminton-scorer-controller-code';
const SOURCE_ID_KEY = 'badminton-scorer-controller-id';

function getOrCreateSourceId(): string {
  const existing = localStorage.getItem(SOURCE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(SOURCE_ID_KEY, id);
  return id;
}

export interface ControllerService {
  subscribeToRoomState: (options: {
    code: string;
    onState: (roomDoc: WatchRemoteMatchDocument) => void;
    onError: (error: Error) => void;
  }) => () => void;
  sendCommand: (options: {
    code: string;
    type: WatchRemoteCommandType;
    teamId?: TeamId;
    sourceId: string;
  }) => Promise<void>;
}

const defaultService: ControllerService = {
  subscribeToRoomState: ({ code, onState, onError }) =>
    subscribeToRoomState({ code, onState, onError }),
  sendCommand: ({ code, type, teamId, sourceId }) =>
    sendControllerCommand({ code, type, teamId, sourceId }),
};

type ControllerStatus = 'disconnected' | 'joining' | 'active' | 'error';

export function useControllerClient(service?: ControllerService): {
  readonly status: ControllerStatus;
  readonly matchDoc: WatchRemoteMatchDocument | undefined;
  readonly error: string | undefined;
  readonly commandError: string | undefined;
  readonly commandPending: boolean;
  readonly lastCode: string;
  readonly join: (code: string) => void;
  readonly leave: () => void;
  readonly sendCommand: (type: WatchRemoteCommandType, teamId?: TeamId) => Promise<void>;
} {
  const resolvedService = service ?? defaultService;

  const [status, setStatus] = useState<ControllerStatus>('disconnected');
  const [matchDoc, setMatchDoc] = useState<WatchRemoteMatchDocument | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [commandError, setCommandError] = useState<string | undefined>(undefined);
  const [commandPending, setCommandPending] = useState(false);
  const [lastCode, setLastCode] = useState<string>(() => localStorage.getItem(CODE_KEY) ?? '');

  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const codeRef = useRef<string>('');
  const sourceIdRef = useRef<string>(getOrCreateSourceId());

  const join = useCallback(
    (code: string) => {
      const normalised = code.trim().toUpperCase();
      if (!normalised) return;

      setStatus('joining');
      setError(undefined);
      setCommandError(undefined);
      codeRef.current = normalised;
      localStorage.setItem(CODE_KEY, normalised);
      setLastCode(normalised);

      unsubscribeRef.current = resolvedService.subscribeToRoomState({
        code: normalised,
        onState: (doc) => {
          setMatchDoc(doc);
          setStatus('active');
        },
        onError: (err) => {
          setStatus('error');
          setError(err.message);
          unsubscribeRef.current?.();
          unsubscribeRef.current = undefined;
        },
      });
    },
    [resolvedService],
  );

  const leave = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
    codeRef.current = '';
    setMatchDoc(undefined);
    setError(undefined);
    setCommandError(undefined);
    setStatus('disconnected');
  }, []);

  const sendCommand = useCallback(
    async (type: WatchRemoteCommandType, teamId?: TeamId) => {
      setCommandError(undefined);
      setCommandPending(true);
      try {
        await resolvedService.sendCommand({
          code: codeRef.current,
          type,
          teamId,
          sourceId: sourceIdRef.current,
        });
      } catch (err) {
        setCommandError(err instanceof Error ? err.message : String(err));
      } finally {
        setCommandPending(false);
      }
    },
    [resolvedService],
  );

  return { status, matchDoc, error, commandError, commandPending, lastCode, join, leave, sendCommand };
}
