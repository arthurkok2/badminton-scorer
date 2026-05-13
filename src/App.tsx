import { useCallback, useEffect, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { CourtView } from './components/CourtView';
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
import { loadPreferences, loadMatchState, savePreferences, saveMatchState, clearMatchState, type AppPreferences } from './preferences';
import { getSpeechStatus, speakAnnouncement } from './speech/announcer';
import {
  createSession,
  generateMatchSuggestion,
  applyMatchResult,
  archiveSession,
} from './session/sessionScheduler';
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  appendToSessionArchive,
  loadSavedPlayers,
  saveSavedPlayers,
} from './session/sessionStorage';
import { SessionSetup } from './components/SessionSetup';
import { MatchSuggestion } from './components/MatchSuggestion';
import { WatchRemotePanel } from './components/WatchRemotePanel';
import { AccountBar } from './components/AccountBar';
import { useWatchRemoteHost } from './hooks/useWatchRemoteHost';
import { useAuth } from './auth';
import type { ActiveSession, MatchSuggestion as MatchSuggestionData, TeamSplit } from './session/sessionTypes';

type AppMode = 'match' | 'session';
type SessionPhase = 'setup' | 'suggestion' | 'playing';

interface MatchViewState {
  readonly match: MatchState;
  readonly pendingAutoAnnouncement?: {
    readonly id: number;
    readonly match: MatchState;
    readonly announcementMode: AppPreferences['announcementMode'];
  };
}

type MatchViewAction =
  | {
      readonly type: 'APPLY_COMMAND';
      readonly command: AppCommand;
      readonly autoAnnounce: boolean;
      readonly announcementMode: AppPreferences['announcementMode'];
      readonly announcementId: number;
    }
  | { readonly type: 'RESET_MODE'; readonly mode: MatchMode; readonly playerNames: Record<PlayerId, string> };

