import type { PlayerId } from '../domain/matchTypes';
import type { GlobalPlayer } from '../session/sessionTypes';
import type { LittleFighterSpriteId } from './spriteCatalog';

export const FALLBACK_SLOT_SPRITES: Readonly<Record<PlayerId, LittleFighterSpriteId>> = {
  A1: 'female-ace',
  A2: 'male-clear',
  B1: 'female-drive',
  B2: 'male-jump-smash',
};

export function resolveLittleFighterSpriteIds(options: {
  readonly playerSlots: Readonly<Record<PlayerId, { readonly playerId?: string }>>;
  readonly oneOffOverrides: Partial<Record<PlayerId, LittleFighterSpriteId>>;
  readonly globalPlayersById: Readonly<Record<string, GlobalPlayer>>;
}): Record<PlayerId, LittleFighterSpriteId> {
  const { playerSlots, oneOffOverrides, globalPlayersById } = options;

  return {
    A1: resolveSlotSpriteId('A1', playerSlots, oneOffOverrides, globalPlayersById),
    A2: resolveSlotSpriteId('A2', playerSlots, oneOffOverrides, globalPlayersById),
    B1: resolveSlotSpriteId('B1', playerSlots, oneOffOverrides, globalPlayersById),
    B2: resolveSlotSpriteId('B2', playerSlots, oneOffOverrides, globalPlayersById),
  };
}

function resolveSlotSpriteId(
  playerId: PlayerId,
  playerSlots: Readonly<Record<PlayerId, { readonly playerId?: string }>>,
  oneOffOverrides: Partial<Record<PlayerId, LittleFighterSpriteId>>,
  globalPlayersById: Readonly<Record<string, GlobalPlayer>>,
): LittleFighterSpriteId {
  const globalPlayerId = playerSlots[playerId].playerId;
  const globalPlayer = globalPlayerId ? globalPlayersById[globalPlayerId] : undefined;

  return oneOffOverrides[playerId] ?? globalPlayer?.spriteId ?? FALLBACK_SLOT_SPRITES[playerId];
}
