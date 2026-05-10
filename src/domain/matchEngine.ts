import type { CourtSide, CreateMatchOptions, MatchState, PlayerId, Score, TeamId } from './matchTypes';

const TEAM_PLAYERS: Record<TeamId, PlayerId[]> = {
  teamA: ['A1', 'A2'],
  teamB: ['B1', 'B2'],
};

const OPPONENT: Record<TeamId, TeamId> = {
  teamA: 'teamB',
  teamB: 'teamA',
};

export function createMatch(options: CreateMatchOptions): MatchState {
  const score: Score = { teamA: 0, teamB: 0 };
  const servingSide = servingSideForScore(score[options.initialServingTeamId]);
  const courtPositions = swapTeamToPutPlayerOnSide(
    {
      A1: 'right',
      A2: 'left',
      B1: 'right',
      B2: 'left',
    },
    options.initialServingTeamId,
    options.initialServingPlayerId,
    servingSide,
  );
  const base: MatchState = {
    mode: options.mode,
    teams: {
      teamA: {
        id: 'teamA',
        name: 'Team A',
        players: [
          { id: 'A1', name: 'Player 1', teamId: 'teamA' },
          { id: 'A2', name: 'Player 2', teamId: 'teamA' },
        ],
      },
      teamB: {
        id: 'teamB',
        name: 'Team B',
        players: [
          { id: 'B1', name: 'Player 3', teamId: 'teamB' },
          { id: 'B2', name: 'Player 4', teamId: 'teamB' },
        ],
      },
    },
    score,
    servingTeamId: options.initialServingTeamId,
    serverId: options.initialServingPlayerId,
    receiverId: 'B1',
    courtPositions,
  };

  return deriveServerAndReceiver(base);
}

export function setInitialServer(match: MatchState, teamId: TeamId, playerId: PlayerId): MatchState {
  if (match.score.teamA !== 0 || match.score.teamB !== 0) {
    return match;
  }

  const servingSide = servingSideForScore(match.score[teamId]);

  return deriveServerAndReceiver({
    ...withoutPrevious(match),
    servingTeamId: teamId,
    serverId: playerId,
    courtPositions: swapTeamToPutPlayerOnSide(match.courtPositions, teamId, playerId, servingSide),
  });
}

export function awardPointToServingTeam(match: MatchState): MatchState {
  if (match.winnerTeamId) {
    return match;
  }

  const score = addPoint(match.score, match.servingTeamId);
  const servingSide = servingSideForScore(score[match.servingTeamId]);
  const courtPositions = swapTeamToPutPlayerOnSide(match.courtPositions, match.servingTeamId, match.serverId, servingSide);
  const next = deriveServerAndReceiver({
    ...withoutPrevious(match),
    previous: withoutPrevious(match),
    score,
    courtPositions,
  });

  return { ...next, winnerTeamId: getWinner(score) };
}

export function awardPointToReceivingTeam(match: MatchState): MatchState {
  if (match.winnerTeamId) {
    return match;
  }

  const newServingTeamId = OPPONENT[match.servingTeamId];
  const score = addPoint(match.score, newServingTeamId);
  const next = deriveServerAndReceiver({
    ...withoutPrevious(match),
    previous: withoutPrevious(match),
    score,
    servingTeamId: newServingTeamId,
  });

  return { ...next, winnerTeamId: getWinner(score) };
}

export function undoLastPoint(match: MatchState): MatchState {
  return match.previous ? withoutPrevious(match.previous) : match;
}

function deriveServerAndReceiver(match: MatchState): MatchState {
  const serverSide = servingSideForScore(match.score[match.servingTeamId]);
  const serverId = playerOnSide(match.courtPositions, match.servingTeamId, serverSide) ?? match.serverId;
  const receivingTeamId = OPPONENT[match.servingTeamId];
  const receiverId = playerOnSide(match.courtPositions, receivingTeamId, serverSide) ?? TEAM_PLAYERS[receivingTeamId][0];

  return { ...match, serverId, receiverId };
}

function addPoint(score: Score, teamId: TeamId): Score {
  return { ...score, [teamId]: score[teamId] + 1 };
}

function servingSideForScore(score: number): CourtSide {
  return score % 2 === 0 ? 'right' : 'left';
}

function playerOnSide(positions: Record<PlayerId, CourtSide>, teamId: TeamId, side: CourtSide): PlayerId | undefined {
  return TEAM_PLAYERS[teamId].find((playerId) => positions[playerId] === side);
}

function swapTeamToPutPlayerOnSide(
  positions: Record<PlayerId, CourtSide>,
  teamId: TeamId,
  playerId: PlayerId,
  side: CourtSide,
): Record<PlayerId, CourtSide> {
  const [first, second] = TEAM_PLAYERS[teamId];
  const other = playerId === first ? second : first;

  return {
    ...positions,
    [playerId]: side,
    [other]: side === 'right' ? 'left' : 'right',
  };
}

function getWinner(score: Score): TeamId | undefined {
  if (score.teamA === 30) {
    return 'teamA';
  }

  if (score.teamB === 30) {
    return 'teamB';
  }

  if (score.teamA >= 21 && score.teamA - score.teamB >= 2) {
    return 'teamA';
  }

  if (score.teamB >= 21 && score.teamB - score.teamA >= 2) {
    return 'teamB';
  }

  return undefined;
}

function withoutPrevious(match: MatchState): MatchState {
  const { previous, ...rest } = match;
  return rest;
}
