import { Megaphone, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { MatchMode, MatchState, PlayerId, TeamId } from '../domain/matchTypes';

interface ControlsProps {
  readonly match: MatchState;
  readonly autoAnnounce: boolean;
  readonly matchMode: MatchMode;
  readonly onUndo: () => void;
  readonly onAnnounce: () => void;
  readonly onAutoAnnounceChange: (enabled: boolean) => void;
  readonly onMatchModeChange: (mode: MatchMode) => void;
  readonly onNewMatch: () => void;
  readonly onSetInitialServer: (teamId: TeamId, playerId: PlayerId) => void;
  readonly onRerollFirstServer: () => void;
}

export function Controls({
  match,
  autoAnnounce,
  matchMode,
  onUndo,
  onAnnounce,
  onAutoAnnounceChange,
  onMatchModeChange,
  onNewMatch,
  onSetInitialServer,
  onRerollFirstServer,
}: ControlsProps) {
  const canSetInitialServer = match.score.teamA === 0 && match.score.teamB === 0 && match.previous === undefined;

  return (
    <section className="controls" aria-label="Match controls">
      <div className="utility-controls">
        <button className="icon-button" type="button" onClick={onUndo} aria-label="Undo last point">
          <RotateCcw size={22} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={onAnnounce} aria-label="Announce score">
          <Megaphone size={22} aria-hidden="true" />
        </button>
        <button
          className={autoAnnounce ? 'toggle-button is-on' : 'toggle-button'}
          type="button"
          role="switch"
          aria-checked={autoAnnounce}
          aria-label="Auto announce"
          onClick={() => onAutoAnnounceChange(!autoAnnounce)}
        >
          {autoAnnounce ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
          Auto
        </button>
      </div>

      <div className="mode-toggle" aria-label="Match mode">
        <button
          type="button"
          className={matchMode === 'doubles' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={matchMode === 'doubles'}
          disabled={matchMode === 'doubles'}
          onClick={() => onMatchModeChange('doubles')}
        >
          Doubles
        </button>
        <button
          type="button"
          className={matchMode === 'singles' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={matchMode === 'singles'}
          disabled={matchMode === 'singles'}
          onClick={() => onMatchModeChange('singles')}
        >
          Singles
        </button>
      </div>

      {canSetInitialServer ? (
        <div className="setup-controls" role="group" aria-label="First server setup">
          <button type="button" onClick={onRerollFirstServer}>
            Reroll first server
          </button>
          <button type="button" onClick={() => onSetInitialServer('teamA', 'A1')}>
            Team A Player 1 serves
          </button>
          <button type="button" onClick={() => onSetInitialServer('teamB', 'B1')}>
            Team B Player 3 serves
          </button>
        </div>
      ) : null}

      <button className="new-match-button" type="button" onClick={onNewMatch}>
        New match
      </button>
    </section>
  );
}
