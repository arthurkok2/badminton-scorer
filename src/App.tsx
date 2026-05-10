import { useCallback, useEffect, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { CourtView } from './components/CourtView';
import { Scoreboard } from './components/Scoreboard';
import { StatusBar } from './components/StatusBar';
import { createMatch } from './domain/matchEngine';
import type { MatchMode, MatchState } from './domain/matchTypes';
import { applyCommand, type AppCommand } from './input/commands';
import {
  connectBluetoothRemote,
  getBluetoothSupportStatus,
  type BluetoothRemoteConnection,
  type BluetoothStatus,
} from './input/bluetoothRemote';
import { loadPreferences, savePreferences, type AppPreferences } from './preferences';
import { getSpeechStatus, speakAnnouncement } from './speech/announcer';

export default function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [match, setMatch] = useState<MatchState>(() => createInitialMatch(preferences.matchMode));
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothStatus>(() => getBluetoothSupportStatus());
  const connectionRef = useRef<BluetoothRemoteConnection | undefined>(undefined);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
      connectionRef.current = undefined;
    };
  }, []);

  const dispatch = useCallback((command: AppCommand) => {
    setMatch((currentMatch) => {
      const nextMatch = applyCommand(currentMatch, command);
      const scored = command.type === 'POINT_SERVING' || command.type === 'POINT_RECEIVING';

      if (scored && preferencesRef.current.autoAnnounce && nextMatch !== currentMatch) {
        speakAnnouncement(nextMatch);
      }

      return nextMatch;
    });
  }, []);

  const updatePreferences = useCallback((updater: (current: AppPreferences) => AppPreferences) => {
    setPreferences((current) => {
      const next = updater(current);
      savePreferences(next);
      return next;
    });
  }, []);

  const handleMatchModeChange = useCallback(
    (mode: MatchMode) => {
      updatePreferences((current) => ({ ...current, matchMode: mode }));
      setMatch(createInitialMatch(mode));
    },
    [updatePreferences],
  );

  const handleConnectBluetooth = useCallback(async () => {
    connectionRef.current?.disconnect();
    connectionRef.current = await connectBluetoothRemote({
      dispatch,
      onStatusChange: setBluetoothStatus,
    });
  }, [dispatch]);

  return (
    <main className="app-shell">
      <div className="app-layout">
        <StatusBar
          bluetoothStatus={bluetoothStatus}
          speechStatus={getSpeechStatus()}
          onConnectBluetooth={handleConnectBluetooth}
        />
        <Scoreboard match={match} />
        <CourtView match={match} />
        <Controls
          match={match}
          autoAnnounce={preferences.autoAnnounce}
          matchMode={preferences.matchMode}
          onPointServing={() => dispatch({ type: 'POINT_SERVING' })}
          onPointReceiving={() => dispatch({ type: 'POINT_RECEIVING' })}
          onUndo={() => dispatch({ type: 'UNDO' })}
          onAnnounce={() => speakAnnouncement(match)}
          onAutoAnnounceChange={(autoAnnounce) => updatePreferences((current) => ({ ...current, autoAnnounce }))}
          onMatchModeChange={handleMatchModeChange}
        />
      </div>
    </main>
  );
}

function createInitialMatch(mode: MatchMode): MatchState {
  return createMatch({ mode, initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
}
