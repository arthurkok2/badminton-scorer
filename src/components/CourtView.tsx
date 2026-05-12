import type { CourtSide, MatchState, Player, TeamId } from '../domain/matchTypes';

interface CourtViewProps {
  readonly match: MatchState;
  readonly onPointTeam: (teamId: TeamId) => void;
}

const COURT_LENGTH_CM = 1340;
const COURT_WIDTH_CM = 610;
const LINE_WIDTH_CM = 4;
const SINGLES_SIDE_INSET_CM = 46;
const NET_X_CM = COURT_LENGTH_CM / 2;
const SHORT_SERVICE_FROM_NET_CM = 198;
const DOUBLES_LONG_SERVICE_FROM_BACK_CM = 76;

export function CourtView({ match, onPointTeam }: CourtViewProps) {
  return (
    <section className="court-section" aria-label="Match court">
      <div className="court">
        <CourtDiagram />
        <CourtScoreOverlay match={match} onPointTeam={onPointTeam} />
        <div className="court-players" aria-label="Player positions">
          <CourtHalf match={match} teamId="teamA" />
          <CourtHalf match={match} teamId="teamB" />
        </div>
      </div>
    </section>
  );
}

function CourtDiagram() {
  const shortServiceLeft = NET_X_CM - SHORT_SERVICE_FROM_NET_CM;
  const shortServiceRight = NET_X_CM + SHORT_SERVICE_FROM_NET_CM;
  const doublesLongServiceLeft = DOUBLES_LONG_SERVICE_FROM_BACK_CM;
  const doublesLongServiceRight = COURT_LENGTH_CM - DOUBLES_LONG_SERVICE_FROM_BACK_CM;
  const centerY = COURT_WIDTH_CM / 2;
  const singlesTopY = SINGLES_SIDE_INSET_CM;
  const singlesBottomY = COURT_WIDTH_CM - SINGLES_SIDE_INSET_CM;

  return (
    <svg
      className="court-diagram"
      data-testid="court-diagram"
      viewBox={`0 0 ${COURT_LENGTH_CM} ${COURT_WIDTH_CM}`}
      role="img"
      aria-label="Badminton court scaled to 13.40m by 6.10m"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect className="court-surface" x="0" y="0" width={COURT_LENGTH_CM} height={COURT_WIDTH_CM} rx="10" />
      <g className="court-lines" fill="none" strokeLinecap="square" vectorEffect="non-scaling-stroke">
        <rect
          data-testid="court-boundary"
          x={LINE_WIDTH_CM / 2}
          y={LINE_WIDTH_CM / 2}
          width={COURT_LENGTH_CM - LINE_WIDTH_CM}
          height={COURT_WIDTH_CM - LINE_WIDTH_CM}
        />
        <line data-testid="singles-sideline-left" x1="0" y1={singlesTopY} x2={COURT_LENGTH_CM} y2={singlesTopY} />
        <line data-testid="singles-sideline-right" x1="0" y1={singlesBottomY} x2={COURT_LENGTH_CM} y2={singlesBottomY} />
        <line data-testid="short-service-line-top" x1={shortServiceLeft} y1="0" x2={shortServiceLeft} y2={COURT_WIDTH_CM} />
        <line data-testid="short-service-line-bottom" x1={shortServiceRight} y1="0" x2={shortServiceRight} y2={COURT_WIDTH_CM} />
        <line
          data-testid="doubles-long-service-line-top"
          x1={doublesLongServiceLeft}
          y1="0"
          x2={doublesLongServiceLeft}
          y2={COURT_WIDTH_CM}
        />
        <line
          data-testid="doubles-long-service-line-bottom"
          x1={doublesLongServiceRight}
          y1="0"
          x2={doublesLongServiceRight}
          y2={COURT_WIDTH_CM}
        />
        <line data-testid="center-service-line-top" x1="0" y1={centerY} x2={shortServiceLeft} y2={centerY} />
        <line data-testid="center-service-line-bottom" x1={shortServiceRight} y1={centerY} x2={COURT_LENGTH_CM} y2={centerY} />
      </g>
      <line
        className="court-net"
        data-testid="court-net"
        x1={NET_X_CM}
        y1="0"
        x2={NET_X_CM}
        y2={COURT_WIDTH_CM}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CourtScoreOverlay({
  match,
  onPointTeam,
}: {
  readonly match: MatchState;
  readonly onPointTeam: (teamId: TeamId) => void;
}) {
  const scoringDisabled = match.winnerTeamId !== undefined;

  return (
    <div className="court-score-overlay">
      <div className="court-score-box" aria-label="Score controls">
        <CourtScoreButton match={match} teamId="teamA" disabled={scoringDisabled} onPointTeam={onPointTeam} />
        <CourtScoreButton match={match} teamId="teamB" disabled={scoringDisabled} onPointTeam={onPointTeam} />
      </div>
    </div>
  );
}

function CourtScoreButton({
  match,
  teamId,
  disabled,
  onPointTeam,
}: {
  readonly match: MatchState;
  readonly teamId: TeamId;
  readonly disabled: boolean;
  readonly onPointTeam: (teamId: TeamId) => void;
}) {
  const isServing = match.servingTeamId === teamId;
  const score = match.score[teamId];
  const teamName = match.teams[teamId].name;

  return (
    <button
      className={isServing ? `court-score-button ${teamId} is-serving` : `court-score-button ${teamId}`}
      type="button"
      aria-label={`Award point to ${teamName}, score ${score}`}
      disabled={disabled}
      data-testid={`score-${teamId}`}
      onClick={() => onPointTeam(teamId)}
    >
      <span aria-hidden="true">{score}</span>
    </button>
  );
}

function CourtHalf({ match, teamId }: { readonly match: MatchState; readonly teamId: TeamId }) {
  const players = match.teams[teamId].players;

  return (
    <>
      <CourtSlot match={match} players={players} side="left" />
      <CourtSlot match={match} players={players} side="right" />
    </>
  );
}

function CourtSlot({
  match,
  players,
  side,
}: {
  readonly match: MatchState;
  readonly players: readonly Player[];
  readonly side: CourtSide;
}) {
  const player = players.find((candidate) => match.courtPositions[candidate.id] === side);
  const isServer = player?.id === match.serverId;
  const visualLane = player === undefined ? laneForCourtSide(players[0]?.teamId, side) : laneForCourtSide(player.teamId, side);

  return (
    <div className={`court-slot ${player?.teamId ?? ''} court-lane-${visualLane}`}>
      {player ? (
        <div className={isServer ? 'player-chip active-server' : 'player-chip'} aria-current={isServer ? 'true' : undefined}>
          <span>{player.name}</span>
        </div>
      ) : null}
    </div>
  );
}

function laneForCourtSide(teamId: TeamId | undefined, side: CourtSide): 'top' | 'bottom' {
  if (teamId === 'teamB') {
    return side === 'right' ? 'top' : 'bottom';
  }

  return side === 'left' ? 'top' : 'bottom';
}
