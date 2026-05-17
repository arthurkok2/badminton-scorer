import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisplaySettingsModal } from './DisplaySettingsModal';

describe('DisplaySettingsModal', () => {
  it('updates the animations preference', async () => {
    const onAnimationsEnabledChange = vi.fn();
    render(
      <DisplaySettingsModal
        animationsEnabled={true}
        showSessionHistoryDuringLiveMatches={true}
        onAnimationsEnabledChange={onAnimationsEnabledChange}
        onShowSessionHistoryDuringLiveMatchesChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('switch', { name: /animations/i }));

    expect(onAnimationsEnabledChange).toHaveBeenCalledWith(false);
  });

  it('updates the live session history preference', async () => {
    const onShowSessionHistoryDuringLiveMatchesChange = vi.fn();
    render(
      <DisplaySettingsModal
        animationsEnabled={true}
        showSessionHistoryDuringLiveMatches={true}
        onAnimationsEnabledChange={vi.fn()}
        onShowSessionHistoryDuringLiveMatchesChange={onShowSessionHistoryDuringLiveMatchesChange}
      />,
    );

    await userEvent.click(screen.getByRole('switch', { name: /show session match history/i }));

    expect(onShowSessionHistoryDuringLiveMatchesChange).toHaveBeenCalledWith(false);
  });
});