export default function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [matchView, setMatchView] = useState<MatchViewState>(() => {
    const saved = loadMatchState();
    const match =
      saved !== undefined && saved.mode === preferences.matchMode
        ? saved
        : createInitialMatch(preferences.matchMode, preferences.playerNames);
    return { match };
  });
  const [appMode, setAppMode] = useState<AppMode>(() =>
    loadActiveSession() ? 'session' : 'match',
  );
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>(() =>
    loadActiveSession() ? 'suggestion' : 'setup',
  );
  const [activeSession, setActiveSession] = useState<ActiveSession | undefined>(
    () => loadActiveSession(),
  );
  const [currentSuggestion, setCurrentSuggestion] = useState<MatchSuggestionData | undefined>(() => {
    const saved = loadActiveSession();
    return saved ? generateMatchSuggestion(saved) : undefined;
  });
  const [currentPlayedSplit, setCurrentPlayedSplit] = useState<TeamSplit | undefined>(undefined);
  const [savedPlayers, setSavedPlayers] = useState<string[]>(() => loadSavedPlayers());
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
    saveMatchState(matchView.match);
  }, [matchView.match]);

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
      announcementMode: preferencesRef.current.announcementMode,
      announcementId: announcementIdRef.current,
    };
    setMatchView((current) => applyMatchViewAction(current, action));
  }, []);

  const { authUnavailable } = useAuth();

  const watchRemote = useWatchRemoteHost({
    match,
    dispatch,
    announce: () => speakAnnouncement(match),
  });

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
    speakAnnouncement(pending.match, pending.announcementMode);
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

      clearMatchState();
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

    clearMatchState();
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

  const handleSwitchToSession = useCallback(() => {
    if (hasStarted(matchView.match) && !window.confirm('Leave this match and start a session?')) return;
    setAppMode('session');
  }, [matchView.match]);

  const handleSwitchToMatch = useCallback(() => {
    if (activeSession && !window.confirm('End the current session?')) return;
    if (activeSession) {
      appendToSessionArchive(archiveSession(activeSession, new Date().toISOString()));
      clearActiveSession();
      setActiveSession(undefined);
      setCurrentSuggestion(undefined);
    }
    setAppMode('match');
    setSessionPhase('setup');
  }, [activeSession]);

  const handleStartSession = useCallback((playerNames: readonly string[]) => {
    const merged = Array.from(new Set([...savedPlayers, ...playerNames]));
    saveSavedPlayers(merged);
    setSavedPlayers(merged);
    const session = createSession(playerNames);
    saveActiveSession(session);
    const suggestion = generateMatchSuggestion(session);
    setActiveSession(session);
    setCurrentSuggestion(suggestion);
    setSessionPhase('suggestion');
  }, [savedPlayers]);

  const handleStartMatch = useCallback((split: TeamSplit) => {
    const playerNames = { A1: split.teamA[0], A2: split.teamA[1], B1: split.teamB[0], B2: split.teamB[1] };
    clearMatchState();
    setMatchView({ match: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1', playerNames }) });
    setCurrentPlayedSplit(split);
    setSessionPhase('playing');
  }, []);

  const handleMatchEnded = useCallback((winnerTeam: 'teamA' | 'teamB') => {
    if (!activeSession || !currentPlayedSplit) return;
    const updated = applyMatchResult(activeSession, currentPlayedSplit, winnerTeam);
    saveActiveSession(updated);
    const suggestion = generateMatchSuggestion(updated);
    setActiveSession(updated);
    setCurrentSuggestion(suggestion);
    setCurrentPlayedSplit(undefined);
    setSessionPhase('suggestion');
  }, [activeSession, currentPlayedSplit]);

  const handleEndSession = useCallback(() => {
    if (!activeSession) return;
    if (!window.confirm('End the current session?')) return;
    appendToSessionArchive(archiveSession(activeSession, new Date().toISOString()));
    clearActiveSession();
    clearMatchState();
    setActiveSession(undefined);
    setCurrentSuggestion(undefined);
    setCurrentPlayedSplit(undefined);
    setMatchView((current) =>
      applyMatchViewAction(current, {
        type: 'RESET_MODE',
        mode: preferencesRef.current.matchMode,
        playerNames: preferencesRef.current.playerNames,
      }),
    );
    setSessionPhase('setup');
    setAppMode('match');
  }, [activeSession]);

  const handleEditPlayers = useCallback(() => {
    if (activeSession && activeSession.matches.length > 0 && !window.confirm('Editing players will reset the current session\'s match history. Continue?')) return;
    setSessionPhase('setup');
  }, [activeSession]);

  const handleBackToSessionSuggestion = useCallback(() => {
    if (appMode !== 'session' || sessionPhase !== 'playing' || hasStarted(matchView.match)) return;
    setSessionPhase('suggestion');
  }, [appMode, matchView.match, sessionPhase]);

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

  const matchWinner = match.winnerTeamId;

  if (appMode === 'session' && sessionPhase === 'setup') {
    return (
      <main className="app-shell">
        <AccountBar />
        <div className="app-layout session-layout">
          <div className="app-mode-toggle">
            <button onClick={handleSwitchToMatch}>← Match mode</button>
          </div>
          <SessionSetup savedPlayers={savedPlayers} onStartSession={handleStartSession} />
        </div>
      </main>
    );
  }

  if (appMode === 'session' && sessionPhase === 'suggestion' && currentSuggestion && activeSession) {
    return (
      <main className="app-shell">
        <AccountBar />
        <div className="app-layout session-layout">
          <MatchSuggestion
            suggestion={currentSuggestion}
            pairingMatrix={activeSession.pairingMatrix}
            onStartMatch={handleStartMatch}
            onEditPlayers={handleEditPlayers}
            onEndSession={handleEndSession}
          />
        </div>
      </main>
    );
  }

  const sessionPlayerNames = appMode === 'session'
    ? {
        A1: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'A1')?.name ?? '',
        A2: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'A2')?.name ?? '',
        B1: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'B1')?.name ?? '',
        B2: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'B2')?.name ?? '',
      }
    : undefined;
  const isSessionPlaying = appMode === 'session' && sessionPhase === 'playing';
  const canReturnToSessionSuggestion = isSessionPlaying && !hasStarted(match);

  return (
    <main className="app-shell">
      <AccountBar />
      <div className="app-layout">
        <CourtView match={match} onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })} />
        <Controls
          match={match}
          autoAnnounce={preferences.autoAnnounce}
          announcementMode={preferences.announcementMode}
          matchMode={preferences.matchMode}
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          onUndo={() => dispatch({ type: 'UNDO' })}
          onAnnounce={() => speakAnnouncement(match, preferencesRef.current.announcementMode)}
          onAutoAnnounceChange={(autoAnnounce) => updatePreferences((current) => ({ ...current, autoAnnounce }))}
          onAnnouncementModeChange={(announcementMode) => updatePreferences((current) => ({ ...current, announcementMode }))}
          onMatchModeChange={handleMatchModeChange}
          onNewMatch={handleNewMatch}
          onStartSessionMode={handleSwitchToSession}
          onSetInitialServer={handleSetInitialServer}
          onRerollFirstServer={handleRerollFirstServer}
          onPlayerNameChange={appMode === 'session' ? () => {} : handlePlayerNameChange}
          showMatchSetupControls={!isSessionPlaying}
          showNewMatchControl={!isSessionPlaying}
          showSessionModeControl={!isSessionPlaying}
          showBackToSessionSuggestion={canReturnToSessionSuggestion}
          onBackToSessionSuggestion={handleBackToSessionSuggestion}
          onEndSession={isSessionPlaying ? handleEndSession : undefined}
        />
        <StatusBar
          bluetoothStatus={bluetoothStatus}
          speechStatus={getSpeechStatus()}
          onConnectBluetooth={handleConnectBluetooth}
        />
        <RemoteDiagnostics events={diagnostics} />
        <WatchRemotePanel
          status={watchRemote.status}
          code={watchRemote.code}
          error={watchRemote.error}
          lastCommandLabel={watchRemote.lastCommandLabel}
          authUnavailable={authUnavailable}
          onStart={() => { void watchRemote.start(); }}
          onStop={() => { void watchRemote.stop(); }}
        />
        {appMode === 'session' && sessionPhase === 'playing' && matchWinner && (
          <div className="session-match-over" role="dialog" aria-label="Match over">
            <p>{match.teams[matchWinner].name} wins!</p>
            <button onClick={() => handleMatchEnded(matchWinner)}>Next match →</button>
          </div>
        )}
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
  return match.score.teamA !== 0 || match.score.teamB !== 0 || match.history.length > 0 || match.winnerTeamId !== undefined;
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
      ? { id: action.announcementId, match: nextMatch, announcementMode: action.announcementMode }
      : current.pendingAutoAnnouncement;

  return {
    match: nextMatch,
    pendingAutoAnnouncement,
  };
}
