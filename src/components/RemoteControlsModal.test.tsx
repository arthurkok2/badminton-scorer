import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RemoteControlsModal } from './RemoteControlsModal';

describe('RemoteControlsModal', () => {
  it('shows Bluetooth and inactive watch remote controls', async () => {
    const onConnectBluetooth = vi.fn();
    const onStartWatchRemote = vi.fn();
    render(
      <RemoteControlsModal
        bluetoothStatus="disconnected"
        watchRemote={{ status: 'inactive', code: undefined, error: undefined, lastCommandLabel: undefined }}
        authUnavailable={false}
        onConnectBluetooth={onConnectBluetooth}
        onStartWatchRemote={onStartWatchRemote}
        onStopWatchRemote={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /connect bluetooth remote/i }));
    await userEvent.click(screen.getByRole('button', { name: /start watch remote/i }));

    expect(onConnectBluetooth).toHaveBeenCalledTimes(1);
    expect(onStartWatchRemote).toHaveBeenCalledTimes(1);
  });

  it('shows active watch remote code and stop action', async () => {
    const onStopWatchRemote = vi.fn();
    render(
      <RemoteControlsModal
        bluetoothStatus="unsupported"
        watchRemote={{ status: 'active', code: 'ABC123', error: undefined, lastCommandLabel: 'Team A point' }}
        authUnavailable={false}
        onConnectBluetooth={vi.fn()}
        onStartWatchRemote={vi.fn()}
        onStopWatchRemote={onStopWatchRemote}
      />,
    );

    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText(/last: team a point/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /end remote/i }));
    expect(onStopWatchRemote).toHaveBeenCalledTimes(1);
  });
});
