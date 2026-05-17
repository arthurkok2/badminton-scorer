import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnnouncementSettingsModal } from './AnnouncementSettingsModal';

describe('AnnouncementSettingsModal', () => {
  it('updates auto announce and announcement mode', async () => {
    const user = userEvent.setup();
    const onAutoAnnounceChange = vi.fn();
    const onAnnouncementModeChange = vi.fn();
    render(
      <AnnouncementSettingsModal
        autoAnnounce={false}
        announcementMode="full"
        speechStatus="available"
        onAutoAnnounceChange={onAutoAnnounceChange}
        onAnnouncementModeChange={onAnnouncementModeChange}
      />,
    );

    await user.click(screen.getByRole('switch', { name: /auto announce/i }));
    await user.click(screen.getByRole('button', { name: /short announcement/i }));

    expect(onAutoAnnounceChange).toHaveBeenCalledWith(true);
    expect(onAnnouncementModeChange).toHaveBeenCalledWith('short');
    expect(screen.getByText(/speech ready/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /announce score/i })).not.toBeInTheDocument();
  });
});
