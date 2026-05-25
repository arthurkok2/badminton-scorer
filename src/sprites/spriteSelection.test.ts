import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../domain/matchTypes';
import type { LittleFighterSpriteId } from './spriteCatalog';
import { resolveLittleFighterSpriteIds } from './spriteSelection';

describe('resolveLittleFighterSpriteIds', () => {
  it('prefers one-off overrides, then sprite id map entries, then fallback slot sprites', () => {
    const playerSlots: Readonly<Record<PlayerId, { readonly playerId?: string }>> = {
      A1: { playerId: 'player-1' },
      A2: { playerId: 'player-2' },
      B1: { playerId: 'player-1' },
      B2: {},
    };

    const oneOffOverrides = {
      B1: 'female-drive',
    } as const;

    const spriteIdMap: Readonly<Record<string, LittleFighterSpriteId | undefined>> = {
      'player-1': 'male-defense',
    };

    expect(resolveLittleFighterSpriteIds({ playerSlots, oneOffOverrides, spriteIdMap })).toEqual({
      A1: 'male-defense',
      A2: 'male-clear',
      B1: 'female-drive',
      B2: 'male-jump-smash',
    });
  });
});
