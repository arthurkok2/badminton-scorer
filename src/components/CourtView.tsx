import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { CourtSide, MatchState, Player, PlayerId, TeamId } from '../domain/matchTypes';

interface CourtViewProps {
  readonly match: MatchState;
  readonly displayMode?: 'court' | 'little-fighters';
  readonly onPointTeam: (teamId: TeamId) => void;
}

const COURT_LENGTH_CM = 1340;
const COURT_WIDTH_CM = 610;
const LINE_WIDTH_CM = 4;
const SINGLES_SIDE_INSET_CM = 46;
const NET_X_CM = COURT_LENGTH_CM / 2;
const SHORT_SERVICE_FROM_NET_CM = 198;
const DOUBLES_LONG_SERVICE_FROM_BACK_CM = 76;
const FIGHTER_ATTACK_MS = 700;
const FIGHTER_STAGE_WIDTH = 1000;
const FIGHTER_STAGE_HEIGHT = 560;
const FIGHTER_COURT_TOP_LEFT = { x: 92, y: 194 };
const FIGHTER_COURT_TOP_RIGHT = { x: 908, y: 194 };
const FIGHTER_COURT_BOTTOM_LEFT = { x: 24, y: 506 };
const FIGHTER_COURT_BOTTOM_RIGHT = { x: 976, y: 506 };
const FIGHTER_SERVER_ADVANCE_CM = 92;
const FIGHTER_BOTTOM_LANE_ADVANCE_CM = 40;
const FIGHTER_SPRITES: Record<PlayerId, string> = {
  A1: `${import.meta.env.BASE_URL}sprites/badminton-female-ace.png`,
  A2: `${import.meta.env.BASE_URL}sprites/badminton-male-clear.png`,
  B1: `${import.meta.env.BASE_URL}sprites/badminton-female-drive.png`,
  B2: `${import.meta.env.BASE_URL}sprites/badminton-male-jump-smash.png`,
};

export function CourtView({ match, displayMode = 'court', onPointTeam }: CourtViewProps) {
  if (displayMode === 'little-fighters') {
    return <LittleFightersView match={match} onPointTeam={onPointTeam} />;
  }

  return (
    <CourtFullscreenSection className="court-section" ariaLabel="Match court">
      <div className="court">
        <CourtDiagram />
        <CourtScoreOverlay match={match} onPointTeam={onPointTeam} />
        <div className="court-players" aria-label="Player positions">
          <CourtHalf match={match} teamId="teamA" />
          <CourtHalf match={match} teamId="teamB" />
        </div>
      </div>
    </CourtFullscreenSection>
  );
}

function CourtFullscreenSection({
  ariaLabel,
  children,
  className,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === sectionRef.current);
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();

    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const handleFullscreenToggle = async () => {
    try {
      if (isFullscreen) {
        await document.exitFullscreen?.();
        return;
      }

      await sectionRef.current?.requestFullscreen?.();
    } catch {
      setIsFullscreen(document.fullscreenElement === sectionRef.current);
    }
  };

  const label = isFullscreen ? 'Exit fullscreen court view' : 'Enter fullscreen court view';
  const Icon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <section ref={sectionRef} className={className} aria-label={ariaLabel}>
      <button className="court-fullscreen-button" type="button" aria-label={label} title={label} onClick={handleFullscreenToggle}>
        <Icon size={20} aria-hidden="true" />
      </button>
      {children}
    </section>
  );
}

