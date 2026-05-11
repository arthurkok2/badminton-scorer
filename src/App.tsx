import { useCallback, useEffect, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { CourtView } from './components/CourtView';
import { Scoreboard } from './components/Scoreboard';
import { StatusBar } from './components/StatusBar';
import { createMatch } from './domain/matchEngine';
import type { MatchMode, MatchState, PlayerId, TeamId } from './domain/matchTypes';
import { applyCommand, type AppCommand } from './input/commands';
import {
  connectBluetoothRemote,
  getBluetoothSupportStatus,
  type BluetoothRemoteConnection,
  type BluetoothStatus,
} from './input/bluetoothRemote';
import {
  connectKeyboardRemote,
  type KeyboardRemoteConnection,
  type KeyboardRemoteDiagnosticEvent,
} from './input/keyboardRemote';
import {
  connectGamepadRemote,
  type GamepadRemoteConnection,
  type GamepadRemoteDiagnosticEvent,
} from './input/gamepadRemote';
import { loadPreferences, savePreferences, type AppPreferences } from './preferences';
import { getSpeechStatus, speakAnnouncement } from './speech/announcer';

interface MatchViewState {
  readonly match: MatchState;
  readonly pendingAutoAnnouncement?: {
    readonly id: number;
    readonly match: MatchState;
  };
}

type MatchViewAction =
  | {
      readonly type: 'APPLY_COMMAND';
      readonly command: AppCommand;
      readonly autoAnnounce: boolean;
      readonly announcementId: number;
    }
  | { readonly type: 'RESET_MODE'; readonly mode: MatchMode; readonly playerNames: Record<PlayerId, string> };

export default function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [matchView, setMatchView] = useState<MatchViewState>(() => ({
    match: createInitialMatch(preferences.matchMode, preferences.playerNames),
  }));
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothStatus>(() => getBluetoothSupportStatus());
  const [diagnostics, setDiagnostics] = useState<DiagnosticEvent[]>([]);
  const connectionRef = useRef<BluetoothRemoteConnection | undefined>(undefined);
  const keyboardConnectionRef = useRef<KeyboardRemoteConnection | undefined>(undefined);
  const gamepadConnectionRef = useRef<GamepadRemoteConnection | undefined>(undefined);
  const preferencesRef = useRef(preferences);
  const announcementIdRef = useRef(0);
  const lastSpokenAnnouncementIdRef = useRef(0);
  const connectAttemptIdRef = useRef(0);
  const mountedRef = useRef(false);
  const match = matchView.match;

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      connectAttemptIdRef.current += 1;
      connectionRef.current?.disconnect();
      connectionRef.current = undefined;
    };
  }, []);

  const dispatch = useCallback((command: AppCommand) => {
    announcementIdRef.current += 1;
    const action: MatchViewAction = {
      type: 'APPLY_COMMAND',
      command,
      autoAnnounce: preferencesRef.current.autoAnnounce,
      announcementId: announcementIdRef.current,
    };
    setMatchView((current) => applyMatchViewAction(current, action));
  }, []);

  const handleKeyboardDiagnosticEvent = useCallback((event: KeyboardRemoteDiagnosticEvent) => {
    setDiagnostics((current) => [{ source: 'keyboard' as const, ...event }, ...current].slice(0, 10));
  }, []);

  const handleGamepadDiagnosticEvent = useCallback((event: GamepadRemoteDiagnosticEvent) => {
    setDiagnostics((current) => [event, ...current].slice(0, 10));
  }, []);

  useEffect(() => {
    const connection = connectKeyboardRemote({ dispatch, onDiagnosticEvent: handleKeyboardDiagnosticEvent });
    keyboardConnectionRef.current = connection;

    return () => {
      connection.disconnect();

      if (keyboardConnectionRef.current === connection) {
        keyboardConnectionRef.current = undefined;
      }
    };
  }, [dispatch, handleKeyboardDiagnosticEvent]);

  useEffect(() => {
    const connection = connectGamepadRemote({ dispatch, onDiagnosticEvent: handleGamepadDiagnosticEvent });
    gamepadConnectionRef.current = connection;

    return () => {
      connection.disconnect();

      if (gamepadConnectionRef.current === connection) {
        gamepadConnectionRef.current = undefined;
      }
    };
  }, [dispatch, handleGamepadDiagnosticEvent]);

  useEffect(() => {
    const pending = matchView.pendingAutoAnnouncement;

    if (pending === undefined || pending.id === lastSpokenAnnouncementIdRef.current) {
      return;
    }

    lastSpokenAnnouncementIdRef.current = pending.id;
    speakAnnouncement(pending.match);
  }, [matchView.pendingAutoAnnouncement]);

  const updatePreferences = useCallback((updater: (current: AppPreferences) => AppPreferences) => {
    setPreferences((current) => {
      const next = updater(current);
      savePreferences(next);
      return next;
    });
  }, []);

  const handleMatchModeChange = useCallback(
    (mode: MatchMode) => {
      if (mode === preferencesRef.current.matchMode) {
        return;
      }

      if (hasStarted(matchView.match) && !window.confirm('Start a new match and discard the current score?')) {
        return;
      }

      updatePreferences((current) => ({ ...current, matchMode: mode }));
      setMatchView((current) =>
        applyMatchViewAction(current, { type: 'RESET_MODE', mode, playerNames: preferencesRef.current.playerNames }),
      );
    },
    [matchView.match, updatePreferences],
  );

  const handleNewMatch = useCallback(() => {
    if (hasStarted(matchView.match) && !window.confirm('Start a new match and discard the current score?')) {
      return;
    }

    setMatchView((current) =>
      applyMatchViewAction(current, {
        type: 'RESET_MODE',
        mode: preferencesRef.current.matchMode,
        playerNames: preferencesRef.current.playerNames,
      }),
    );
  }, [matchView.match]);

  const handleSetInitialServer = useCallback(
    (teamId: TeamId, playerId: PlayerId) => {
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    },
    [dispatch],
  );

  const handlePlayerNameChange = useCallback(
    (playerId: PlayerId, name: string) => {
      const nextPlayerNames = { ...preferencesRef.current.playerNames, [playerId]: name };
      updatePreferences((current) => ({ ...current, playerNames: nextPlayerNames }));
      setMatchView((current) => {
        if (hasStarted(current.match)) return current;
        return { match: createInitialMatch(preferencesRef.current.matchMode, nextPlayerNames) };
      });
    },
    [updatePreferences],
  );

  const handleRerollFirstServer = useCallback(() => {
    const choices: ReadonlyArray<{ teamId: TeamId; playerId: PlayerId }> =
      preferencesRef.current.matchMode === 'singles'
        ? [
            { teamId: 'teamA', playerId: 'A1' },
            { teamId: 'teamB', playerId: 'B1' },
          ]
        : [
            { teamId: 'teamA', playerId: 'A1' },
            { teamId: 'teamA', playerId: 'A2' },
            { teamId: 'teamB', playerId: 'B1' },
            { teamId: 'teamB', playerId: 'B2' },
          ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    dispatch({ type: 'SET_INITIAL_SERVER', teamId: choice.teamId, playerId: choice.playerId });
  }, [dispatch]);

  const handleConnectBluetooth = useCallback(async () => {
    connectionRef.current?.disconnect();
    connectionRef.current = undefined;
    connectAttemptIdRef.current += 1;
    const attemptId = connectAttemptIdRef.current;
    const connection = await connectBluetoothRemote({
      dispatch,
      onStatusChange: (status) => {
        if (mountedRef.current && connectAttemptIdRef.current === attemptId) {
          setBluetoothStatus(status);
        }
      },
    });

    if (connection === undefined) {
      return;
    }

    if (!mountedRef.current || connectAttemptIdRef.current !== attemptId) {
      connection.disconnect();
      return;
    }

    connectionRef.current = connection;
  }, [dispatch]);

  return (
    <main className="app-shell">
      <div className="app-layout">
        <Scoreboard match={match} onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })} />
        <CourtView match={match} />
        <Controls
          match={match}
          autoAnnounce={preferences.autoAnnounce}
          matchMode={preferences.matchMode}
          playerNames={preferences.playerNames}
          onUndo={() => dispatch({ type: 'UNDO' })}
          onAnnounce={() => speakAnnouncement(match)}
          onAutoAnnounceChange={(autoAnnounce) => updatePreferences((current) => ({ ...current, autoAnnounce }))}
          onMatchModeChange={handleMatchModeChange}
          onNewMatch={handleNewMatch}
          onSetInitialServer={handleSetInitialServer}
          onRerollFirstServer={handleRerollFirstServer}
          onPlayerNameChange={handlePlayerNameChange}
        />
        <StatusBar
          bluetoothStatus={bluetoothStatus}
          speechStatus={getSpeechStatus()}
          onConnectBluetooth={handleConnectBluetooth}
        />
        <RemoteDiagnostics events={diagnostics} />
      </div>
    </main>
  );
}

