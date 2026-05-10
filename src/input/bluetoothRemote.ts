import { createGestureInterpreter } from './gestureInterpreter';
import type { AppCommand } from './commands';

export type BluetoothStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';
export type RemoteButtonEvent = 'press' | 'release' | 'unknown';

interface BluetoothRemoteOptions {
  dispatch: (command: AppCommand) => void;
  onStatusChange: (status: BluetoothStatus) => void;
  now?: () => number;
}

export function getBluetoothSupportStatus(navigatorLike: Navigator = navigator): BluetoothStatus {
  return 'bluetooth' in navigatorLike ? 'disconnected' : 'unsupported';
}

export function translateRemoteValue(value: Uint8Array): RemoteButtonEvent {
  if (value[0] === 1) {
    return 'press';
  }

  if (value[0] === 0) {
    return 'release';
  }

  return 'unknown';
}

export async function connectBluetoothRemote(options: BluetoothRemoteOptions): Promise<void> {
  if (!('bluetooth' in navigator)) {
    options.onStatusChange('unsupported');
    return;
  }

  options.onStatusChange('connecting');
  const bluetooth = navigator.bluetooth;
  const now = options.now ?? (() => performance.now());
  const interpreter = createGestureInterpreter(options.dispatch);

  try {
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service', 'device_information'],
    });

    device.addEventListener('gattserverdisconnected', () => {
      options.onStatusChange('disconnected');
    });

    options.onStatusChange('connected');

    window.setInterval(() => {
      interpreter.flush(now());
    }, 100);
  } catch {
    options.onStatusChange('disconnected');
  }
}