function LittleFightersView({ match, onPointTeam }: CourtViewProps) {
  const previousScoreRef = useRef(match.score);
  const [attackState, setAttackState] = useState<{ attackingTeamId: TeamId; attackerId: string } | null>(null);

  useEffect(() => {
    const previousScore = previousScoreRef.current;
    previousScoreRef.current = match.score;

    const scoredTeamId =
      match.score.teamA > previousScore.teamA
        ? 'teamA'
        : match.score.teamB > previousScore.teamB
          ? 'teamB'
          : undefined;

    if (!scoredTeamId) {
      return;
    }

    const attackerId = match.servingTeamId === scoredTeamId ? match.serverId : match.teams[scoredTeamId].players[0]?.id;
    if (!attackerId) {
      return;
    }

    setAttackState({ attackingTeamId: scoredTeamId, attackerId });
    const timeoutId = window.setTimeout(() => setAttackState(null), FIGHTER_ATTACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [match]);

  return (
    <CourtFullscreenSection className="court-section fighters-section" ariaLabel="Little fighters match display">
      <div className="fighters-stage" data-testid="little-fighters-view">
        <div className="fighters-stage-backdrop" aria-hidden="true" />
        <div className="fighters-stage-ground" aria-hidden="true" />
        <div className="fighters-court-viewport" aria-hidden="true">
          <LittleFightersCourtDiagram />
        </div>
        <div className="fighters-hud">
          <FighterHudTeam match={match} teamId="teamA" align="left" attackState={attackState} onPointTeam={onPointTeam} />
          <FighterHudTeam match={match} teamId="teamB" align="right" attackState={attackState} onPointTeam={onPointTeam} />
        </div>
        <div className="fighters-arena" aria-label="Player positions">
          <FighterTeam match={match} teamId="teamA" align="left" attackState={attackState} />
          <FighterTeam match={match} teamId="teamB" align="right" attackState={attackState} />
        </div>
        <div className="fighters-court-line-overlay" aria-hidden="true">
          <LittleFightersCourtLineOverlay />
        </div>
      </div>
    </CourtFullscreenSection>
  );
}

function LittleFightersCourtLineOverlay() {
  const doublesTop = createProjectedLinePath({ x: 0, y: 0 }, { x: COURT_LENGTH_CM, y: 0 });
  const doublesBottom = createProjectedLinePath({ x: 0, y: COURT_WIDTH_CM }, { x: COURT_LENGTH_CM, y: COURT_WIDTH_CM });
  const singlesTop = createProjectedLinePath({ x: 0, y: SINGLES_SIDE_INSET_CM }, { x: COURT_LENGTH_CM, y: SINGLES_SIDE_INSET_CM });
  const singlesBottom = createProjectedLinePath(
    { x: 0, y: COURT_WIDTH_CM - SINGLES_SIDE_INSET_CM },
    { x: COURT_LENGTH_CM, y: COURT_WIDTH_CM - SINGLES_SIDE_INSET_CM },
  );
  const centerLeft = createProjectedLinePath({ x: 0, y: COURT_WIDTH_CM / 2 }, { x: NET_X_CM - SHORT_SERVICE_FROM_NET_CM, y: COURT_WIDTH_CM / 2 });
  const centerRight = createProjectedLinePath(
    { x: NET_X_CM + SHORT_SERVICE_FROM_NET_CM, y: COURT_WIDTH_CM / 2 },
    { x: COURT_LENGTH_CM, y: COURT_WIDTH_CM / 2 },
  );
  const net = createProjectedLinePath({ x: NET_X_CM, y: 0 }, { x: NET_X_CM, y: COURT_WIDTH_CM });

  return (
    <svg className="fighters-court-line-overlay-svg" viewBox={`0 0 ${FIGHTER_STAGE_WIDTH} ${FIGHTER_STAGE_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
      <g className="fighters-court-overlay-lines">
        <path d={doublesTop} />
        <path d={doublesBottom} />
        <path d={singlesTop} />
        <path d={singlesBottom} />
        <path className="fighters-court-overlay-center-line" d={centerLeft} />
        <path className="fighters-court-overlay-center-line" d={centerRight} />
        <path className="fighters-court-overlay-net" d={net} />
      </g>
    </svg>
  );
}

function LittleFightersCourtDiagram() {
  const courtBoundary = createProjectedBoundaryPath();
  const doublesTop = createProjectedLinePath({ x: 0, y: 0 }, { x: COURT_LENGTH_CM, y: 0 });
  const doublesBottom = createProjectedLinePath({ x: 0, y: COURT_WIDTH_CM }, { x: COURT_LENGTH_CM, y: COURT_WIDTH_CM });
  const singlesTop = createProjectedLinePath({ x: 0, y: SINGLES_SIDE_INSET_CM }, { x: COURT_LENGTH_CM, y: SINGLES_SIDE_INSET_CM });
  const singlesBottom = createProjectedLinePath(
    { x: 0, y: COURT_WIDTH_CM - SINGLES_SIDE_INSET_CM },
    { x: COURT_LENGTH_CM, y: COURT_WIDTH_CM - SINGLES_SIDE_INSET_CM },
  );
  const shortServiceLeft = createProjectedLinePath(
    { x: NET_X_CM - SHORT_SERVICE_FROM_NET_CM, y: 0 },
    { x: NET_X_CM - SHORT_SERVICE_FROM_NET_CM, y: COURT_WIDTH_CM },
  );
  const shortServiceRight = createProjectedLinePath(
    { x: NET_X_CM + SHORT_SERVICE_FROM_NET_CM, y: 0 },
    { x: NET_X_CM + SHORT_SERVICE_FROM_NET_CM, y: COURT_WIDTH_CM },
  );
  const doublesLongServiceLeft = createProjectedLinePath(
    { x: DOUBLES_LONG_SERVICE_FROM_BACK_CM, y: 0 },
    { x: DOUBLES_LONG_SERVICE_FROM_BACK_CM, y: COURT_WIDTH_CM },
  );
  const doublesLongServiceRight = createProjectedLinePath(
    { x: COURT_LENGTH_CM - DOUBLES_LONG_SERVICE_FROM_BACK_CM, y: 0 },
    { x: COURT_LENGTH_CM - DOUBLES_LONG_SERVICE_FROM_BACK_CM, y: COURT_WIDTH_CM },
  );
  const centerTop = createProjectedLinePath({ x: 0, y: COURT_WIDTH_CM / 2 }, { x: NET_X_CM - SHORT_SERVICE_FROM_NET_CM, y: COURT_WIDTH_CM / 2 });
  const centerBottom = createProjectedLinePath(
    { x: NET_X_CM + SHORT_SERVICE_FROM_NET_CM, y: COURT_WIDTH_CM / 2 },
    { x: COURT_LENGTH_CM, y: COURT_WIDTH_CM / 2 },
  );
  const net = createProjectedLinePath({ x: NET_X_CM, y: 0 }, { x: NET_X_CM, y: COURT_WIDTH_CM });
  const netMeshLines = createNetMeshLines();

  return (
    <svg
      className="fighters-court-svg"
      data-testid="fighters-court-svg"
      viewBox={`0 0 ${FIGHTER_STAGE_WIDTH} ${FIGHTER_STAGE_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="fightersCourtSurface" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7cb36d" />
          <stop offset="54%" stopColor="#467944" />
          <stop offset="100%" stopColor="#234e2a" />
        </linearGradient>
        <linearGradient id="fightersCourtLineGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#e6f5e8" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="fightersCourtNet" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8f7f0" />
          <stop offset="100%" stopColor="#c8d8d0" />
        </linearGradient>
        <filter id="fightersCourtShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="fightersCourtLineShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.6" floodColor="rgba(10, 26, 14, 0.34)" />
        </filter>
      </defs>
      <ellipse
        className="fighters-court-shadow"
        cx={FIGHTER_STAGE_WIDTH / 2}
        cy={FIGHTER_COURT_BOTTOM_LEFT.y + 34}
        rx={436}
        ry={66}
        filter="url(#fightersCourtShadow)"
      />
      <path className="fighters-court-surface" d={courtBoundary} />
      <path className="fighters-court-highlight" d={courtBoundary} />
      <g className="fighters-court-lines" filter="url(#fightersCourtLineShadow)">
        <path className="fighters-court-boundary" data-testid="fighters-court-boundary" d={courtBoundary} />
        <path className="fighters-court-sideline fighters-court-doubles-sideline" data-testid="fighters-doubles-sideline-top" d={doublesTop} />
        <path
          className="fighters-court-sideline fighters-court-doubles-sideline"
          data-testid="fighters-doubles-sideline-bottom"
          d={doublesBottom}
        />
        <path className="fighters-court-sideline" data-testid="fighters-singles-sideline-top" d={singlesTop} />
        <path className="fighters-court-sideline" data-testid="fighters-singles-sideline-bottom" d={singlesBottom} />
        <path className="fighters-court-service-line" data-testid="fighters-short-service-left" d={shortServiceLeft} />
        <path className="fighters-court-service-line" data-testid="fighters-short-service-right" d={shortServiceRight} />
        <path className="fighters-court-service-line" data-testid="fighters-doubles-long-service-left" d={doublesLongServiceLeft} />
        <path className="fighters-court-service-line" data-testid="fighters-doubles-long-service-right" d={doublesLongServiceRight} />
        <path className="fighters-court-center-line" data-testid="fighters-center-service-left" d={centerTop} />
        <path className="fighters-court-center-line" data-testid="fighters-center-service-right" d={centerBottom} />
      </g>
      <g className="fighters-court-net-mesh">
        {netMeshLines.map((meshLine, index) => (
          <path key={index} d={meshLine} />
        ))}
      </g>
      <path className="fighters-court-net" data-testid="fighters-court-net" d={net} />
    </svg>
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

function FighterHudTeam({
  match,
  teamId,
  align,
  attackState,
  onPointTeam,
}: {
  readonly match: MatchState;
  readonly teamId: TeamId;
  readonly align: 'left' | 'right';
  readonly attackState: { attackingTeamId: TeamId; attackerId: string } | null;
  readonly onPointTeam: (teamId: TeamId) => void;
}) {
  const isServing = match.servingTeamId === teamId;
  const score = match.score[teamId];
  const teamName = match.teams[teamId].name;
  const hpPercent = getTeamHpPercent(match, teamId);
  const isUnderAttack = attackState !== null && attackState.attackingTeamId !== teamId;

  return (
    <div
      className={isUnderAttack ? `fighter-hud-team ${teamId} align-${align} is-under-attack` : `fighter-hud-team ${teamId} align-${align}`}
      data-serving-team={isServing ? 'true' : 'false'}
    >
      <button
        className={isServing ? `fighter-score-button ${teamId} is-serving` : `fighter-score-button ${teamId}`}
        type="button"
        aria-label={`Award point to ${teamName}, score ${score}`}
        disabled={match.winnerTeamId !== undefined}
        data-testid={`score-${teamId}`}
        onClick={() => onPointTeam(teamId)}
      >
        <span className="fighter-score-number" aria-hidden="true">{score}</span>
      </button>
      <div className="fighter-health-stack">
        <div className="fighter-team-tag">
          <span>{teamName}</span>
          {isServing ? <strong>Serve</strong> : null}
        </div>
        <div
          className="fighter-healthbar"
          role="meter"
          aria-label={`${teamName} health`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hpPercent)}
        >
          <div className={`fighter-healthbar-fill ${teamId}`} style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

function FighterTeam({
  match,
  teamId,
  align,
  attackState,
}: {
  readonly match: MatchState;
  readonly teamId: TeamId;
  readonly align: 'left' | 'right';
  readonly attackState: { attackingTeamId: TeamId; attackerId: string } | null;
}) {
  const players = match.teams[teamId].players;
  const isUnderAttack = attackState !== null && attackState.attackingTeamId !== teamId;

  return (
    <div
      className={isUnderAttack ? `fighter-team ${teamId} align-${align} is-under-attack` : `fighter-team ${teamId} align-${align}`}
      data-serving-team={match.servingTeamId === teamId ? 'true' : 'false'}
    >
      {players.map((player) => {
        const isServer = player.id === match.serverId;
        const isAttacking = attackState?.attackerId === player.id;
        const quadrant = getFighterLane(player.teamId, match.courtPositions[player.id]);
        const anchor = getFighterAnchor(match, player);
        return (
          <div
            key={player.id}
            className={
              [
                'fighter-player',
                player.teamId,
                isServer ? 'is-server' : '',
                isAttacking ? 'is-attacking' : '',
                `lane-${quadrant}`,
              ].filter(Boolean).join(' ')
            }
            aria-current={isServer ? 'true' : undefined}
            data-testid={`fighter-${player.id}`}
            data-quadrant={quadrant}
            style={
              {
                left: `${(anchor.x / FIGHTER_STAGE_WIDTH) * 100}%`,
                top: `${(anchor.y / FIGHTER_STAGE_HEIGHT) * 100}%`,
              } satisfies CSSProperties
            }
          >
            <img className="fighter-sprite" src={FIGHTER_SPRITES[player.id]} alt="" aria-hidden="true" />
            <div className={player.teamId === 'teamA' ? 'fighter-nameplate nameplate-left' : 'fighter-nameplate nameplate-right'}>
              <span className="fighter-nameplate-name">{player.name}</span>
              {isServer ? <strong>Serving</strong> : null}
            </div>
          </div>
        );
      })}
    </div>
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

function getTeamHpPercent(match: MatchState, teamId: TeamId): number {
  const opposingTeamId = teamId === 'teamA' ? 'teamB' : 'teamA';
  const scoreAgainst = match.score[opposingTeamId];
  return Math.max(0, 100 - (scoreAgainst / 21) * 100);
}

function getFighterLane(teamId: TeamId, side: CourtSide): 'top' | 'bottom' {
  return laneForCourtSide(teamId, side);
}

function getFighterAnchor(match: MatchState, player: Player): { x: number; y: number } {
  const lane = getFighterLane(player.teamId, match.courtPositions[player.id]);
  const laneCenterY = getServiceCourtCenterY(lane);
  const baseCourtX = getTeamBaseCourtX(player.teamId);
  const serverOffset = player.id === match.serverId ? (player.teamId === 'teamA' ? FIGHTER_SERVER_ADVANCE_CM : -FIGHTER_SERVER_ADVANCE_CM) : 0;

  return projectCourtPoint({
    x: baseCourtX + serverOffset,
    y: laneCenterY,
  });
}

function getServiceCourtCenterY(lane: 'top' | 'bottom'): number {
  if (lane === 'top') {
    return (SINGLES_SIDE_INSET_CM + COURT_WIDTH_CM / 2) / 2;
  }

  return (COURT_WIDTH_CM / 2 + (COURT_WIDTH_CM - SINGLES_SIDE_INSET_CM)) / 2 + FIGHTER_BOTTOM_LANE_ADVANCE_CM;
}

function getTeamBaseCourtX(teamId: TeamId): number {
  if (teamId === 'teamA') {
    return (DOUBLES_LONG_SERVICE_FROM_BACK_CM + (NET_X_CM - SHORT_SERVICE_FROM_NET_CM)) / 2;
  }

  return ((NET_X_CM + SHORT_SERVICE_FROM_NET_CM) + (COURT_LENGTH_CM - DOUBLES_LONG_SERVICE_FROM_BACK_CM)) / 2;
}

function createProjectedBoundaryPath(): string {
  const topLeft = projectCourtPoint({ x: 0, y: 0 });
  const topRight = projectCourtPoint({ x: COURT_LENGTH_CM, y: 0 });
  const bottomRight = projectCourtPoint({ x: COURT_LENGTH_CM, y: COURT_WIDTH_CM });
  const bottomLeft = projectCourtPoint({ x: 0, y: COURT_WIDTH_CM });
  return `M ${formatCoordinate(topLeft.x)} ${formatCoordinate(topLeft.y)} L ${formatCoordinate(topRight.x)} ${formatCoordinate(topRight.y)} L ${formatCoordinate(bottomRight.x)} ${formatCoordinate(bottomRight.y)} L ${formatCoordinate(bottomLeft.x)} ${formatCoordinate(bottomLeft.y)} Z`;
}

function createProjectedLinePath(start: { x: number; y: number }, end: { x: number; y: number }): string {
  const startPoint = projectCourtPoint(start);
  const endPoint = projectCourtPoint(end);
  return `M ${formatCoordinate(startPoint.x)} ${formatCoordinate(startPoint.y)} L ${formatCoordinate(endPoint.x)} ${formatCoordinate(endPoint.y)}`;
}

function createNetMeshLines(): string[] {
  const meshLines: string[] = [];
  const netX = NET_X_CM;

  for (let offsetY = 54; offsetY < COURT_WIDTH_CM; offsetY += 56) {
    const left = projectCourtPoint({ x: netX - 12, y: offsetY });
    const right = projectCourtPoint({ x: netX + 12, y: offsetY });
    meshLines.push(`M ${left.x} ${left.y} L ${right.x} ${right.y}`);
  }

  return meshLines;
}

function projectCourtPoint(point: { x: number; y: number }): { x: number; y: number } {
  const rowT = point.y / COURT_WIDTH_CM;
  const columnT = point.x / COURT_LENGTH_CM;
  const leftEdgeX = interpolate(FIGHTER_COURT_TOP_LEFT.x, FIGHTER_COURT_BOTTOM_LEFT.x, rowT);
  const rightEdgeX = interpolate(FIGHTER_COURT_TOP_RIGHT.x, FIGHTER_COURT_BOTTOM_RIGHT.x, rowT);
  const projectedY = interpolate(FIGHTER_COURT_TOP_LEFT.y, FIGHTER_COURT_BOTTOM_LEFT.y, rowT);

  return {
    x: interpolate(leftEdgeX, rightEdgeX, columnT),
    y: projectedY,
  };
}

function interpolate(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(3)).toString();
}
