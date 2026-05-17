import { Bluetooth, Radio } from 'lucide-react';
import type { BluetoothStatus } from '../input/bluetoothRemote';
import type { WatchRemoteHostStatus } from '../remote/firestoreRemoteTypes';

interface RemoteControlsModalProps {
  readonly bluetoothStatus: BluetoothStatus;
  readonly watchRemote: {
    readonly status: WatchRemoteHostStatus;
    readonly code?: string;
    readonly error?: string;
    readonly lastCommandLabel?: string;
  };
  readonly authUnavailable: boolean;
  readonly onConnectBluetooth: () => void;
  readonly onStartWatchRemote: () => void;
  readonly onStopWatchRemote: () => void;
}

export function RemoteControlsModal({
  bluetoothStatus,
  watchRemote,
  authUnavailable,
  onConnectBluetooth,
  onStartWatchRemote,
  onStopWatchRemote,
}: RemoteControlsModalProps) {
  const bluetoothUnsupported = bluetoothStatus === 'unsupported';

  return (
    <div className="settings-panel">
      <section className="settings-section" aria-label="Bluetooth remote">
        <h3>Bluetooth remote</h3>
        <div className="status-item">
          <Bluetooth size={18} aria-hidden="true" />
          <span>{bluetoothLabel(bluetoothStatus)}</span>
        </div>
        <button
          className="connect-button"
          type="button"
          onClick={onConnectBluetooth}
          disabled={bluetoothUnsupported || bluetoothStatus === 'connecting'}
          aria-label="Connect Bluetooth remote"
        >
          {bluetoothStatus === 'connecting' ? 'Connecting' : 'Connect'}
        </button>
      </section>

      <section className="settings-section" aria-label="Watch remote">
        <h3>Watch remote</h3>
        <div className="status-item">
          <Radio size={18} aria-hidden="true" />
          <span>Watch remote {watchRemote.status}</span>
        </div>
        {(watchRemote.status === 'inactive' || watchRemote.status === 'error') ? (
          <button type="button" onClick={onStartWatchRemote} disabled={authUnavailable}>
            Start watch remote
          </button>
        ) : null}
        {watchRemote.status === 'starting' ? <span className="watch-remote-status">Starting...</span> : null}
        {watchRemote.status === 'active' ? (
          <>
            {watchRemote.code ? <div className="watch-remote-code">{watchRemote.code}</div> : null}
            {watchRemote.lastCommandLabel ? (
              <div className="watch-remote-status">Last: {watchRemote.lastCommandLabel}</div>
            ) : null}
            <button type="button" onClick={onStopWatchRemote}>End remote</button>
          </>
        ) : null}
        {watchRemote.status === 'stopping' ? <button type="button" disabled>Stopping...</button> : null}
        {watchRemote.status === 'error' && watchRemote.error ? (
          <div className="watch-remote-status" role="alert">{watchRemote.error}</div>
        ) : null}
        {authUnavailable ? <p className="settings-note">Watch remote unavailable offline.</p> : null}
      </section>
    </div>
  );
}

function bluetoothLabel(status: BluetoothStatus): string {
  if (status === 'unsupported') return 'Bluetooth unsupported: Android Chrome required';
  if (status === 'connected') return 'Bluetooth connected';
  if (status === 'connecting') return 'Bluetooth connecting';
  return 'Bluetooth disconnected';
}
