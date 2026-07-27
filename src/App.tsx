import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { CourtView } from './components/CourtView';
import { PoseCamera } from './components/PoseCamera';
import { createMatch } from './domain/matchEngine';
import type { MatchMode, MatchState, PlayerId, TeamId } from './domain/matchTypes';
import { LITTLE_FIGHTER_SPRITES, LITTLE_FIGHTER_SPRITES_BY_ID, type LittleFighterSpriteId } from './sprites/spriteCatalog';
import { resolveLittleFighterSpriteIds } from './sprites/spriteSelection';
import { SpritePickerModal } from './components/SpritePickerModal';
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
  searchGlobalPlayers,
  createGlobalPlayerDocument,
  completeCloudSessionMatch,
  importMappedLegacySessions,
  loadCloudHistoryStats,
  saveCloudSession,
  updateGlobalPlayerSpriteId,
  type CloudHistoryStats,
} from './session/cloudSessionService';
import {
  loadActiveSession,
  loadSessionArchive,
  saveActiveSession,
  clearActiveSession,
  appendToSessionArchive,
  isSessionImportedForUser,
  markSessionImportedForUser,
  loadInProgressMatchState,
  saveInProgressMatchState,
  clearInProgressMatchState,
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
import { SessionImportPrompt } from './components/SessionImportPrompt';
import { HistoryStatsModal } from './components/HistoryStatsModal';
import { ToastViewport, type ToastMessage } from './components/ToastViewport';
import { useWatchRemoteHost } from './hooks/useWatchRemoteHost';
import { useAuth } from './auth';
import type { ActiveSession, GlobalPlayer, MatchSuggestion as MatchSuggestionData, TeamSplit } from './session/sessionTypes';
import { detectAnimationEvent } from './animations/detectAnimationEvent';
import { AnimationOverlay } from './components/AnimationOverlay';
import { SpinningShuttle } from './components/SpinningShuttle';
import type { AnimationEvent } from './animations/types';
import type { AppMenuAction } from './components/AppMenu';

type AppMode = 'match' | 'session';
type SessionPhase = 'setup' | 'suggestion' | 'playing';
type AppSettingsModal = Exclude<AppMenuAction, 'sessionMode' | 'newMatch' | 'historyStats'>;
type AppModal = AppSettingsModal | 'sessionSignIn';

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
  'historyStats',
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
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>(() => {
    if (!loadActiveSession()) return 'setup';
    return loadInProgressMatchState() ? 'playing' : 'suggestion';
  });
  const [activeSession, setActiveSession] = useState<ActiveSession | undefined>(
    () => loadActiveSession(),
  );
  const [currentSuggestion, setCurrentSuggestion] = useState<MatchSuggestionData | undefined>(() => {
    const saved = loadActiveSession();
    return saved ? generateMatchSuggestion(saved) : undefined;
  });
  const [currentPlayedSplit, setCurrentPlayedSplit] = useState<TeamSplit | undefined>(
    () => loadInProgressMatchState()?.split,
  );
  const [currentSessionMatchStartedAt, setCurrentSessionMatchStartedAt] = useState<string | undefined>(
    () => loadInProgressMatchState()?.startedAt,
  );
  const [sessionSyncError, setSessionSyncError] = useState<string | undefined>(undefined);
  const [pendingRetryMatch, setPendingRetryMatch] = useState<{ matchRecord: import('./session/sessionTypes').MatchRecord } | undefined>(undefined);
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothStatus>(() => getBluetoothSupportStatus());
  const [diagnostics, setDiagnostics] = useState<DiagnosticEvent[]>([]);
  const [activeModal, setActiveModal] = useState<AppModal | undefined>(undefined);
  const [playerSearchResults, setPlayerSearchResults] = useState<GlobalPlayer[]>([]);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [showHistoryStats, setShowHistoryStats] = useState(false);
  const [importLegacyNames, setImportLegacyNames] = useState<string[]>([]);
  const [cloudHistoryStats, setCloudHistoryStats] = useState<CloudHistoryStats | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [savedPlayers, setSavedPlayers] = useState<GlobalPlayer[]>([]);
  const [activeSpritePickerPlayerId, setActiveSpritePickerPlayerId] = useState<PlayerId | undefined>(undefined);
  const [oneOffSpriteOverrides, setOneOffSpriteOverrides] = useState<Partial<Record<PlayerId, LittleFighterSpriteId>>>({});
  const [spriteSaveState, setSpriteSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [spriteSaveError, setSpriteSaveError] = useState<string | undefined>(undefined);
  const [gestureStatus, setGestureStatus] = useState<{ gesture: string; frames: number } | null>(null);

  useEffect(() => {
    setSpriteSaveState('idle');
    setSpriteSaveError(undefined);
  }, [activeSpritePickerPlayerId]);

  const connectionRef = useRef<BluetoothRemoteConnection | undefined>(undefined);
  const keyboardConnectionRef = useRef<KeyboardRemoteConnection | undefined>(undefined);
  const gamepadConnectionRef = useRef<GamepadRemoteConnection | undefined>(undefined);
  const preferencesRef = useRef(preferences);
  const announcementIdRef = useRef(0);
  const lastSpokenAnnouncementIdRef = useRef(0);
  const connectAttemptIdRef = useRef(0);
  const mountedRef = useRef(false);
  const toastIdRef = useRef(0);
  const match = matchView.match;
  const [activeAnimation, setActiveAnimation] = useState<AnimationEvent | null>(null);
  const [showSpinningShuttle, setShowSpinningShuttle] = useState(false);
  const prevMatchRef = useRef<MatchState>(matchView.match);

  const handleAnimationDismiss = useCallback(() => setActiveAnimation(null), []);
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastMessage['variant'] = 'error') => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((current) => [...current.slice(-2), { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

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

  const {
    user,
    loading: authLoading,
    isAnonymous,
    authUnavailable,
    signInWithGoogle,
  } = useAuth();
  const watchRemoteUnavailableReason = authLoading
    ? 'Checking sign-in...'
    : authUnavailable
      ? 'Sign-in unavailable offline.'
      : !user || isAnonymous
        ? 'Sign in to start watch remote.'
        : undefined;

  useEffect(() => {
    if (!user || isAnonymous) return;
    const archive = loadSessionArchive();
    const activeSession = loadActiveSession();
    const sessions = activeSession ? [activeSession, ...archive] : archive;
    const unimportedNames = new Set<string>();
    for (const session of sessions) {
      if (!isSessionImportedForUser(user.uid, session.id) && hasLegacySessionPlayer(session.players)) {
        for (const player of session.players) {
          const displayName = getStoredSessionPlayerDisplayName(player);
          if (displayName) unimportedNames.add(displayName);
        }
      }
    }
    if (unimportedNames.size > 0) {
      setImportLegacyNames([...unimportedNames]);
      setShowImportPrompt(true);
    }
  }, [user, isAnonymous]);

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
      setOneOffSpriteOverrides({});
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
    setOneOffSpriteOverrides({});
    setMatchView((current) =>
      applyMatchViewAction(current, {
        type: 'RESET_MODE',
        mode: preferencesRef.current.matchMode,
        playerNames: preferencesRef.current.playerNames,
      }),
    );

    setShowSpinningShuttle(true);
  }, [matchView.match, dispatch]);

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

  const handleShuttleComplete = useCallback(
    (teamId: TeamId) => {
      setShowSpinningShuttle(false);
      const playerId = teamId === 'teamA' ? 'A1' : 'B1';
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    },
    [dispatch],
  );

  const handleSwitchToSession = useCallback(() => {
    if (!user || isAnonymous) {
      setActiveModal('sessionSignIn');
      return;
    }
    if (hasStarted(matchView.match) && !window.confirm('Leave this match and start a session?')) return;
    setActiveModal(undefined);
    setAppMode('session');
  }, [isAnonymous, matchView.match, user]);

  const handleSwitchToMatch = useCallback(() => {
    if (activeSession && !window.confirm('End the current session?')) return;
    if (activeSession) {
      const archivedSession = archiveSession(activeSession, new Date().toISOString());
      appendToSessionArchive(archivedSession);
      if (user && !isAnonymous) {
        void saveCloudSession({ uid: user.uid, session: archivedSession, status: 'completed' }).catch(() => {
          setSessionSyncError('Could not sync session to cloud.');
          showToast('Could not sync session to cloud.');
        });
      }
      clearActiveSession();
      clearInProgressMatchState();
      setActiveSession(undefined);
      setCurrentSuggestion(undefined);
      setCurrentSessionMatchStartedAt(undefined);
    }
    setAppMode('match');
    setSessionPhase('setup');
  }, [activeSession, isAnonymous, showToast, user]);

  const handleStartSession = useCallback((players: readonly GlobalPlayer[]) => {
    const session = createSession(players);
    saveActiveSession(session);
    setSavedPlayers([...players]);
    if (user && !isAnonymous) {
      void saveCloudSession({ uid: user.uid, session, status: 'active' }).catch(() => {
        setSessionSyncError('Could not sync session to cloud.');
        showToast('Could not sync session to cloud.');
      });
    }
    const suggestion = generateMatchSuggestion(session);
    setActiveSession(session);
    setCurrentSuggestion(suggestion);
    setSessionPhase('suggestion');
  }, [isAnonymous, showToast, user]);

  const handleSearchPlayers = useCallback((searchText: string) => {
    if (!user || isAnonymous) {
      setPlayerSearchResults([]);
      return;
    }

    void searchGlobalPlayers({ searchText })
      .then(results => {
        setPlayerSearchResults(results);
      })
      .catch(() => {
        setPlayerSearchResults([]);
        showToast('Could not load players. Check your connection or sign in again.');
      });
  }, [isAnonymous, showToast, user]);

  const handleCreatePlayer = useCallback(async (displayName: string): Promise<GlobalPlayer | undefined> => {
    if (!user || isAnonymous) return undefined;
    try {
      return await createGlobalPlayerDocument({ displayName, uid: user.uid });
    } catch {
      showToast('Could not create player. Check your connection or sign in again.');
      return undefined;
    }
  }, [isAnonymous, showToast, user]);

  const handleImportSessions = useCallback((mapping: ReadonlyMap<string, GlobalPlayer>) => {
    if (!user) return;
    const archive = loadSessionArchive();
    const active = loadActiveSession();
    const sessions = active ? [active, ...archive] : archive;
    const importableSessions = sessions.filter((session) => hasLegacySessionPlayer(session.players));
    void importMappedLegacySessions({ uid: user.uid, sessions: importableSessions, mapping })
      .then(() => {
        for (const session of importableSessions) {
          markSessionImportedForUser(user.uid, session.id);
        }
        setSessionSyncError(undefined);
        setShowImportPrompt(false);
      })
      .catch(() => {
        setSessionSyncError('Could not import local sessions to cloud. Try again.');
        showToast('Could not import local sessions to cloud. Try again.');
      });
  }, [showToast, user]);

  const handleShowHistoryStats = useCallback(() => {
    if (!user || isAnonymous) {
      setActiveModal('sessionSignIn');
      return;
    }

    void loadCloudHistoryStats({ uid: user.uid })
      .then((stats) => {
        setCloudHistoryStats(stats);
        setShowHistoryStats(true);
      })
      .catch(() => {
        setSessionSyncError('Could not load cloud history.');
        showToast('Could not load cloud history.');
        setCloudHistoryStats(undefined);
        setShowHistoryStats(true);
      });
  }, [isAnonymous, showToast, user]);

  const handleDismissImport = useCallback(() => {
    setShowImportPrompt(false);
  }, []);

  const getGlobalPlayerIdForMatchSlot = useCallback((slot: PlayerId): string | undefined => {
    if (!currentPlayedSplit) return undefined;
    const index = slot === 'A1' ? 0 : slot === 'A2' ? 1 : slot === 'B1' ? 0 : 1;
    const players = slot === 'A1' || slot === 'A2' ? currentPlayedSplit.teamA : currentPlayedSplit.teamB;
    return players[index]?.id;
  }, [currentPlayedSplit]);

  async function handleSelectPlayerSprite(spriteId: LittleFighterSpriteId) {
    if (!activeSpritePickerPlayerId) return;

    if (appMode !== 'session') {
      setOneOffSpriteOverrides((current) => ({ ...current, [activeSpritePickerPlayerId]: spriteId }));
      setActiveSpritePickerPlayerId(undefined);
      return;
    }

    const globalPlayerId = getGlobalPlayerIdForMatchSlot(activeSpritePickerPlayerId);
    if (!user?.uid || !globalPlayerId) return;

    setSpriteSaveState('saving');
    setSpriteSaveError(undefined);

    try {
      const updatedPlayer = await updateGlobalPlayerSpriteId({ playerId: globalPlayerId, spriteId });
      setSavedPlayers((current) => current.map((player) => (player.id === updatedPlayer.id ? updatedPlayer : player)));
      setSpriteSaveState('idle');
      setActiveSpritePickerPlayerId(undefined);
    } catch {
      setSpriteSaveState('error');
      setSpriteSaveError('Could not save that sprite right now.');
    }
  }

  const spriteIdMap: Readonly<Record<string, LittleFighterSpriteId | undefined>> = Object.fromEntries([
    ...savedPlayers.map((player) => [player.id, player.spriteId] as const),
    ...(activeSession?.players ?? []).map((player) => [player.id, player.spriteId] as const),
  ]);
  const resolvedSpriteIds = resolveLittleFighterSpriteIds({
    playerSlots: {
      A1: { playerId: getGlobalPlayerIdForMatchSlot('A1') },
      A2: { playerId: getGlobalPlayerIdForMatchSlot('A2') },
      B1: { playerId: getGlobalPlayerIdForMatchSlot('B1') },
      B2: { playerId: getGlobalPlayerIdForMatchSlot('B2') },
    },
    oneOffOverrides: oneOffSpriteOverrides,
    spriteIdMap,
  });
  const fighterSprites = {
    A1: LITTLE_FIGHTER_SPRITES_BY_ID[resolvedSpriteIds.A1],
    A2: LITTLE_FIGHTER_SPRITES_BY_ID[resolvedSpriteIds.A2],
    B1: LITTLE_FIGHTER_SPRITES_BY_ID[resolvedSpriteIds.B1],
    B2: LITTLE_FIGHTER_SPRITES_BY_ID[resolvedSpriteIds.B2],
  };

  const handleStartMatch = useCallback((split: TeamSplit) => {
    const playerNames = {
      A1: split.teamA[0].displayName,
      A2: split.teamA[1].displayName,
      B1: split.teamB[0].displayName,
      B2: split.teamB[1].displayName,
    };
    const startedAt = new Date().toISOString();
    clearMatchState();
    saveInProgressMatchState({ split, startedAt });
    setMatchView({ match: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1', playerNames }) });
    setCurrentPlayedSplit(split);
    setCurrentSessionMatchStartedAt(startedAt);
    setSessionPhase('playing');

    setShowSpinningShuttle(true);
  }, [dispatch]);

  const handleMatchEnded = useCallback((winnerTeam: 'teamA' | 'teamB') => {
    if (!activeSession || !currentPlayedSplit) return;
    const endedAt = new Date().toISOString();
    const updated = applyMatchResult(activeSession, currentPlayedSplit, winnerTeam, {
      finalScore: match.score,
      startedAt: currentSessionMatchStartedAt ?? endedAt,
      endedAt,
    });
    saveActiveSession(updated);
    clearInProgressMatchState();
    const suggestion = generateMatchSuggestion(updated);
    setActiveSession(updated);
    setCurrentSuggestion(suggestion);
    setCurrentPlayedSplit(undefined);
    setCurrentSessionMatchStartedAt(undefined);
    setSessionPhase('suggestion');

    if (user && !isAnonymous) {
      const completedMatch = updated.matches[updated.matches.length - 1];
      if (completedMatch) {
        setPendingRetryMatch({ matchRecord: completedMatch });
        completeCloudSessionMatch({ uid: user.uid, matchRecord: completedMatch })
          .then(() => {
            setSessionSyncError(undefined);
            setPendingRetryMatch(undefined);
          })
          .catch(() => {
            setSessionSyncError('Could not sync match to cloud. Tap to retry.');
            showToast('Could not sync match to cloud. Tap to retry.');
          });
      }
    }
  }, [activeSession, currentPlayedSplit, currentSessionMatchStartedAt, isAnonymous, match.score, showToast, user]);

  const handleEndSession = useCallback(() => {
    if (!activeSession) return;
    if (!window.confirm('End the current session?')) return;
    const archivedSession = archiveSession(activeSession, new Date().toISOString());
    appendToSessionArchive(archivedSession);
    if (user && !isAnonymous) {
      void saveCloudSession({ uid: user.uid, session: archivedSession, status: 'completed' }).catch(() => {
        setSessionSyncError('Could not sync session to cloud.');
        showToast('Could not sync session to cloud.');
      });
    }
    clearActiveSession();
    clearInProgressMatchState();
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
  }, [activeSession, isAnonymous, showToast, user]);

  const handleRetrySessionSync = useCallback(() => {
    if (!user || !pendingRetryMatch) return;
    setSessionSyncError(undefined);
    completeCloudSessionMatch({ uid: user.uid, matchRecord: pendingRetryMatch.matchRecord })
      .then(() => {
        setSessionSyncError(undefined);
        setPendingRetryMatch(undefined);
      })
      .catch(() => {
        setSessionSyncError('Could not sync match to cloud. Tap to retry.');
        showToast('Could not sync match to cloud. Tap to retry.');
      });
  }, [pendingRetryMatch, showToast, user]);

  const handleEditPlayers = useCallback(() => {
    if (activeSession && activeSession.matches.length > 0 && !window.confirm('Editing players will reset the current session\'s match history. Continue?')) return;
    setSessionPhase('setup');
  }, [activeSession]);

  const handleBackToSessionSuggestion = useCallback(() => {
    if (appMode !== 'session' || sessionPhase !== 'playing' || hasStarted(matchView.match)) return;
    clearInProgressMatchState();
    setCurrentPlayedSplit(undefined);
    setCurrentSessionMatchStartedAt(undefined);
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

  const handleDisplayModeChange = useCallback(
    (displayMode: AppPreferences['displayMode']) => updatePreferences((current) => ({ ...current, displayMode })),
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

      if (action === 'historyStats') {
        handleShowHistoryStats();
        return;
      }

      setActiveModal(action);
    },
    [handleNewMatch, handleShowHistoryStats, handleSwitchToSession],
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
  const activeModalTitle = activeModal === 'sessionSignIn'
    ? 'Sign in required'
    : activeModal !== undefined
      ? appSettingsModalTitles[activeModal]
      : '';
  const activeModalDialog = activeModal ? (
    <AppModal title={activeModalTitle} onClose={() => setActiveModal(undefined)}>
      {activeModal === 'sessionSignIn' ? (
        <div className="session-sign-in-prompt">
          <p>You need to sign in to use session mode.</p>
          <button
            className="session-primary-button"
            onClick={() => { void signInWithGoogle(); setActiveModal(undefined); }}
          >
            Sign in with Google
          </button>
        </div>
      ) : activeModal === 'matchSettings' ? (
        <MatchSettingsModal
          match={match}
          matchMode={preferences.matchMode}
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          settingsLocked={settingsLocked}
          onMatchModeChange={handleMatchModeChange}
          onSetInitialServer={handleSetInitialServer}
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
          displayMode={preferences.displayMode}
          animationsEnabled={preferences.animationsEnabled}
          showSessionHistoryDuringLiveMatches={preferences.showSessionHistoryDuringLiveMatches}
          onDisplayModeChange={handleDisplayModeChange}
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
          watchRemoteUnavailableReason={watchRemoteUnavailableReason}
          onConnectBluetooth={handleConnectBluetooth}
          onStartWatchRemote={handleStartWatchRemote}
          onStopWatchRemote={handleStopWatchRemote}
        />
      ) : activeModal === 'diagnostics' ? (
        <DiagnosticsModal events={diagnostics} />
      ) : null}
    </AppModal>
  ) : null;
  const toastViewport = <ToastViewport toasts={toasts} onDismiss={dismissToast} />;

  if (appMode === 'session' && sessionPhase === 'setup') {
    return (
      <main className="app-shell">
        <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={availableAppMenuActions} />
        <div className="app-layout session-layout">
          <div className="app-mode-toggle">
            <button onClick={handleSwitchToMatch}>← Match mode</button>
          </div>
          <SessionSetup
            savedPlayers={[]}
            searchResults={playerSearchResults}
            onSearchPlayers={handleSearchPlayers}
            onCreatePlayer={handleCreatePlayer}
            onStartSession={handleStartSession}
          />
        </div>
        {showImportPrompt && (
          <SessionImportPrompt
            legacyNames={importLegacyNames}
            searchResults={playerSearchResults}
            onSearchPlayers={handleSearchPlayers}
            onCreatePlayer={handleCreatePlayer}
            onImport={handleImportSessions}
            onDismiss={handleDismissImport}
          />
        )}
        {activeModalDialog}
        {showHistoryStats ? (
          <HistoryStatsModal
            sessions={cloudHistoryStats?.sessions ?? []}
            players={cloudHistoryStats?.players ?? []}
            pairs={cloudHistoryStats?.pairs ?? []}
            matchups={cloudHistoryStats?.matchups ?? []}
            globalMatches={cloudHistoryStats?.globalMatches ?? []}
            personalStats={cloudHistoryStats?.personalStats}
            onClose={() => setShowHistoryStats(false)}
          />
        ) : null}
        {toastViewport}
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
        {showImportPrompt && (
          <SessionImportPrompt
            legacyNames={importLegacyNames}
            searchResults={playerSearchResults}
            onSearchPlayers={handleSearchPlayers}
            onCreatePlayer={handleCreatePlayer}
            onImport={handleImportSessions}
            onDismiss={handleDismissImport}
          />
        )}
        {activeModalDialog}
        {showHistoryStats ? (
          <HistoryStatsModal
            sessions={cloudHistoryStats?.sessions ?? []}
            players={cloudHistoryStats?.players ?? []}
            pairs={cloudHistoryStats?.pairs ?? []}
            matchups={cloudHistoryStats?.matchups ?? []}
            globalMatches={cloudHistoryStats?.globalMatches ?? []}
            personalStats={cloudHistoryStats?.personalStats}
            onClose={() => setShowHistoryStats(false)}
          />
        ) : null}
        {toastViewport}
      </main>
    );
  }

  const isSessionPlaying = appMode === 'session' && sessionPhase === 'playing';
  const canReturnToSessionSuggestion = isSessionPlaying && !hasStarted(match);

  return (
    <main className="app-shell">
      <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={availableAppMenuActions} />
      <div className="app-layout">
        <CourtView
          match={match}
          displayMode={preferences.displayMode}
          onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })}
          fighterSprites={fighterSprites}
          onPlayerSpriteClick={setActiveSpritePickerPlayerId}
          gestureStatus={gestureStatus}
        />
        <PoseCamera onCommand={dispatch} onStatus={(gesture, frames) => setGestureStatus(frames > 0 ? { gesture, frames } : null)} />
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
        {isSessionPlaying && sessionSyncError ? (
          <div className="session-sync-warning" role="status">
            <span>{sessionSyncError}</span>
            <button onClick={handleRetrySessionSync}>Retry</button>
          </div>
        ) : null}
        {appMode === 'session' && sessionPhase === 'playing' && matchWinner && (
          <div className="session-match-over" role="dialog" aria-label="Match over">
            <p>{match.teams[matchWinner].name} wins!</p>
            <button onClick={() => handleMatchEnded(matchWinner)}>Next match →</button>
          </div>
        )}
      </div>
      {showImportPrompt && (
        <SessionImportPrompt
          legacyNames={importLegacyNames}
          searchResults={playerSearchResults}
          onSearchPlayers={handleSearchPlayers}
          onCreatePlayer={handleCreatePlayer}
          onImport={handleImportSessions}
          onDismiss={handleDismissImport}
        />
      )}
      {activeModalDialog}
      {activeSpritePickerPlayerId && (() => {
        const teamId: TeamId = activeSpritePickerPlayerId.startsWith('B') ? 'teamB' : 'teamA';
        const player = match.teams[teamId].players.find((p) => p.id === activeSpritePickerPlayerId);
        const playerName = player?.name ?? activeSpritePickerPlayerId;
        const selectedSpriteId = resolvedSpriteIds[activeSpritePickerPlayerId];
        return (
          <AppModal title="Choose player sprite" onClose={() => setActiveSpritePickerPlayerId(undefined)}>
            <SpritePickerModal
              playerName={playerName}
              selectedSpriteId={selectedSpriteId}
              spriteOptions={LITTLE_FIGHTER_SPRITES}
              saveState={spriteSaveState}
              errorMessage={spriteSaveError}
              onSelect={handleSelectPlayerSprite}
            />
          </AppModal>
        );
      })()}
        {showHistoryStats ? (
          <HistoryStatsModal
            sessions={cloudHistoryStats?.sessions ?? []}
            players={cloudHistoryStats?.players ?? []}
            pairs={cloudHistoryStats?.pairs ?? []}
            matchups={cloudHistoryStats?.matchups ?? []}
            globalMatches={cloudHistoryStats?.globalMatches ?? []}
            personalStats={cloudHistoryStats?.personalStats}
            onClose={() => setShowHistoryStats(false)}
          />
        ) : null}
      {toastViewport}
      <AnimationOverlay event={activeAnimation} onDismiss={handleAnimationDismiss} />
      {showSpinningShuttle && (
        <SpinningShuttle
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          onComplete={handleShuttleComplete}
        />
      )}
    </main>
  );
}

function createInitialMatch(mode: MatchMode, playerNames: Record<PlayerId, string>): MatchState {
  return createMatch({ mode, initialServingTeamId: 'teamA', initialServingPlayerId: 'A1', playerNames });
}

function hasStarted(match: MatchState): boolean {
  return match.score.teamA !== 0 || match.score.teamB !== 0 || match.history.length > 0 || match.winnerTeamId !== undefined;
}

function hasLegacySessionPlayer(players: readonly unknown[]): boolean {
  return players.some((player) => {
    if (!player || typeof player !== 'object') return false;
    const id = 'id' in player ? player.id : undefined;
    if (typeof id === 'string') return id.startsWith('legacy-local-player-');
    return 'name' in player && typeof player.name === 'string';
  });
}

function getStoredSessionPlayerDisplayName(player: unknown): string | undefined {
  if (!player || typeof player !== 'object') return undefined;
  if ('displayName' in player && typeof player.displayName === 'string') return player.displayName;
  if ('name' in player && typeof player.name === 'string') return player.name;
  return undefined;
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
