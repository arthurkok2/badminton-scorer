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

  const breakPlayers = [...players]
    .filter(p => p.onBreak)
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed);
  const onCourtPlayers = [...players]
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
  splits.sort((a, b) => scoreTeamSplit(a, matrix) - scoreTeamSplit(b, matrix));
  return splits;
}
