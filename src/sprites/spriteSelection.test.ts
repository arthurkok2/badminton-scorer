import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../domain/matchTypes';
import type { GlobalPlayer } from '../session/sessionTypes';
import { resolveLittleFighterSpriteIds } from './spriteSelection';

describe('resolveLittleFighterSpriteIds', () => {
  it('prefers one-off overrides, then global player sprite ids, then fallback slot sprites', () => {
    const playerOne: GlobalPlayer = {
      id: 'player-1',
      displayName: 'Alice',
      searchName: 'alice',
      createdBy: 'uid-1',
      claimStatus: 'guest',
      globalIndividualElo: 1500,
      globalMatchCount: 0,
      statsVersion: 1,
      spriteId: 'male-defense',
    };

    const playerTwo: GlobalPlayer = {
      id: 'player-2',
      displayName: 'Bob',
      searchName: 'bob',
      createdBy: 'uid-1',
      claimStatus: 'guest',
      globalIndividualElo: 1500,
      globalMatchCount: 0,
      statsVersion: 1,
    };

    const playerSlots: Readonly<Record<PlayerId, { readonly playerId?: string }>> = {
      A1: { playerId: 'player-1' },
      A2: { playerId: 'player-2' },
      B1: { playerId: 'player-1' },
      B2: {},
    };

    const oneOffOverrides = {
      B1: 'female-drive',
    } as const;

    const globalPlayersById: Readonly<Record<string, GlobalPlayer>> = {
      'player-1': playerOne,
      'player-2': playerTwo,
    };

    expect(resolveLittleFighterSpriteIds({ playerSlots, oneOffOverrides, globalPlayersById })).toEqual({
      A1: 'male-defense',
      A2: 'male-clear',
      B1: 'female-drive',
      B2: 'male-jump-smash',
    });
  });
});
