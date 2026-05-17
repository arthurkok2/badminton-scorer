import type { MatchMode, MatchState, PlayerId, TeamId } from '../domain/matchTypes';

interface MatchSettingsModalProps {
  readonly match: MatchState;
  readonly matchMode: MatchMode;
  readonly playerNames: Record<PlayerId, string>;
  readonly settingsLocked?: boolean;
  readonly onMatchModeChange: (mode: MatchMode) => void;
  readonly onSetInitialServer: (teamId: TeamId, playerId: PlayerId) => void;
  readonly onRerollFirstServer: () => void;
  readonly onPlayerNameChange: (playerId: PlayerId, name: string) => void;
}

export function MatchSettingsModal({
  match,
  matchMode,
  playerNames,
  settingsLocked = false,
  onMatchModeChange,
  onSetInitialServer,
  onRerollFirstServer,
  onPlayerNameChange,
}: MatchSettingsModalProps) {
  const canSetInitialServer = match.score.teamA === 0 && match.score.teamB === 0 && match.history.length === 0;

  return (
    <div className="settings-panel">
      <div className="mode-toggle" role="group" aria-label="Match mode">
        <button
          type="button"
          className={matchMode === 'doubles' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={matchMode === 'doubles'}
          disabled={settingsLocked || matchMode === 'doubles'}
          onClick={() => onMatchModeChange('doubles')}
        >
          Doubles
        </button>
        <button
          type="button"
          className={matchMode === 'singles' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={matchMode === 'singles'}
          disabled={settingsLocked || matchMode === 'singles'}
          onClick={() => onMatchModeChange('singles')}
        >
          Singles
        </button>
      </div>

      {settingsLocked ? (
        <p className="settings-note">Session match settings are locked while the session match is active.</p>
      ) : null}

      {canSetInitialServer ? (
        <div className="setup-controls" role="group" aria-label="First server setup">
          <div className="player-names-editor">
            <PlayerNameTeam
              teamLabel="Team A"
              fields={matchMode === 'doubles' ? ['A1', 'A2'] : ['A1']}
              playerNames={playerNames}
              disabled={settingsLocked}
              onPlayerNameChange={onPlayerNameChange}
            />
            <PlayerNameTeam
              teamLabel="Team B"
              fields={matchMode === 'doubles' ? ['B1', 'B2'] : ['B1']}
              playerNames={playerNames}
              disabled={settingsLocked}
              onPlayerNameChange={onPlayerNameChange}
            />
          </div>
          <button type="button" disabled={settingsLocked} onClick={onRerollFirstServer}>
            Reroll first server
          </button>
          <button type="button" disabled={settingsLocked} onClick={() => onSetInitialServer('teamA', 'A1')}>
            Team A {playerNames.A1} serves
          </button>
          <button type="button" disabled={settingsLocked} onClick={() => onSetInitialServer('teamB', 'B1')}>
            Team B {playerNames.B1} serves
          </button>
        </div>
      ) : (
        <p className="settings-note">Match setup is locked after the first rally.</p>
      )}
    </div>
  );
}

function PlayerNameTeam({
  teamLabel,
  fields,
  playerNames,
  disabled,
  onPlayerNameChange,
}: {
  readonly teamLabel: string;
  readonly fields: readonly PlayerId[];
  readonly playerNames: Record<PlayerId, string>;
  readonly disabled: boolean;
  readonly onPlayerNameChange: (playerId: PlayerId, name: string) => void;
}) {
  return (
    <div className="player-names-team">
      <span className="player-names-label">{teamLabel}</span>
      {fields.map((playerId, index) => (
        <label key={playerId} className="player-name-field">
          <span>P{index + 1}</span>
          <input
            type="text"
            value={playerNames[playerId]}
            maxLength={20}
            aria-label={`${teamLabel} player ${index + 1} name`}
            disabled={disabled}
            onChange={(event) => onPlayerNameChange(playerId, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
