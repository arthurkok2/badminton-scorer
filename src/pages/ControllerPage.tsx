import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountBar } from '../components/AccountBar';
import { AppModal } from '../components/AppModal';
import type { AppMenuAction } from '../components/AppMenu';
import { useControllerClient } from '../hooks/useControllerClient';
import { useWatchLayout } from '../hooks/useWatchLayout';

type ControllerSettingsAction = Extract<
  AppMenuAction,
  'announcementSettings' | 'displaySettings' | 'remoteControls' | 'diagnostics'
>;

const controllerSettingsActions: readonly ControllerSettingsAction[] = [
  'announcementSettings',
  'displaySettings',
  'remoteControls',
  'diagnostics',
];

const controllerSettingsTitles: Record<ControllerSettingsAction, string> = {
  announcementSettings: 'Announcement settings',
  displaySettings: 'Display settings',
  remoteControls: 'Remote controls',
  diagnostics: 'Diagnostics',
};

export function ControllerPage() {
  const { status, matchDoc, error, commandError, lastCode, join, leave, sendCommand } =
    useControllerClient();
  const isWatch = useWatchLayout();
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [activeModal, setActiveModal] = useState<ControllerSettingsAction | undefined>(undefined);
  const joinDisabled = status === 'joining';
  const handleAppMenuAction = useCallback((action: AppMenuAction) => {
    if (isControllerSettingsAction(action)) {
      setActiveModal(action);
    }
  }, []);
  const activeModalDialog = activeModal ? (
    <AppModal title={controllerSettingsTitles[activeModal]} onClose={() => setActiveModal(undefined)}>
      <p className="settings-note">These controls will appear in the focused modal.</p>
    </AppModal>
  ) : null;

  // Watch layout: join state
  if (isWatch && (status === 'disconnected' || status === 'joining')) {
    return (
      <main className="watch-controller">
        <form className="watch-join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (codeInputRef.current) join(codeInputRef.current.value);
          }}
        >
          <label htmlFor="watch-room-code-input">Room code</label>
          <input
            id="watch-room-code-input"
            className="watch-join-input"
            ref={codeInputRef}
            type="text"
            defaultValue={lastCode}
            maxLength={6}
            autoCapitalize="characters"
            placeholder="ABCD"
          />
          <button
            className="watch-join-button"
            disabled={joinDisabled}
            type="submit"
          >
            {status === 'joining' ? 'Joining…' : 'Join'}
          </button>
        </form>
      </main>
    );
  }

  if (status === 'disconnected' || status === 'joining') {
    return (
      <main className="app-shell">
        <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={controllerSettingsActions} />
        <div className="app-layout">
          <section className="controller-panel">
            <div className="controller-page-header">
              <h1 className="controller-title">Controller</h1>
            </div>
            <div className="controller-join-form">
              <label htmlFor="room-code-input">Room code</label>
              <input
                id="room-code-input"
                ref={codeInputRef}
                type="text"
                defaultValue={lastCode}
                maxLength={6}
                autoCapitalize="characters"
                placeholder="e.g. ABCD"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') join((e.target as HTMLInputElement).value);
                }}
              />
              <button
                className="connect-button"
                disabled={joinDisabled}
                onClick={() => {
                  if (codeInputRef.current) join(codeInputRef.current.value);
                }}
              >
                {status === 'joining' ? 'Joining…' : 'Join'}
              </button>
            </div>
            <Link to="/" className="controller-back-link">← Back to scorer</Link>
          </section>
        </div>
        {activeModalDialog}
      </main>
    );
  }

  // Watch layout: error state
  if (isWatch && status === 'error') {
    return (
      <main className="watch-controller">
        <p className="watch-command-error" role="alert">{error ?? 'An error occurred'}</p>
        <button className="watch-undo-button" onClick={leave}>Back</button>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app-shell">
        <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={controllerSettingsActions} />
        <div className="app-layout">
          <section className="controller-panel">
            <h1 className="controller-title">Controller</h1>
            <p className="controller-error-message" role="alert">{error ?? 'An error occurred'}</p>
            <button className="connect-button" onClick={leave}>Back</button>
          </section>
        </div>
        {activeModalDialog}
      </main>
    );
  }

  // Watch layout: active state
  if (isWatch && status === 'active') {
    const wMatch = matchDoc!.matchState;
    const wTeamAName = wMatch.teams.teamA.name;
    const wTeamBName = wMatch.teams.teamB.name;
    const wIsServingA = wMatch.servingTeamId === 'teamA';
    const wServingTeam = wMatch.teams[wMatch.servingTeamId];
    const wServingPlayer = wServingTeam.players.find((p) => p.id === wMatch.serverId);
    const wServerName = wServingPlayer?.name ?? '';

    return (
      <main className="watch-controller">
        <div className="watch-header">
          <span className="watch-team-name">{wTeamAName}</span>
          {wIsServingA && <span className="watch-serving-dot" aria-label="Serving" />}
          <span className="watch-vs">vs</span>
          {!wIsServingA && <span className="watch-serving-dot" aria-label="Serving" />}
          <span className="watch-team-name">{wTeamBName}</span>
        </div>
        {wServerName && (
          <div className="watch-server-name">Serving: {wServerName}</div>
        )}

        <div className="watch-scores">
          <span className="watch-score">{wMatch.score.teamA}</span>
          <span className="watch-score-separator">:</span>
          <span className="watch-score">{wMatch.score.teamB}</span>
        </div>

        {commandError && (
          <p className="watch-command-error" role="alert">{commandError}</p>
        )}

        <div className="watch-commands">
          <button
            className="watch-point-button"
            onClick={() => sendCommand('POINT_TEAM', 'teamA')}
          >
            <span className="watch-point-label">Point</span>
            {wTeamAName}
          </button>
          <button
            className="watch-point-button"
            onClick={() => sendCommand('POINT_TEAM', 'teamB')}
          >
            <span className="watch-point-label">Point</span>
            {wTeamBName}
          </button>
        </div>

        <button
          className="watch-undo-button"
          onClick={() => sendCommand('UNDO', undefined)}
        >
          Undo
        </button>
      </main>
    );
  }

  const match = matchDoc!.matchState;
  const teamAName = match.teams.teamA.name;
  const teamBName = match.teams.teamB.name;
  const isServingA = match.servingTeamId === 'teamA';

  return (
    <main className="app-shell">
      <AccountBar onAppMenuAction={handleAppMenuAction} availableAppMenuActions={controllerSettingsActions} />
      <div className="app-layout">
        <section className="controller-panel">
          <div className="controller-header">
            <h1 className="controller-title">Controller</h1>
            <span className="controller-code">{matchDoc!.code}</span>
          </div>

          <div className="controller-score">
            <div className={`controller-team${isServingA ? ' controller-team--serving' : ''}`}>
              <span className="controller-team-name">{teamAName}</span>
              <span className="controller-team-score">{match.score.teamA}</span>
              {isServingA && <span className="controller-serving-dot" aria-label="Serving" />}
            </div>
            <span className="controller-vs">vs</span>
            <div className={`controller-team${!isServingA ? ' controller-team--serving' : ''}`}>
              <span className="controller-team-name">{teamBName}</span>
              <span className="controller-team-score">{match.score.teamB}</span>
              {!isServingA && <span className="controller-serving-dot" aria-label="Serving" />}
            </div>
          </div>

          {matchDoc!.winnerTeamId && (
            <p className="controller-winner">
              {match.teams[matchDoc!.winnerTeamId].name} wins!
            </p>
          )}

          {commandError && (
            <p className="controller-command-error" role="alert">{commandError}</p>
          )}

          <div className="controller-commands">
            <button
              className="controller-command-button controller-command-button--point"
              onClick={() => sendCommand('POINT_TEAM', 'teamA')}
            >
              Point {teamAName}
            </button>
            <button
              className="controller-command-button controller-command-button--point"
              onClick={() => sendCommand('POINT_TEAM', 'teamB')}
            >
              Point {teamBName}
            </button>
            <button
              className="controller-command-button"
              onClick={() => sendCommand('UNDO', undefined)}
            >
              Undo
            </button>
            <button
              className="controller-command-button"
              onClick={() => sendCommand('ANNOUNCE', undefined)}
            >
              Announce
            </button>
          </div>

          <button className="controller-leave-button" onClick={leave}>Leave</button>
        </section>
      </div>
      {activeModalDialog}
    </main>
  );
}

function isControllerSettingsAction(action: AppMenuAction): action is ControllerSettingsAction {
  return controllerSettingsActions.some((availableAction) => availableAction === action);
}
