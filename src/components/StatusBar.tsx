import { Bluetooth, Radio } from 'lucide-react';
import type { BluetoothStatus } from '../input/bluetoothRemote';
import type { SpeechStatus } from '../speech/announcer';

interface StatusBarProps {
  readonly bluetoothStatus: BluetoothStatus;
  readonly speechStatus: SpeechStatus;
  readonly onConnectBluetooth: () => void;
}

export function StatusBar({ bluetoothStatus, speechStatus, onConnectBluetooth }: StatusBarProps) {
  const bluetoothUnsupported = bluetoothStatus === 'unsupported';

  return (
    <section className="status-bar" aria-label="Device status">
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
      <div className="status-item">
        <Radio size={18} aria-hidden="true" />
        <span>Speech {speechStatus === 'available' ? 'ready' : 'unsupported'}</span>
      </div>
    </section>
  );
}

function bluetoothLabel(status: BluetoothStatus): string {
  if (status === 'unsupported') {
    return 'Bluetooth unsupported: Android Chrome required';
  }

  if (status === 'connected') {
    return 'Bluetooth connected';
  }

  if (status === 'connecting') {
    return 'Bluetooth connecting';
  }

  return 'Bluetooth disconnected';
}
