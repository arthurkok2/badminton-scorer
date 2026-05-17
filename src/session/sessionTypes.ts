// src/session/sessionTypes.ts

export interface SessionPlayer {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly consecutiveStreak: number;
  readonly onBreak: boolean;
}

export interface TeamSplit {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
}

export interface MatchRecord {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly startedAt?: string;
  readonly endedAt?: string;
}

export interface PairingMatrix {
  readonly together: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly against: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface MatchSuggestion {
  readonly rankedSplits: readonly [TeamSplit, TeamSplit, TeamSplit];
  readonly onBreak: readonly string[];
}

export interface ActiveSession {
  readonly id: string;
  readonly startedAt: string;
  readonly players: readonly SessionPlayer[];
  readonly matches: readonly MatchRecord[];
  readonly pairingMatrix: PairingMatrix;
}

export interface ArchivedPlayer {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly breaksTaken: number;
}

export interface ArchivedSession {
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly players: readonly ArchivedPlayer[];
  readonly matches: readonly MatchRecord[];
}
