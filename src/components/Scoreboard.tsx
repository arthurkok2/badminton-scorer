import type { MatchState, PlayerId, TeamId } from '../domain/matchTypes';

interface ScoreboardProps {
  readonly match: MatchState;
  readonly onPointTeam: (teamId: TeamId) => void;
}

export function Scoreboard({ match, onPointTeam }: ScoreboardProps) {
  const receivingTeamId = match.servingTeamId === 'teamA' ? 'teamB' : 'teamA';
  const scoringDisabled = match.winnerTeamId !== undefined;

  return (
    <section className="scoreboard" aria-label="Live match scoreboard">
      <div className="score-row">
        <TeamScore match={match} teamId="teamA" disabled={scoringDisabled} onPointTeam={onPointTeam} />
        <div className="score-divider" aria-hidden="true">
          -
        </div>
        <TeamScore match={match} teamId="teamB" disabled={scoringDisabled} onPointTeam={onPointTeam} />
      </div>

      <div className="serve-summary" aria-live="polite">
        <p>Serving: {match.teams[match.servingTeamId].name}</p>
        <p>Server: {playerName(match, match.serverId)}</p>
        <p>Receiver: {playerName(match, match.receiverId)} ({match.teams[receivingTeamId].name})</p>
      </div>

      {match.winnerTeamId ? (
        <p className="winner-banner">Game: {match.teams[match.winnerTeamId].name}</p>
      ) : null}
    </section>
  );
}

function TeamScore({
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

  return (
    <button
      className={isServing ? 'team-score is-serving' : 'team-score'}
      type="button"
      aria-label={`${match.teams[teamId].name} score`}
      disabled={disabled}
      onClick={() => onPointTeam(teamId)}
    >
      <p className="team-label">{match.teams[teamId].name}</p>
      <p className="score-value" data-testid={`score-${teamId}`}>
        {match.score[teamId]}
      </p>
    </button>
  );
}

function playerName(match: MatchState, playerId: PlayerId): string {
  return [...match.teams.teamA.players, ...match.teams.teamB.players].find((player) => player.id === playerId)?.name ?? playerId;
}
