import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SpritePickerModal } from './SpritePickerModal';
import { LITTLE_FIGHTER_SPRITES } from '../sprites/spriteCatalog';

describe('SpritePickerModal', () => {
  it('renders the roster and reports the selected sprite id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <SpritePickerModal
        playerName="Alice"
        selectedSpriteId="female-ace"
        spriteOptions={LITTLE_FIGHTER_SPRITES}
        saveState="idle"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: /female net/i }));

    expect(onSelect).toHaveBeenCalledWith('female-net');
    expect(screen.getByRole('button', { name: /female ace/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
