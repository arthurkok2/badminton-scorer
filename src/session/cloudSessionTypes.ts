import type { LittleFighterSpriteId } from '../sprites/spriteCatalog';
import type { EloSnapshot } from './elo';

export interface GlobalPlayerDocument {
  readonly id: string;
  readonly displayName: string;
  readonly searchName: string;
  readonly createdBy: string;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
  readonly claimStatus: 'guest' | 'claimed' | 'verified';
  readonly linkedUid?: string;
  readonly spriteId?: LittleFighterSpriteId;
  readonly globalIndividualElo: number;
  readonly globalMatchCount: number;
  readonly statsVersion: number;
}

export interface GlobalPairDocument {
  readonly id: string;
  readonly playerIds: readonly [string, string];
  readonly displayNames: readonly [string, string];
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
  readonly globalPairElo: number;
  readonly globalMatchCount: number;
  readonly statsVersion: number;
}

export interface GlobalMatchDocument {
  readonly id: string;
  readonly submittedBy: string;
  readonly sessionId: string;
  readonly sourcePath: string;
  readonly matchNumber: number;
  readonly teamAPlayerIds: readonly [string, string];
  readonly teamBPlayerIds: readonly [string, string];
  readonly teamAPairId: string;
  readonly teamBPairId: string;
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly finalScore?: { readonly teamA: number; readonly teamB: number };
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly globalIndividualElo: Readonly<Record<string, EloSnapshot>>;
  readonly globalPairElo: Readonly<Record<string, EloSnapshot>>;
  readonly status: 'submitted';
  readonly createdAt: unknown;
}
