import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { CourtView } from './components/CourtView';
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
import { AccountBar } from './components/AccountBar';
import { AppModal } from './components/AppModal';
import { AnnouncementSettingsModal } from './components/AnnouncementSettingsModal';
import { DisplaySettingsModal } from './components/DisplaySettingsModal';
import { MatchSettingsModal } from './components/MatchSettingsModal';
import { RemoteControlsModal } from './components/RemoteControlsModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import type { DiagnosticEvent } from './components/DiagnosticsModal';
import { SessionMatchHistory } from './components/SessionMatchHistory';
import { useWatchRemoteHost } from './hooks/useWatchRemoteHost';
import { useAuth } from './auth';
import type { ActiveSession, MatchSuggestion as MatchSuggestionData, TeamSplit } from './session/sessionTypes';
import { detectAnimationEvent } from './animations/detectAnimationEvent';
import { AnimationOverlay } from './components/AnimationOverlay';
import type { AnimationEvent } from './animations/types';
import type { AppMenuAction } from './components/AppMenu';

type AppMode = 'match' | 'session';
type SessionPhase = 'setup' | 'suggestion' | 'playing';
type AppSettingsModal = Exclude<AppMenuAction, 'sessionMode' | 'newMatch'>;

const appSettingsModalTitles: Record<AppSettingsModal, string> = {
  matchSettings: 'Match settings',
  announcementSettings: 'Announcement settings',
  displaySettings: 'Display settings',
  remoteControls: 'Remote controls',
  diagnostics: 'Diagnostics',
};

