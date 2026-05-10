import type { MatchState, PlayerId, TeamId } from '../domain/matchTypes';

interface ScoreboardProps {
  readonly match: MatchState;
}

export function Scoreboard({ match }: ScoreboardProps) {
  const receivingTeamId = match.servingTeamId === 'teamA' ? 'teamB' : 'teamA';

  return (
    <section className="scoreboard" aria-label="Live match scoreboard">
      <div className="score-row">
        <TeamScore match={match} teamId="teamA" />
        <div className="score-divider" aria-hidden="true">
          -
        </div>
        <TeamScore match={match} teamId="teamB" />
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

function TeamScore({ match, teamId }: { readonly match: MatchState; readonly teamId: TeamId }) {
  const isServing = match.servingTeamId === teamId;

  return (
    <article className={isServing ? 'team-score is-serving' : 'team-score'} aria-label={`${match.teams[teamId].name} score`}>
      <p className="team-label">{match.teams[teamId].name}</p>
      <p className="score-value" data-testid={`score-${teamId}`}>
        {match.score[teamId]}
      </p>
    </article>
  );
}

function playerName(match: MatchState, playerId: PlayerId): string {
  return [...match.teams.teamA.players, ...match.teams.teamB.players].find((player) => player.id === playerId)?.name ?? playerId;
}
