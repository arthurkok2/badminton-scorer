export type LittleFighterSpriteId =
  | 'female-ace'
  | 'female-drop'
  | 'female-drive'
  | 'female-net'
  | 'male-clear'
  | 'male-defense'
  | 'male-jump-smash'
  | 'male-serve';

export interface LittleFighterSpriteOption {
  readonly id: LittleFighterSpriteId;
  readonly name: string;
  readonly src: string;
}

const SPRITE_BASE_URL = `${import.meta.env.BASE_URL}sprites/`;

export const LITTLE_FIGHTER_SPRITES: readonly LittleFighterSpriteOption[] = [
  { id: 'female-ace', name: 'Female Ace', src: `${SPRITE_BASE_URL}badminton-female-ace.png` },
  { id: 'female-drop', name: 'Female Drop', src: `${SPRITE_BASE_URL}badminton-female-drop.png` },
  { id: 'female-drive', name: 'Female Drive', src: `${SPRITE_BASE_URL}badminton-female-drive.png` },
  { id: 'female-net', name: 'Female Net', src: `${SPRITE_BASE_URL}badminton-female-net.png` },
  { id: 'male-clear', name: 'Male Clear', src: `${SPRITE_BASE_URL}badminton-male-clear.png` },
  { id: 'male-defense', name: 'Male Defense', src: `${SPRITE_BASE_URL}badminton-male-defense.png` },
  { id: 'male-jump-smash', name: 'Male Jump Smash', src: `${SPRITE_BASE_URL}badminton-male-jump-smash.png` },
  { id: 'male-serve', name: 'Male Serve', src: `${SPRITE_BASE_URL}badminton-male-serve.png` },
];

export const LITTLE_FIGHTER_SPRITES_BY_ID: Readonly<Record<LittleFighterSpriteId, LittleFighterSpriteOption>> =
  LITTLE_FIGHTER_SPRITES.reduce(
    (spritesById, sprite) => {
      spritesById[sprite.id] = sprite;
      return spritesById;
    },
    {} as Record<LittleFighterSpriteId, LittleFighterSpriteOption>,
  );
