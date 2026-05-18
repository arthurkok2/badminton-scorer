import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { AccountBar } from '../components/AccountBar';
import { AppModal } from '../components/AppModal';
import type { AppMenuAction } from '../components/AppMenu';
import { useControllerClient } from '../hooks/useControllerClient';

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
  const {
    user,
    loading: authLoading,
    isAnonymous,
    authUnavailable,
  } = useAuth();
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [activeModal, setActiveModal] = useState<ControllerSettingsAction | undefined>(undefined);
  const signInRequired = !authLoading && !authUnavailable && (!user || isAnonymous);
  const joinDisabled = status === 'joining' || authLoading || authUnavailable || signInRequired;
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
              {authUnavailable && (
                <p className="controller-auth-unavailable">Sign-in unavailable offline - controller disabled</p>
              )}
              {signInRequired && (
                <p className="controller-auth-unavailable">Sign in to use the Firebase controller.</p>
              )}
            </div>
            <Link to="/" className="controller-back-link">← Back to scorer</Link>
          </section>
        </div>
        {activeModalDialog}
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
