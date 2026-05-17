import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisplaySettingsModal } from './DisplaySettingsModal';

describe('DisplaySettingsModal', () => {
  it('updates the animations preference', async () => {
    const onAnimationsEnabledChange = vi.fn();
    render(<DisplaySettingsModal animationsEnabled={true} onAnimationsEnabledChange={onAnimationsEnabledChange} />);

    await userEvent.click(screen.getByRole('switch', { name: /animations/i }));

    expect(onAnimationsEnabledChange).toHaveBeenCalledWith(false);
  });
});
