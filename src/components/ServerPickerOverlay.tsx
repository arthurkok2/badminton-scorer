import type { MatchMode, PlayerId, TeamId } from '../domain/matchTypes';

interface Props {
  readonly mode: MatchMode;
  readonly playerNames: Record<PlayerId, string>;
  readonly onComplete: (teamId: TeamId, playerId: PlayerId) => void;
}

export function ServerPickerOverlay({ mode: _mode, playerNames, onComplete }: Props) {
  const teamAName = playerNames.A1;
  const teamBName = playerNames.B1;

  return (
    <div className="server-picker-overlay" role="dialog" aria-label="Choose which team serves first">
      <div className="server-picker-card">
        <h2 className="server-picker-title">Who serves first?</h2>
        <div className="server-picker-buttons">
          <button
            type="button"
            className="server-picker-button server-picker-button--teamA"
            onClick={() => onComplete('teamA', 'A1')}
          >
            Team A {teamAName} serves
          </button>
          <button
            type="button"
            className="server-picker-button server-picker-button--teamB"
            onClick={() => onComplete('teamB', 'B1')}
          >
            Team B {teamBName} serves
          </button>
        </div>
      </div>
    </div>
  );
}
