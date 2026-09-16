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

// Longest run of matches a player can be picked for while others are level on games played,
// so court time is spread through the session rather than bunched into one long stint.
const MAX_CONSECUTIVE_MATCHES = 4;

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

export function selectNextPlayers(
  players: readonly GlobalSessionPlayer[],
  matrix: PairingMatrix,
  recentMatchPlayerIds: readonly (readonly string[])[] = [],
): {
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

  // Fisher-Yates shuffle so ties in gamesPlayed and in shared-court history resolve
  // with uniform probability rather than by insertion order.
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Fewest games played always play, which keeps court time even. Whoever is level with the
  // fourth-fewest competes for the remaining slots on variety instead: the foursome that has
  // shared a court least wins. Rotating strictly by who sat out last (the previous rule) let
  // an even-sized roster settle into fixed groups that only ever played each other.
  const byGamesPlayed = [...shuffled].sort((a, b) => a.gamesPlayed - b.gamesPlayed);
  const cutoff = byGamesPlayed[3].gamesPlayed;
  const mustPlay = byGamesPlayed.filter(player => player.gamesPlayed < cutoff);
  const contenders = byGamesPlayed.filter(player => player.gamesPlayed === cutoff);

  // Whenever everyone is level on games played the variety score alone decides, and it has no
  // reason to bring back whoever just sat out or to rest whoever has been on all night. Two
  // filters keep the rotation humane before variety picks from what is left.
  const playedLastMatch = (player: GlobalSessionPlayer) =>
    recentMatchPlayerIds.length === 0 || recentMatchPlayerIds[0].includes(player.id);
  const consecutiveMatches = (player: GlobalSessionPlayer) => {
    let played = 0;
    for (const ids of recentMatchPlayerIds) {
      if (!ids.includes(player.id)) break;
      played++;
    }
    return played;
  };

  const combinations = combinationsOf(contenders, 4 - mustPlay.length);
  const selectedIdsOf = (combination: readonly GlobalSessionPlayer[]) =>
    new Set([...mustPlay, ...combination].map(player => player.id));

  // Nobody sits two matches running — but only where a single player sits out, meaning a
  // 5-player roster. There the foursome is decided entirely by who sits, so every foursome
  // comes up equally often whatever order they are picked in and bringing the last sitter
  // straight back costs no variety. On bigger rosters it narrows which foursomes can follow,
  // and on 8 the players who sat out are exactly the four open slots, so it would rebuild the
  // fixed groups the variety score exists to break up.
  const backOn =
    players.length - 4 === 1
      ? combinations.filter(combination => {
          const ids = selectedIdsOf(combination);
          return contenders.every(player => playedLastMatch(player) || ids.has(player.id));
        })
      : combinations;
  const afterSitOuts = backOn.length > 0 ? backOn : combinations;

  // Nobody plays more than MAX_CONSECUTIVE_MATCHES in a row. With 5 players this is what turns
  // the rotation into a steady four-on, one-off cycle; larger rosters rarely reach the cap.
  const rested = afterSitOuts.filter(combination => {
    const ids = selectedIdsOf(combination);
    return contenders.every(
      player => consecutiveMatches(player) < MAX_CONSECUTIVE_MATCHES || !ids.has(player.id),
    );
  });
  const candidates = rested.length > 0 ? rested : afterSitOuts;

  let selected: readonly GlobalSessionPlayer[] = [];
  let lowestCost = Number.POSITIVE_INFINITY;
  for (const combination of candidates) {
    const four = [...mustPlay, ...combination];
    const cost = sharedCourtCost(four, matrix);
    if (cost < lowestCost) {
      lowestCost = cost;
      selected = four;
    }
  }
  if (selected.length < 4) throw new Error('selectNextPlayers: not enough players after prioritization');

  const selectedIds = new Set(selected.map(player => player.id));
  return {
    selected: selected as unknown as readonly [GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer, GlobalSessionPlayer],
    onBreak: byGamesPlayed.filter(player => !selectedIds.has(player.id)),
  };
}

function combinationsOf<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [
    ...combinationsOf(rest, size - 1).map(combination => [head, ...combination]),
    ...combinationsOf(rest, size),
  ];
}

// How often these four have already shared a court, counting partnerships and head-to-heads
// alike, so the least familiar foursome scores lowest.
function sharedCourtCost(four: readonly GlobalSessionPlayer[], matrix: PairingMatrix): number {
  let cost = 0;
  for (let i = 0; i < four.length; i++) {
    for (let j = i + 1; j < four.length; j++) {
      cost += getPairCount(matrix.together, four[i].id, four[j].id);
      cost += getPairCount(matrix.against, four[i].id, four[j].id);
    }
  }
  return cost;
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
  const recentMatchPlayerIds = session.matches
    .slice(-MAX_CONSECUTIVE_MATCHES)
    .reverse()
    .map(match => [...match.teamAPlayerIds, ...match.teamBPlayerIds]);
  const { selected, onBreak } = selectNextPlayers(session.players, session.pairingMatrix, recentMatchPlayerIds);
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
    playedIds.has(player.id) ? { ...player, gamesPlayed: player.gamesPlayed + 1 } : player,
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
