import type { MatchState, Player, PlayerId, TeamId } from '../domain/matchTypes';

interface CourtViewProps {
  readonly match: MatchState;
}

export function CourtView({ match }: CourtViewProps) {
  return (
    <section className="court-section" aria-label="Court positions">
      <div className="court">
        <CourtHalf match={match} teamId="teamA" />
        <div className="net" aria-hidden="true" />
        <CourtHalf match={match} teamId="teamB" />
      </div>
    </section>
  );
}

function CourtHalf({ match, teamId }: { readonly match: MatchState; readonly teamId: TeamId }) {
  const players = match.teams[teamId].players;

  return (
    <div className={`court-half ${teamId}`}>
      <CourtSlot match={match} players={players} side="left" />
      <CourtSlot match={match} players={players} side="right" />
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
  readonly side: 'left' | 'right';
}) {
  const player = players.find((candidate) => match.courtPositions[candidate.id] === side);
  const isServer = player?.id === match.serverId;
  const isReceiver = player?.id === match.receiverId;

  return (
    <div className={`court-slot ${side}`}>
      {player ? (
        <div className={isServer ? 'player-chip active-server' : 'player-chip'} aria-current={isServer ? 'true' : undefined}>
          <span>{player.name}</span>
          <small>{labelForPlayer(match, player.id, isServer, isReceiver)}</small>
        </div>
      ) : null}
    </div>
  );
}

function labelForPlayer(match: MatchState, playerId: PlayerId, isServer: boolean, isReceiver: boolean): string {
  if (isServer) {
    return 'Server';
  }

  if (isReceiver) {
    return 'Receiver';
  }

  return match.courtPositions[playerId] === 'right' ? 'Right court' : 'Left court';
}
