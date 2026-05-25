import type { GlobalPlayer, GlobalSessionPlayer } from './sessionTypes';

export function normalizePlayerSearchName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function createPairId(a: string, b: string): string {
  if (a.includes('__') || b.includes('__')) {
    throw new Error('Player ids used in pair ids must not contain "__".');
  }

  return [a, b].sort().join('__');
}

export function createGlobalPlayer({
  id,
  displayName,
  createdBy,
}: {
  readonly id: string;
  readonly displayName: string;
  readonly createdBy: string;
}): GlobalPlayer {
  return {
    id,
    displayName: displayName.trim(),
    searchName: normalizePlayerSearchName(displayName),
    createdBy,
    claimStatus: 'guest',
    globalIndividualElo: 1500,
    globalMatchCount: 0,
    statsVersion: 1,
  };
}

export function toSessionPlayer(player: GlobalPlayer): GlobalSessionPlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    gamesPlayed: 0,
    consecutiveStreak: 0,
    onBreak: true,
    spriteId: player.spriteId,
  };
}
