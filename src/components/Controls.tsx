import { Megaphone, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { MatchMode, MatchState } from '../domain/matchTypes';

interface ControlsProps {
  readonly match: MatchState;
  readonly autoAnnounce: boolean;
  readonly matchMode: MatchMode;
  readonly onPointServing: () => void;
  readonly onPointReceiving: () => void;
  readonly onUndo: () => void;
  readonly onAnnounce: () => void;
  readonly onAutoAnnounceChange: (enabled: boolean) => void;
  readonly onMatchModeChange: (mode: MatchMode) => void;
}

export function Controls({
  match,
  autoAnnounce,
  matchMode,
  onPointServing,
  onPointReceiving,
  onUndo,
  onAnnounce,
  onAutoAnnounceChange,
  onMatchModeChange,
}: ControlsProps) {
  const receivingTeamId = match.servingTeamId === 'teamA' ? 'teamB' : 'teamA';
  const scoringDisabled = match.winnerTeamId !== undefined;

  return (
    <section className="controls" aria-label="Match controls">
      <div className="point-controls">
        <button className="point-button primary" type="button" onClick={onPointServing} disabled={scoringDisabled}>
          <span>+1</span>
          Point for serving team
          <small>{match.teams[match.servingTeamId].name}</small>
        </button>
        <button className="point-button secondary" type="button" onClick={onPointReceiving} disabled={scoringDisabled}>
          <span>+1</span>
          Point for receiving team
          <small>{match.teams[receivingTeamId].name}</small>
        </button>
      </div>

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
          onClick={() => onMatchModeChange('doubles')}
        >
          Doubles
        </button>
        <button
          type="button"
          className={matchMode === 'singles' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={matchMode === 'singles'}
          onClick={() => onMatchModeChange('singles')}
        >
          Singles
        </button>
      </div>
    </section>
  );
}
