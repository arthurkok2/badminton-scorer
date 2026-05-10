import { createGestureInterpreter } from './gestureInterpreter';
import type { AppCommand } from './commands';

export type BluetoothStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';
export type RemoteButtonEvent = 'press' | 'release' | 'unknown';

const DEFAULT_REMOTE_SERVICE: BluetoothServiceUUID = 'battery_service';
const DEFAULT_REMOTE_CHARACTERISTIC: BluetoothCharacteristicUUID = 'battery_level';

interface BluetoothRemoteOptions {
  dispatch: (command: AppCommand) => void;
  onStatusChange: (status: BluetoothStatus) => void;
  navigatorLike?: Navigator;
  serviceUuid?: BluetoothServiceUUID;
  characteristicUuid?: BluetoothCharacteristicUUID;
  setInterval?: (callback: () => void, delay: number) => number;
  clearInterval?: (intervalId: number) => void;
  now?: () => number;
}

export interface BluetoothRemoteConnection {
  disconnect(): void;
}

export function getBluetoothSupportStatus(
  navigatorLike: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): BluetoothStatus {
  return navigatorLike !== undefined && 'bluetooth' in navigatorLike ? 'disconnected' : 'unsupported';
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

function readRemoteValue(event: Event): Uint8Array | undefined {
  const value = (event.target as { value?: DataView | Uint8Array } | null)?.value;

  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  return undefined;
}

export async function connectBluetoothRemote(options: BluetoothRemoteOptions): Promise<BluetoothRemoteConnection | undefined> {
  const navigatorLike = options.navigatorLike ?? (typeof navigator === 'undefined' ? undefined : navigator);

  if (navigatorLike === undefined || !('bluetooth' in navigatorLike)) {
    options.onStatusChange('unsupported');
    return undefined;
  }

  options.onStatusChange('connecting');
  const bluetooth = navigatorLike.bluetooth;
  const serviceUuid = options.serviceUuid ?? DEFAULT_REMOTE_SERVICE;
  const characteristicUuid = options.characteristicUuid ?? DEFAULT_REMOTE_CHARACTERISTIC;
  const now = options.now ?? (() => performance.now());
  const setFlushInterval = options.setInterval ?? ((callback, delay) => window.setInterval(callback, delay));
  const clearFlushInterval = options.clearInterval ?? ((intervalId) => window.clearInterval(intervalId));
  const interpreter = createGestureInterpreter(options.dispatch);

  try {
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [serviceUuid],
    });
    const gattServer = await device.gatt?.connect();

    if (gattServer === undefined) {
      options.onStatusChange('disconnected');
      return undefined;
    }

    const service = await gattServer.getPrimaryService(serviceUuid);
    const characteristic = await service.getCharacteristic(characteristicUuid);
    await characteristic.startNotifications();

    let isDisconnected = false;
    let flushIntervalId: number | undefined;

    const handleCharacteristicValueChanged = (event: Event): void => {
      const value = readRemoteValue(event);

      if (value === undefined) {
        return;
      }

      const remoteEvent = translateRemoteValue(value);

      if (remoteEvent === 'press') {
        interpreter.handlePress(now());
        return;
      }

      if (remoteEvent === 'release') {
        interpreter.handleRelease(now());
      }
    };

    const cleanup = (): void => {
      if (flushIntervalId !== undefined) {
        clearFlushInterval(flushIntervalId);
        flushIntervalId = undefined;
      }

      characteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
      device.removeEventListener('gattserverdisconnected', handleDisconnected);
    };

    const handleDisconnected = (): void => {
      if (isDisconnected) {
        return;
      }

      isDisconnected = true;
      cleanup();
      options.onStatusChange('disconnected');
    };

    characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
    device.addEventListener('gattserverdisconnected', handleDisconnected);
    flushIntervalId = setFlushInterval(() => {
      interpreter.flush(now());
    }, 100);
    options.onStatusChange('connected');

    return {
      disconnect() {
        if (isDisconnected) {
          return;
        }

        isDisconnected = true;
        cleanup();
        gattServer.disconnect();
        options.onStatusChange('disconnected');
      },
    };
  } catch {
    options.onStatusChange('disconnected');
    return undefined;
  }
}