type DiagnosticEvent = ({ source: 'keyboard' } & KeyboardRemoteDiagnosticEvent) | GamepadRemoteDiagnosticEvent;

function RemoteDiagnostics({ events }: { readonly events: DiagnosticEvent[] }) {
  return (
    <details className="remote-diagnostics" aria-label="Remote input log">
      <summary className="remote-diagnostics-header">
        <h2>Remote input log</h2>
        <span>{events.length === 0 ? 'Listening' : `${events.length} shown`}</span>
      </summary>
      {events.length === 0 ? (
        <p className="remote-diagnostics-empty">No events seen yet</p>
      ) : (
        <ol className="remote-diagnostics-list">
          {events.map((event, index) =>
            event.source === 'gamepad' ? (
              <li key={`gamepad-${event.type}-${event.gamepadIndex}-${event.buttonIndex}-${index}`}>
                <strong>[gamepad] {event.type}</strong>
                <span>Pad {event.gamepadIndex}</span>
                <span>Btn {event.buttonIndex}</span>
                <span title={event.gamepadId}>{event.gamepadId.slice(0, 30)}</span>
              </li>
            ) : (
              <li key={`keyboard-${event.type}-${event.key}-${event.code}-${event.keyCode}-${index}`}>
                <strong>[key] {event.type}</strong>
                <span>Key {event.key || 'Unidentified'}</span>
                <span>Code {event.code || 'none'}</span>
                <span>KeyCode {event.keyCode}</span>
                <span>Which {event.which}</span>
                <span>Repeat {event.repeat ? 'yes' : 'no'}</span>
              </li>
            ),
          )}
        </ol>
      )}
    </details>
  );
}

function createInitialMatch(mode: MatchMode, playerNames: Record<PlayerId, string>): MatchState {
  return createMatch({ mode, initialServingTeamId: 'teamA', initialServingPlayerId: 'A1', playerNames });
}

function hasStarted(match: MatchState): boolean {
  return match.score.teamA !== 0 || match.score.teamB !== 0 || match.previous !== undefined || match.winnerTeamId !== undefined;
}

function applyMatchViewAction(current: MatchViewState, action: MatchViewAction): MatchViewState {
  if (action.type === 'RESET_MODE') {
    return {
      match: createInitialMatch(action.mode, action.playerNames),
    };
  }

  const nextMatch = applyCommand(current.match, action.command);
  const scored = action.command.type === 'POINT_TEAM';
  const pendingAutoAnnouncement =
    scored && action.autoAnnounce && nextMatch !== current.match
      ? { id: action.announcementId, match: nextMatch }
      : current.pendingAutoAnnouncement;

  return {
    match: nextMatch,
    pendingAutoAnnouncement,
  };
}
