import type { PlayerId } from '../domain/matchTypes';
import type { LittleFighterSpriteId } from './spriteCatalog';

const FALLBACK_SLOT_SPRITES: Readonly<Record<PlayerId, LittleFighterSpriteId>> = {
  A1: 'female-ace',
  A2: 'male-clear',
  B1: 'female-drive',
  B2: 'male-jump-smash',
};

export function resolveLittleFighterSpriteIds(options: {
  readonly playerSlots: Readonly<Record<PlayerId, { readonly playerId?: string }>>;
  readonly oneOffOverrides: Partial<Record<PlayerId, LittleFighterSpriteId>>;
  readonly spriteIdMap: Readonly<Record<string, LittleFighterSpriteId | undefined>>;
}): Record<PlayerId, LittleFighterSpriteId> {
  const { playerSlots, oneOffOverrides, spriteIdMap } = options;

  return {
    A1: resolveSlotSpriteId('A1', playerSlots, oneOffOverrides, spriteIdMap),
    A2: resolveSlotSpriteId('A2', playerSlots, oneOffOverrides, spriteIdMap),
    B1: resolveSlotSpriteId('B1', playerSlots, oneOffOverrides, spriteIdMap),
    B2: resolveSlotSpriteId('B2', playerSlots, oneOffOverrides, spriteIdMap),
  };
}

function resolveSlotSpriteId(
  playerId: PlayerId,
  playerSlots: Readonly<Record<PlayerId, { readonly playerId?: string }>>,
  oneOffOverrides: Partial<Record<PlayerId, LittleFighterSpriteId>>,
  spriteIdMap: Readonly<Record<string, LittleFighterSpriteId | undefined>>,
): LittleFighterSpriteId {
  const globalPlayerId = playerSlots[playerId].playerId;
  const savedSpriteId = globalPlayerId ? spriteIdMap[globalPlayerId] : undefined;

  return oneOffOverrides[playerId] ?? savedSpriteId ?? FALLBACK_SLOT_SPRITES[playerId];
}
