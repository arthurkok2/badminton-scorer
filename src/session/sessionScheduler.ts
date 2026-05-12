// src/session/sessionScheduler.ts
import type {
  ActiveSession,
  ArchivedSession,
  MatchRecord,
  MatchSuggestion,
  PairingMatrix,
  SessionPlayer,
  TeamSplit,
} from './sessionTypes';

export function createSession(playerNames: readonly string[]): ActiveSession {
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    players: playerNames.map(name => ({
      name,
      gamesPlayed: 0,
      consecutiveStreak: 0,
      onBreak: true,
    })),
    matches: [],
    pairingMatrix: { together: {}, against: {} },
  };
}

export function selectNextPlayers(players: readonly SessionPlayer[]): {
  readonly selected: readonly [string, string, string, string];
  readonly onBreak: readonly string[];
} {
  if (players.length <= 4) {
    return {
      selected: players.map(p => p.name) as unknown as readonly [string, string, string, string],
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

  return {
    selected: prioritized.slice(0, 4).map(p => p.name) as unknown as readonly [string, string, string, string],
    onBreak: prioritized.slice(4).map(p => p.name),
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
    (getPairCount(matrix.together, a1, a2) + getPairCount(matrix.together, b1, b2)) * 2;
  const againstScore =
    getPairCount(matrix.against, a1, b1) +
    getPairCount(matrix.against, a1, b2) +
    getPairCount(matrix.against, a2, b1) +
    getPairCount(matrix.against, a2, b2);
  return togetherScore + againstScore;
}

export function rankSplitsForPlayers(
  players: readonly [string, string, string, string],
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
  together = incrementPairCount(together, a1, a2);
  together = incrementPairCount(together, b1, b2);
  let against = matrix.against;
  against = incrementPairCount(against, a1, b1);
  against = incrementPairCount(against, a1, b2);
  against = incrementPairCount(against, a2, b1);
  against = incrementPairCount(against, a2, b2);
  return { together, against };
}

export function applyMatchResult(
  session: ActiveSession,
  split: TeamSplit,
  winnerTeam: 'teamA' | 'teamB',
): ActiveSession {
  const playedNames = new Set([...split.teamA, ...split.teamB]);
  const newMatrix = updatePairingMatrix(session.pairingMatrix, split);
  const newPlayers: SessionPlayer[] = session.players.map(player =>
    playedNames.has(player.name)
      ? { ...player, gamesPlayed: player.gamesPlayed + 1, consecutiveStreak: player.consecutiveStreak + 1, onBreak: false }
      : { ...player, consecutiveStreak: 0, onBreak: true },
  );
  const matchRecord: MatchRecord = { teamA: split.teamA, teamB: split.teamB, winnerTeam };
  return { ...session, players: newPlayers, matches: [...session.matches, matchRecord], pairingMatrix: newMatrix };
}

export function archiveSession(session: ActiveSession, endedAt: string): ArchivedSession {
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt,
    players: session.players.map(player => ({
      name: player.name,
      gamesPlayed: player.gamesPlayed,
      breaksTaken: session.matches.length - player.gamesPlayed,
    })),
    matches: session.matches,
  };
}
