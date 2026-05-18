// src/session/sessionTypes.ts

/**
 * App-domain global player record. Persisted Firestore DTOs add createdAt and
 * updatedAt in the cloud session service layer.
 */
export interface GlobalPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly searchName: string;
  readonly createdBy: string;
  readonly claimStatus: 'guest' | 'claimed' | 'verified';
  readonly linkedUid?: string;
  readonly globalIndividualElo: number;
  readonly globalMatchCount: number;
  readonly statsVersion: number;
}

export interface LegacySessionPlayer {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly consecutiveStreak: number;
  readonly onBreak: boolean;
}

export interface GlobalSessionPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly gamesPlayed: number;
  readonly consecutiveStreak: number;
  readonly onBreak: boolean;
}

export interface TeamSplit {
  readonly teamA: readonly [GlobalSessionPlayer, GlobalSessionPlayer];
  readonly teamB: readonly [GlobalSessionPlayer, GlobalSessionPlayer];
}

export interface MatchRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly matchNumber: number;
  readonly teamAPlayerIds: readonly [string, string];
  readonly teamBPlayerIds: readonly [string, string];
  readonly teamADisplayNames: readonly [string, string];
  readonly teamBDisplayNames: readonly [string, string];
  readonly teamAPairId: string;
  readonly teamBPairId: string;
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly finalScore?: {
    readonly teamA: number;
    readonly teamB: number;
  };
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly globalMatchId?: string;
}

export interface LegacyTeamSplit {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
}

export interface LegacyMatchRecord {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly finalScore?: {
    readonly teamA: number;
    readonly teamB: number;
  };
  readonly startedAt?: string;
  readonly endedAt?: string;
}

export interface PairingMatrix {
  readonly together: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly against: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface MatchSuggestion {
  readonly rankedSplits: readonly [TeamSplit, TeamSplit, TeamSplit];
  readonly onBreak: readonly GlobalSessionPlayer[];
}

export interface ActiveSession {
  readonly id: string;
  readonly startedAt: string;
  readonly players: readonly GlobalSessionPlayer[];
  readonly matches: readonly MatchRecord[];
  readonly pairingMatrix: PairingMatrix;
}

export interface ArchivedPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly gamesPlayed: number;
  readonly breaksTaken: number;
}

export interface ArchivedSession {
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly players: readonly ArchivedPlayer[];
  readonly matches: readonly (MatchRecord | LegacyMatchRecord)[];
}
