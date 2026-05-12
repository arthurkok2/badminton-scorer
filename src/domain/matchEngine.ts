import type {
  CourtSide,
  CreateMatchOptions,
  MatchMode,
  MatchSnapshot,
  MatchState,
  Player,
  PlayerId,
  Score,
  TeamId,
} from './matchTypes';

const DOUBLES_TEAM_PLAYERS: Record<TeamId, PlayerId[]> = {
  teamA: ['A1', 'A2'],
  teamB: ['B1', 'B2'],
};

const SINGLES_TEAM_PLAYERS: Record<TeamId, PlayerId[]> = {
  teamA: ['A1'],
  teamB: ['B1'],
};

const OPPONENT: Record<TeamId, TeamId> = {
  teamA: 'teamB',
  teamB: 'teamA',
};

export function createMatch(options: CreateMatchOptions): MatchState {
  validateTeamPlayer(options.mode, options.initialServingTeamId, options.initialServingPlayerId);

  const score: Score = { teamA: 0, teamB: 0 };
  const servingSide = servingSideForScore(score[options.initialServingTeamId]);
  const initialCourtPositions = swapTeamToPutPlayerOnSide(
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
  const courtPositions =
    options.mode === 'singles' ? positionSinglesForServingSide(initialCourtPositions, servingSide) : initialCourtPositions;
  const base: MatchState = {
    mode: options.mode,
    teams: {
      teamA: {
        id: 'teamA',
        name: 'Team A',
        players: playersForMode(options.mode, 'teamA').map((id) => createPlayer(id, options.playerNames)),
      },
      teamB: {
        id: 'teamB',
        name: 'Team B',
        players: playersForMode(options.mode, 'teamB').map((id) => createPlayer(id, options.playerNames)),
      },
    },
    score,
    servingTeamId: options.initialServingTeamId,
    serverId: options.initialServingPlayerId,
    receiverId: 'B1',
    courtPositions,
    history: [],
  };

  return deriveServerAndReceiver(base);
}

export function setInitialServer(match: MatchState, teamId: TeamId, playerId: PlayerId): MatchState {
  if (match.score.teamA !== 0 || match.score.teamB !== 0) {
    return match;
  }

  validateTeamPlayer(match.mode, teamId, playerId);

  const servingSide = servingSideForScore(match.score[teamId]);
  const courtPositions = swapTeamToPutPlayerOnSide(match.courtPositions, teamId, playerId, servingSide);

  return deriveServerAndReceiver({
    ...withoutHistory(match),
    history: match.history,
    servingTeamId: teamId,
    serverId: playerId,
    courtPositions: match.mode === 'singles' ? positionSinglesForServingSide(courtPositions, servingSide) : courtPositions,
  });
}

export function awardPointToServingTeam(match: MatchState): MatchState {
  if (match.winnerTeamId) {
    return match;
  }

  const score = addPoint(match.score, match.servingTeamId);
  const servingSide = servingSideForScore(score[match.servingTeamId]);
  const doublesPositions = swapTeamToPutPlayerOnSide(
    match.courtPositions,
    match.servingTeamId,
    match.serverId,
    servingSide,
  );
  const courtPositions =
    match.mode === 'singles' ? positionSinglesForServingSide(doublesPositions, servingSide) : doublesPositions;
  const next = deriveServerAndReceiver({
    ...withoutHistory(match),
    history: appendHistory(match),
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
  const servingSide = servingSideForScore(score[newServingTeamId]);
  const next = deriveServerAndReceiver({
    ...withoutHistory(match),
    history: appendHistory(match),
    score,
    servingTeamId: newServingTeamId,
    courtPositions:
      match.mode === 'singles' ? positionSinglesForServingSide(match.courtPositions, servingSide) : { ...match.courtPositions },
  });

  return { ...next, winnerTeamId: getWinner(score) };
}

export function awardPointToTeam(match: MatchState, teamId: TeamId): MatchState {
  return teamId === match.servingTeamId ? awardPointToServingTeam(match) : awardPointToReceivingTeam(match);
}

export function undoLastPoint(match: MatchState): MatchState {
  if (match.history.length === 0) {
    return match;
  }

  const snapshotToRestore = match.history[match.history.length - 1];
  const remainingHistory = match.history.slice(0, -1);

  return restoreSnapshot(snapshotToRestore, remainingHistory);
}

function deriveServerAndReceiver(match: MatchState): MatchState {
  const serverSide = servingSideForScore(match.score[match.servingTeamId]);
  const serverId = playerOnSide(match, match.servingTeamId, serverSide) ?? match.serverId;
  const receivingTeamId = OPPONENT[match.servingTeamId];
  const receiverId = playerOnSide(match, receivingTeamId, serverSide) ?? playersForMode(match.mode, receivingTeamId)[0];

  return { ...match, serverId, receiverId };
}

function addPoint(score: Score, teamId: TeamId): Score {
  return { ...score, [teamId]: score[teamId] + 1 };
}

function servingSideForScore(score: number): CourtSide {
  return score % 2 === 0 ? 'right' : 'left';
}

function playerOnSide(match: MatchState, teamId: TeamId, side: CourtSide): PlayerId | undefined {
  return playersForMode(match.mode, teamId).find((playerId) => match.courtPositions[playerId] === side);
}

function swapTeamToPutPlayerOnSide(
  positions: Readonly<Record<PlayerId, CourtSide>>,
  teamId: TeamId,
  playerId: PlayerId,
  side: CourtSide,
): Record<PlayerId, CourtSide> {
  const [first, second] = DOUBLES_TEAM_PLAYERS[teamId];
  const other = playerId === first ? second : first;

  return {
    ...positions,
    [playerId]: side,
    [other]: side === 'right' ? 'left' : 'right',
  };
}

function positionSinglesForServingSide(
  positions: Readonly<Record<PlayerId, CourtSide>>,
  side: CourtSide,
): Record<PlayerId, CourtSide> {
  return {
    ...positions,
    A1: side,
    B1: side,
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

function withoutHistory(match: MatchState): MatchSnapshot {
  const { history, ...rest } = match;
  return rest;
}

function cloneMatchSnapshot(match: MatchState): MatchSnapshot {
  const snapshot = withoutHistory(match);

  return cloneSnapshot(snapshot);
}

function appendHistory(match: MatchState): MatchSnapshot[] {
  return [...match.history.map(cloneSnapshot), cloneMatchSnapshot(match)];
}

function cloneSnapshot(snapshot: MatchSnapshot): MatchSnapshot {
  return {
    ...snapshot,
    teams: {
      teamA: {
        ...snapshot.teams.teamA,
        players: snapshot.teams.teamA.players.map((player) => ({ ...player })),
      },
      teamB: {
        ...snapshot.teams.teamB,
        players: snapshot.teams.teamB.players.map((player) => ({ ...player })),
      },
    },
    score: { ...snapshot.score },
    courtPositions: { ...snapshot.courtPositions },
  };
}

function restoreSnapshot(snapshot: MatchSnapshot, history: readonly MatchSnapshot[] = []): MatchState {
  return {
    ...cloneSnapshot(snapshot),
    history: history.map(cloneSnapshot),
  };
}

function playersForMode(mode: MatchMode, teamId: TeamId): PlayerId[] {
  return mode === 'singles' ? SINGLES_TEAM_PLAYERS[teamId] : DOUBLES_TEAM_PLAYERS[teamId];
}

function validateTeamPlayer(mode: MatchMode, teamId: TeamId, playerId: PlayerId): void {
  if (!playersForMode(mode, teamId).includes(playerId)) {
    throw new Error(`Player ${playerId} does not belong to ${teamId}`);
  }
}

const DEFAULT_PLAYER_NAMES: Record<PlayerId, string> = {
  A1: 'Player 1',
  A2: 'Player 2',
  B1: 'Player 3',
  B2: 'Player 4',
};

function createPlayer(playerId: PlayerId, playerNames?: Readonly<Record<PlayerId, string>>): Player {
  return {
    id: playerId,
    name: playerNames?.[playerId] ?? DEFAULT_PLAYER_NAMES[playerId],
    teamId: playerId.startsWith('A') ? 'teamA' : 'teamB',
  };
}
