// src/session/sessionScheduler.ts
import type {
  ActiveSession,
  ArchivedSession,
  GlobalPlayer,
  GlobalSessionPlayer,
  MatchRecord,
  MatchSuggestion,
  PairingMatrix,
  TeamSplit,
} from './sessionTypes';
import { createGlobalPlayer, createPairId, toSessionPlayer } from './playerIdentity';

export function createSession(players: readonly GlobalPlayer[]): ActiveSession {
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    players: players.map(toSessionPlayer),
    matches: [],
    pairingMatrix: { together: {}, against: {} },
  };
}

export function createLegacySessionFromPlayerNames(playerNames: readonly string[]): ActiveSession {
  return createSession(
    playerNames.map((displayName, index) =>
      createGlobalPlayer({
        id: `legacy-local-player-${index + 1}`,
        displayName,
        createdBy: 'legacy-local',
      }),
    ),
  );
}

export function selectNextPlayers(players: readonly GlobalSessionPlayer[]): {
  readonly selected: readonly [GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer];
  readonly onBreak: readonly GlobalSessionPlayer[];
} {
  if (players.length < 4) throw new Error('selectNextPlayers requires at least 4 players');
  if (players.length === 4) {
    return {
      selected: players as unknown as readonly [GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer],
      onBreak: [],
    };
  }

  // Fisher-Yates shuffle so ties in gamesPlayed / consecutiveStreak resolve
  // with uniform probability rather than by insertion order.
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const breakPlayers = shuffled
    .filter(p => p.onBreak)
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed);
  const onCourtPlayers = shuffled
    .filter(p => !p.onBreak)
    .sort((a, b) => a.consecutiveStreak - b.consecutiveStreak);

  // Break players (fewest games first) take priority over on-court players.
  // On-court players with highest streak sit out (they end up at the tail of prioritized).
  const prioritized = [...breakPlayers, ...onCourtPlayers];

  const top4 = prioritized.slice(0, 4);
  if (top4.length < 4) throw new Error('selectNextPlayers: not enough players after prioritization');
  return {
    selected: top4 as unknown as readonly [GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer],
    onBreak: prioritized.slice(4),
  };
}

function getPairCount(
  matrix: Readonly<Record<string, Readonly<Record<string, number>>>>,
  a: string,
  b: string,
): number {
  return matrix[a]?.[b] ?? 0;
}

function scoreTeamSplit(split: TeamSplit, matrix: PairingMatrix): number {
  const [a1, a2] = split.teamA;
  const [b1, b2] = split.teamB;
  const togetherScore =
    (getPairCount(matrix.together, a1.id, a2.id) + getPairCount(matrix.together, b1.id, b2.id)) * 2;
  const againstScore =
    getPairCount(matrix.against, a1.id, b1.id) +
    getPairCount(matrix.against, a1.id, b2.id) +
    getPairCount(matrix.against, a2.id, b1.id) +
    getPairCount(matrix.against, a2.id, b2.id);
  return togetherScore + againstScore;
}

export function rankSplitsForPlayers(
  players: readonly [GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer],
  matrix: PairingMatrix,
): readonly [TeamSplit, TeamSplit, TeamSplit] {
  const [p0, p1, p2, p3] = players;
  const splits: [TeamSplit, TeamSplit, TeamSplit] = [
    { teamA: [p0, p1], teamB: [p2, p3] },
    { teamA: [p0, p2], teamB: [p1, p3] },
    { teamA: [p0, p3], teamB: [p1, p2] },
  ];
  // Fisher-Yates shuffle so equal-score ties resolve with uniform probability,
  // preventing deterministic cycles when the pairing matrix is fully balanced.
  for (let i = splits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [splits[i], splits[j]] = [splits[j], splits[i]];
  }
  splits.sort((a, b) => scoreTeamSplit(a, matrix) - scoreTeamSplit(b, matrix));
  return splits;
}

export function generateMatchSuggestion(session: ActiveSession): MatchSuggestion {
  const { selected, onBreak } = selectNextPlayers(session.players);
  const rankedSplits = rankSplitsForPlayers(selected, session.pairingMatrix);
  return { rankedSplits, onBreak };
}

function incrementPairCount(
  matrix: Readonly<Record<string, Readonly<Record<string, number>>>>,
  a: string,
  b: string,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  return {
    ...matrix,
    [a]: { ...matrix[a], [b]: (matrix[a]?.[b] ?? 0) + 1 },
    [b]: { ...matrix[b], [a]: (matrix[b]?.[a] ?? 0) + 1 },
  };
}

function updatePairingMatrix(matrix: PairingMatrix, split: TeamSplit): PairingMatrix {
  const [a1, a2] = split.teamA;
  const [b1, b2] = split.teamB;
  let together = matrix.together;
  together = incrementPairCount(together, a1.id, a2.id);
  together = incrementPairCount(together, b1.id, b2.id);
  let against = matrix.against;
  against = incrementPairCount(against, a1.id, b1.id);
  against = incrementPairCount(against, a1.id, b2.id);
  against = incrementPairCount(against, a2.id, b1.id);
  against = incrementPairCount(against, a2.id, b2.id);
  return { together, against };
}

export function applyMatchResult(
  session: ActiveSession,
  split: TeamSplit,
  winnerTeam: 'teamA' | 'teamB',
  metadata?: Pick<MatchRecord, 'finalScore' | 'startedAt' | 'endedAt' | 'globalMatchId'>,
): ActiveSession {
  const playedIds = new Set([...split.teamA, ...split.teamB].map(player => player.id));
  const newMatrix = updatePairingMatrix(session.pairingMatrix, split);
  const newPlayers: GlobalSessionPlayer[] = session.players.map(player =>
    playedIds.has(player.id)
      ? { ...player, gamesPlayed: player.gamesPlayed + 1, consecutiveStreak: player.consecutiveStreak + 1, onBreak: false }
      : { ...player, consecutiveStreak: 0, onBreak: true },
  );
  const matchRecord: MatchRecord = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    matchNumber: session.matches.length + 1,
    teamAPlayerIds: [split.teamA[0].id, split.teamA[1].id],
    teamBPlayerIds: [split.teamB[0].id, split.teamB[1].id],
    teamADisplayNames: [split.teamA[0].displayName, split.teamA[1].displayName],
    teamBDisplayNames: [split.teamB[0].displayName, split.teamB[1].displayName],
    teamAPairId: createPairId(split.teamA[0].id, split.teamA[1].id),
    teamBPairId: createPairId(split.teamB[0].id, split.teamB[1].id),
    winnerTeam,
    ...metadata,
  };
  return { ...session, players: newPlayers, matches: [...session.matches, matchRecord], pairingMatrix: newMatrix };
}

export function archiveSession(session: ActiveSession, endedAt: string): ArchivedSession {
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt,
    players: session.players.map(player => ({
      id: player.id,
      displayName: player.displayName,
      gamesPlayed: player.gamesPlayed,
      breaksTaken: session.matches.length - player.gamesPlayed,
    })),
    matches: session.matches,
  };
}
