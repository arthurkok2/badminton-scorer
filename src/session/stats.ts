import type { MatchRecord } from './sessionTypes';

export interface PlayerStats {
  readonly displayName: string;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly recentForm: readonly ('W' | 'L')[];
}

export interface PairStats {
  readonly displayNames: readonly [string, string];
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
}

export interface MatchupStats {
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
}

export interface StatsSummary {
  readonly players: Readonly<Record<string, PlayerStats>>;
  readonly pairs: Readonly<Record<string, PairStats>>;
  readonly matchups: Readonly<Record<string, MatchupStats>>;
  readonly ratedMatchCount: number;
  readonly statsVersion: 1;
}

interface MutablePlayerStats {
  displayName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  recentForm: ('W' | 'L')[];
}

interface MutablePairStats {
  displayNames: [string, string];
  matchesPlayed: number;
  wins: number;
  losses: number;
}

interface MutableMatchupStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
}

export function buildStatsSummary(matches: readonly MatchRecord[]): StatsSummary {
  const players: Record<string, MutablePlayerStats> = {};
  const pairs: Record<string, MutablePairStats> = {};
  const matchups: Record<string, MutableMatchupStats> = {};

  for (const match of matches) {
    applyMatch(match, players, pairs, matchups);
  }

  return {
    players: mapValues(players, finalizePlayer),
    pairs: mapValues(pairs, finalizePair),
    matchups: mapValues(matchups, finalizeMatchup),
    ratedMatchCount: matches.length,
    statsVersion: 1,
  };
}

function applyMatch(
  match: MatchRecord,
  players: Record<string, MutablePlayerStats>,
  pairs: Record<string, MutablePairStats>,
  matchups: Record<string, MutableMatchupStats>,
): void {
  const teamAWon = match.winnerTeam === 'teamA';
  const teamA = match.teamAPlayerIds;
  const teamB = match.teamBPlayerIds;

  for (const [index, id] of teamA.entries()) {
    incrementPlayer(players, id, match.teamADisplayNames[index]!, teamAWon);
  }
  for (const [index, id] of teamB.entries()) {
    incrementPlayer(players, id, match.teamBDisplayNames[index]!, !teamAWon);
  }

  incrementPair(pairs, match.teamAPairId, match.teamADisplayNames, teamAWon);
  incrementPair(pairs, match.teamBPairId, match.teamBDisplayNames, !teamAWon);

  for (const playerA of teamA) {
    for (const playerB of teamB) {
      incrementMatchup(matchups, `${playerA}__vs__${playerB}`, teamAWon);
      incrementMatchup(matchups, `${playerB}__vs__${playerA}`, !teamAWon);
    }
  }
}

function incrementPlayer(
  players: Record<string, MutablePlayerStats>,
  playerId: string,
  displayName: string,
  won: boolean,
): void {
  if (!players[playerId]) {
    players[playerId] = {
      displayName,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      recentForm: [],
    };
  }

  const player = players[playerId]!;
  player.matchesPlayed += 1;
  if (won) {
    player.wins += 1;
    player.recentForm.push('W');
  } else {
    player.losses += 1;
    player.recentForm.push('L');
  }

  // Keep only last 5 entries
  if (player.recentForm.length > 5) {
    player.recentForm.splice(0, player.recentForm.length - 5);
  }
}

function incrementPair(
  pairs: Record<string, MutablePairStats>,
  pairId: string,
  displayNames: readonly string[],
  won: boolean,
): void {
  if (!pairs[pairId]) {
    pairs[pairId] = {
      displayNames: [displayNames[0]!, displayNames[1]!],
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
    };
  }

  const pair = pairs[pairId]!;
  pair.matchesPlayed += 1;
  if (won) {
    pair.wins += 1;
  } else {
    pair.losses += 1;
  }
}

function incrementMatchup(
  matchups: Record<string, MutableMatchupStats>,
  matchupKey: string,
  won: boolean,
): void {
  if (!matchups[matchupKey]) {
    matchups[matchupKey] = {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
    };
  }

  const matchup = matchups[matchupKey]!;
  matchup.matchesPlayed += 1;
  if (won) {
    matchup.wins += 1;
  } else {
    matchup.losses += 1;
  }
}

function finalizePlayer(player: MutablePlayerStats): PlayerStats {
  return {
    displayName: player.displayName,
    matchesPlayed: player.matchesPlayed,
    wins: player.wins,
    losses: player.losses,
    winRate: player.matchesPlayed > 0 ? player.wins / player.matchesPlayed : 0,
    recentForm: Object.freeze([...player.recentForm]),
  };
}

function finalizePair(pair: MutablePairStats): PairStats {
  return {
    displayNames: [pair.displayNames[0]!, pair.displayNames[1]!],
    matchesPlayed: pair.matchesPlayed,
    wins: pair.wins,
    losses: pair.losses,
    winRate: pair.matchesPlayed > 0 ? pair.wins / pair.matchesPlayed : 0,
  };
}

function finalizeMatchup(matchup: MutableMatchupStats): MatchupStats {
  return {
    matchesPlayed: matchup.matchesPlayed,
    wins: matchup.wins,
    losses: matchup.losses,
  };
}

function mapValues<T, U>(obj: Record<string, T>, fn: (v: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));
}
