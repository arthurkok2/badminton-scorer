import type { LittleFighterSpriteId, LittleFighterSpriteOption } from '../sprites/spriteCatalog';

interface SpritePickerModalProps {
  readonly playerName: string;
  readonly selectedSpriteId: LittleFighterSpriteId;
  readonly spriteOptions: readonly LittleFighterSpriteOption[];
  readonly saveState: 'idle' | 'saving' | 'error';
  readonly errorMessage?: string;
  readonly onSelect: (spriteId: LittleFighterSpriteId) => void;
}

export function SpritePickerModal({
  playerName,
  selectedSpriteId,
  spriteOptions,
  saveState,
  errorMessage,
  onSelect,
}: SpritePickerModalProps) {
  return (
    <div className="sprite-picker">
      <p className="settings-note">Choose a badminton sprite for {playerName}.</p>
      {errorMessage ? <p className="controller-error-message">{errorMessage}</p> : null}
      <div className="sprite-picker-grid" role="list" aria-label={`${playerName} sprite options`}>
        {spriteOptions.map((sprite) => (
          <button
            key={sprite.id}
            className={sprite.id === selectedSpriteId ? 'sprite-picker-tile is-selected' : 'sprite-picker-tile'}
            type="button"
            aria-pressed={sprite.id === selectedSpriteId}
            aria-label={sprite.name}
            disabled={saveState === 'saving'}
            onClick={() => onSelect(sprite.id)}
          >
            <img src={sprite.src} alt="" aria-hidden="true" />
            <span>{sprite.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