const sessionAppMenuActions: readonly AppMenuAction[] = [
  'matchSettings',
  'announcementSettings',
  'displaySettings',
  'remoteControls',
  'diagnostics',
  'sessionMode',
];

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
  const [currentSessionMatchStartedAt, setCurrentSessionMatchStartedAt] = useState<string | undefined>(undefined);
  const [savedPlayers, setSavedPlayers] = useState<string[]>(() => loadSavedPlayers());
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothStatus>(() => getBluetoothSupportStatus());
  const [diagnostics, setDiagnostics] = useState<DiagnosticEvent[]>([]);
  const [activeModal, setActiveModal] = useState<AppSettingsModal | undefined>(undefined);
  const connectionRef = useRef<BluetoothRemoteConnection | undefined>(undefined);
  const keyboardConnectionRef = useRef<KeyboardRemoteConnection | undefined>(undefined);
  const gamepadConnectionRef = useRef<GamepadRemoteConnection | undefined>(undefined);
  const preferencesRef = useRef(preferences);
  const announcementIdRef = useRef(0);
  const lastSpokenAnnouncementIdRef = useRef(0);
  const connectAttemptIdRef = useRef(0);
  const mountedRef = useRef(false);
  const match = matchView.match;
  const [activeAnimation, setActiveAnimation] = useState<AnimationEvent | null>(null);
  const prevMatchRef = useRef<MatchState>(matchView.match);

  const handleAnimationDismiss = useCallback(() => setActiveAnimation(null), []);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    saveMatchState(matchView.match);
  }, [matchView.match]);

  useEffect(() => {
    const prev = prevMatchRef.current;
    const next = matchView.match;
    prevMatchRef.current = next;

    if (!preferencesRef.current.animationsEnabled) return;

    const event = detectAnimationEvent(prev, next);
    if (event) {
      setActiveAnimation((current) => current ?? event);
    }
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
    setActiveModal(undefined);
    setAppMode('session');
  }, [matchView.match]);

  const handleSwitchToMatch = useCallback(() => {
    if (activeSession && !window.confirm('End the current session?')) return;
    if (activeSession) {
      appendToSessionArchive(archiveSession(activeSession, new Date().toISOString()));
      clearActiveSession();
      setActiveSession(undefined);
      setCurrentSuggestion(undefined);
      setCurrentSessionMatchStartedAt(undefined);
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
    setCurrentSessionMatchStartedAt(new Date().toISOString());
    setSessionPhase('playing');
  }, []);

  const handleMatchEnded = useCallback((winnerTeam: 'teamA' | 'teamB') => {
    if (!activeSession || !currentPlayedSplit) return;
    const endedAt = new Date().toISOString();
    const updated = applyMatchResult(activeSession, currentPlayedSplit, winnerTeam, {
      startedAt: currentSessionMatchStartedAt ?? endedAt,
      endedAt,
    });
    saveActiveSession(updated);
    const suggestion = generateMatchSuggestion(updated);
    setActiveSession(updated);
    setCurrentSuggestion(suggestion);
    setCurrentPlayedSplit(undefined);
    setCurrentSessionMatchStartedAt(undefined);
    setSessionPhase('suggestion');
  }, [activeSession, currentPlayedSplit, currentSessionMatchStartedAt]);

  const handleEndSession = useCallback(() => {
    if (!activeSession) return;
    if (!window.confirm('End the current session?')) return;
    appendToSessionArchive(archiveSession(activeSession, new Date().toISOString()));
    clearActiveSession();
    clearMatchState();
    setActiveSession(undefined);
    setCurrentSuggestion(undefined);
    setCurrentPlayedSplit(undefined);
    setCurrentSessionMatchStartedAt(undefined);
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

  const handleStartWatchRemote = useCallback(() => { void watchRemote.start(); }, [watchRemote]);
  const handleStopWatchRemote = useCallback(() => { void watchRemote.stop(); }, [watchRemote]);

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

  const handleAutoAnnounceChange = useCallback(
    (autoAnnounce: boolean) => updatePreferences((current) => ({ ...current, autoAnnounce })),
    [updatePreferences],
  );

  const handleAnnouncementModeChange = useCallback(
    (announcementMode: AppPreferences['announcementMode']) =>
      updatePreferences((current) => ({ ...current, announcementMode })),
    [updatePreferences],
  );

  const handleAnimationsEnabledChange = useCallback(
    (animationsEnabled: boolean) => updatePreferences((current) => ({ ...current, animationsEnabled })),
    [updatePreferences],
  );

  const handleShowSessionHistoryDuringLiveMatchesChange = useCallback(
    (showSessionHistoryDuringLiveMatches: boolean) =>
      updatePreferences((current) => ({ ...current, showSessionHistoryDuringLiveMatches })),
    [updatePreferences],
  );

  const handleAppMenuAction = useCallback(
    (action: AppMenuAction) => {
      if (action === 'sessionMode') {
        handleSwitchToSession();
        return;
      }

      if (action === 'newMatch') {
        setActiveModal(undefined);
        handleNewMatch();
        return;
      }

      setActiveModal(action);
    },
    [handleNewMatch, handleSwitchToSession],
  );

  const matchWinner = match.winnerTeamId;
  const availableAppMenuActions = appMode === 'session' ? sessionAppMenuActions : undefined;
  const sessionPlayerNames = useMemo(() => {
    if (appMode !== 'session') return undefined;
    const allPlayers = [...match.teams.teamA.players, ...match.teams.teamB.players];
    return {
      A1: allPlayers.find(p => p.id === 'A1')?.name ?? '',
      A2: allPlayers.find(p => p.id === 'A2')?.name ?? '',
      B1: allPlayers.find(p => p.id === 'B1')?.name ?? '',
      B2: allPlayers.find(p => p.id === 'B2')?.name ?? '',
    };
  }, [appMode, match.teams]);
  const settingsLocked = appMode === 'session' && sessionPhase === 'playing';
  const activeModalDialog = activeModal ? (
    <AppModal title={appSettingsModalTitles[activeModal]} onClose={() => setActiveModal(undefined)}>
      {activeModal === 'matchSettings' ? (
        <MatchSettingsModal
          match={match}
          matchMode={preferences.matchMode}
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          settingsLocked={settingsLocked}
          onMatchModeChange={handleMatchModeChange}
          onSetInitialServer={handleSetInitialServer}
          onRerollFirstServer={handleRerollFirstServer}
          onPlayerNameChange={appMode === 'session' ? () => undefined : handlePlayerNameChange}
        />
      ) : activeModal === 'announcementSettings' ? (
        <AnnouncementSettingsModal
          autoAnnounce={preferences.autoAnnounce}
          announcementMode={preferences.announcementMode}
          speechStatus={getSpeechStatus()}
          onAutoAnnounceChange={handleAutoAnnounceChange}
          onAnnouncementModeChange={handleAnnouncementModeChange}
        />
      ) : activeModal === 'displaySettings' ? (
        <DisplaySettingsModal
          animationsEnabled={preferences.animationsEnabled}
          showSessionHistoryDuringLiveMatches={preferences.showSessionHistoryDuringLiveMatches}
          onAnimationsEnabledChange={handleAnimationsEnabledChange}
          onShowSessionHistoryDuringLiveMatchesChange={handleShowSessionHistoryDuringLiveMatchesChange}
        />
      ) : activeModal === 'remoteControls' ? (
        <RemoteControlsModal
          bluetoothStatus={bluetoothStatus}
          watchRemote={{
            status: watchRemote.status,
            code: watchRemote.code,
            error: watchRemote.error,
            lastCommandLabel: watchRemote.lastCommandLabel,
          }}
          authUnavailable={authUnavailable}
          onConnectBluetooth={handleConnectBluetooth}
          onStartWatchRemote={handleStartWatchRemote}
          onStopWatchRemote={handleStopWatchRemote}
        />
      ) : activeModal === 'diagnostics' ? (
        <DiagnosticsModal events={diagnostics} />
      ) : null}
    </AppModal>
  ) : null;

  if (appMode === 'session' && sessionPhase === 'setup') {
    return (
      <main className="app-shell">
        <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={availableAppMenuActions} />
        <div className="app-layout session-layout">
          <div className="app-mode-toggle">
            <button onClick={handleSwitchToMatch}>← Match mode</button>
          </div>
          <SessionSetup savedPlayers={savedPlayers} onStartSession={handleStartSession} />
        </div>
        {activeModalDialog}
      </main>
    );
  }

  if (appMode === 'session' && sessionPhase === 'suggestion' && currentSuggestion && activeSession) {
    return (
      <main className="app-shell">
        <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={availableAppMenuActions} />
        <div className="app-layout session-layout">
          <MatchSuggestion
            suggestion={currentSuggestion}
            pairingMatrix={activeSession.pairingMatrix}
            completedMatches={activeSession.matches}
            onStartMatch={handleStartMatch}
            onEditPlayers={handleEditPlayers}
            onEndSession={handleEndSession}
          />
        </div>
        {activeModalDialog}
      </main>
    );
  }

  const isSessionPlaying = appMode === 'session' && sessionPhase === 'playing';
  const canReturnToSessionSuggestion = isSessionPlaying && !hasStarted(match);

  return (
    <main className="app-shell">
      <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={availableAppMenuActions} />
      <div className="app-layout">
        <CourtView match={match} onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })} />
        <Controls
          onUndo={() => dispatch({ type: 'UNDO' })}
          onAnnounce={() => speakAnnouncement(match, preferencesRef.current.announcementMode)}
          showBackToSessionSuggestion={canReturnToSessionSuggestion}
          onBackToSessionSuggestion={handleBackToSessionSuggestion}
          onEndSession={isSessionPlaying ? handleEndSession : undefined}
        />
        {isSessionPlaying && preferences.showSessionHistoryDuringLiveMatches && activeSession ? (
          <SessionMatchHistory matches={activeSession.matches} />
        ) : null}
        {appMode === 'session' && sessionPhase === 'playing' && matchWinner && (
          <div className="session-match-over" role="dialog" aria-label="Match over">
            <p>{match.teams[matchWinner].name} wins!</p>
            <button onClick={() => handleMatchEnded(matchWinner)}>Next match →</button>
          </div>
        )}
      </div>
      {activeModalDialog}
      <AnimationOverlay event={activeAnimation} onDismiss={handleAnimationDismiss} />
    </main>
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
